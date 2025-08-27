'use client'

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import { FiGithub, FiSlack, FiArrowRight } from 'react-icons/fi';

export default function Home() {
  const { isAuthenticated, loading, login } = useAuth();
  const router = useRouter();

  // Remove auto-redirect - let users see the homepage even when logged in

  if (loading) {
    return <Loader fullScreen size="large" />;
  }

  return (
    <>
      <div className="animated-background">
        <div className="grid-pattern"></div>
        <div className="floating-orbs">
          <div className="orb"></div>
          <div className="orb"></div>
          <div className="orb"></div>
          <div className="orb"></div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center min-h-screen py-2 relative">
        {/* View Dashboard button for logged-in users */}
        {isAuthenticated && (
          <div className="absolute top-4 right-4 z-20">
            <Button
              onClick={() => router.push('/settings/notifications')}
              variant="secondary"
              icon={<FiArrowRight />}
              iconPosition="right"
              className="bg-white/90 dark:bg-gray-800 backdrop-blur-sm"
            >
              View dashboard
            </Button>
          </div>
        )}
        <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center relative z-10">
          <div className="backdrop-blur-sm bg-white dark:bg-gray-800/50 rounded-3xl p-8 mb-8 border border-gray-100 dark:border-gray-700 shadow-xl">
            <div className="mb-6 flex justify-center">
              <img 
                src="/logo-full-dark.png" 
                alt="Radar" 
                className="h-10 w-auto dark:hidden block"
              />
              <img 
                src="/logo-full-light.png" 
                alt="Radar" 
                className="h-10 w-auto hidden dark:block"
              />
            </div>
            
            <p className="mt-3 text-2xl max-w-2xl mb-8 text-gray-700 dark:text-gray-200">
              Track GitHub activity and receive notifications in Slack
            </p>
            
            {!isAuthenticated && (
              <div className="flex item-center justify-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
                <Button
                  onClick={login}
                  variant="primary"
                  size="lg"
                  icon={<FiSlack />}
                >
                  Login with Slack
                </Button>
              </div>
            )}
          </div>
          
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 max-w-4xl">
            <div className="backdrop-blur-sm bg-white dark:bg-gray-800/30 rounded-lg p-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all hover:border-marian-blue-200 dark:hover:border-gray-600">
              <h2 className="text-xl font-semibold mb-4 text-marian-blue-700 dark:text-light-blue-500">Real-time notifications</h2>
              <p className="text-gray-600 dark:text-gray-300">Get instant notifications about pull requests, reviews, comments, and more.</p>
            </div>
            
            <div className="backdrop-blur-sm bg-white dark:bg-gray-800/30 rounded-lg p-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all hover:border-marian-blue-200 dark:hover:border-gray-600">
              <h2 className="text-xl font-semibold mb-4 text-marian-blue-700 dark:text-light-blue-500">Custom filters</h2>
              <p className="text-gray-600 dark:text-gray-300">Choose which repositories and events you want to be notified about.</p>
            </div>
            
            <div className="backdrop-blur-sm bg-white dark:bg-gray-800/30 rounded-lg p-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all hover:border-marian-blue-200 dark:hover:border-gray-600">
              <h2 className="text-xl font-semibold mb-4 text-marian-blue-700 dark:text-light-blue-500">Team collaboration</h2>
              <p className="text-gray-600 dark:text-gray-300">Keep your entire team in the loop with shared notifications.</p>
            </div>
          </div>
        </main>
        
        <footer className="w-full h-24 border-t border-gray-100 dark:border-gray-700 flex justify-center items-center">
          <div className="flex items-center space-x-6">
            <a
              className="flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              href="https://github.com/zlwaterfield/radar"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FiGithub className="mr-2" />
              View on GitHub
            </a>
            <span className="text-gray-400 dark:text-gray-600">·</span>
            <Link href="/terms" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
              Terms
            </Link>
            <span className="text-gray-400 dark:text-gray-600">·</span>
            <Link href="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
              Privacy
            </Link>
          </div>
        </footer>
      </div>
    </>
  );
}
