"use client"

import { FormEvent, useState } from "react"
import { auth, provider } from "@/lib/firebase"
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  sendEmailVerification,
  signInWithPopup,
  signOut
} from "firebase/auth"
import PortalGuestGuard from "@/components/PortalGuestGuard"
import { authFetch } from "@/lib/client-auth"

export default function SupplierRegister() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState<"email" | "google" | null>(null)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const syncUserEmail = async (uid: string, userEmail: string) => {
    await authFetch("/api/user/check-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        firebaseUID: uid,
        email: userEmail,
        photoURL: auth.currentUser?.photoURL || ""
      })
    })

    await authFetch("/api/supplier/sync-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        firebaseUID: uid,
        email: userEmail,
        photoURL: auth.currentUser?.photoURL || ""
      })
    })
  }

  const routeAfterRegister = async (uid: string) => {
    const res = await authFetch(`/api/supplier/me?firebaseUID=${uid}`)
    const data = await res.json()

    if (data.supplier) {
      window.location.href = "/supplier/login"
      return
    }

    window.location.href = "/supplier/apply"
  }

  const handleEmailRegister = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setSuccessMessage("")

    const normalizedEmail = email.trim()

    if (!normalizedEmail || !password || !confirmPassword) {
      setError("Email, password and confirm password are required")
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading("email")

    try {
      const result = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
      const user = result.user
      await sendEmailVerification(user)
      await signOut(auth)
      setSuccessMessage("Verification email sent. Please verify your email, then login.")
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code

      if (code === "auth/email-already-in-use") {
        try {
          const signInMethods = await fetchSignInMethodsForEmail(auth, normalizedEmail)
          if (signInMethods.includes("google.com")) {
            setError("This email is already registered with Google. Please use Register with Google.")
          } else {
            setError("Email already in use. Please login instead.")
          }
        } catch {
          setError("Email already in use. Please login instead.")
        }
      } else if (code === "auth/invalid-email") {
        setError("Please enter a valid email")
      } else if (code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.")
      } else if (code === "auth/account-exists-with-different-credential") {
        setError("This email is linked with Google login. Please use Register with Google.")
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Try again in a few minutes.")
      } else {
        setError((err as Error)?.message || "Registration failed")
      }
    } finally {
      setLoading(null)
    }
  }

  const handleGoogleRegister = async () => {
    setError("")
    setSuccessMessage("")
    setLoading("google")

    try {
      const result = await signInWithPopup(auth, provider)
      const user = result.user
      await syncUserEmail(user.uid, user.email || user.providerData?.[0]?.email || "")
      await routeAfterRegister(user.uid)
    } catch (err: unknown) {
      setError((err as Error)?.message || "Registration failed")
    } finally {
      setLoading(null)
    }
  }

  return (
    <PortalGuestGuard portal="supplier">
      <div className="flex min-h-[calc(100svh-10rem)] items-start justify-center pb-6 pt-2 sm:pb-8 sm:pt-4 md:min-h-[calc(100svh-12rem)] md:pt-6">
        <div className="bg-card w-full max-w-[420px] rounded-2xl p-6 text-center sm:p-10">
          <h1 className="text-3xl font-bold mb-2">Supplier Registration</h1>
          <p className="text-white/70 mb-6">Register with Email or Google to continue</p>

          <form onSubmit={handleEmailRegister} className="space-y-4 text-left">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="input w-full"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={6}
                className="input w-full"
                placeholder="Create password"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={6}
                className="input w-full"
                placeholder="Re-enter password"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {successMessage && <p className="text-sm text-green-400">{successMessage}</p>}

            <button
              type="submit"
              disabled={loading !== null}
              className="w-full py-3 bg-primary rounded-xl hover:opacity-90 disabled:opacity-60"
            >
              {loading === "email" ? "Creating account..." : "Register with Email"}
            </button>
          </form>

          <div className="my-5 text-gray-500">or</div>

          <button
            onClick={handleGoogleRegister}
            disabled={loading !== null}
            className="w-full py-3 bg-primary rounded-xl hover:opacity-90 disabled:opacity-60"
          >
            {loading === "google" ? "Please wait..." : "Register with Google"}
          </button>
        </div>
      </div>
    </PortalGuestGuard>
  )
}
