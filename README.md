<img width="512" height="205" alt="logo-full-dark" src="https://github.com/user-attachments/assets/b668d053-23c6-484b-98b3-d6c798126473" />

> Note: 🚧 this is still in early development so it may be buggy, please create a Github issue with feedback / bug reports and we will get them resolved!

A Slack application that connects GitHub activity to your team's Slack workspace, delivering customizable notifications about Pull Requests, Issues, Discussions, etc. in near real-time.

Radar was built with inspiration from [Toast](https://toast.ninja/), the Github Slack app, [Graphite](https://graphite.dev/). I wanted something simpler and lighter than Graphite but with a few key features that Toast and Github app were missing. I built it to be more configurable and feature-rich yet still simple and fast.

## ✨ Features

### Core Functionality
- **Smart Notifications**: Routing based on user roles (author, reviewer, assignee)
- **Real-time Delivery**: Fast notifications from GitHub webhooks to Slack
- **Full Event Support**: PRs, issues, reviews, comments, discussions, and more
- **Keyword-Based Notifications**: Smart keyword matching (using AI 👀)
- **Digest Notifications**: Configurable scheduled summaries of pull requests activity
- **Open Source Mode**: Run self-hosted with full features enabled (no billing required)

## 🛠 Tech Stack

### Frontend
- [**Next.js**](https://nextjs.org)

### Backend
- [**NestJS**](https://nestjs.com)
- [**Better Auth**](https://betterauth.io)
- [**Trigger.dev**](https://trigger.dev)
- [**PostHog**](https://posthog.com)
- [**OpenAI**](https://openai.com)

### Integrations
- [**Slack API**](https://api.slack.com)
- [**GitHub API**](https://docs.github.com/rest)
- [**GitHub Webhooks**](https://docs.github.com/webhooks)

## Setup and Installation

### Prerequisites

- Node.js 18+
- npm package manager
- Slack workspace with admin privileges
- GitHub account with access to repositories you want to track
- Docker and Docker Compose (optional, for containerized deployment)

### Local Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/zlwaterfield/radar.git
   cd radar
   ```

2. Install dependencies for both backend and frontend:
   ```bash
   # Install backend dependencies
   cd app
   npm install
   
   # Install frontend dependencies
   cd ../client
   npm install
   ```

3. Set up environment variables:
   
   **Backend (app directory):**
   ```bash
   cd app
   # Create .env file with your configuration
   # See Configuration section below for required variables
   ```
   
   **Frontend (client directory):**
   ```bash
   cd client
   # Create .env.local file with your configuration
   # See Configuration section below for required variables
   ```

4. Set up the database:
   ```bash
   cd app
   # Generate Prisma client
   npx prisma generate
   
   # Run database migrations
   npx prisma migrate dev
   ```

5. Run the applications:
   
   **Start the backend (NestJS API):**
   ```bash
   cd app
   npm run start:dev
   ```
   The API will be available at `http://localhost:3000`
   
   **Start the frontend (Next.js app):**
   ```bash
   cd client
   npm run dev
   ```
   The frontend will be available at `http://localhost:3001`

5. Set up Trigger.dev:

You'll need a Trigger account and to configure your environment variables.

   ```bash
   # Login to Trigger.dev
   npx trigger login
   
   # Make sure to set TRIGGER_SECRET_KEY and TRIGGER_SECRET_KEY in your app/.env file
   # You can find this in your Trigger.dev dashboard
   ```

6. Set up a tunnel for webhooks (recommended):

For local development, you'll need a public URL for GitHub webhooks and Slack events. We recommend using ngrok:

   ```bash
   # Install ngrok (if not already installed)
   # Visit https://ngrok.com/download for installation instructions
   
   # Start ngrok tunnel on port 3003 (where your app will receive webhooks)
   ngrok http 3003
   ```

   Copy the HTTPS URL provided by ngrok (e.g., `https://abc123.ngrok.io`) and use it for:
   - GitHub webhook URLs
   - Slack event subscriptions
   - Update your environment variables accordingly

7. Run Trigger.dev:

   ```bash
   cd app
   npx trigger.dev@latest dev
   ```

## Configuration

See the [documentation](./docs/README.md) for detailed setup instructions including:
- [Creating a Slack app](./docs/slack_setup.md)
- [Setting up GitHub authentication](./docs/github_setup.md)
- [Open Source Mode](./docs/open_source_mode.md) - Run without billing/payments
- User and team settings

### Environment Variables

The application requires several environment variables to be set. See the two `.env.example` for a complete list with descriptions.

Key environment variables include:
- Slack API credentials
- GitHub API credentials
- Application settings
- Trigger credentials
- **Payment settings** (optional - set `PAYMENT_DISABLED=true` for open-source mode)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details.
