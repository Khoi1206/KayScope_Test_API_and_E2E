import { MongoClient } from 'mongodb'

// The environment variable must be set in .env.local
const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable in .env.local'
  )
}

/**
 * Declare a module-level global to cache the MongoClient across hot reloads
 * in development (Next.js HMR).
 */
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined
}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'development') {
  // In development: use a global variable to avoid creating multiple connections
  // when Next.js hot-reloads modules
  if (!global._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI)
    global._mongoClientPromise = client.connect()
  }
  clientPromise = global._mongoClientPromise
} else {
  // In production: do not cache through a global variable
  client = new MongoClient(MONGODB_URI)
  clientPromise = client.connect()
}

/**
 * Helper to get a database instance.
 * @param dbName database name; defaults to MONGODB_DB env var or 'kayscope'
 */
export async function getDatabase(dbName?: string) {
  const resolvedClient = await clientPromise
  return resolvedClient.db(dbName ?? process.env.MONGODB_DB ?? 'kayscope')
}

export default clientPromise
