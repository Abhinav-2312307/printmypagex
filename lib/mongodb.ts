import mongoose, { type Mongoose } from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable")
}

const mongoUri = MONGODB_URI

type MongooseCache = {
  conn: Mongoose | null
  promise: Promise<Mongoose> | null
}

declare global {
  var mongooseCache: MongooseCache | undefined
}

const cached = globalThis.mongooseCache ?? { conn: null, promise: null }

if (!globalThis.mongooseCache) {
  globalThis.mongooseCache = cached
}

export async function connectDB() {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUri)
  }

  cached.conn = await cached.promise
  return cached.conn
}
