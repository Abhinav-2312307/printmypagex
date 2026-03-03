"use client"

import Navbar from "@/components/Navbar"
import { auth, provider } from "@/lib/firebase"
import { signInWithPopup } from "firebase/auth"

export default function UserRegister() {

  const register = async () => {
    await signInWithPopup(auth, provider)
    window.location.href = "/user/dashboard"
  }

  return (
    <div>

      <Navbar />

      <div className="flex justify-center items-center min-h-[80vh]">

        <div className="bg-card p-10 rounded-2xl w-96 text-center shadow-lg">

          <h1 className="text-3xl font-bold mb-6">
            Create Account
          </h1>

          <button
            onClick={register}
            className="w-full py-3 bg-primary text-black rounded-xl font-semibold hover:opacity-90"
          >
            Continue with Google
          </button>

        </div>

      </div>

    </div>
  )
}