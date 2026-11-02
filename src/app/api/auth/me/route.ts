import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getClientStore,
  saveClientStore,
  mergeStores,
  hasProgress,
  hasDatabaseUrl,
  prisma,
} from "@/lib/db";

/**
 * Called by the client on load when a Google session may exist.
 *
 * Linking behaviour:
 *  - Signed out  -> returns email: null and the browser keeps its own id.
 *  - Signed in, account has no linked id yet -> the browser's current id
 *    becomes the account's canonical id (its progress now belongs to the account).
 *  - Signed in, account already linked to a different id -> the browser's
 *    local progress is merged into the account store once, and the client is
 *    told to switch its localStorage id to the account's canonical id.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const clientId = req.nextUrl.searchParams.get("clientId") || "";
  const email = session?.user?.email || null;
  const name = session?.user?.name || null;

  let resolvedClientId = clientId || null;

  if (email) {
    if (hasDatabaseUrl) {
      try {
        // Make sure the Google user exists as a row we can link progress to.
        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              name: session?.user?.name || null,
              image: session?.user?.image || null,
              clientId: clientId && clientId !== "anon" ? clientId : null,
            },
          });
        } else {
          // Keep profile fresh from Google.
          user = await prisma.user.update({
            where: { id: user.id },
            data: {
              name: session?.user?.name || user.name,
              image: session?.user?.image || user.image,
            },
          });
        }

        if (user.clientId) {
          resolvedClientId = user.clientId;
          // Merge this browser's progress into the account store exactly once.
          if (clientId && clientId !== "anon" && clientId !== user.clientId) {
            const accountStore = await getClientStore(user.clientId);
            const localStore = await getClientStore(clientId);
            if (hasProgress(localStore)) {
              await saveClientStore(user.clientId, mergeStores(accountStore, localStore));
            }
          }
        } else if (clientId && clientId !== "anon") {
          // First sign-in: adopt this browser's id as the account id.
          user = await prisma.user.update({
            where: { id: user.id },
            data: { clientId },
          });
          resolvedClientId = user.clientId;
        }

        // Ensure the account store carries the learner's Google name.
        if (resolvedClientId && name) {
          const store = await getClientStore(resolvedClientId);
          if (!store.name) {
            store.name = name.replace(/\s+/g, " ").trim().slice(0, 60);
            await saveClientStore(resolvedClientId, store);
          }
        }
      } catch (e) {
        console.error("auth/me linking failed:", e);
      }
    } else {
      // Development without a database: just stamp the name on the local store.
      if (clientId) {
        const store = await getClientStore(clientId);
        if (!store.name && name) {
          store.name = name;
          await saveClientStore(clientId, store);
        }
      }
    }
  }

  return NextResponse.json({
    email,
    name,
    image: session?.user?.image || null,
    clientId: resolvedClientId,
    mail: Boolean(process.env.GOOGLE_CLIENT_ID),
  });
}
