import mongoose from "mongoose"

const OrderSchema = new mongoose.Schema({

firebaseUID:{
type:String,
required:true
},

fileURL:String,

pages:Number,

printType:String,

price:Number,

status:{
type:String,
default:"pending"
},

supplier:{
type:String,
default:null
},

createdAt:{
type:Date,
default:Date.now
}

})

export default mongoose.models.Order ||
mongoose.model("Order",OrderSchema)