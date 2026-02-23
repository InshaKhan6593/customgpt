export type UserRole = "USER" | "DEVELOPER" | "ADMIN"

export interface User {
  name: string
  email: string
  role: UserRole
}
