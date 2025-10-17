import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  baseURL: process.env.API_URL,

  emailAndPassword: {
    enabled: true,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectURI: `${process.env.API_URL}/api/auth/callback/google`,
    },
  },

  logger: {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  },

  trustedOrigins: [process.env.FRONTEND_URL!],
});
