import mongoose from "mongoose"

const SupplierSchema = new mongoose.Schema({

firebaseUID:{
type:String,
required:true,
unique:true
},

name:String,
phone:String,
rollNo:String,
branch:String,
year:String,

approved:{
type:Boolean,
default:false
},

active:{
type:Boolean,
default:false
},

createdAt:{
type:Date,
default:Date.now
}

})

export default mongoose.models.Supplier ||
mongoose.model("Supplier",SupplierSchema)