"use client"

import { useEffect, useRef, useState } from "react"
import { auth } from "@/lib/firebase"
import { signOut, onAuthStateChanged, User } from "firebase/auth"
import { useRouter } from "next/navigation"
import ProfileCard from "@/components/ProfileCard"
import CandleThemeToggle from "@/components/CandleThemeToggle"
import { authFetch } from "@/lib/client-auth"

type NavbarButtonVariant = "glass" | "accent" | "back" | "contact" | "orders" | "dashboardBack"

type NavbarButton = {
  label: string
  href?: string
  onClick?: () => void
  variant?: NavbarButtonVariant
  badge?: number
}

interface NavbarProps {
  logoHref?: string
  navButtons?: NavbarButton[]
  hideGuestAuthButtons?: boolean
  onProfileClick?: () => void
  showOrdersMenuItem?: boolean
  showSpacer?: boolean
}

type NavbarProfileData = {
  name?: string
  email?: string
  phone?: string
  rollNo?: string
  branch?: string
  section?: string
  year?: string | number
  photoURL?: string
  firebasePhotoURL?: string
  displayPhotoURL?: string
}

const defaultNavButtons: NavbarButton[] = [
  {
    label: "Pricing",
    href: "/pricing",
    variant: "glass"
  },
  {
    label: "Contact",
    href: "/contact",
    variant: "contact"
  }
]

