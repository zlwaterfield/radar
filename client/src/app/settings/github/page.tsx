"use client"

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import { FiGithub, FiCheck, FiSettings } from 'react-icons/fi';

function GithubIntegrationContent() {
  const { user, isAuthenticated, loading, connectGithub, installGithubApp, checkGithubInstallations } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [installationStatus, setInstallationStatus] = useState<any>(null);
  const [checkingInstallations, setCheckingInstallations] = useState(false);

  useEffect(() => {
    // Handle token from OAuth callback
    const token = searchParams.get('token');
    if (token) {
      // Store the token and redirect to clean URL
      document.cookie = `auth_token=${token}; path=/; max-age=86400; secure; samesite=strict`;
      document.cookie = `user_id=; path=/; max-age=86400; secure; samesite=strict`; // Will be set by auth context
      window.location.href = '/settings/github';  // Clean redirect to remove token from URL
      return;
    }
    
    if (!loading) {
      if (!isAuthenticated) {
        router.push('/');
      }
      // Don't auto-redirect if user has GitHub connected - let them see the app installation step
    }
  }, [isAuthenticated, loading, router, searchParams]);

  // Check GitHub installations when user has GitHub connected
  useEffect(() => {
    if (user?.github_id && !checkingInstallations && !installationStatus) {
      setCheckingInstallations(true);
      checkGithubInstallations()
        .then(setInstallationStatus)
        .catch(error => {
          console.error('Failed to check GitHub installations:', error);
          setInstallationStatus({ has_installations: false, error: error.message });
        })
        .finally(() => setCheckingInstallations(false));
    }
  }, [user?.github_id, checkGithubInstallations, checkingInstallations, installationStatus]);

  if (loading) {
    return <Loader size="large" />;
  }

  const hasGitHubAccount = user?.github_id;
  const hasGitHubApp = installationStatus?.has_installations;

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="px-6 py-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          GitHub integration
        </h3>
        <div className="mt-2 max-w-xl text-sm text-gray-600 dark:text-gray-300">
          <p>Connect your GitHub account and install the Radar app to monitor your repositories.</p>
        </div>
        
        <div className="mt-6 space-y-6">
          {/* Step 1: OAuth Authentication */}
          <div className="flex items-start space-x-4 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex-shrink-0">
              {hasGitHubAccount ? (
                <div className="w-8 h-8 bg-mint-green-400 text-white rounded-full flex items-center justify-center">
                  <FiCheck className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </div>
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">Authenticate with GitHub</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Connect your GitHub account to identify yourself and access your profile information.
              </p>
              {!hasGitHubAccount && (
                <Button 
                  onClick={connectGithub}
                  variant="primary"
                  icon={<FiGithub />}
                >
                  Connect GitHub account
                </Button>
              )}
              {hasGitHubAccount && (
                <div className="text-sm text-mint-green-400 dark:text-mint-green-300 font-medium">
                  ✓ Connected as {user?.github_login || 'GitHub user'}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: App Installation */}
          <div className="flex items-start space-x-4 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
            <div className="flex-shrink-0">
              {checkingInstallations ? (
                <div className="w-8 h-8 bg-marian-blue-100 dark:bg-marian-blue-800 text-marian-blue-600 dark:text-marian-blue-300 rounded-full flex items-center justify-center">
                  <div className="relative w-4 h-4">
                    <div className="w-4 h-4 rounded-full border-2 border-marian-blue-200 dark:border-marian-blue-600"></div>
                    <div className="absolute top-0 left-0 w-4 h-4 rounded-full border-2 border-marian-blue-600 dark:border-marian-blue-300 border-t-transparent animate-spin"></div>
                  </div>
                </div>
              ) : hasGitHubApp ? (
                <div className="w-8 h-8 bg-mint-green-400 text-white rounded-full flex items-center justify-center">
                  <FiCheck className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </div>
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">
                {checkingInstallations ? 'Checking installation...' : hasGitHubApp ? 'Radar app installed' : 'Install Radar app'}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                {checkingInstallations 
                  ? 'Checking if the Radar GitHub App is installed...'
                  : hasGitHubApp 
                    ? `The Radar GitHub App is installed and monitoring ${installationStatus?.total_repositories || 0} ${installationStatus?.total_repositories === 1 ? 'repository' : 'repositories'} across ${installationStatus?.total_installations || 0} installation(s).`
                    : 'Install the Radar GitHub App to your repositories to monitor pull requests, issues, and comments.'
                }
              </p>
              {hasGitHubAccount && !checkingInstallations && !hasGitHubApp && (
                <Button 
                  onClick={installGithubApp}
                  variant="secondary"
                  icon={<FiSettings />}
                >
                  Install GitHub app
                </Button>
              )}
              {hasGitHubAccount && !checkingInstallations && hasGitHubApp && (
                <div className="space-y-3">
                  <div className="text-sm text-mint-green-400 dark:text-mint-green-300 font-medium">
                    ✓ {installationStatus?.total_installations} installation(s) found
                  </div>
                  {installationStatus?.installations?.map((installation: any, index: number) => (
                    <div key={installation.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">{installation.account_name}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                            ({installation.account_type}) • {installation.repository_count} {installation.repository_count === 1 ? 'repository' : 'repositories'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex space-x-3">
                    <Button 
                      onClick={installGithubApp}
                      variant="ghost"
                      size="sm"
                      icon={<FiSettings />}
                    >
                      Update installation
                    </Button>
                    <Button 
                      onClick={() => window.open('https://github.com/settings/installations', '_blank')}
                      variant="ghost"
                      size="sm"
                      icon={<FiGithub />}
                    >
                      Manage on GitHub
                    </Button>
                  </div>
                </div>
              )}
              {!hasGitHubAccount && (
                <p className="text-sm text-gray-400">Complete step 1 first</p>
              )}
              {checkingInstallations && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Please wait while we check your GitHub App installations...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GithubIntegration() {
  return (
    <Suspense fallback={<Loader size="large" />}>
      <GithubIntegrationContent />
    </Suspense>
  );
}