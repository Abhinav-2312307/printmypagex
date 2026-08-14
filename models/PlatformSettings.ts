import mongoose from "mongoose"

const PlatformSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "main"
    },
    landingFeedbackVisible: {
      type: Boolean,
      default: true
    },
    pendingAutoCancelHours: {
      type: Number,
      default: 72
    },
    paymentAutoCancelHours: {
      type: Number,
      default: 24
    }
  },
  {
    timestamps: true
  }
)

PlatformSettingsSchema.index({ key: 1 }, { unique: true })

export default mongoose.models.PlatformSettings ||
  mongoose.model("PlatformSettings", PlatformSettingsSchema)
