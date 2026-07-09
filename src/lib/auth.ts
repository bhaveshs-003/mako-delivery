/**
 * NextAuth configuration (spec §1: credentials provider for v1, SSO-ready).
 *
 * The user's role is embedded in the JWT and surfaced on the session so both
 * middleware (edge) and API routes can make authorization decisions without a
 * DB round-trip. Deactivated users are rejected at sign-in AND on every token
 * refresh (see the jwt callback) so revoking access takes effect immediately.
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./db";
import type { UserRole } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });
        // Fail closed: no user, deactivated, or bad password → no session.
        if (!user || !user.isActive) return null;

        const valid = await compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: UserRole }).role;
      }
      // Re-check activation on every refresh so deactivation is immediate.
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { isActive: true, role: true },
        });
        if (!dbUser || !dbUser.isActive) {
          // Mark the token invalid; session callback will surface it.
          token.deactivated = true;
        } else {
          token.role = dbUser.role;
          token.deactivated = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.deactivated) {
        // Return a session with no user so downstream guards reject it.
        return { ...session, user: undefined } as typeof session;
      }
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: UserRole }).role = token.role as UserRole;
      }
      return session;
    },
  },
};
