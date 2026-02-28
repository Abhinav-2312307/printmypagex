"use client"

import { signInWithPopup, GoogleAuthProvider } from "firebase/auth"
import { auth } from "@/lib/firebase"

export default function LoginPage() {

  const handleGoogleLogin = async () => {

    try {

      const provider = new GoogleAuthProvider()

      const result = await signInWithPopup(auth, provider)

      const user = result.user

      console.log("Logged in user:", user)

      const res = await fetch("/api/user/check-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          firebaseUID: user.uid,
          email: user.email,
          name: user.displayName
        })
      })

      const data = await res.json()

      if (data.exists) {
        window.location.href = "/dashboard"
      } else {
        window.location.href = "/complete-profile"
      }

    } catch (error) {
      console.error(error)
    }

  }

  return (

    <div style={{
      height: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "#0f0f0f"
    }}>

      <div style={{
        padding: "40px",
        border: "1px solid #444",
        borderRadius: "12px",
        textAlign: "center"
      }}>

        <h2 style={{ marginBottom: "20px" }}>Login</h2>

        <button
          onClick={handleGoogleLogin}
          style={{
            padding: "12px 20px",
            background: "#2563eb",
            border: "none",
            borderRadius: "6px",
            color: "white",
            cursor: "pointer"
          }}
        >
          Continue with Google
        </button>

      </div>

    </div>

  )
}