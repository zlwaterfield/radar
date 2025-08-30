import { betterAuth } from 'better-auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL!,
  },
  
  emailAndPassword: {
    enabled: false, // We only use OAuth
  },
  
  socialProviders: {
    slack: {
      clientId: process.env.SLACK_APP_CLIENT_ID!,
      clientSecret: process.env.SLACK_APP_CLIENT_SECRET!,
      redirectURI: `${process.env.CALLBACK_API_HOST}/api/auth/callback/slack`,
      scope: [
        'chat:write',
        'chat:write.public', 
        'commands',
        'users:read',
        'users:read.email',
        'team:read',
        'im:history',
        'im:read',
        'im:write',
        'app_mentions:read'
      ],
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectURI: `${process.env.CALLBACK_API_HOST}/api/auth/callback/github`,
      scope: ['user:email', 'read:user', 'repo', 'read:org'],
    },
  },
  
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  
  advanced: {
    cookiePrefix: 'radar-auth',
    crossSubDomainCookies: {
      enabled: true,
      domain: process.env.NODE_ENV === 'production' ? '.radarnotifications.com' : 'localhost',
    },
  },
  
  logger: {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  },
  
  trustedOrigins: [
    process.env.FRONTEND_URL!,
    process.env.CALLBACK_API_HOST!,
  ],
  
  callbacks: {
    async signIn({ user, account }: { user: any; account: any }) {
      // Custom logic for handling user sign-in
      // This is where we'll integrate with our existing user management
      console.log('User signing in:', { userId: user.id, provider: account?.providerId });
      return true;
    },
    
    async signUp({ user, account }: { user: any; account: any }) {
      // Custom logic for new user registration
      console.log('New user signing up:', { userId: user.id, provider: account?.providerId });
      return true;
    },
  },
});