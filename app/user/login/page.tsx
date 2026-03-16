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
import Navbar from "@/components/Navbar"
import PortalGuestGuard from "@/components/PortalGuestGuard"
import { isOwnerEmail } from "@/lib/owner-access"
import {
  resolveUserPortalDestination,
  USER_ROLE_PROMPT_MESSAGE
} from "@/lib/portal-access"

export default function UserLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState<"email" | "google" | null>(null)
  const [error, setError] = useState("")
  const [resetMessage, setResetMessage] = useState("")

  const syncAndRouteUser = async (uid: string, userEmail: string) => {
    const destination = await resolveUserPortalDestination({
      uid,
      email: userEmail,
      photoURL: auth.currentUser?.photoURL || "",
      confirmSupplierPromotion: () => window.confirm(USER_ROLE_PROMPT_MESSAGE)
    })

    window.location.href = destination
  }

  const handleEmailLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")
    setResetMessage("")

    if (!email.trim() || !password) {
      setError("Email and password are required")
      return
    }

    setLoading("email")

    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password)
      const user = result.user

      if (!user.emailVerified && !isOwnerEmail(user.email)) {
        await signOut(auth)
        setError("Please verify your email first. You can use Resend Verification Email.")
        return
      }

      await syncAndRouteUser(
        user.uid,
        user.email || user.providerData?.[0]?.email || email.trim()
      )
    } catch (err: unknown) {
      if (auth.currentUser) {
        await signOut(auth).catch(() => {})
      }

      const code = (err as { code?: string })?.code

      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Invalid email or password")
      } else if (code === "auth/user-not-found") {
        setError("No account found with this email. Please register first.")
      } else if (code === "auth/account-exists-with-different-credential") {
        setError("This email is linked with Google login. Please use Continue with Google.")
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
    setLoading("google")

    try {
      const result = await signInWithPopup(auth, provider)
      const user = result.user

      await syncAndRouteUser(user.uid, user.email || user.providerData?.[0]?.email || "")
    } catch (err: unknown) {
      if (auth.currentUser) {
        await signOut(auth).catch(() => {})
      }

      setError((err as Error)?.message || "Google login failed")
    } finally {
      setLoading(null)
    }
  }

  const handleResendVerification = async () => {
    setError("")
    setResetMessage("")

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
      setResetMessage("Verification email sent. Please check inbox/spam and verify.")
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

  const handleForgotPassword = async () => {
    setError("")
    setResetMessage("")

    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setError("Enter your email first, then click Forgot Password")
      return
    }

    try {
      const signInMethods = await fetchSignInMethodsForEmail(auth, normalizedEmail)

      if (signInMethods.includes("google.com")) {
        setError("This email uses Google login. Please use Continue with Google.")
        return
      }

      await sendPasswordResetEmail(auth, normalizedEmail)
      setResetMessage("Password reset link sent. Check your email inbox.")
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code
      if (code === "auth/user-not-found") {
        setError("No account found with this email.")
      } else {
        setError((err as Error)?.message || "Unable to send reset email")
      }
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
              label: "Create Account",
              href: "/user/register",
              variant: "accent"
            }
          ]}
          hideGuestAuthButtons
          showOrdersMenuItem={false}
        />

        <div className="flex items-center justify-center px-6 pb-16">
          <div className="bg-card w-full max-w-md rounded-3xl p-10 text-center shadow-xl">
            <h1 className="text-3xl font-bold mb-6">User Login</h1>

            <form onSubmit={handleEmailLogin} className="space-y-4 text-left">
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
                  autoComplete="current-password"
                  minLength={6}
                  className="input w-full"
                  placeholder="Enter your password"
                />
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}
              {resetMessage && <p className="text-sm text-green-400">{resetMessage}</p>}

              <button
                type="submit"
                disabled={loading !== null}
                className="w-full py-3 bg-primary text-black rounded-xl font-semibold hover:opacity-90 disabled:opacity-60"
              >
                {loading === "email" ? "Signing in..." : "Sign in with Email"}
              </button>

              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading !== null}
                className="w-full py-2 text-sm text-gray-600 transition hover:text-gray-900 disabled:opacity-60 dark:text-gray-300 dark:hover:text-white"
              >
                Forgot Password?
              </button>

              <button
                type="button"
                onClick={handleResendVerification}
                disabled={loading !== null}
                className="w-full py-2 text-sm text-gray-600 transition hover:text-gray-900 disabled:opacity-60 dark:text-gray-300 dark:hover:text-white"
              >
                Resend Verification Email
              </button>
            </form>

            <div className="my-5 text-gray-500">or</div>

            <button
              onClick={handleGoogleLogin}
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
