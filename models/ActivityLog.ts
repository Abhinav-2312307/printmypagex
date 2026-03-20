import mongoose from "mongoose"

const ActivityLogSchema = new mongoose.Schema({
  actorType: {
    type: String,
    enum: ["admin", "user", "supplier", "system", "public"],
    default: "system"
  },
  actorUID: {
    type: String,
    default: ""
  },
  actorEmail: {
    type: String,
    default: ""
  },
  action: {
    type: String,
    required: true
  },
  entityType: {
    type: String,
    required: true
  },
  entityId: {
    type: String,
    default: ""
  },
  level: {
    type: String,
    enum: ["info", "success", "warning", "error"],
    default: "info"
  },
  message: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

ActivityLogSchema.index({ createdAt: -1 })
ActivityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })
ActivityLogSchema.index({ action: 1, createdAt: -1 })

export default mongoose.models.ActivityLog ||
  mongoose.model("ActivityLog", ActivityLogSchema)
