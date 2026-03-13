import mongoose from "mongoose"

const FaqItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true
    },
    question: {
      type: String,
      required: true,
      trim: true
    },
    answer: {
      type: String,
      required: true,
      trim: true
    },
    badge: {
      type: String,
      trim: true,
      default: ""
    }
  },
  {
    _id: false
  }
)

const FaqContentSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "main"
    },
    userFaqs: {
      type: [FaqItemSchema],
      default: []
    },
    supplierFaqs: {
      type: [FaqItemSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
)

export default mongoose.models.FaqContent ||
  mongoose.model("FaqContent", FaqContentSchema)
