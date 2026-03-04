import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { MongoDBUserRepository } from '@/modules/auth/infrastructure/repositories/mongodb-user.repository'
import { LoginUseCase } from '@/modules/auth/domain/usecases/login.usecase'

/**
 * authOptions — NextAuth v4 (stable) configuration.
 *
 * Exported and shared between:
 * - API route: app/api/auth/[...nextauth]/route.ts
 * - Server helper: getServerSession(authOptions)
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          // Manual dependency injection (no IoC container)
          const userRepository = new MongoDBUserRepository()
          const loginUseCase = new LoginUseCase(userRepository)

          const user = await loginUseCase.execute({
            email: credentials.email,
            password: credentials.password,
          })

          // NextAuth requires an object with an `id` field
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.avatar ?? null,
          }
        } catch {
          // authorize must return null on failure (do not throw)
          return null
        }
      },
    }),
  ],

  /**
   * JWT strategy: token stored in an httpOnly cookie.
   * No database session needed — simpler and scales better.
   */
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    /**
     * jwt callback: adds user.id to the token.
     * Runs on sign-in or whenever the session is accessed.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },

    /**
     * session callback: exposes token.id in session.user.
     * Allows client-side code to access the user id.
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },

  pages: {
    signIn: '/login',     // Redirect to /login instead of /api/auth/signin
    error: '/login',      // Redirect errors back to the login page
  },

  // Required in production — use a long random string in .env.local
  secret: process.env.NEXTAUTH_SECRET,

  // Enable debug logs in development
  debug: process.env.NODE_ENV === 'development',
}
