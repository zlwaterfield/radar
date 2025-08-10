# Radar

A sophisticated Slack application that seamlessly connects GitHub activity to your team's Slack workspace, delivering intelligent, customizable notifications about Pull Requests, issues, reviews, comments, and repository changes in near real-time.

## ✨ Features

### Core Functionality
- **Multi-Platform Integration**: Seamless connection between Slack and GitHub with OAuth2 authentication
- **Repository Management**: Select and manage multiple GitHub repositories per user/team
- **Intelligent Notifications**: Smart routing based on user roles (author, reviewer, assignee)
- **Real-time Delivery**: Near-instantaneous notifications from GitHub webhooks to Slack
- **Comprehensive Event Support**: PRs, issues, reviews, comments, discussions, and more

### Advanced Capabilities
- **Keyword-Based Notifications**: AI-powered OpenAI integration for smart keyword matching
- **Digest Notifications**: Configurable daily/weekly summaries of repository activity
- **Message Updates**: Automatic Slack message updates when GitHub content is edited
- **Webhook Retry System**: Robust delivery guarantees with exponential backoff retry logic
- **Security & Validation**: JWT authentication, input sanitization, and rate limiting
- **Analytics & Monitoring**: PostHog integration for comprehensive usage analytics

## 🛠 Tech Stack

### Backend
- **FastAPI**: High-performance Python web framework
- **Supabase**: PostgreSQL database with real-time capabilities
- **APScheduler**: Background task scheduling and cron jobs
- **PostHog**: Product analytics and error tracking
- **OpenAI API**: Intelligent keyword matching and analysis

### Integrations
- **Slack API**: Rich message formatting and user interactions
- **GitHub API**: Repository access and webhook event processing
- **GitHub Webhooks**: Real-time event delivery with signature verification

### Security & Performance
- **JWT Authentication**: Secure token-based user authentication
- **Rate Limiting**: Request throttling and abuse prevention
- **Input Validation**: Comprehensive data sanitization
- **Webhook Retry System**: Exponential backoff for delivery guarantees
- **Encrypted Storage**: Sensitive token encryption at rest

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

### Docker Installation

1. Clone the repository:
   ```
   git clone https://github.com/zlwaterfield/radar.git
   cd radar
   ```

2. Copy the example environment file and update with your settings:
   ```
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Create a GitHub private key file:
   ```
   # Place your GitHub App's private key in the project root
   # Make sure the path matches GITHUB_PRIVATE_KEY_PATH in your .env file
   touch github_private_key.pem
   # Paste your private key content into this file
   ```

4. Build and run with Docker Compose:
   ```
   docker-compose up -d --build
   ```

5. Check the container logs to ensure everything is running correctly:
   ```
   docker-compose logs -f
   ```

6. Access the application:
   - API: `http://localhost:8000`
   - API Documentation: `http://localhost:8000/docs`

7. To stop the containers:
   ```
   docker-compose down
   ```

8. For a complete reset (including volumes):
   ```
   docker-compose down
   docker-compose up -d --build
   ```

9. To view container status:
   ```
   docker-compose ps
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

## 📚 API Documentation

### Interactive Documentation
Once the application is running, you can access the API documentation at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### API Endpoints Overview

#### Authentication & Users
- `POST /api/auth/login` - User authentication with JWT tokens
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/settings` - Update user notification preferences

#### GitHub Integration
- `GET /api/github/repositories` - List user's GitHub repositories
- `POST /api/github/repositories/sync` - Sync repository data
- `GET /api/github/user` - Get GitHub user information

#### Slack Integration  
- `GET /api/slack/channels` - List available Slack channels
- `POST /api/slack/test` - Test Slack message delivery

#### Webhooks & Events
- `POST /api/webhooks/github` - GitHub webhook endpoint (secured)
- `GET /api/retry/webhooks/retry/stats` - Webhook retry statistics
- `POST /api/retry/webhooks/retry/trigger` - Manual retry processing
- `GET /api/retry/webhooks/failed` - List failed webhook events

#### Settings & Configuration
- `GET /api/settings/user/{user_id}` - Get user settings
- `PUT /api/settings/user/{user_id}` - Update user settings
- `GET /api/retry/scheduler/status` - Background scheduler status

## Development

### Project Structure

