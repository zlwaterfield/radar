import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  name: process.env.APP_NAME || 'Radar',
  environment: process.env.NODE_ENV || 'development',
  debug: process.env.DEBUG === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // API settings
  host: process.env.API_HOST || '0.0.0.0',
  port: parseInt(process.env.API_PORT || '3000', 10),
  callbackHost: process.env.CALLBACK_API_HOST || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  
  // CORS settings
  corsOrigins: process.env.BACKEND_CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  
  // Rate limiting
  webhookRateLimit: parseInt(process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE || '60', 10),
  apiRateLimit: parseInt(process.env.API_RATE_LIMIT_PER_MINUTE || '100', 10),
  
  // Security
  secretKey: process.env.SECRET_KEY || 'your-secret-key-here',
  algorithm: process.env.ALGORITHM || 'HS256',
  accessTokenExpire: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '30', 10),
}));