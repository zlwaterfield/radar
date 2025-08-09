# Setting Up Supabase for Radar

This guide will walk you through the process of setting up a Supabase project for Radar.

## Prerequisites

- A Supabase account (sign up at [supabase.com](https://supabase.com))
- A development environment with Radar installed

## Step 1: Create a New Supabase Project

1. Log in to your Supabase account
2. Click "New Project"
3. Enter the following details:
   - **Name**: Radar
   - **Database Password**: Create a secure password
   - **Region**: Choose a region closest to your users
4. Click "Create New Project"
5. Wait for your project to be created (this may take a few minutes)

## Step 2: Get Your API Keys

1. Once your project is created, go to the project dashboard
2. In the sidebar, click on "Settings" > "API"
3. You'll find two important keys:
   - **Project URL**: The URL of your Supabase project
   - **API Key**: The anon/public key for your project
4. Copy these values as you'll need them for your environment variables

## Step 3: Set Up Database Tables

Radar requires several tables in your Supabase database. You can create these tables using the SQL editor or the Supabase dashboard.

### Using the SQL Editor

1. In the Supabase dashboard, go to the "SQL Editor" section
2. Create a new query
3. Copy the contents of the `database/schema.sql` file from the Radar project
4. Paste the SQL code into the editor
5. Click "Run" to execute the SQL code

> **Note**: The complete database schema is maintained in `database/schema.sql`. This file contains all the necessary tables, indexes, and triggers required for Radar to function properly.

### Using the Database Initialization Script

Alternatively, after setting up the basic tables, you can use Radar's built-in database initialization script to verify your setup:

1. Set up your environment variables (see Step 5 below)
2. Run the initialization script: `python database/init_db.py`
3. The script will check your database schema and guide you through any missing components

## Step 4: Set Up Row-Level Security (RLS)

To secure your data, you should enable Row-Level Security (RLS) on your tables:

1. In the Supabase dashboard, go to the "Authentication" > "Policies" section
2. For each table, click "Enable RLS"
3. Create policies that restrict access to only authenticated users

Here's an example policy for the `users` table:

```sql
CREATE POLICY "Users can only access their own data"
ON users
FOR ALL
USING (auth.uid() = id);
```

## Step 5: Configure Environment Variables

Add the following environment variables to your `.env` file:

```
SUPABASE_URL=your_project_url
SUPABASE_KEY=your_api_key
```

## Step 6: Verify the Setup

1. Start your Radar application
2. Try to authenticate a user through Slack
3. Check your Supabase database to ensure the user is created

## Database Schema Explanation

- **users**: Stores user information including Slack and GitHub credentials
- **user_settings**: Stores user notification preferences and settings
- **user_repositories**: Maps users to their selected GitHub repositories
- **events**: Stores GitHub events received via webhooks
- **notifications**: Tracks notifications sent to users

## Troubleshooting

### Connection Issues

- Verify that your environment variables are set correctly
- Ensure that your IP address is allowed in the Supabase project settings
- Check that your database is online in the Supabase dashboard

### Permission Errors

- Verify that Row-Level Security (RLS) is configured correctly
- Ensure that your policies allow the necessary operations
- Check that you're using the correct API key

### Performance Issues

- Monitor your database performance in the Supabase dashboard
- Consider adding additional indexes for frequently queried columns
- Implement caching for frequently accessed data

## Next Steps

- [Set up your Slack App](./slack_setup.md)
- [Set up your GitHub App](./github_setup.md)
- [Start using Radar](./user_guide.md)
