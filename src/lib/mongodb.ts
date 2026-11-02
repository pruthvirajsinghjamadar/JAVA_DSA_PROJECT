import { MongoClient, Db } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export function isMongoConfigured(): boolean {
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || "";
  return Boolean(
    uri &&
      (uri.startsWith("mongodb://") || uri.startsWith("mongodb+srv://")) &&
      !uri.includes("<password>") &&
      !uri.includes("<username>") &&
      !uri.includes("user:password")
  );
}

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

export async function getMongoClient(): Promise<MongoClient | null> {
  if (!isMongoConfigured()) return null;
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL || "";

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  } else {
    if (!clientPromise) {
      client = new MongoClient(uri);
      clientPromise = client.connect();
    }
    return clientPromise;
  }
}

export async function getMongoDb(): Promise<Db | null> {
  try {
    const client = await getMongoClient();
    if (!client) return null;
    return client.db();
  } catch (err) {
    console.warn("MongoDB Atlas connection error:", (err as any)?.message || err);
    return null;
  }
}
