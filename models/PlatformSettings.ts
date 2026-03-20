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
    }
  },
  {
    timestamps: true
  }
)

PlatformSettingsSchema.index({ key: 1 }, { unique: true })

export default mongoose.models.PlatformSettings ||
  mongoose.model("PlatformSettings", PlatformSettingsSchema)
