import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';
import { EmailService } from '../email/email.service';

const prisma = new PrismaClient();
const emailService = new EmailService();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  baseURL: process.env.FRONTEND_URL,

  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      if (!emailService.isConfigured()) {
        console.warn(
          'Email service not configured. Password reset email not sent.',
        );
        return;
      }

      await emailService.sendPasswordResetEmail({
        to: user.email,
        resetUrl: url,
        expirationTime: '1 hour',
      });
    },
    resetPasswordTokenExpiresIn: 3600, // 1 hour in seconds
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectURI: `${process.env.API_URL}/api/auth/callback/google`,
    },
  },

  advanced: {
    useSecureCookies: true,
  },

  logger: {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  },

  trustedOrigins: [process.env.FRONTEND_URL!],
});
