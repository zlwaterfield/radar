"use client"

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Button from '@/components/Button';
import Layout from '@/components/Layout';
import { FiSlack, FiGithub, FiGrid } from 'react-icons/fi';

interface IntegrationStatus {
  slack: {
    connected: boolean;
    slackId?: string;
    teamName?: string;
  };
  github: {
    connected: boolean;
    githubId?: string;
    githubLogin?: string;
    appInstalled?: boolean;
    githubInstallationId?: string;
  };
}

function OnboardingContent() {
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>({
    slack: { connected: false },
    github: { connected: false },
  });
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // Function to refresh integration status
  const refreshIntegrationStatus = async () => {
    if (!user) return;

    try {
      setLoadingStatus(true);
      const [slackResponse, githubResponse] = await Promise.all([
        fetch('/api/integrations/slack/status'),
        fetch('/api/integrations/github/status'),
      ]);

      const slackStatus = await slackResponse.json();
      const githubStatus = await githubResponse.json();

      console.log('slackStatus', slackStatus);
      console.log('githubStatus', githubStatus);

      setIntegrationStatus({
        slack: slackStatus,
        github: githubStatus,
      });
    } catch (error) {
      console.error('Error fetching integration status:', error);
      toast.error('Failed to check integration status');
    } finally {
      setLoadingStatus(false);
    }
  };

  // Handle URL parameters for success/error messages
  useEffect(() => {
    const slack = searchParams.get('slack');
    const github = searchParams.get('github');
    const error = searchParams.get('error');

    if (slack === 'connected') {
      const message = 'Slack connected successfully!';
      setMessage(message);
      toast.success(message);
      refreshIntegrationStatus(); // Refresh status when Slack connected
    } else if (github === 'connected') {
      const message = 'GitHub connected successfully!';
      setMessage(message);
      toast.success(message);
      refreshIntegrationStatus(); // Refresh status when GitHub connected
    } else if (github === 'app_installed') {
      const message = 'GitHub App installed successfully!';
      setMessage(message);
      toast.success(message);
      refreshIntegrationStatus(); // Refresh status when GitHub app installed
    } else if (error) {
      let errorMessage = '';
      if (error.startsWith('slack_')) {
        errorMessage = `Slack connection failed: ${error.replace('slack_', '')}`;
      } else if (error.startsWith('github_')) {
        errorMessage = `GitHub connection failed: ${error.replace('github_', '')}`;
      } else {
        errorMessage = `Connection failed: ${error}`;
      }
      setMessage(errorMessage);
      toast.error(errorMessage);
    }
  }, [searchParams, user]);

  // Fetch integration status on initial load
  useEffect(() => {
    if (user && !loading) {
      refreshIntegrationStatus();
    }
  }, [user, loading]);

  const connectSlack = () => {
    window.location.href = '/api/integrations/slack/connect';
  };

  const connectGitHub = () => {
    window.location.href = '/api/integrations/github/connect';
  };

  const installGitHubApp = () => {
    window.location.href = '/api/integrations/github/install';
  };

  if (loading || loadingStatus) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Please sign in first</h1>
            <p className="text-gray-600">You need to be signed in to complete onboarding.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-gray-900">Welcome to Radar!</h1>
            <p className="mt-4 text-lg text-gray-600">
              Let&apos;s connect your integrations to get you started with GitHub activity notifications.
            </p>
          </div>

          {message && (
            <div className={`mb-6 p-4 rounded-md ${
              message.includes('failed') || message.includes('error')
                ? 'bg-red-50 text-red-700'
                : 'bg-green-50 text-green-700'
            }`}>
              {message}
            </div>
          )}

          <div className="space-y-6">
            {/* Step 1: Slack Integration */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                    <FiSlack size={24} className="text-white" />
                  </div>
                  <div>
                    <div className="inline-block mb-1 bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Step 1</div>
                    <h3 className="text-lg font-semibold text-gray-900">Slack</h3>
                    <p className="text-gray-600">
                      Receive notifications directly in your Slack workspace
                    </p>
                    {integrationStatus.slack.connected && (
                      <p className="text-sm text-green-600 mt-1">
                        Connected to {integrationStatus.slack.teamName}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  {!integrationStatus.slack.connected ? (
                    <Button onClick={connectSlack}>
                      Connect Slack
                    </Button>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={connectSlack}
                      >
                        Reconnect
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 2: GitHub Integration */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center">
                    <FiGithub size={24} className="text-white" />
                  </div>
                  <div>
                    <div className="inline-block mb-1 bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Step 2</div>
                    <h3 className="text-lg font-semibold text-gray-900">GitHub Account</h3>
                    <p className="text-gray-600">
                      Connect your GitHub account to track repository activity
                    </p>
                    {integrationStatus.github.connected && (
                      <p className="text-sm text-green-600 mt-1">
                        Connected as {integrationStatus.github.githubLogin}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  {!integrationStatus.github.connected ? (
                    <Button onClick={connectGitHub}>
                      Connect GitHub
                    </Button>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => connectGitHub()}
                      >
                        Reconnect
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: GitHub App Installation */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                    <FiGrid size={24} className="text-white" />
                  </div>
                  <div>
                    <div className="inline-block mb-1 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Step 3</div>
                    <h3 className="text-lg font-semibold text-gray-900">GitHub App</h3>
                    <p className="text-gray-600">
                      Install the GitHub App to enable repository access and webhooks
                    </p>
                    {integrationStatus.github.appInstalled && (
                      <p className="text-sm text-green-600 mt-1">
                        ✓ GitHub App installed successfully
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  {!integrationStatus.github.appInstalled ? (
                    <Button 
                      onClick={installGitHubApp}
                      disabled={!integrationStatus.github.connected}
                    >
                      Install App
                    </Button>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={installGitHubApp}
                      >
                        Reinstall
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Continue Button */}
            {(integrationStatus.github.connected || integrationStatus.slack.connected) && (
              <div className="text-center pt-6 flex justify-center">
                <Button
                  onClick={() => window.location.href = '/settings'}
                >
                  Continue to Settings
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        </div>
      </Layout>
    }>
      <OnboardingContent />
    </Suspense>
  );
}