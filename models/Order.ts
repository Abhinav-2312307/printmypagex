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

  fileURL:{
    type:String,
    required:true
  },

  pages:{
    type:Number,
    required:true
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

  paymentStatus:{
    type:String,
    enum:["unpaid","paid"],
    default:"unpaid"
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

  createdAt:{
    type:Date,
    default:Date.now
  }

})

export default mongoose.models.Order ||
mongoose.model("Order",OrderSchema)