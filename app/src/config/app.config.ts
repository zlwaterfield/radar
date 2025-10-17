import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'Radar',
  environment: process.env.NODE_ENV || 'development',
  debug: process.env.DEBUG === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',

  // API settings
  host: process.env.API_HOST || '0.0.0.0',
  port: parseInt(process.env.API_PORT || '3003', 10),
  apiUrl: process.env.API_URL || 'http://localhost:3003',
  callbackHost: process.env.CALLBACK_API_HOST || 'http://localhost:3003',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',

  // CORS settings
  corsOrigins: process.env.FRONTEND_URL?.split(',') || [
    'http://localhost:3001',
  ],

  // Security
  secretKey: process.env.SECRET_KEY!,
  algorithm: 'HS256',

  // Trigger.dev
  triggerProjectRef: process.env.TRIGGER_PROJECT_REF,
  triggerSecretKey: process.env.TRIGGER_SECRET_KEY,
}));
