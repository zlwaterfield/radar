'use client'

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { FiGithub, FiSlack } from 'react-icons/fi';

export default function Home() {
  const { isAuthenticated, loading, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.push('/settings/notifications');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Layout title="Welcome">
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
        <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center relative z-10">
          <div className="backdrop-blur-sm bg-white/5 dark:bg-gray-900/5 rounded-3xl p-8 mb-8 border border-white/10 dark:border-gray-700/20">
            <h1 className="text-6xl font-bold text-primary-600 mb-6">
              Radar
            </h1>
            
            <p className="mt-3 text-2xl max-w-2xl mb-8">
              Track GitHub activity and receive notifications in Slack
            </p>
            
            <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
              <button
                onClick={login}
                className="btn btn-primary flex items-center justify-center text-lg px-8 py-3"
              >
                <FiSlack className="mr-2" />
                Login with Slack
              </button>
            </div>
          </div>
          
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 max-w-4xl">
            <div className="card backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-white/20 dark:border-gray-700/30">
              <h2 className="text-xl font-semibold mb-4">Real-time Notifications</h2>
              <p>Get instant notifications about pull requests, reviews, comments, and more.</p>
            </div>
            
            <div className="card backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-white/20 dark:border-gray-700/30">
              <h2 className="text-xl font-semibold mb-4">Custom Filters</h2>
              <p>Choose which repositories and events you want to be notified about.</p>
            </div>
            
            <div className="card backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 border-white/20 dark:border-gray-700/30">
              <h2 className="text-xl font-semibold mb-4">Team Collaboration</h2>
              <p>Keep your entire team in the loop with shared notifications.</p>
            </div>
          </div>
        </main>
        
        <footer className="w-full h-24 border-t border-gray-200 dark:border-gray-700 flex justify-center items-center">
          <a
            className="flex items-center justify-center"
            href="https://github.com/zlwaterfield/radar"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FiGithub className="mr-2" />
            View on GitHub
          </a>
        </footer>
      </div>
    </Layout>
  );
}
