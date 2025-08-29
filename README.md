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
- **FastAPI**: High-performance Python web framework
- **Supabase**: PostgreSQL database with real-time capabilities
- **APScheduler**: Background task scheduling and cron jobs
- **PostHog**: Product analytics and error tracking
- **OpenAI**: Intelligent keyword matching and analysis

### Integrations
- **Slack API**: Rich message formatting and user interactions
- **GitHub API**: Repository access and webhook event processing
- **GitHub Webhooks**: Real-time event delivery with signature verification

## Setup and Installation

### Prerequisites

- Python 3.8+
- Slack workspace with admin privileges
- GitHub account with access to repositories you want to track
- Supabase account for database
- Docker and Docker Compose (optional, for containerized deployment)

### Local Installation

1. Clone the repository:
   ```
   git clone https://github.com/zlwaterfield/radar.git
   cd radar
   ```

2. Set up a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Copy the example environment file and update with your settings:
   ```
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. Run the application:
   ```
   uvicorn app.main:app --reload
   ```

## Configuration

See the [documentation](./docs/README.md) for detailed setup instructions including:
- [Creating a Slack app](./docs/slack_setup.md)
- [Setting up GitHub authentication](./docs/github_setup.md)
- [Configuring Supabase](./docs/supabase_setup.md)
- User and team settings

### Environment Variables

The application requires several environment variables to be set. See `.env.example` for a complete list with descriptions.

Key environment variables include:
- Slack API credentials
- GitHub API credentials
- Supabase connection details
- Application settings

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - see LICENSE file for details.

## 🎯 Roadmap

- Soon
   - Team mentions
   - Github Discussions support
   - Improving onboarding experience
   - Testing all events in production
   - Improve event messages (general copying and PR descriptions, +/- changes, etc)
   - Document all supported events
- Next
   - Daily Digests support
   - Customizable Digests to custom channels
   - Better Slack homepage
   - Slack / Github user connecting to @ in notifications
- Later
   - Statistics
   - Billing and subscription management

## Bugs
- Same github user multiple slack workspaces