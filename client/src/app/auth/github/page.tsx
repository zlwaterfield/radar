"use client"

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';
import { FiGithub, FiCheck, FiSettings } from 'react-icons/fi';

function ConnectGithubContent() {
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
      window.location.href = '/auth/github';  // Clean redirect to remove token from URL
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
    return <Loader fullScreen size="large" />;
  }

  const hasGitHubAccount = user?.github_id;
  const hasGitHubApp = installationStatus?.has_installations;

  return (
    <Layout title="Connect GitHub" showBackButton={true}>
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <h2 className="text-2xl font-bold mb-6">Connect Your GitHub Account</h2>
          
          <p className="mb-6">
            To use Radar, you need to complete two steps to connect with GitHub:
          </p>
          
          <div className="space-y-6 mb-8">
            {/* Step 1: OAuth Authentication */}
            <div className="flex items-start space-x-4 p-4 rounded-lg border-2 border-gray-200">
              <div className="flex-shrink-0">
                {hasGitHubAccount ? (
                  <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <FiCheck className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Authenticate with GitHub</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Connect your GitHub account to identify yourself and access your profile information.
                </p>
                {!hasGitHubAccount && (
                  <button 
                    onClick={connectGithub}
                    className="btn btn-primary flex items-center"
                  >
                    <FiGithub className="mr-2" />
                    Connect GitHub Account
                  </button>
                )}
                {hasGitHubAccount && (
                  <div className="text-sm text-green-600 font-medium">
                    ✓ Connected as {user?.github_login || 'GitHub user'}
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: App Installation */}
            <div className="flex items-start space-x-4 p-4 rounded-lg border-2 border-gray-200">
              <div className="flex-shrink-0">
                {checkingInstallations ? (
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                    <div className="relative w-4 h-4">
                      <div className="w-4 h-4 rounded-full border-2 border-blue-200"></div>
                      <div className="absolute top-0 left-0 w-4 h-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
                    </div>
                  </div>
                ) : hasGitHubApp ? (
                  <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                    <FiCheck className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-2">
                  {checkingInstallations ? 'Checking Installation...' : hasGitHubApp ? 'Radar App Installed' : 'Install Radar App'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  {checkingInstallations 
                    ? 'Checking if the Radar GitHub App is installed...'
                    : hasGitHubApp 
                      ? `The Radar GitHub App is installed and monitoring ${installationStatus?.total_repositories || 0} repositories across ${installationStatus?.total_installations || 0} installation(s).`
                      : 'Install the Radar GitHub App to your repositories to monitor pull requests, issues, and comments.'
                  }
                </p>
                {hasGitHubAccount && !checkingInstallations && !hasGitHubApp && (
                  <button 
                    onClick={installGithubApp}
                    className="btn btn-secondary flex items-center"
                  >
                    <FiSettings className="mr-2" />
                    Install GitHub App
                  </button>
                )}
                {hasGitHubAccount && !checkingInstallations && hasGitHubApp && (
                  <div className="space-y-3">
                    <div className="text-sm text-green-600 font-medium">
                      ✓ {installationStatus?.total_installations} installation(s) found
                    </div>
                    {installationStatus?.installations?.map((installation: any, index: number) => (
                      <div key={installation.id} className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{installation.account_name}</span>
                            <span className="text-sm text-gray-500 ml-2">
                              ({installation.account_type}) • {installation.repository_count} repositories
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex space-x-3">
                      <button 
                        onClick={installGithubApp}
                        className="btn btn-outline flex items-center text-sm"
                      >
                        <FiSettings className="mr-2" />
                        Update Installation
                      </button>
                      <button 
                        onClick={() => window.open('https://github.com/settings/installations', '_blank')}
                        className="btn btn-outline flex items-center text-sm"
                      >
                        <FiGithub className="mr-2" />
                        Manage on GitHub
                      </button>
                    </div>
                  </div>
                )}
                {!hasGitHubAccount && (
                  <p className="text-sm text-gray-400">Complete step 1 first</p>
                )}
                {checkingInstallations && (
                  <div className="text-sm text-gray-500">
                    Please wait while we check your GitHub App installations...
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Privacy:</strong> We only request read access to your repositories and will never make changes to your code. 
              You can manage app permissions at any time through GitHub settings.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function ConnectGithub() {
  return (
    <Suspense fallback={<Loader fullScreen size="large" />}>
      <ConnectGithubContent />
    </Suspense>
  );
}
