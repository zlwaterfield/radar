import { registerAs } from '@nestjs/config';

export default registerAs('github', () => ({
  appId: process.env.GITHUB_APP_ID,
  appName: process.env.GITHUB_APP_NAME,
  clientId: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  privateKey: process.env.GITHUB_PRIVATE_KEY,
  privateKeyPath: process.env.GITHUB_PRIVATE_KEY_PATH,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
}));
