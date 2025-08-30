import { registerAs } from '@nestjs/config';

export default registerAs('monitoring', () => ({
  posthogApiKey: process.env.POSTHOG_API_KEY,
  posthogHost: process.env.POSTHOG_HOST || 'https://us.posthog.com',
  openaiApiKey: process.env.OPENAI_API_KEY,
}));