export default function Navbar({
  logoHref = "/",
  navButtons,
  hideGuestAuthButtons = false,
  onProfileClick,
  showOrdersMenuItem = true,
  showSpacer = true
}: NavbarProps = {}) {
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [profileData, setProfileData] = useState<NavbarProfileData | null>(null)
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      if (!nextUser) {
        setProfileData(null)
      }
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      return
    }

    let active = true

    const loadProfile = async () => {
      try {
        const res = await authFetch(`/api/user/details?firebaseUID=${user.uid}`)
        const data = (await res.json()) as { user?: NavbarProfileData }

        if (!active) return

        if (res.ok && data?.user) {
          setProfileData(data.user)
          return
        }
      } catch (error) {
        console.error("NAVBAR_PROFILE_LOAD_ERROR:", error)
      }

      if (!active) return

      setProfileData({
        name: user.displayName || "",
        email: user.email || "",
        phone: user.phoneNumber || "",
        displayPhotoURL: user.photoURL || ""
      })
    }

    loadProfile()

    return () => {
      active = false
    }
  }, [user])

  const resolvedProfile: NavbarProfileData | null = user
    ? {
        name: profileData?.name || user.displayName || "User",
        email: profileData?.email || user.email || "",
        phone: profileData?.phone || user.phoneNumber || "",
        rollNo: profileData?.rollNo || "",
        branch: profileData?.branch || "",
        section: profileData?.section || "",
        year: profileData?.year || "",
        photoURL: profileData?.photoURL || "",
        firebasePhotoURL: profileData?.firebasePhotoURL || "",
        displayPhotoURL:
          profileData?.displayPhotoURL ||
          profileData?.photoURL ||
          profileData?.firebasePhotoURL ||
          user.photoURL ||
          ""
      }
    : null

  const userInitial =
    resolvedProfile?.name?.charAt(0)?.toUpperCase() ||
    resolvedProfile?.email?.charAt(0)?.toUpperCase() ||
    user?.displayName?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    "U"

  const avatarPhotoURL = String(
    resolvedProfile?.displayPhotoURL ||
      resolvedProfile?.photoURL ||
      resolvedProfile?.firebasePhotoURL ||
      user?.photoURL ||
      ""
  )

  const logout = async () => {
    await signOut(auth)
    router.push("/")
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }

      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleNavButtonClick = (button: NavbarButton) => {
    if (button.onClick) {
      button.onClick()
    }

    if (button.href) {
      router.push(button.href)
    }
  }

  const handleProfileClick = () => {
    setOpen(false)

    if (onProfileClick) {
      onProfileClick()
      return
    }

    setShowProfile(true)
  }

  const resolvedButtons = navButtons && navButtons.length > 0 ? navButtons : defaultNavButtons

  const renderNavButton = (button: NavbarButton, index: number) => {
    const variant = button.variant || "glass"

    if (variant === "orders") {
      const orderCount = typeof button.badge === "number" ? button.badge : 0

      return (
        <button
          key={`${button.label}-${index}`}
          onClick={() => handleNavButtonClick(button)}
          className="group relative"
        >
          {orderCount > 0 ? (
            <div className="absolute -right-2 -top-2 z-10">
              <div className="flex h-5 w-5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {orderCount > 99 ? "99+" : orderCount}
                </span>
              </div>
            </div>
          ) : null}

          <div className="relative overflow-hidden rounded-xl bg-gradient-to-bl from-gray-900 via-gray-950 to-black p-[1px] shadow-2xl shadow-emerald-500/20">
            <div className="relative flex items-center gap-3 rounded-xl bg-gray-950 px-4 py-2.5 transition-all duration-300 group-hover:bg-gray-950/50">
              <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 transition-transform duration-300 group-hover:scale-110">
                <svg
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4 text-white"
                  aria-hidden="true"
                >
                  <path
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 rounded-lg bg-emerald-500/50 blur-sm transition-all duration-300 group-hover:blur-md" />
              </div>

              <div className="flex flex-col items-start text-left leading-tight">
                <span className="text-sm font-semibold text-white">{button.label}</span>
                <span className="text-[10px] font-medium text-emerald-400/80">Track your print status</span>
              </div>

              <div className="ml-auto flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 transition-transform duration-300 group-hover:scale-150" />
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/50 transition-transform duration-300 group-hover:scale-150 group-hover:delay-100" />
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/30 transition-transform duration-300 group-hover:scale-150 group-hover:delay-200" />
              </div>
            </div>

            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 opacity-20 transition-opacity duration-300 group-hover:opacity-40" />
          </div>
        </button>
      )
    }

    if (variant === "dashboardBack") {
      
      
    }

    if (variant === "contact") {
      return (
        <div key={`${button.label}-${index}`} className="relative">
          <button
            onClick={() => handleNavButtonClick(button)}
            className="group relative flex min-h-[2.35rem] min-w-[7rem] max-w-full cursor-pointer items-center justify-start rounded-full bg-white/10 py-1.5 shadow-[inset_1px_2px_5px_#00000080] transition-[background-color] duration-[0.8s] ease-[cubic-bezier(0.510,0.026,0.368,1.016)] hover:bg-green-400 sm:min-h-[2.92rem] sm:min-w-[8.5rem] sm:py-2"
          >
            <div className="absolute inset-0 flex items-center justify-start px-1 py-0.5">
              <div className="w-[0%] transition-all duration-[1s] ease-[cubic-bezier(0.510,0.026,0.368,1.016)] group-hover:w-full" />

              <div className="flex h-full aspect-square items-center justify-center rounded-full bg-green-400 shadow-[inset_1px_-1px_3px_0_black] transition-all duration-[1s] ease-[cubic-bezier(0.510,0.026,0.368,1.016)] group-hover:bg-black">
                <div className="size-[0.75rem] text-black transition-transform duration-[1s] ease-[cubic-bezier(0.510,0.026,0.368,1.016)] group-hover:-rotate-45 group-hover:text-white sm:size-[0.8rem]">
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path fill="currentColor" d="M12.175 9H0V7H12.175L6.575 1.4L8 0L16 8L8 16L6.575 14.6L12.175 9Z"/>
                  </svg>
                </div>
              </div>
            </div>

            <div className="pl-[2.8rem] pr-[0.8rem] text-xs text-black transition-[padding] duration-[1s] ease-[cubic-bezier(0.510,0.026,0.368,1.016)] group-hover:pl-[0.8rem] group-hover:pr-[2.8rem] group-hover:text-black dark:text-white dark:group-hover:text-black sm:pl-[3.4rem] sm:pr-[1.1rem] sm:text-sm sm:group-hover:pl-[1.1rem] sm:group-hover:pr-[3.4rem]">
              {button.label}
            </div>
          </button>

          {typeof button.badge === "number" && button.badge > 0 ? (
            <span className="absolute -top-2 -right-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-2 py-1 text-[10px] leading-none text-white shadow-md">
              {button.badge}
            </span>
          ) : null}
        </div>
      )
    }

    if (variant === "back") {
      return (
        <div key={`${button.label}-${index}`} className="relative">
          <button
            onClick={() => handleNavButtonClick(button)}
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 backdrop-blur-md transition-all duration-300 hover:bg-gray-200 sm:px-4 sm:py-2 sm:text-sm dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M3.825 7H16v2H3.825l5.6 5.6L8 16 0 8 8 0l1.425 1.4L3.825 7z" />
            </svg>
            <span>{button.label}</span>
          </button>

          {typeof button.badge === "number" && button.badge > 0 ? (
            <span className="absolute -top-2 -right-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-2 py-1 text-[10px] leading-none text-white shadow-md">
              {button.badge}
            </span>
          ) : null}
        </div>
      )
    }

    if (variant === "accent") {
      return (
        <div key={`${button.label}-${index}`} className="relative">
          <button
            onClick={() => handleNavButtonClick(button)}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-300/20 bg-gradient-to-r from-indigo-500 to-cyan-500 px-3 py-1.5 text-xs font-medium text-white transition-all duration-300 hover:scale-[1.03] sm:px-4 sm:py-2 sm:text-sm"
          >
            <span>{button.label}</span>
          </button>

          {typeof button.badge === "number" && button.badge > 0 ? (
            <span className="absolute -top-2 -right-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-2 py-1 text-[10px] leading-none text-white shadow-md">
              {button.badge}
            </span>
          ) : null}
        </div>
      )
    }

    const sharedClasses =
      "group relative inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-700 backdrop-blur-md transition-[background-color,border-color,transform] duration-300 hover:bg-gray-200 sm:px-5 sm:py-2 sm:text-sm dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"

    return (
      <div key={`${button.label}-${index}`} className="relative">
        <button
          onClick={() => handleNavButtonClick(button)}
          className={sharedClasses}
        >
          <span className="transition-transform duration-300 group-hover:translate-x-[2px]">
            {button.label}
          </span>

          <svg
            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-[3px] group-hover:rotate-90"
            viewBox="0 0 16 19"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M7 18C7 18.5523 7.44772 19 8 19C8.55228 19 9 18.5523 9 18H7ZM8.70711 0.292893C8.31658 -0.0976311 7.68342 -0.0976311 7.29289 0.292893L0.928932 6.65685C0.538408 7.04738 0.538408 7.68054 0.928932 8.07107C1.31946 8.46159 1.95262 8.46159 2.34315 8.07107L8 2.41421L13.6569 8.07107C14.0474 8.46159 14.6805 8.46159 15.0711 8.07107C15.4616 7.68054 15.4616 7.04738 15.0711 6.65685L8.70711 0.292893ZM9 18L9 1H7L7 18H9Z" />
          </svg>
        </button>

        {typeof button.badge === "number" && button.badge > 0 ? (
          <span className="absolute -top-2 -right-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-2 py-1 text-[10px] leading-none text-white shadow-md">
            {button.badge}
          </span>
        ) : null}
      </div>
    )
  }

  const renderMobileMenuButton = (button: NavbarButton, index: number) => (
    <button
      key={`mobile-${button.label}-${index}`}
      onClick={() => {
        handleNavButtonClick(button)
        setMobileMenuOpen(false)
      }}
      className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
    >
      <span>{button.label}</span>
      {typeof button.badge === "number" && button.badge > 0 ? (
        <span className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-2 py-1 text-[10px] leading-none text-white">
          {button.badge}
        </span>
      ) : null}
    </button>
  )

  return (
    <>
      {showSpacer ? <div className="h-28 md:h-32" /> : null}

      <div className="fixed top-6 z-50 flex w-full justify-center px-3 md:px-0">
        <nav className="flex w-full max-w-[1400px] items-center justify-between rounded-3xl border border-gray-200 bg-white/70 px-4 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.2)] backdrop-blur-3xl transition-all duration-300 hover:scale-[1.01] dark:border-white/20 dark:bg-black/40 dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] md:px-10 md:py-4">
          <h1
            className="cursor-pointer text-xl font-bold text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text md:text-2xl"
            onClick={() => router.push(logoHref)}
          >
            PrintMyPage
          </h1>

          <div className="flex items-center gap-3 sm:gap-4 md:gap-8">
            <div className="hidden items-center gap-5 md:flex">
              {resolvedButtons.map((button, index) => renderNavButton(button, index))}
            </div>

            <div className="relative md:hidden" ref={mobileMenuRef}>
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white/80 text-gray-700 transition hover:bg-gray-200 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>

              {mobileMenuOpen ? (
                <div className="absolute right-0 z-50 mt-3 w-64 rounded-2xl border border-gray-200 bg-white/90 p-3 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1423]/95">
                  <div className="space-y-2">
                    {resolvedButtons.map((button, index) => renderMobileMenuButton(button, index))}
                  </div>

                  {!user && !hideGuestAuthButtons ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false)
                          router.push("/user/login")
                        }}
                        className="rounded-xl border border-gray-300 bg-white/80 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-200 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false)
                          router.push("/user/register")
                        }}
                        className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-3 py-2 text-sm text-white transition hover:opacity-90"
                      >
                        Register
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <CandleThemeToggle />

            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setOpen((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-sm font-bold text-black shadow-lg transition hover:scale-105"
                  aria-label="Open profile menu"
                >
                  {avatarPhotoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPhotoURL}
                      alt={resolvedProfile?.name || "User"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    userInitial
                  )}
                </button>

                {open ? (
                  <div className="absolute right-0 z-50 mt-4 w-64 space-y-3
                    rounded-2xl
                    bg-white/70
                    backdrop-blur-3xl
                    border border-gray-200
                    shadow-[0_8px_40px_rgba(0,0,0,0.2)]
                    p-4
                    dark:border-white/20
                    dark:bg-black/40
                    dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)]
                    ">
                    <div className="break-all border-b border-gray-300 pb-2 text-sm text-gray-700 dark:border-white/10 dark:text-gray-300">
                      {user.email}
                    </div>

                    <button
                      onClick={handleProfileClick}
                      className="block w-full text-left transition hover:text-indigo-400"
                    >
                      View Profile
                    </button>

                    {showOrdersMenuItem ? (
                      <button
                        onClick={() => {
                          setOpen(false)
                          router.push("/user/orders")
                        }}
                        className="block w-full text-left transition hover:text-indigo-400"
                      >
                        My Orders
                      </button>
                    ) : null}

                    <button
                      onClick={logout}
                      className="block w-full text-left text-red-500 transition hover:text-red-400"
                    >
                      Logout
                    </button>
                  </div>
                ) : null}
              </div>
            ) : hideGuestAuthButtons ? null : (
              <div className="hidden items-center gap-2 md:flex">
                <button
                  onClick={() => router.push("/user/login")}
                  className="rounded-full border border-gray-300 bg-white/80 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-200 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  Sign In
                </button>

                <button
                  onClick={() => router.push("/user/register")}
                  className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 text-sm text-white transition hover:scale-105"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>

      {showProfile && user && resolvedProfile ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <button
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            onClick={() => setShowProfile(false)}
            aria-label="Close profile modal"
          />

          <div className="relative z-10 w-[520px] max-w-[95%] animate-[scale-in_0.9s_ease]">
            <ProfileCard
              title="My Profile"
              profile={resolvedProfile}
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
