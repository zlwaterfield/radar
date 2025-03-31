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
│── client/         # Next.js application
├── docs/               # Documentation
├── scripts/            # Utility scripts
├── .env.example        # Example environment variables
├── Dockerfile          # Docker configuration
├── docker-compose.yml  # Docker Compose configuration
├── README.md           # Project documentation
└── requirements.txt    # Project dependencies
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

## Troubleshooting

Common issues and solutions:

1. **Webhook verification fails**: Ensure your GitHub webhook secret matches the one in your environment variables.

2. **Slack authentication issues**: Verify your Slack app has the correct scopes and redirect URLs.

3. **Missing notifications**: Check user settings and ensure the repository has webhooks properly configured.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT


TODO
- github connection 
- auth - use jwt for more security
- improve notification logic for issues (comments / reactions)
- messages updates - changed comment, title, description, merged/closed and no longer relevant
- digest
- keyword notifications
- status (current prs, reviews for home page)
- dashboard home page fixes
- better align notifications for author / reviewer / assignee
- billing
- posthog (client, server, errors)
