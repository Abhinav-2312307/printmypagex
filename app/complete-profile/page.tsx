"use client"

import { useState } from "react"
import { auth } from "@/lib/firebase"

export default function CompleteProfile() {

const [form,setForm] = useState({
name:"",
rollNo:"",
branch:"",
section:"",
year:"",
phone:""
})

const handleChange = (e:any)=>{
setForm({...form,[e.target.name]:e.target.value})
}

const handleSubmit = async (e:any)=>{

e.preventDefault()

const user = auth.currentUser

if(!user){
alert("User not logged in")
return
}

const res = await fetch("/api/user/create-profile",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
firebaseUID:user.uid,
...form
})
})

const data = await res.json()

if(data.success){
alert("Profile Created")
window.location.href="/dashboard"
}

}

return(

<div className="profile-page">

<div className="profile-card">

<h2>Complete Your Profile</h2>

<form onSubmit={handleSubmit}>

<div className="form-grid">

<div className="input-group">
<label>Name</label>
<input name="name" onChange={handleChange} required/>
</div>

<div className="input-group">
<label>Roll Number</label>
<input name="rollNo" onChange={handleChange} required/>
</div>

<div className="input-group">
<label>Branch</label>
<input name="branch" onChange={handleChange} required/>
</div>

<div className="input-group">
<label>Section</label>
<input name="section" onChange={handleChange} required/>
</div>

<div className="input-group">
<label>Year</label>
<input name="year" type="number" onChange={handleChange} required/>
</div>

<div className="input-group">
<label>Phone</label>
<input name="phone" onChange={handleChange} required/>
</div>

</div>

<button className="order-btn">
Create Profile
</button>

</form>

</div>

</div>

)

}