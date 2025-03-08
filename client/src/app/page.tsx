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
      router.push('/dashboard');
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
      <div className="flex flex-col items-center justify-center min-h-screen py-2">
        <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
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
          
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3 max-w-4xl">
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Real-time Notifications</h2>
              <p>Get instant notifications about pull requests, reviews, comments, and more.</p>
            </div>
            
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Custom Filters</h2>
              <p>Choose which repositories and events you want to be notified about.</p>
            </div>
            
            <div className="card">
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
