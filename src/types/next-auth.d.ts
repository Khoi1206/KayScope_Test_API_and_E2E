import 'next-auth'
import 'next-auth/jwt'

/**
 * Extend NextAuth v4 types so TypeScript understands
 * that session.user.id and token.id exist.
 *
 * Module augmentation — generates no runtime code.
 */
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
  }
}
