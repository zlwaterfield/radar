<img width="1024" height="409" alt="radar-logo" src="https://github.com/user-attachments/assets/4df91303-8557-42a3-9860-5696794c5acb" />

A Slack application that connects GitHub activity to your team's Slack workspace, delivering customizable notifications about Pull Requests, Issues, Discussions, etc. in near real-time.

## ✨ Features

### Core Functionality
- **Intelligent Notifications**: Smart routing based on user roles (author, reviewer, assignee)
- **Real-time Delivery**: Near-instantaneous notifications from GitHub webhooks to Slack
- **Comprehensive Event Support**: PRs, issues, reviews, comments, discussions, and more
- **Keyword-Based Notifications**: AI-powered OpenAI integration for smart keyword matching
- **Digest Notifications (coming soon)**: Configurable daily/weekly summaries of repository activity

## 🛠 Tech Stack

### Backend
- **NestJS**: Progressive Node.js framework for building efficient server-side applications
- **Better Auth**: Modern authentication library for TypeScript
- **Trigger.dev**: Background job processing and workflow automation
- **PostHog**: Product analytics and error tracking
- **OpenAI**: Intelligent keyword matching and analysis

### Integrations
- **Slack API**: Rich message formatting and user interactions
- **GitHub API**: Repository access and webhook event processing
- **GitHub Webhooks**: Real-time event delivery with signature verification

## Setup and Installation

### Prerequisites

- Node.js 18+
- npm or yarn package manager
- Slack workspace with admin privileges
- GitHub account with access to repositories you want to track
- Docker and Docker Compose (optional, for containerized deployment)

### Local Installation

1. Clone the repository:
   ```
   git clone https://github.com/zlwaterfield/radar.git
   cd radar
   ```

2. Install dependencies:
   ```
   npm install
   ```

4. Copy the example environment file and update with your settings:
   ```
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Run the application:
   ```
   npm run start:dev
   ```

## Configuration

See the [documentation](./docs/README.md) for detailed setup instructions including:
- [Creating a Slack app](./docs/slack_setup.md)
- [Setting up GitHub authentication](./docs/github_setup.md)
- User and team settings

### Environment Variables

The application requires several environment variables to be set. See `.env.example` for a complete list with descriptions.

Key environment variables include:
- Slack API credentials
- GitHub API credentials
- Application settings

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details.

## 🎯 Roadmap

- Next
   - Customizable Digests to custom channels
   - Keyword notifications to custom channels
   - Github Discussions support
   - Better Slack homepage
   - Slack / Github user connecting to @ in notifications
- Later
   - Statistics
   - Billing and subscription management