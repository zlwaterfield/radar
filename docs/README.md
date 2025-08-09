# Radar Documentation

Welcome to the Radar documentation. This comprehensive guide will help you set up, configure, and use the application effectively.

## 📚 Table of Contents

### Getting Started
- **[Installation Guide](./installation.mdx)** - Complete setup instructions
- **[Slack App Setup](./slack_setup.md)** - Configure Slack integration
- **[GitHub App Setup](./github_setup.md)** - Set up GitHub webhooks and authentication
- **[Supabase Setup](./supabase_setup.md)** - Database configuration

### Features & Usage
- **[User Guide](./user-guide.md)** - End-user documentation and tutorials
- **[Notification System](./notification-system.mdx)** - Understanding how notifications work
- **[AI Keyword Notifications](./ai-keyword-notifications.mdx)** - Advanced keyword matching

### Development
- **[API Documentation](./API.md)** - Comprehensive API reference with examples
- **[Architecture Overview](#architecture)** - System design and components
- **[Contributing Guidelines](#contributing)** - How to contribute to the project

### Operations
- **[Monitoring & Analytics](#monitoring)** - PostHog integration and metrics
- **[Webhook Retry System](#webhook-retry)** - Understanding the retry mechanism
- **[Troubleshooting](#troubleshooting)** - Common issues and solutions

## Quick Start

For a quick start, follow these steps:

1. Set up the [Slack App](./slack_setup.md)
2. Set up the [GitHub App](./github_setup.md)
3. Configure [Supabase](./supabase_setup.md)
4. Set up your [environment variables](./setup.md#environment-configuration)
5. Run the application

## 🏗 Architecture

Radar follows a modern microservices-inspired architecture with clear separation of concerns:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   GitHub API    │    │   Slack API     │    │   OpenAI API    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Radar FastAPI Application                     │
├─────────────────┬─────────────────┬─────────────────┬───────────┤
│  API Routes     │   Services      │   Middleware    │ Database  │
│                 │                 │                 │           │
│ • webhooks.py   │ • github_svc    │ • rate_limit    │ Supabase  │
│ • auth.py       │ • slack_svc     │ • validation    │ (PostgreSQL)│
│ • retry.py      │ • notification  │ • monitoring    │           │
│ • users.py      │ • webhook_retry │                 │           │
│                 │ • scheduler     │                 │           │
└─────────────────┴─────────────────┴─────────────────┴───────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│   PostHog       │    │   APScheduler   │    │   Background    │
│   Analytics     │    │   (Cron Jobs)   │    │   Tasks         │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Core Components

- **API Layer**: FastAPI routes handling HTTP requests
- **Service Layer**: Business logic for GitHub, Slack, and notification processing
- **Middleware**: Security, validation, and monitoring
- **Database**: Supabase PostgreSQL for persistent storage
- **Scheduler**: Background tasks for retries and digests
- **Analytics**: PostHog for usage tracking and error monitoring

## 🔄 Webhook Retry System

Radar implements a sophisticated webhook retry mechanism to ensure reliable delivery:

### Retry Strategy
1. **Initial Failure**: Event fails during processing
2. **Failed Event Created**: Store event details in `failed_webhook_events` table
3. **Exponential Backoff**: Retry with increasing delays (5min → 15min → 1hr → 5hr → 15hr)
4. **Monitoring**: Track retry attempts and success rates
5. **Manual Override**: API endpoints for manual retry operations

### Key Features
- Automatic retry scheduling with APScheduler
- Comprehensive error tracking and analysis  
- Manual retry capabilities via API
- Statistics dashboard for operational insights
- Configurable retry limits and delays

## 📊 Monitoring

### PostHog Integration
- **Event Tracking**: User actions, webhook processing, notification delivery
- **Error Monitoring**: Automatic error capture with context
- **Performance Metrics**: Request timing, processing duration
- **User Analytics**: Feature usage, retention metrics

### Health Monitoring
- **Health Check Endpoint**: `/health` for system status
- **Scheduler Status**: `/api/retry/scheduler/status` for background tasks
- **Database Status**: Connection pooling and query performance
- **API Metrics**: Response times, error rates, throughput

## 🛠 Contributing

### Development Workflow
1. **Fork & Clone**: Fork the repository and clone locally
2. **Environment Setup**: Follow installation guide
3. **Feature Branch**: Create branch from main (`git checkout -b feature/name`)
4. **Development**: Write code with tests
5. **Code Quality**: Run `black`, `isort`, `flake8`
6. **Testing**: Execute test suite (`pytest`)
7. **Pull Request**: Submit PR with detailed description

### Code Standards
- **Python Style**: Black formatting, isort imports, flake8 linting
- **API Design**: RESTful endpoints, consistent error handling
- **Testing**: Unit tests for services, integration tests for endpoints
- **Documentation**: Docstrings, API documentation, user guides
- **Security**: Input validation, authentication, secure token handling

### Architecture Principles
- **Separation of Concerns**: Clear boundaries between layers
- **Testability**: Dependency injection, mocking capabilities
- **Scalability**: Stateless design, background task processing
- **Reliability**: Error handling, retry mechanisms, monitoring
- **Security**: Input validation, secure authentication, rate limiting

## 🐛 Troubleshooting

### Common Issues

**Authentication Failures**
```bash
# Check JWT token validity
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/users/me

# Verify environment variables
echo $SLACK_CLIENT_ID
echo $GITHUB_CLIENT_ID
```

**Webhook Delivery Issues**
```bash
# Check webhook retry statistics
curl http://localhost:8000/api/retry/webhooks/retry/stats

# Manually trigger retry processing
curl -X POST http://localhost:8000/api/retry/webhooks/retry/trigger
```

**Database Connection Problems**
```bash
# Test Supabase connection
python -c "from app.db.supabase import SupabaseManager; print('Connected!' if SupabaseManager.supabase else 'Failed')"

# Check database schema
psql $SUPABASE_DB_URL -c "\dt"
```

### Debug Mode
Enable debug logging by setting `DEBUG=true` in your environment variables.

## 📞 Support

- **GitHub Issues**: [Report bugs and feature requests](https://github.com/zlwaterfield/radar/issues)
- **Discussions**: [Community discussions and Q&A](https://github.com/zlwaterfield/radar/discussions)
- **Documentation**: This guide and API documentation
- **Contact**: Reach out to maintainers for critical issues

---

*Last updated: January 2024*
