import mongoose from "mongoose"

const PricingSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "default"
    },
    prices: {
      bw: {
        type: Number,
        required: true,
        min: 0.01,
        default: 2
      },
      color: {
        type: Number,
        required: true,
        min: 0.01,
        default: 5
      },
      glossy: {
        type: Number,
        required: true,
        min: 0.01,
        default: 15
      }
    }
  },
  {
    timestamps: true
  }
)

PricingSettingsSchema.index({ key: 1 }, { unique: true })

export default mongoose.models.PricingSettings ||
  mongoose.model("PricingSettings", PricingSettingsSchema)
