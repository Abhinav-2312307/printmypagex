import mongoose from "mongoose"

const UserSchema = new mongoose.Schema({

  firebaseUID:{
    type:String,
    required:true,
    unique:true
  },

  name:{
    type:String,
    required:true
  },

  email:String,

  phone:{
    type:String,
    required:true
  },

  rollNo:{
    type:String,
    required:true
  },

  branch:String,

  year:Number,

  section:String,

  role:{
    type:String,
    enum:["USER","SUPPLIER","ADMIN"],
    default:"USER"
  },

  createdAt:{
    type:Date,
    default:Date.now
  }

})

export default mongoose.models.User ||
mongoose.model("User",UserSchema)