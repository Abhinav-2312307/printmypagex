import mongoose from "mongoose"

const SubmissionRateLimitSchema = new mongoose.Schema({
  scope: {
    type: String,
    required: true
  },

  identifierHash: {
    type: String,
    required: true
  },

  windowStartedAt: {
    type: Date,
    required: true,
    default: Date.now
  },

  windowHits: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },

  totalHits: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },

  blockedUntil: {
    type: Date,
    default: null
  },

  lastPayloadHash: {
    type: String,
    default: ""
  },

  lastPayloadAt: {
    type: Date,
    default: null
  },

  lastRequestAt: {
    type: Date,
    required: true,
    default: Date.now
  },

  expiresAt: {
    type: Date,
    required: true
  }
})

SubmissionRateLimitSchema.index(
  { scope: 1, identifierHash: 1 },
  { unique: true }
)
SubmissionRateLimitSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
)
SubmissionRateLimitSchema.index({ blockedUntil: 1 })

export default mongoose.models.SubmissionRateLimit ||
  mongoose.model("SubmissionRateLimit", SubmissionRateLimitSchema)
