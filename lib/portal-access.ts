"use client"

import { authFetch } from "@/lib/client-auth"
import { isOwnerEmail } from "@/lib/owner-access"
import { hasUserRole, type UserRole } from "@/lib/user-roles"

type UserPortalRecord = {
  role?: UserRole
  roles?: UserRole[]
  active?: boolean
  approved?: boolean
}

type SupplierPortalRecord = {
  approved?: boolean
  active?: boolean
}

export const USER_ROLE_PROMPT_MESSAGE =
  "You were already registered as a supplier. Do you want to register as a user too? We'll reuse your saved details."

async function readJson<T>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T
  } catch {
    return {} as T
  }
}

export async function syncUserIdentity(uid: string, email: string, photoURL: string) {
  await authFetch("/api/user/check-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      firebaseUID: uid,
      email,
      photoURL
    })
  })
}

export async function syncSupplierIdentity(uid: string, email: string, photoURL: string) {
  await authFetch("/api/supplier/sync-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      firebaseUID: uid,
      email,
      photoURL
    })
  })
}

export async function fetchUserDetails(uid: string) {
  const res = await authFetch(`/api/user/details?firebaseUID=${uid}`)

  if (res.status === 404) {
    return null
  }

  const data = await readJson<{ user?: UserPortalRecord; error?: string }>(res)

  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch user details")
  }

  return data.user || null
}

export async function fetchSupplierProfile(uid: string) {
  const res = await authFetch(`/api/supplier/me?firebaseUID=${uid}`)
  const data = await readJson<{ supplier?: SupplierPortalRecord; message?: string }>(res)

  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch supplier details")
  }

  return data.supplier || null
}

export function getSupplierPortalDestination(supplier: SupplierPortalRecord | null | undefined) {
  if (!supplier) {
    return "/supplier/apply"
  }

  if (!supplier.approved || !supplier.active) {
    return "/supplier"
  }

  return "/supplier/dashboard"
}

export async function resolveUserPortalDestination({
  uid,
  email,
  photoURL,
  confirmSupplierPromotion
}: {
  uid: string
  email: string
  photoURL: string
  confirmSupplierPromotion: () => boolean | Promise<boolean>
}) {
  if (isOwnerEmail(email)) {
    return "/admin"
  }

  await syncUserIdentity(uid, email, photoURL)

  const user = await fetchUserDetails(uid)

  if (user) {
    if (hasUserRole(user, "ADMIN")) {
      return "/admin"
    }

    if (user.active === false || user.approved === false) {
      throw new Error("Your account is not allowed to login right now.")
    }

    if (hasUserRole(user, "USER")) {
      return "/user/dashboard"
    }
  }

  const supplier = await fetchSupplierProfile(uid)
  const supplierBackedAccount = Boolean(supplier) || hasUserRole(user, "SUPPLIER")

  if (!supplierBackedAccount) {
    return "/complete-profile"
  }

  const accepted = await confirmSupplierPromotion()

  if (!accepted) {
    return getSupplierPortalDestination(supplier)
  }

  const registerRes = await authFetch("/api/user/register-as-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      firebaseUID: uid,
      email,
      photoURL
    })
  })

  const registerData = await readJson<{
    success?: boolean
    message?: string
    user?: UserPortalRecord
  }>(registerRes)

  if (!registerRes.ok || !registerData.success) {
    throw new Error(registerData.message || "Failed to register you as a user.")
  }

  const promotedUser = registerData.user

  if (promotedUser && (promotedUser.active === false || promotedUser.approved === false)) {
    throw new Error("Your account is not allowed to login right now.")
  }

  return "/user/dashboard"
}

export async function resolveSupplierPortalDestination({
  uid,
  email,
  photoURL
}: {
  uid: string
  email: string
  photoURL: string
}) {
  if (isOwnerEmail(email)) {
    return "/supplier/dashboard"
  }

  await syncUserIdentity(uid, email, photoURL)
  await syncSupplierIdentity(uid, email, photoURL)

  const supplier = await fetchSupplierProfile(uid)

  return getSupplierPortalDestination(supplier)
}
