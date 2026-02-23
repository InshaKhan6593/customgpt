import "next-auth/jwt"

export type UserRole = "USER" | "DEVELOPER" | "ADMIN"

export type { User } from "next-auth"

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's postal address. */
      id: string
      role: UserRole
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }

  interface User {
    id: string
    role: UserRole
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: UserRole
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    id?: string
    role?: UserRole
  }
}
