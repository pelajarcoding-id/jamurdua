import 'server-only';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { authConfig } from './auth.config';
import { Prisma } from '@prisma/client';

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const emailInput = String(credentials.email).trim()
        if (!emailInput) return null

        const user = await prisma.user.findFirst({
          where: {
            email: {
              equals: emailInput,
              mode: 'insensitive',
            },
          },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const bcrypt = (await import('bcrypt')).default;
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (isValid) {
          let kebunIds: number[] = [];
          try {
            const rows = await prisma.$queryRaw<Array<{ id: number }>>(
              Prisma.sql`SELECT "A" as id FROM "_UserKebuns" WHERE "B" = ${user.id}`
            );
            kebunIds = rows.map(r => r.id);
          } catch {
            kebunIds = [];
          }
          return { 
            id: user.id.toString(), 
            name: user.name, 
            email: user.email, 
            role: user.role, 
            kebunId: user.kebunId,
            kebunIds: kebunIds
          };
        } else {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.kebunId = (user as any).kebunId;
        token.kebunIds = (user as any).kebunIds;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        (session.user as any).kebunId = token.kebunId as number;
        (session.user as any).kebunIds = token.kebunIds as number[];
      }
      return session;
    },
  },
});
