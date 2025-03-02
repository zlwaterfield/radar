import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { FiGithub } from 'react-icons/fi';

export default function ConnectGithub() {
  const { user, isAuthenticated, loading, connectGithub } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push('/');
      } else if (user?.github_id) {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, loading, router, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Layout title="Connect GitHub">
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <h2 className="text-2xl font-bold mb-6">Connect Your GitHub Account</h2>
          
          <p className="mb-6">
            To use Radar, you need to connect your GitHub account. This allows us to:
          </p>
          
          <ul className="list-disc pl-6 mb-6 space-y-2">
            <li>Access your repositories to set up notifications</li>
            <li>Monitor pull requests, issues, and comments</li>
            <li>Send notifications to your Slack workspace</li>
          </ul>
          
          <p className="mb-8">
            We only request read access to your repositories and will never make changes to your code.
          </p>
          
          <div className="flex justify-center">
            <button 
              onClick={connectGithub}
              className="btn btn-primary flex items-center text-lg px-8 py-3"
            >
              <FiGithub className="mr-2" />
              Connect GitHub Account
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
