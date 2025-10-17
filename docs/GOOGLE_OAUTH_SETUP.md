# Google OAuth Setup Guide

This guide walks you through setting up Google OAuth authentication for Radar.

## Prerequisites

- A Google account
- Access to [Google Cloud Console](https://console.cloud.google.com)
- Radar application running locally or deployed

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click on the project dropdown at the top of the page
3. Click "New Project"
4. Enter a project name (e.g., "Radar Authentication")
5. Click "Create"

## Step 2: Enable Google+ API (Optional)

While not strictly required, enabling the Google+ API provides better user profile information:

1. In the Google Cloud Console, navigate to "APIs & Services" > "Library"
2. Search for "Google+ API"
3. Click on it and press "Enable"

## Step 3: Configure OAuth Consent Screen

1. In Google Cloud Console, go to "APIs & Services" > "OAuth consent screen"
2. Select "External" user type (unless you have a Google Workspace organization)
3. Click "Create"

### Fill in the required information:

**App Information:**
- App name: `Radar`
- User support email: Your email address
- App logo: (Optional) Upload your app logo

**App Domain:**
- Application home page: `http://localhost:3001` (for development)
- Application privacy policy: `http://localhost:3001/privacy`
- Application terms of service: `http://localhost:3001/terms`

**Authorized Domains:**
Add your production domain when deploying (e.g., `yourdomain.com`)

**Developer Contact Information:**
- Email addresses: Your email address

4. Click "Save and Continue"

### Scopes:

5. Click "Add or Remove Scopes"
6. Add the following scopes:
   - `userinfo.email`
   - `userinfo.profile`
   - `openid`
7. Click "Update" then "Save and Continue"

### Test Users (for development):

8. Add test users who can sign in during development
9. Click "Save and Continue"

## Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Web application" as the application type

### Configure the OAuth client:

**Name:** `Radar Web Client`

**Authorized JavaScript origins:**
```
http://localhost:3001
http://localhost:3003
```
(Add your production URLs when deploying)

**Authorized redirect URIs:**
```
http://localhost:3003/api/auth/callback/google
http://localhost:3001/auth/callback
```
(Add your production callback URLs when deploying, e.g., `https://api.yourdomain.com/api/auth/callback/google` and `https://yourdomain.com/auth/callback`)

4. Click "Create"

## Step 5: Copy Your Credentials

After creating the OAuth client, you'll see a modal with your credentials:

1. Copy the **Client ID**
2. Copy the **Client Secret**

Keep these secure and never commit them to version control!

## Step 6: Configure Environment Variables

### Backend Configuration

Add the following to your `app/.env` file:

```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

To generate a secure `BETTER_AUTH_SECRET`, run:
```bash
openssl rand -base64 32
```

### Frontend Configuration

Add the following to your `client/.env.local` file:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3003
```

## Step 7: Restart Your Application

1. Restart your backend server:
   ```bash
   cd app
   npm run start:dev
   ```

2. Restart your frontend server:
   ```bash
   cd client
   npm run dev
   ```

## Step 8: Test Google OAuth

1. Navigate to `http://localhost:3001/auth/signin`
2. Click "Continue with Google"
3. You should be redirected to Google's login page
4. Sign in with a Google account
5. Authorize the application
6. You should be redirected back to your application and logged in

## Production Deployment

When deploying to production, remember to:

1. **Update OAuth Consent Screen:**
   - Replace localhost URLs with your production domain
   - Add production domain to authorized domains

2. **Update OAuth Client:**
   - Add production JavaScript origins (e.g., `https://yourdomain.com`, `https://api.yourdomain.com`)
   - Add production redirect URIs:
     - `https://api.yourdomain.com/api/auth/callback/google` (Backend OAuth callback)
     - `https://yourdomain.com/auth/callback` (Frontend redirect after auth)

3. **Verify OAuth App:**
   - If your app will be used by users outside your organization, you'll need to submit your app for verification
   - Go to OAuth consent screen and click "Publish App"
   - Follow Google's verification process

## Troubleshooting

### "Error 400: redirect_uri_mismatch"

This error occurs when the redirect URI in your request doesn't match any authorized redirect URIs in your OAuth client configuration.

**Solution:**
1. Go to Google Cloud Console > Credentials
2. Edit your OAuth client
3. Ensure the redirect URI exactly matches: `http://localhost:3003/api/auth/callback/google` (for development)
4. Make sure there are no trailing slashes or typos

### "This app isn't verified"

During development with external user type, Google will show a warning screen.

**For Development:**
- Click "Advanced" > "Go to [App Name] (unsafe)"
- This is normal for apps in testing mode

**For Production:**
- Submit your app for verification through the OAuth consent screen
- Or use Internal user type if you have Google Workspace

### "Access blocked: This app's request is invalid"

This usually means scopes are misconfigured.

**Solution:**
1. Verify that you've added the required scopes in the OAuth consent screen
2. Make sure the scopes in your Better Auth configuration match those in Google Cloud Console

### Users can't sign in (not added as test users)

If your OAuth consent screen is in testing mode, only test users can sign in.

**Solution:**
1. Add users to test users list in OAuth consent screen
2. Or publish your app for production use

## Security Best Practices

1. **Never commit credentials:** Use environment variables and `.env` files (add to `.gitignore`)
2. **Use different credentials for development and production**
3. **Regularly rotate your client secret**
4. **Keep your `BETTER_AUTH_SECRET` secure and random**
5. **Use HTTPS in production**
6. **Implement proper CORS policies**
7. **Regularly review authorized domains and redirect URIs**

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)

## Support

If you encounter issues not covered in this guide:

1. Check the [Better Auth Discord](https://discord.gg/better-auth) for community support
2. Review Google's OAuth 2.0 documentation
3. Check the application logs for detailed error messages
