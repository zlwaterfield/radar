import { registerAs } from '@nestjs/config';

export default registerAs('slack', () => ({
  clientId: process.env.SLACK_APP_CLIENT_ID,
  clientSecret: process.env.SLACK_APP_CLIENT_SECRET,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  botToken: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
}));
