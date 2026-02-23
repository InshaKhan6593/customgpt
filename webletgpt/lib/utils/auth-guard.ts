import { auth } from "@/lib/auth"
import type { UserRole } from "@/lib/types"

const roleHierarchy: Record<UserRole, number> = {
  USER: 1,
  DEVELOPER: 2,
  ADMIN: 3,
}

export class AuthorizationError extends Error {
  constructor(message = "Insufficient permissions") {
    super(message)
    this.name = "AuthorizationError"
  }
}

/**
 * Validates the current user's role against a required minimum role.
 * Throws an AuthorizationError if the user is unauthenticated or lacks the required role.
 */
export async function requireRole(minimumRole: UserRole = "USER") {
  const session = await auth()

  if (!session?.user) {
    throw new AuthorizationError("Not authenticated")
  }

  const userRoleLevel = roleHierarchy[session.user.role] || 0
  const requiredRoleLevel = roleHierarchy[minimumRole]

  if (userRoleLevel < requiredRoleLevel) {
    throw new AuthorizationError(`Required role: ${minimumRole}`)
  }

  return session.user
}

export const requireUser = () => requireRole("USER")
