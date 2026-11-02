import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { hasDatabaseUrl, prisma } from "@/lib/db";

function resolveSecret(): string | undefined {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    // Do not fall back to a predictable secret in production: anyone who knows
    // it could forge session cookies. Vercel builds run with NODE_ENV=production,
    // so a missing NEXTAUTH_SECRET fails fast here and shows up at build time.
    throw new Error(
      "NEXTAUTH_SECRET is not set. Generate one with `openssl rand -base64 32` and add it to your environment (Vercel: Project Settings > Environment Variables)."
    );
  }
  return "dev_only_secret_never_used_in_production";
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      // Persist the Google account so progress can be linked to it.
      if (hasDatabaseUrl && user?.email) {
        try {
          await prisma.user.upsert({
            where: { email: user.email },
            update: {
              name: user.name ?? undefined,
              image: user.image ?? undefined,
            },
            create: {
              email: user.email,
              name: user.name,
              image: user.image,
            },
          });
        } catch (e) {
          // Never block sign-in on a transient DB error.
          console.error("Failed to persist user on sign-in:", e);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.image = token.picture as string | null | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
  },
  secret: resolveSecret(),
};
