import NextAuth, { type DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      passwordChangedAt?: Date | string | null;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string;
    passwordChangedAt?: Date | null;
  }
}
