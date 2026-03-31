import mongoose from "mongoose"

const OrderSchema = new mongoose.Schema({

  userUID:{
    type:String,
    required:true
  },

  supplierUID:{
    type:String,
    default:null
  },

  requestType:{
    type:String,
    enum:["global","specific"],
    default:"global"
  },

  alternatePhone:{
    type:String,
    default:""
  },

  duplex:{
    type:Boolean,
    default:false
  },

  spiralBinding:{
    type:Boolean,
    default:false
  },

  instruction:{
    type:String,
    default:""
  },

  fileURL:{
    type:String,
    required:true
  },

  storageURL:{
    type:String,
    default:""
  },

  fileOriginalName:{
    type:String,
    default:""
  },

  fileMimeType:{
    type:String,
    default:"application/octet-stream"
  },

  fileStorageEncoding:{
    type:String,
    enum:["none","gzip"],
    default:"none"
  },

  fileAccessToken:{
    type:String,
    default:""
  },

  fileOriginalSizeBytes:{
    type:Number,
    default:0
  },

  fileStoredSizeBytes:{
    type:Number,
    default:0
  },

  pdfPasswordRequired:{
    type:Boolean,
    default:false
  },

  pdfPassword:{
    type:String,
    default:""
  },

  pages:{
    type:Number,
    required:true
  },

  copies:{
    type:Number,
    default:1,
    min:1
  },

  verifiedPages:{
    type:Number,
    default:null
  },

  printType:{
    type:String,
    enum:["bw","color","glossy"],
    required:true
  },

  estimatedPrice:{
    type:Number,
    required:true
  },

  finalPrice:{
    type:Number,
    default:null
  },

  discountPercent:{
    type:Number,
    default:0
  },

  discountAmount:{
    type:Number,
    default:0
  },

  paymentStatus:{
    type:String,
    enum:["unpaid","paid"],
    default:"unpaid"
  },

  razorpayOrderId:{
    type:String,
    default:null
  },

  razorpayPaymentId:{
    type:String,
    default:null
  },

  razorpaySignature:{
    type:String,
    default:null
  },

  paidAt:{
    type:Date,
    default:null
  },

  adminReminderCount:{
    type:Number,
    default:0
  },

  lastAdminReminderAt:{
    type:Date,
    default:null
  },

  status:{
    type:String,
    enum:[
      "pending",
      "accepted",
      "awaiting_payment",
      "printing",
      "printed",
      "delivered",
      "cancelled"
    ],
    default:"pending"
  },

  acceptedAt:{
    type:Date,
    default:null
  },

  deliveredAt:{
    type:Date,
    default:null
  },

  cancelledAt:{
    type:Date,
    default:null
  },

  logs:[
    {
      message:String,
      time:{
        type:Date,
        default:Date.now
      }
    }
  ],

  createdAt:{
    type:Date,
    default:Date.now
  }

})

OrderSchema.index({ userUID: 1, createdAt: -1 })
OrderSchema.index({ supplierUID: 1, createdAt: -1 })
OrderSchema.index({ status: 1, requestType: 1, supplierUID: 1, createdAt: -1 })
OrderSchema.index({ razorpayOrderId: 1 })
OrderSchema.index({ paymentStatus: 1, paidAt: -1 })
OrderSchema.index({ fileAccessToken: 1 }, { unique: true, sparse: true })

export default mongoose.models.Order ||
mongoose.model("Order",OrderSchema)
