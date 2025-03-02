# Radar

A Slack application that connects to GitHub and tracks activity to notify users about Pull Requests, reviews, comments, and changes in near real-time.

## Features

- Connect to Slack and GitHub with proper authentication
- Select relevant GitHub repositories
- Team usage with individual user configurations
- Near real-time notifications from GitHub to Slack
- Customizable notification preferences
- Daily and weekly digest notifications
- Repository activity statistics

## Tech Stack

- Python with FastAPI
- Supabase for backend storage
- Slack API for messaging
- GitHub API for event tracking
- APScheduler for scheduled tasks
- Docker for containerization

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
   source venv/bin/activate  # On Windows: venv\Scripts\activate
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

3. Build and run with Docker Compose:
   ```
   docker-compose up -d
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

## API Documentation

Once the application is running, you can access the API documentation at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Development

### Project Structure

```
radar/
├── app/                # Application code
│   ├── api/            # API endpoints
│   │   ├── routes/     # Route handlers
│   ├── core/           # Core application logic
│   ├── db/             # Database models and connections
│   ├── models/         # Pydantic models
│   ├── services/       # External services (Slack, GitHub)
│   └── utils/          # Utility functions
├── docs/               # Documentation
├── scripts/            # Utility scripts
├── tests/              # Test suite
├── .env.example        # Example environment variables
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Docker Compose configuration
├── README.md           # Project documentation
└── requirements.txt    # Project dependencies
```

### Testing

Run the test suite with pytest:

```
pytest
```

For coverage report:

```
pytest --cov=app tests/
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

## Deployment

### Production Deployment

For production deployment, consider:

1. Using a reverse proxy like Nginx
2. Setting up SSL certificates
3. Using a process manager like Supervisor
4. Configuring proper logging

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Docker Deployment

The included Docker configuration can be used for production with appropriate environment variables.

## Troubleshooting

Common issues and solutions:

1. **Webhook verification fails**: Ensure your GitHub webhook secret matches the one in your environment variables.

2. **Slack authentication issues**: Verify your Slack app has the correct scopes and redirect URLs.

3. **Missing notifications**: Check user settings and ensure the repository has webhooks properly configured.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
