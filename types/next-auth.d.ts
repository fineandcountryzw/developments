// Type definitions for Auth.js extending default session
import { DefaultSession, DefaultUser } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

// User roles matching Prisma enum
type UserRole = 'ADMIN' | 'MANAGER' | 'AGENT' | 'ACCOUNT' | 'CLIENT' | 'DEVELOPER';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      branch?: string;
      passwordChangeRequired?: boolean;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    id: string;
    role: UserRole;
    branch?: string;
    passwordChangeRequired?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    name?: string | null;
    role: UserRole;
    branch?: string;
    passwordChangeRequired?: boolean;
    invalidate?: boolean;
  }
}
