"use client"

import { auth, provider } from "@/lib/firebase"
import { signInWithPopup } from "firebase/auth"

export default function SupplierRegister(){

  const register = async () => {

    try{

      const result = await signInWithPopup(auth, provider)

      const user = result.user

      const res = await fetch(
        `/api/supplier/me?firebaseUID=${user.uid}`
      )

      const data = await res.json()

      if(data.supplier){
        window.location.href="/supplier/login"
      }else{
        window.location.href="/supplier/apply"
      }

    }catch(err){
      console.log(err)
      alert("Registration failed")
    }

  }

  return(

    <div style={{padding:"40px"}}>

      <h1>Supplier Registration</h1>

      <button onClick={register}>
        Register with Google
      </button>

    </div>

  )

}