```
radar/
├── app/                    # Application code
│   ├── api/                # API layer
│   │   └── routes/         # FastAPI route handlers
│   │       ├── auth.py     # Authentication endpoints
│   │       ├── github.py   # GitHub integration endpoints
│   │       ├── retry.py    # Webhook retry management
│   │       ├── slack.py    # Slack integration endpoints
│   │       ├── webhooks.py # GitHub webhook processing
│   │       └── ...
│   ├── core/               # Core application logic
│   │   ├── config.py       # Configuration management
│   │   └── logging.py      # Logging setup
│   ├── db/                 # Database layer
│   │   └── supabase.py     # Supabase client and operations
│   ├── middleware/         # FastAPI middleware
│   │   └── rate_limit.py   # Rate limiting middleware
│   ├── models/             # Pydantic data models
│   │   └── slack.py        # Slack message models
│   ├── services/           # Business logic services
│   │   ├── github_service.py        # GitHub API integration
│   │   ├── monitoring_service.py    # PostHog analytics
│   │   ├── notification_service.py  # Notification routing
│   │   ├── scheduler_service.py     # Background scheduler
│   │   ├── slack_service.py         # Slack API integration
│   │   ├── task_service.py          # Scheduled tasks
│   └── utils/              # Utility functions
│       ├── auth.py         # Authentication utilities
│       └── validation.py   # Input validation
├── database/               # Database management
│   ├── init_db.py          # Database initialization
│   └── schema.sql          # Complete database schema
├── tests/                  # Test suite
│   └── ...
├── .env.example           # Environment variables template
├── docker-compose.yml     # Docker Compose configuration
├── README.md             # Project documentation
└── requirements.txt      # Python dependencies
```

### Code Style

This project uses:
- Black for code formatting
- isort for import sorting
- flake8 for linting

Format code before committing:

```
black app tests
isort app tests
flake8 app tests
```

## 🚀 Key Features Implemented

### Notification Intelligence
- **Role-Based Routing**: Automatically determines if users should be notified based on their relationship to the GitHub event (author, reviewer, assignee)
- **Keyword Matching**: OpenAI-powered intelligent keyword detection in issues and comments with configurable confidence thresholds
- **Message Updates**: Seamlessly updates existing Slack messages when GitHub content is edited (PRs, issues, comments)
- **Discussion Support**: Full support for GitHub Discussions and Discussion Comments

### Reliability & Performance  
- **Webhook Retry System**: Exponential backoff retry mechanism (5min → 15hr delays) for failed GitHub webhooks
- **Rate Limiting**: Configurable request throttling to prevent abuse
- **Input Validation**: Comprehensive sanitization of all user inputs and webhook payloads
- **Error Tracking**: Detailed error logging with PostHog integration

### Security
- **JWT Authentication**: Secure token-based user authentication with configurable expiration
- **Webhook Signature Verification**: Support for both SHA1 and SHA256 GitHub webhook signatures  
- **Token Encryption**: Sensitive API tokens encrypted at rest using Fernet encryption
- **CORS Protection**: Configurable cross-origin request policies

### Monitoring & Analytics
- **PostHog Integration**: Comprehensive event tracking, user analytics, and error monitoring
- **Performance Metrics**: Request timing, webhook processing performance, retry statistics
- **Health Checks**: Built-in health monitoring endpoints for system status

## 🔧 Troubleshooting

### Common Issues & Solutions

**Webhook Verification Failures**
- Ensure GitHub webhook secret matches `GITHUB_WEBHOOK_SECRET` environment variable
- Verify webhook is configured for both SHA1 and SHA256 signatures
- Check webhook URL points to `/api/webhooks/github` endpoint

**Slack Authentication Issues**  
- Verify Slack app has required OAuth scopes: `chat:write`, `users:read`, `channels:read`
- Ensure redirect URLs include your domain in Slack app configuration
- Check `SLACK_CLIENT_ID` and `SLACK_CLIENT_SECRET` are correctly set

**Missing Notifications**
- Review user notification preferences in settings
- Confirm user has enabled notifications for the specific event type
- Verify repository webhooks are properly configured in GitHub
- Check webhook retry stats at `/api/retry/webhooks/retry/stats`

**Database Connection Issues**
- Verify `SUPABASE_URL` and `SUPABASE_KEY` are correctly configured
- Ensure database schema is properly initialized using `database/schema.sql`
- Check Supabase dashboard for connection limits and usage

**Background Tasks Not Running**
- Verify APScheduler is properly started (check logs for "Webhook retry scheduler started")  
- Check scheduler status via `/api/retry/scheduler/status` endpoint
- Ensure no conflicting cron processes are running

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`  
3. Make your changes with proper tests
4. Format code: `black app tests && isort app tests`
5. Run tests: `pytest`
6. Submit a Pull Request

## 📄 License

MIT License - see LICENSE file for details.

## 🎯 Roadmap & Status

### 📋 Future Enhancements
- [ ] Notification deduplication (prevent duplicate messages)
- [ ] User onboarding flow improvements  
- [ ] Enhanced metrics and analytics
- [ ] Billing and subscription management
- [ ] Advanced notification scheduling
- [ ] Digests
- [ ] Github Discussions support
- [ ] Team/individual Statistics

---

## 📚 Additional Resources

- **GitHub Webhooks**: [Webhook Events Documentation](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- **Slack API**: [Slack Block Kit](https://api.slack.com/block-kit)
- **FastAPI**: [FastAPI Documentation](https://fastapi.tiangolo.com/)
- **Supabase**: [Supabase Documentation](https://supabase.com/docs)
