"use client"

import { FormEvent, useState } from "react"
import { auth, provider } from "@/lib/firebase"
import {
  fetchSignInMethodsForEmail,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth"
import { isOwnerEmail } from "@/lib/owner-access"
import PortalGuestGuard from "@/components/PortalGuestGuard"
import { authFetch } from "@/lib/client-auth"

export default function SupplierLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState<"email" | "google" | null>(null)
  const [error, setError] = useState("")
  const [infoMessage, setInfoMessage] = useState("")

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

  const routeSupplier = async (uid: string) => {
    const res = await authFetch(`/api/supplier/me?firebaseUID=${uid}`)
    const data = await res.json()

    if (isOwnerEmail(auth.currentUser?.email || "")) {
      window.location.href = "/supplier/dashboard"
      return
    }

    if (!data.supplier) {
      window.location.href = "/supplier/apply"
      return
    }

    if (!data.supplier.approved) {
      setError("Admin has not approved you yet")
      return
    }

    if (!data.supplier.active) {
      setError("Your supplier account is currently inactive")
      return
    }

    window.location.href = "/supplier/dashboard"
  }

  const handleEmailLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setInfoMessage("")

    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) {
      setError("Email and password are required")
      return
    }

    setLoading("email")

    try {
      const result = await signInWithEmailAndPassword(auth, normalizedEmail, password)
      const user = result.user

      if (!user.emailVerified && !isOwnerEmail(user.email)) {
        await signOut(auth)
        setError("Please verify your email first. Use Resend Verification Email.")
        return
      }

      await syncUserEmail(user.uid, user.email || user.providerData?.[0]?.email || normalizedEmail)
      await routeSupplier(user.uid)
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code

      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Invalid email or password")
      } else if (code === "auth/user-not-found") {
        setError("No account found with this email. Please register first.")
      } else if (code === "auth/account-exists-with-different-credential") {
        setError("This email is linked with Google login. Please use Login with Google.")
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Try again in a few minutes.")
      } else {
        setError((err as Error)?.message || "Login failed")
      }
    } finally {
      setLoading(null)
    }
  }

  const handleGoogleLogin = async () => {
    setError("")
    setInfoMessage("")
    setLoading("google")

    try {
      const result = await signInWithPopup(auth, provider)
      const user = result.user
      await syncUserEmail(user.uid, user.email || user.providerData?.[0]?.email || "")
      await routeSupplier(user.uid)
    } catch (err: unknown) {
      setError((err as Error)?.message || "Google login failed")
    } finally {
      setLoading(null)
    }
  }
 
  const handleForgotPassword = async () => {
    setError("")
    setInfoMessage("")

    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setError("Enter your email first, then click Forgot Password")
      return
    }

    try {
      const signInMethods = await fetchSignInMethodsForEmail(auth, normalizedEmail)
      if (signInMethods.includes("google.com")) {
        setError("This email uses Google login. Please use Login with Google.")
        return
      }

      await sendPasswordResetEmail(auth, normalizedEmail)
      setInfoMessage("Password reset link sent. Check your email inbox.")
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === "auth/user-not-found") {
        setError("No account found with this email.")
      } else {
        setError((err as Error)?.message || "Unable to send reset email")
      }
    }
  }

  const handleResendVerification = async () => {
    setError("")
    setInfoMessage("")

    const normalizedEmail = email.trim()
    if (!normalizedEmail || !password) {
      setError("Enter email and password, then click Resend Verification Email")
      return
    }

    setLoading("email")

    try {
      const result = await signInWithEmailAndPassword(auth, normalizedEmail, password)
      const user = result.user
      await sendEmailVerification(user)
      await signOut(auth)
      setInfoMessage("Verification email sent. Check inbox/spam and verify.")
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Invalid email or password")
      } else if (code === "auth/user-not-found") {
        setError("No account found with this email.")
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Try again in a few minutes.")
      } else {
        setError((err as Error)?.message || "Unable to resend verification email")
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <PortalGuestGuard portal="supplier">
      <div className="flex min-h-[calc(100svh-10rem)] items-start justify-center pb-6 pt-2 sm:pb-8 sm:pt-4 md:min-h-[calc(100svh-12rem)] md:pt-6">
        <div className="bg-card w-full max-w-[420px] rounded-2xl p-6 text-center sm:p-10">
          <h1 className="text-3xl font-bold mb-2">Supplier Login</h1>
          <p className="text-white/70 mb-6">Login to access supplier dashboard</p>

          <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
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
                autoComplete="current-password"
                minLength={6}
                className="input w-full"
                placeholder="Enter your password"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {infoMessage && <p className="text-sm text-green-400">{infoMessage}</p>}

            <button
              type="submit"
              disabled={loading !== null}
              className="w-full py-3 bg-primary rounded-xl hover:opacity-90 disabled:opacity-60"
            >
              {loading === "email" ? "Signing in..." : "Login with Email"}
            </button>

            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading !== null}
              className="w-full py-2 text-sm text-gray-300 hover:text-white disabled:opacity-60"
            >
              Forgot Password?
            </button>

            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading !== null}
              className="w-full py-2 text-sm text-gray-300 hover:text-white disabled:opacity-60"
            >
              Resend Verification Email
            </button>
          </form>

          <div className="my-5 text-gray-500">or</div>

          <button
            onClick={handleGoogleLogin}
            disabled={loading !== null}
            className="w-full py-3 bg-primary rounded-xl hover:opacity-90 disabled:opacity-60"
          >
            {loading === "google" ? "Please wait..." : "Login with Google"}
          </button>
        </div>
      </div>
    </PortalGuestGuard>
  )
}
