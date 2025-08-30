import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
  },

  logger: {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  },

  trustedOrigins: [process.env.FRONTEND_URL!],
});
