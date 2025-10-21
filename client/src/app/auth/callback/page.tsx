"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      if (loading) {
        return;
      }

      if (user) {
        // Get the stored redirect URL or default to onboarding
        const redirectUrl = sessionStorage.getItem('auth_redirect') || '/onboarding';
        sessionStorage.removeItem('auth_redirect');

        // Check if user has completed onboarding
        try {
          const [slackResponse, githubResponse] = await Promise.all([
            fetch('/api/integrations/slack/status'),
            fetch('/api/integrations/github/status'),
          ]);

          const slackStatus = await slackResponse.json();
          const githubStatus = await githubResponse.json();

          // If user has connected either Slack or GitHub, redirect to dashboard
          if (slackStatus.connected || githubStatus.connected) {
            router.push('/dashboard');
          } else {
            router.push(redirectUrl);
          }
        } catch (error) {
          console.error('Error checking integration status:', error);
          router.push(redirectUrl);
        }
      } else {
        // If not authenticated, redirect to sign-in with error
        router.push('/auth/signin?error=authentication_failed');
      }
    };

    handleCallback();
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Completing sign in...</p>
      </div>
    </div>
  );
}
