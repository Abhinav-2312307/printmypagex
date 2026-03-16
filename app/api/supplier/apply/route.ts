import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"
import User from "@/models/User"
import { isAlphabeticText, isNumeric, normalizeText } from "@/lib/form-validation"
import { authenticateUserRequest } from "@/lib/user-auth"
import { mergeUserRoles } from "@/lib/user-roles"

export async function POST(req: Request){

try{
const auth = await authenticateUserRequest(req, {
requireProfile: false,
requireActive: false
})
if (!auth.ok) return auth.response

await connectDB()

const body = await req.json()

const name = normalizeText(String(body.name || ""))
const phone = String(body.phone || "").trim()
const rollNo = String(body.rollNo || "").trim()
const branch = normalizeText(String(body.branch || ""))
const yearNum = Number(body.year)

if(!body.firebaseUID){
return NextResponse.json({
error: "Missing firebaseUID"
},{ status:400 })
}

if(String(body.firebaseUID) !== auth.uid){
return NextResponse.json({
error: "Unauthorized UID"
},{ status:403 })
}

if(!name || !isAlphabeticText(name)){
return NextResponse.json({
error: "Name must contain only text"
},{ status:400 })
}

if(!isNumeric(phone) || phone.length < 10 || phone.length > 15){
return NextResponse.json({
error: "Phone must be numeric (10-15 digits)"
},{ status:400 })
}

if(!isNumeric(rollNo)){
return NextResponse.json({
error: "Roll number must be numeric"
},{ status:400 })
}

if(!branch || !isAlphabeticText(branch)){
return NextResponse.json({
error: "Branch must contain only text"
},{ status:400 })
}

if(!Number.isInteger(yearNum) || yearNum < 1 || yearNum > 8){
return NextResponse.json({
error: "Year must be a number between 1 and 8"
},{ status:400 })
}

const existing = await Supplier.findOne({
firebaseUID: body.firebaseUID
})
const existingUser = await User.findOne({
firebaseUID: body.firebaseUID
}).lean()
const supplierRoleState = mergeUserRoles(existingUser, ["SUPPLIER"], {
preferredRole: "SUPPLIER"
})

if(existing){
await User.findOneAndUpdate(
{ firebaseUID: body.firebaseUID },
{
$set: {
firebaseUID: body.firebaseUID,
email: body.email || existingUser?.email || undefined,
firebasePhotoURL: body.photoURL || existingUser?.firebasePhotoURL || undefined,
name,
phone,
rollNo,
branch,
year: yearNum,
role: supplierRoleState.role,
roles: supplierRoleState.roles,
approved: existingUser?.approved ?? true,
active: existingUser?.active ?? true
}
},
{
upsert: true,
new: true
}
)

console.log("SUPPLIER_PROFILE_DEBUG: Existing supplier, user profile synced", {
firebaseUID: body.firebaseUID,
hasEmail: Boolean(body.email)
})

return NextResponse.json({
error: "Already applied"
})
}

const supplier = await Supplier.create({

firebaseUID: body.firebaseUID,
name,
email: body.email || undefined,
firebasePhotoURL: body.photoURL || undefined,
phone,
rollNo,
branch,
year: String(yearNum),

approved: false,
active: false

})

/* 🔥 CRITICAL FIX */
await User.findOneAndUpdate(

{ firebaseUID: body.firebaseUID },

{
$set: {
firebaseUID: body.firebaseUID,
email: body.email || existingUser?.email || undefined,
firebasePhotoURL: body.photoURL || existingUser?.firebasePhotoURL || undefined,
name,
phone,
rollNo,
branch,
year: yearNum,
role: supplierRoleState.role,
roles: supplierRoleState.roles,
approved: existingUser?.approved ?? true,
active: existingUser?.active ?? true
}
},

{
upsert: true,
new: true
}

)

console.log("SUPPLIER_PROFILE_DEBUG: Supplier application synced", {
firebaseUID: body.firebaseUID,
hasEmail: Boolean(body.email)
})

return NextResponse.json({
success: true,
supplier
})

}catch(err){

console.log(err)

return NextResponse.json({
error: "Server error"
})

}

}
