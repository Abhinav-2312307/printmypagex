export const USER_ROLES = ["USER", "SUPPLIER", "ADMIN"] as const

export type UserRole = (typeof USER_ROLES)[number]

type RoleCarrier = {
  role?: string | null
  roles?: Array<string | null | undefined> | null
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole)
}

export function extractUserRoles(
  input: RoleCarrier | UserRole | UserRole[] | null | undefined
): UserRole[] {
  if (!input) {
    return []
  }

  if (typeof input === "string") {
    return isUserRole(input) ? [input] : []
  }

  if (Array.isArray(input)) {
    return [...new Set(input.filter(isUserRole))]
  }

  const roles = [...new Set((input.roles || []).filter(isUserRole))]

  if (isUserRole(input.role) && !roles.includes(input.role)) {
    roles.unshift(input.role)
  }

  return roles
}

export function resolvePrimaryUserRole(
  input: RoleCarrier | UserRole | UserRole[] | null | undefined,
  fallback: UserRole = "USER"
): UserRole {
  if (input && typeof input === "object" && !Array.isArray(input) && isUserRole(input.role)) {
    return input.role
  }

  return extractUserRoles(input)[0] || fallback
}

export function resolveUserRoleState(
  input: RoleCarrier | UserRole | UserRole[] | null | undefined,
  fallback: UserRole = "USER"
) {
  const role = resolvePrimaryUserRole(input, fallback)
  const roles = [...new Set([...extractUserRoles(input), role])]

  return {
    role,
    roles
  }
}

export function hasUserRole(
  input: RoleCarrier | UserRole | UserRole[] | null | undefined,
  role: UserRole
) {
  if (!input) {
    return false
  }

  const roles = extractUserRoles(input)

  if (roles.length === 0) {
    return role === "USER"
  }

  return roles.includes(role)
}

export function mergeUserRoles(
  current: RoleCarrier | null | undefined,
  rolesToAdd: UserRole[],
  options: {
    preferredRole?: UserRole
    fallbackRole?: UserRole
    preserveAdmin?: boolean
  } = {}
) {
  const fallbackRole = options.fallbackRole || "USER"
  const currentState = current ? resolveUserRoleState(current, fallbackRole) : null
  const currentPrimaryRole = currentState?.role

  const roles = [
    ...new Set([...(currentState?.roles || []), ...rolesToAdd.filter(isUserRole)])
  ]

  let role = currentPrimaryRole || fallbackRole

  if (
    options.preferredRole &&
    isUserRole(options.preferredRole) &&
    !(options.preserveAdmin !== false && currentPrimaryRole === "ADMIN")
  ) {
    role = options.preferredRole
  }

  if (!roles.includes(role)) {
    roles.unshift(role)
  }

  return {
    role,
    roles
  }
}

export function removeUserRoles(
  current: RoleCarrier | null | undefined,
  rolesToRemove: UserRole[],
  options: {
    preferredRole?: UserRole
    fallbackRole?: UserRole
  } = {}
) {
  const fallbackRole = options.fallbackRole || "USER"
  const currentState = resolveUserRoleState(current, fallbackRole)
  const removalSet = new Set(rolesToRemove.filter(isUserRole))

  let roles = currentState.roles.filter((role) => !removalSet.has(role))
  let role = currentState.role

  if (!roles.includes(role)) {
    if (options.preferredRole && roles.includes(options.preferredRole)) {
      role = options.preferredRole
    } else {
      role = roles[0] || fallbackRole
    }
  }

  if (!roles.includes(role)) {
    roles = [role, ...roles]
  }

  return {
    role,
    roles
  }
}
