import mongoose from "mongoose"
import { USER_ROLES } from "@/lib/user-roles"

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
  photoURL:String,
  firebasePhotoURL:String,

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
    enum:USER_ROLES,
    default:"USER"
  },

  roles:{
    type:[String],
    enum:USER_ROLES,
    default:["USER"]
  },

  approved:{
    type:Boolean,
    default:true
  },

  active:{
    type:Boolean,
    default:true
  },

  createdAt:{
    type:Date,
    default:Date.now
  }

})

export default mongoose.models.User ||
mongoose.model("User",UserSchema)
