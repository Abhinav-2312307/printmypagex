"use client"

import { auth, provider } from "@/lib/firebase"
import { signInWithPopup } from "firebase/auth"

export default function SupplierLogin(){

const login = async()=>{

const result = await signInWithPopup(auth,provider)

const user = result.user

const res = await fetch(
`/api/supplier/me?firebaseUID=${user.uid}`
)

const data = await res.json()

if(!data.supplier){
alert("You are not registered as supplier")
return
}

if(!data.supplier.approved){
alert("Admin has not approved you yet")
return
}

window.location.href="/supplier/dashboard"

}

return(

<div style={{padding:"40px"}}>

<h1>Supplier Login</h1>

<button onClick={login}>
Login with Google
</button>

</div>

)

}