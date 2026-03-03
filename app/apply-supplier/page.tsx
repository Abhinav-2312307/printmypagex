"use client"

import { useState } from "react"
import { auth } from "@/lib/firebase"

export default function ApplySupplier(){

const [loading,setLoading] = useState(false)

const apply = async ()=>{

const user = auth.currentUser

if(!user){
alert("Login first")
return
}

setLoading(true)

const res = await fetch("/api/supplier/apply",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
firebaseUID:user.uid
})

})

const data = await res.json()

setLoading(false)

if(data.error){
alert(data.error)
return
}

alert("Supplier application submitted")

}

return(

<div style={{padding:"40px"}}>

<h1>Become a Supplier</h1>

<p>
Apply to become a PrintMyPage supplier.
</p>

<button onClick={apply} disabled={loading}>

{loading ? "Applying..." : "Apply"}

</button>

</div>

)

}