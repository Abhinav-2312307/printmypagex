"use client"

import { useState } from "react"
import { auth } from "@/lib/firebase"

export default function SupplierApply(){

const [form,setForm] = useState({
name:"",
phone:"",
rollNo:"",
branch:"",
year:""
})

const handleChange=(e:any)=>{
setForm({...form,[e.target.name]:e.target.value})
}

const submit = async()=>{

const user = auth.currentUser

const res = await fetch("/api/supplier/apply",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
firebaseUID:user?.uid,
...form
})

})

const data = await res.json()

if(data.error){
alert(data.error)
return
}

alert("Application sent to admin")

window.location.href="/"

}

return(

<div style={{padding:"40px"}}>

<h1>Supplier Application</h1>

<input name="name" placeholder="Name" onChange={handleChange}/>
<input name="phone" placeholder="Phone" onChange={handleChange}/>
<input name="rollNo" placeholder="Roll No" onChange={handleChange}/>
<input name="branch" placeholder="Branch" onChange={handleChange}/>
<input name="year" placeholder="Year" onChange={handleChange}/>

<button onClick={submit}>
Submit Application
</button>

</div>

)

}