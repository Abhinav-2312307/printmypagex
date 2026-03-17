import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"
import User from "@/models/User"
import { isOwnerEmail } from "@/lib/owner-access"
import { authenticateUserRequest } from "@/lib/user-auth"

type SupplierRecord = {
  _id?: string
  firebaseUID: string
  name?: string
  email?: string
  phone?: string
  rollNo?: string
  branch?: string
  year?: string | number
  photoURL?: string
  firebasePhotoURL?: string
  approved?: boolean
  active?: boolean
  createdAt?: Date
}

type OwnerUserRecord = {
  email?: string
  name?: string
  phone?: string
  rollNo?: string
  branch?: string
  year?: string | number
  photoURL?: string
  firebasePhotoURL?: string
}

export async function GET(req:Request){
const auth = await authenticateUserRequest(req, {
requireProfile: false,
requireActive: false
})
if (!auth.ok) return auth.response

await connectDB()

const {searchParams} = new URL(req.url)

const firebaseUID = searchParams.get("firebaseUID")

if(!firebaseUID){
return NextResponse.json({
success:false,
message:"Missing firebaseUID"
},{ status:400 })
}

if(firebaseUID !== auth.uid){
return NextResponse.json({
success:false,
message:"Unauthorized UID"
},{ status:403 })
}

const supplier = await Supplier.findOne({
firebaseUID
})
  .select("firebaseUID name email phone rollNo branch year photoURL firebasePhotoURL approved active createdAt")
  .lean<SupplierRecord | null>()

if (!supplier && firebaseUID) {
const user = await User.findOne({ firebaseUID })
  .select("email name phone rollNo branch year photoURL firebasePhotoURL")
  .lean<OwnerUserRecord | null>()

if (user && isOwnerEmail(user.email)) {
return NextResponse.json({
success: true,
supplier: {
firebaseUID,
name: user.name || "Owner",
email: user.email || "",
phone: user.phone || "",
rollNo: user.rollNo || "",
branch: user.branch || "",
year: user.year || "",
photoURL: user.photoURL || "",
firebasePhotoURL: user.firebasePhotoURL || "",
displayPhotoURL: user.photoURL || user.firebasePhotoURL || "",
approved: true,
active: true
}
})
}
}

return NextResponse.json({
success:true,
supplier: supplier
? {
...supplier,
displayPhotoURL: supplier.photoURL || supplier.firebasePhotoURL || ""
}
: null
})

}
