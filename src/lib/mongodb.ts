import mongoose from "mongoose";
import { Employee } from "../models/Employee";

const MONGODB_URI = process.env.MONGODB_URI;

// Reuse a single connection across hot reloads in dev / serverless
// invocations to avoid exhausting MongoDB's connection limit.
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalForMongoose = globalThis as unknown as {
  mongoose?: MongooseCache;
};

const cache: MongooseCache = globalForMongoose.mongoose ?? {
  conn: null,
  promise: null,
};
globalForMongoose.mongoose = cache;

async function connectAndPrepare(uri: string): Promise<typeof mongoose> {
  const conn = await mongoose.connect(uri);

  // Brings Employee indexes in line with the schema: creates the unique
  // (case-insensitive) name index and drops the old unique email index, which
  // would otherwise reject every new employee that has no email.
  try {
    await Employee.syncIndexes();
  } catch (error) {
    console.error(
      "Could not sync Employee indexes — duplicate names may already exist in the database:",
      error
    );
  }

  return conn;
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set in the environment.");
  }

  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = connectAndPrepare(MONGODB_URI);
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    // Don't keep a rejected promise around, or every later request fails too.
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
