# Deployment Guide — Java + DSA Platform (100% Free)

Stack: **Next.js 16 (App Router) + NextAuth (Google) + Prisma/PostgreSQL**, deployed on **Vercel Hobby** with a **Neon Free** Postgres database.

No paid service is needed anywhere. The only external APIs used are Google's OAuth 2.0 endpoints (free) and your Postgres database (free tier).

---

## 1. What each piece does

| Piece | Service | Cost | Purpose |
|---|---|---|---|
| Hosting | Vercel Hobby | Free | Serves the Next.js app + API routes (serverless) |
| Database | Neon Free (0.5 GB) | Free | Stores learner progress + Google accounts (`LearnerState`, `User`, ...) |
| Auth | Google OAuth 2.0 via NextAuth v4 | Free | "Continue with Google" sign-in |
| Secret | `openssl rand -base64 32` | Free | Signs session cookies (`NEXTAUTH_SECRET`) |

Local development without any database still works: routes fall back to `data/local-store.json`.

---

## 2. One-time local setup

```bash
npm install                 # also runs `prisma generate` via postinstall
npx prisma db push          # creates the tables in your database (needs DATABASE_URL in .env.local)
npm run dev                 # http://localhost:3000
```

`.env.local` (copy from `.env.example`):

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
NEXTAUTH_SECRET=generate_me_with_openssl_rand_base64_32
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
ADMIN_KEY=some_long_random_admin_key
```

---

## 3. Google Cloud Console (OAuth credentials)

1. Go to https://console.cloud.google.com/ and create a project (free).
2. **APIs & Services → OAuth consent screen**
   - User type: **External**, fill the app name + your email.
   - Scopes: leave defaults (`email`, `profile`, `openid` are enough).
   - **Add yourself (and any testers) under "Test users"** — while the app is in "Testing" status only listed users can sign in.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://YOUR-PROJECT.vercel.app`
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://YOUR-PROJECT.vercel.app/api/auth/callback/google`
4. Copy the **Client ID** and **Client secret** into `.env.local` (local) and later into Vercel env vars.
5. When you are ready for real users, click **"Publish app"** on the consent screen (still free).

> The redirect URI path is always `/api/auth/callback/google` for the NextAuth Google provider.

---

## 4. Neon database (free Postgres)

1. Sign up at https://neon.tech (Free tier: 0.5 GB storage, autosuspend, enough for this app).
2. Create a project → copy the connection string. Use the **pooled** endpoint for serverless (Vercel):
   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
3. Put it in `.env.local`, then create the tables:
   ```bash
   npx prisma db push
   ```
   (Or use `npx prisma migrate dev --name init` if you prefer versioned migrations, then `npm run db:deploy` on Vercel is unnecessary — `db push` is enough for this project.)

Alternative free databases: **Supabase** (Postgres free tier, 500 MB) or **Vercel Postgres** — same `DATABASE_URL` format.

---

## 5. Deploy on Vercel

1. Push this repo to GitHub.
2. https://vercel.com → **Add New → Project** → import the repo (Hobby plan is free).
3. **Settings → Environment Variables** — add all of these (Production + Preview + Development):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Neon pooled URL |
   | `NEXTAUTH_SECRET` | `openssl rand -base64 32` output |
   | `NEXTAUTH_URL` | `https://YOUR-PROJECT.vercel.app` |
   | `GOOGLE_CLIENT_ID` | from Google Cloud Console |
   | `GOOGLE_CLIENT_SECRET` | from Google Cloud Console |
   | `ADMIN_KEY` | your admin dashboard key |

4. Deploy. Build command and output are auto-detected; `postinstall: prisma generate` runs during the build, so the Prisma client is ready.
5. After the first deploy, add the production URL to Google Console redirect URIs (step 3) if you haven't already.

### Updating the database schema later

After changing `prisma/schema.prisma`:

```bash
npx prisma db push        # applies changes directly to Neon
```

---

## 6. APIs this project exposes (all built in — no third-party APIs required)

Auth:
- `GET/POST /api/auth/[...nextauth]` — NextAuth (Google OAuth)
- `GET /api/auth/me?clientId=` — session info + account/progress linking

Course:
- `GET /api/course?clientId=`
- `POST /api/course/certificate`
- `GET /api/topics/[slug]?clientId=`
- `GET /api/topics/[slug]/code?clientId=`
- `GET /api/topics/[slug]/quiz?clientId=` · `POST /api/topics/[slug]/quiz`
- `PUT /api/topics/[slug]/read`
- `GET /api/questions/[id]/check` (quiz answer check)
- `GET /api/challenges/[id]/solution?clientId=`
- `POST /api/challenges/[id]/run` (Java evaluation — runs locally in Node, no external judge API)

Progress:
- `GET/PUT /api/learner/[clientId]`
- `GET /api/profile/[clientId]?clientId=`
- `PUT /api/progress/[clientId]`
- `PUT /api/sheet/[key]`
- `GET /api/daily?clientId=`
- `GET /api/practice?clientId=`
- `POST /api/preview/skip` · `POST /api/preview/finish-all`

Public:
- `GET /api/certificates/[code]` — certificate verification

Admin (require `ADMIN_KEY`):
- `POST /api/admin/check` · `GET /api/admin/stats` · `GET /api/admin/usage` · `GET /api/admin/github`

Java code execution note: challenge runs are evaluated by the built-in `src/lib/java-evaluator.ts` (no JVM on Vercel's free functions). If you later want real compilation, wire in a free-tier Judge0 self-host or an external sandbox — nothing is required to deploy today.

---

## 7. How Google sign-in ties to progress

1. Progress is stored per `clientId` (a random id in localStorage).
2. On first Google sign-in the server links that id to your `User` row (`User.clientId`).
3. Signing in on another device merges that device's local progress into the account and switches the browser to the account id — so progress follows the account.
4. Signing out clears the local id so the next visitor starts anonymous.
