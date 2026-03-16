"use client"

import { FormEvent, useState } from "react"
import Navbar from "@/components/Navbar"
import PortalGuestGuard from "@/components/PortalGuestGuard"
import { auth, provider } from "@/lib/firebase"
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  sendEmailVerification,
  signInWithPopup,
  signOut
} from "firebase/auth"
import {
  resolveUserPortalDestination,
  USER_ROLE_PROMPT_MESSAGE
} from "@/lib/portal-access"

export default function UserRegister() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState<"email" | "google" | null>(null)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const syncAndRouteUser = async (uid: string, userEmail: string) => {
    const destination = await resolveUserPortalDestination({
      uid,
      email: userEmail,
      photoURL: auth.currentUser?.photoURL || "",
      confirmSupplierPromotion: () => window.confirm(USER_ROLE_PROMPT_MESSAGE)
    })

    window.location.href = destination
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
            setError("This email is already registered with Google. Please use Continue with Google.")
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
        setError("This email is linked with Google login. Please use Continue with Google.")
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
    setLoading("google")

    try {
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      await syncAndRouteUser(user.uid, user.email || user.providerData?.[0]?.email || "")
    } catch (err: unknown) {
      if (auth.currentUser) {
        await signOut(auth).catch(() => {})
      }

      setError((err as Error)?.message || "Google signup failed")
    } finally {
      setLoading(null)
    }
  }

  return (
    <PortalGuestGuard portal="user">
      <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-sky-100 dark:from-black dark:via-[#0f0f1a] dark:to-[#12122a]">
        <Navbar
          logoHref="/"
          navButtons={[
            {
              label: "Back Home",
              href: "/",
              variant: "back"
            },
            {
              label: "Sign In",
              href: "/user/login",
              variant: "accent"
            }
          ]}
          hideGuestAuthButtons
          showOrdersMenuItem={false}
        />

        <div className="flex items-center justify-center px-6 pb-16">
          <div className="bg-card w-full max-w-md rounded-3xl p-10 text-center shadow-xl">
            <h1 className="text-3xl font-bold mb-6">Create Account</h1>

            <form onSubmit={handleEmailRegister} className="space-y-4 text-left">
              <div>
                <label className="mb-1 block text-sm text-gray-500 dark:text-gray-400">Email</label>
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
                <label className="mb-1 block text-sm text-gray-500 dark:text-gray-400">Password</label>
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
                <label className="mb-1 block text-sm text-gray-500 dark:text-gray-400">Confirm Password</label>
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
                className="w-full py-3 bg-primary text-black rounded-xl font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {loading === "email" ? "Creating account..." : "Register with Email"}
              </button>
            </form>

            <div className="my-5 text-gray-500">or</div>

            <button
              onClick={handleGoogleRegister}
              disabled={loading !== null}
              className="w-full py-3 bg-primary text-black rounded-xl font-semibold hover:opacity-90 disabled:opacity-60"
            >
              {loading === "google" ? "Please wait..." : "Continue with Google"}
            </button>
          </div>
        </div>
      </div>
    </PortalGuestGuard>
  )
}
