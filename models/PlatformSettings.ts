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
    },
    orderBurstMaxRequests: {
      type: Number,
      default: 15
    },
    orderBurstBlockMinutes: {
      type: Number,
      default: 15
    },
    orderDailyMaxRequests: {
      type: Number,
      default: 20
    },
    orderDailyBlockHours: {
      type: Number,
      default: 24
    },
    maxFilesPerOrder: {
      type: Number,
      default: 5
    },
    maxSupplierDiscountPercent: {
      type: Number,
      default: 50
    }
  },
  {
    timestamps: true
  }
)

PlatformSettingsSchema.index({ key: 1 }, { unique: true })

const existingModel = mongoose.models.PlatformSettings

if (
  existingModel &&
  (
    !existingModel.schema.path("orderBurstMaxRequests") ||
    !existingModel.schema.path("maxSupplierDiscountPercent") ||
    !existingModel.schema.path("maxFilesPerOrder")
  )
) {
  mongoose.deleteModel("PlatformSettings")
}

export default mongoose.models.PlatformSettings ||
  mongoose.model("PlatformSettings", PlatformSettingsSchema)
