import mongoose from "mongoose"

const UserSchema = new mongoose.Schema({
  firebaseUID: String,
  name: String,
  email: String,
  phone: String,
  rollNo: String,
  branch: String,
  year: Number,
  section: String,
  role: {
    type: String,
    default: "USER"
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

export default mongoose.models.User || mongoose.model("User", UserSchema)