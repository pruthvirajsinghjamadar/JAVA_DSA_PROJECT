import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { hasDatabaseUrl, prisma } from "@/lib/db";

function resolveSecret(): string | undefined {
  if (process.env.NEXTAUTH_SECRET) return process.env.NEXTAUTH_SECRET;
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "NEXTAUTH_SECRET is not set. Generate one with `openssl rand -base64 32` and add it to your environment (Vercel: Project Settings > Environment Variables)."
    );
    return "fallback_secret_please_set_nextauth_secret";
  }
  return "dev_only_secret_never_used_in_production";
}

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID.trim(),
            clientSecret: process.env.GOOGLE_CLIENT_SECRET.trim(),
            authorization: {
              params: {
                prompt: "select_account",
                access_type: "offline",
                response_type: "code",
              },
            },
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
    error: "/signin",
  },
  secret: resolveSecret(),
};
