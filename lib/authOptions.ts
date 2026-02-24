/**
 * NextAuth.js Configuration for Fine & Country Zimbabwe ERP
 *
 * This integrates with Neon Auth and Prisma for:
 * - Session-based authentication with JWT strategy
 * - Role-based access control (ADMIN, MANAGER, AGENT, ACCOUNT, CLIENT)
 * - Prisma adapter for user persistence
 *
 * Note: This system uses email + demo password authentication.
 * The CredentialsProvider validates users by email lookup and demo password check.
 * In production, implement proper OAuth or add password field to User model.
 */

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import type { UserRole } from "../types/next-auth";
import bcrypt from "bcryptjs";

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is required. Please set it in your .env.local file.');
}

export const authOptions: NextAuthOptions = {
  // Use Prisma adapter for session/account persistence
  adapter: PrismaAdapter(prisma) as any,
  
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log("[NEXTAUTH] authorize() called with email:", credentials?.email);
        
        if (!credentials?.email) {
          console.log("[NEXTAUTH] No email provided");
          return null;
        }

        if (!credentials?.password) {
          console.log("[NEXTAUTH] No password provided");
          return null;
        }

        try {
          console.log("[NEXTAUTH] Looking up user:", credentials.email);
          
          // Find user by email using singleton prisma client
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase() },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              branch: true,
              isActive: true,
              password: true,
            },
          }) as any;

          if (!user) {
            console.log("[NEXTAUTH] User not found:", credentials.email);
            return null;
          }

          if (!user.isActive) {
            console.log("[NEXTAUTH] User is inactive:", credentials.email);
            return null;
          }

          // Check bcrypt password
          if (!user.password) {
            console.log("[NEXTAUTH] User has no password set:", credentials.email);
            return null;
          }

          // Validate password complexity
          const password = credentials.password;
          if (password.length < 8) {
            console.log("[NEXTAUTH] Password too short:", credentials.email);
            return null;
          }
          if (!/[A-Z]/.test(password)) {
            console.log("[NEXTAUTH] Password missing uppercase letter:", credentials.email);
            return null;
          }
          if (!/[a-z]/.test(password)) {
            console.log("[NEXTAUTH] Password missing lowercase letter:", credentials.email);
            return null;
          }
          if (!/[0-9]/.test(password)) {
            console.log("[NEXTAUTH] Password missing number:", credentials.email);
            return null;
          }

          // Check password expiration (90 days)
          const passwordChangedAt = user.passwordChangedAt || user.createdAt;
          const daysSinceChange = Math.floor((Date.now() - new Date(passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceChange > 90) {
            console.log("[NEXTAUTH] Password expired for:", credentials.email, "days since change:", daysSinceChange);
            // Return user with a flag indicating password change is required
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              branch: user.branch || undefined,
              passwordChangeRequired: true
            };
          }

          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) {
            console.log("[NEXTAUTH] Invalid password for:", credentials.email);
            return null;
          }

          console.log("[NEXTAUTH] User authenticated:", {
            id: user.id,
            email: user.email,
            role: user.role,
          });

          // Return user object for JWT (exclude password)
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            branch: user.branch || undefined,
          };
        } catch (error) {
          console.error("[NEXTAUTH] Auth error:", error);
          return null;
        }
      },
    }),
    // Google Provider - only enable if credentials are provided
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle Google OAuth sign-in
      if (account?.provider === "google") {
        console.log("[NEXTAUTH] Google sign-in detected:", user.email);
        
        // Check if user exists in database
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! }
        });

        if (!existingUser) {
          // New user from Google - create with default CLIENT role
          console.log("[NEXTAUTH] Creating new user from Google OAuth:", user.email);
          await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name || profile?.name,
              image: user.image,
              role: 'CLIENT', // Default role for Google sign-ins
              branch: 'Harare', // Default branch
              isActive: true,
              emailVerified: new Date(),
            }
          });
        } else if (!existingUser.isActive) {
          // User exists but is inactive
          console.log("[NEXTAUTH] Inactive user attempted Google sign-in:", user.email);
          return false;
        } else {
          // Update last login
          await prisma.user.update({
            where: { email: user.email! },
            data: { lastLogin: new Date() }
          });
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      // Initial sign-in: persist user data in JWT
      if (user) {
        // For Google OAuth, fetch user from database to get role and name
        if (account?.provider === "google") {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
            select: { id: true, name: true, role: true, branch: true, isActive: true }
          });
          
          if (dbUser) {
            token.id = dbUser.id;
            token.name = dbUser.name || user.name || null;
            token.role = (dbUser.role?.toUpperCase() as UserRole) || "CLIENT";
            token.branch = dbUser.branch ?? undefined;
          }
        } else {
          // For credentials provider - name is already in user object from authorize()
          token.id = user.id;
          token.name = (user as any).name || null;
          token.role = ((user as any).role?.toUpperCase() as UserRole) || "CLIENT";
          token.branch = (user as any).branch;
          // Check if password change is required
          if ((user as any).passwordChangeRequired) {
            token.passwordChangeRequired = true;
          }
        }
        
        console.log("[NEXTAUTH] JWT created:", {
          id: token.id,
          role: token.role,
        });
      } else if (token?.id) {
        // Existing session: always refresh role from DB to fix stale JWT (e.g. role changed)
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, name: true, branch: true, isActive: true }
          });
          if (dbUser) {
            // Check if role has changed - invalidate session if so
            const currentRole = token.role;
            const newRole = dbUser.role?.toUpperCase();
            if (newRole && currentRole !== newRole) {
              console.log("[NEXTAUTH] Role changed, session should be invalidated:", {
                oldRole: currentRole,
                newRole: newRole
              });
              // Set a flag to indicate session should be invalidated
              token.invalidate = true;
            }
            token.role = (newRole || "CLIENT") as UserRole;
            token.name = dbUser.name || token.name;
            token.branch = dbUser.branch ?? token.branch;
          }
        } catch (e) {
          console.warn("[NEXTAUTH] Failed to refresh role from DB:", e);
        }
      }
      return token;
    },

    async session({ session, token }) {
      // Check if session should be invalidated due to role change
      if (token.invalidate) {
        console.log("[NEXTAUTH] Session invalidated due to role change");
        throw new Error("SESSION_INVALIDATED");
      }

      // Check if password change is required
      if (token.passwordChangeRequired) {
        console.log("[NEXTAUTH] Password change required for user:", token.id);
        session.user.passwordChangeRequired = true;
      }

      // Include role, id, and name in client-accessible session
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = (token.name as string) || null;
        // Always propagate role as uppercase string
        session.user.role = token.role as UserRole;
        session.user.branch = token.branch;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      console.log('[NEXTAUTH] redirect() called:', { url, baseUrl });
      
      // If the url is relative, prepend base URL
      if (url.startsWith("/")) {
        const fullUrl = `${baseUrl}${url}`;
        console.log('[NEXTAUTH] Relative URL, redirecting to:', fullUrl);
        return fullUrl;
      }
      
      // If same origin, allow
      if (new URL(url).origin === baseUrl) {
        console.log('[NEXTAUTH] Same origin, redirecting to:', url);
        return url;
      }
      
      // For successful sign-in, redirect to post-login for role-based routing
      console.log('[NEXTAUTH] External origin or default, redirecting to post-login');
      return `${baseUrl}/post-login`;
    },
  },

  events: {
    signIn({ user }) {
      // Log login to audit trail - non-blocking (fire and forget)
      try {
        // Schedule audit log creation without awaiting (prevents "message channel closed" error)
        if (typeof window === 'undefined') {
          // Server-side: Use Promise without await
          import('@prisma/client').then(({ PrismaClient }) => {
            const prisma = new PrismaClient();
            prisma.activityLog.create({
              data: {
                branch: (user as any).branch || 'Harare',
                userId: user.id,
                action: 'LOGIN',
                module: 'AUTH',
                recordId: user.id || 'N/A',
                description: `User ${user.email} logged in successfully`,
              },
            })
              .then(() => {
                prisma.$disconnect();
                console.log('[AUDIT] Login recorded for:', user.email);
              })
              .catch((error) => {
                console.error('[AUDIT] Failed to log login:', error);
                prisma.$disconnect();
              });
          }).catch(error => console.error('[AUDIT] Failed to import Prisma:', error));
        }
      } catch (error) {
        console.error('[AUDIT] Error in signIn event:', error);
      }
    },
    signOut({ token }) {
      // Log logout to audit trail - non-blocking (fire and forget)
      try {
        // Schedule audit log creation without awaiting (prevents "message channel closed" error)
        if (typeof window === 'undefined') {
          // Server-side: Use Promise without await
          import('@prisma/client').then(({ PrismaClient }) => {
            const prisma = new PrismaClient();
            prisma.activityLog.create({
              data: {
                branch: (token as any).branch || 'Harare',
                userId: token.sub || null,
                action: 'LOGOUT',
                module: 'AUTH',
                recordId: token.sub || 'N/A',
                description: `User ${(token as any).email || 'unknown'} logged out`,
              },
            })
              .then(() => {
                prisma.$disconnect();
                console.log('[AUDIT] Logout recorded');
              })
              .catch((error) => {
                console.error('[AUDIT] Failed to log logout:', error);
                prisma.$disconnect();
              });
          }).catch(error => console.error('[AUDIT] Failed to import Prisma:', error));
        }
      } catch (error) {
        console.error('[AUDIT] Error in signOut event:', error);
      }
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours (reduced from 30 days for security)
    updateAge: 60 * 60, // Update session every hour
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  secret: process.env.NEXTAUTH_SECRET,

  debug: process.env.NODE_ENV === "development",
};

export default authOptions;
