'use client'

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Loader from '@/components/Loader';
import Button from '@/components/Button';
import { FiArrowRight, FiGithub } from 'react-icons/fi';

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  // if (loading) {
  //   return <Loader fullScreen size="large" />;
  // }

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
        {isAuthenticated ? (
          <div className="absolute top-4 right-4 z-20">
            <Button
              onClick={() => router.push('/settings/notifications')}
              variant="secondary"
              icon={<FiArrowRight size={20} />}
              iconPosition="right"
              className="bg-white/90 dark:bg-gray-800 backdrop-blur-sm"
            >
              View dashboard
            </Button>
          </div>
        ) : (
          <div className="absolute top-4 right-4 z-20">
              <Button
                onClick={() => router.push('/auth/signin')}
                variant="secondary"
              >
                Sign In
              </Button>
          </div>
        )}
        <main className="flex flex-col items-center justify-center py-20 w-full flex-1 px-4 sm:px-8 lg:px-20 text-center relative z-10">
          <div className="backdrop-blur-sm bg-white dark:bg-gray-800/50 rounded-3xl px-12 py-8 mb-8 border border-gray-100 dark:border-gray-700 shadow-xl">
            <div className="mb-6 flex justify-center">
              <img 
                src="/logo-full-dark.png" 
                alt="Radar" 
                className="h-14 w-auto dark:hidden block"
              />
              <img 
                src="/logo-full-light.png" 
                alt="Radar" 
                className="h-14 w-auto hidden dark:block"
              />
            </div>
            
            <p className="mt-3 text-2xl max-w-2xl mb-8 text-gray-700 dark:text-gray-200">
              Never miss important GitHub activity.<br/>Get instant notifications in Slack.
            </p>
            
            {!isAuthenticated && (
              <div className="flex flex-col items-center space-y-6">
                <div className="flex item-center justify-center space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
                  <Button
                    onClick={() => router.push('/auth/signup')}
                    variant="primary"
                  >
                    Get Started
                  </Button>
                </div>
                {/* <div className="flex items-center space-x-4 sm:space-x-8 text-sm text-gray-600 dark:text-gray-400">
                  <div className="text-center">
                    <div className="font-bold text-lg text-marian-blue-700 dark:text-light-blue-500"></div>
                    <div>Active users</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg text-marian-blue-700 dark:text-light-blue-500"></div>
                    <div>Notifications sent</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg text-marian-blue-700 dark:text-light-blue-500"></div>
                    <div>Saved daily</div>
                  </div>
                </div> */}
              </div>
            )}
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3 max-w-4xl">
            <div className="backdrop-blur-sm bg-white dark:bg-gray-800/30 rounded-lg p-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all hover:cursor-pointer">
              <div className="flex items-center justify-center mb-4">
                <h2 className="text-xl font-semibold text-marian-blue-700 dark:text-light-blue-500">Real-time notifications</h2>
              </div>
              <p className="text-gray-600 dark:text-gray-300">Get instant notifications about pull requests, reviews, comments, issues, and more.</p>
            </div>
            
            <div className="backdrop-blur-sm bg-white dark:bg-gray-800/30 rounded-lg p-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all hover:cursor-pointer">
              <div className="flex items-center justify-center mb-4">
                <h2 className="text-xl font-semibold text-marian-blue-700 dark:text-light-blue-500">Custom filters</h2>
              </div>
              <p className="text-gray-600 dark:text-gray-300">Choose which repositories and events you want to be notified about.</p>
            </div>
            
            <div className="backdrop-blur-sm bg-white dark:bg-gray-800/30 rounded-lg p-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all hover:cursor-pointer">
              <div className="flex items-center justify-center mb-4">
                <h2 className="text-xl font-semibold text-marian-blue-700 dark:text-light-blue-500">AI keyword matching</h2>
              </div>
              <p className="text-gray-600 dark:text-gray-300">Intelligent filtering based on keywords and patterns in your code changes.</p>
            </div>
          </div>
          
          {/* How it works section */}
          <div className="mt-16 max-w-4xl">
            <h2 className="text-2xl font-bold text-center mb-12 text-gray-800 dark:text-gray-100">How it works</h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="w-12 h-12 bg-marian-blue-500 dark:bg-marian-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-marian-blue-900 dark:text-light-blue-400 font-bold text-lg">1</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">Connect GitHub</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">Link your GitHub repositories through our secure integration</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-marian-blue-500 dark:bg-marian-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-marian-blue-900 dark:text-light-blue-400 font-bold text-lg">2</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">Configure notifications</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">Choose which events and repositories you want to track</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-marian-blue-500 dark:bg-marian-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-marian-blue-900 dark:text-light-blue-400 font-bold text-lg">3</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-100">Receive in Slack</h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">Get instant, intelligent notifications in your Slack channels</p>
              </div>
            </div>
          </div>
          
          {/* Demo section */}
          <div className="mt-16 max-w-xl w-full">
            <h2 className="text-2xl font-bold text-center mb-8 text-gray-800 dark:text-gray-100">See it in action</h2>
            <div className="backdrop-blur-sm bg-white dark:bg-gray-800/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700 shadow-lg">
              <div className="flex items-start space-x-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-bold">R</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline space-x-2 mb-1">
                    <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">Radar</span>
                    <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded font-medium">APP</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">2:14 PM</span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3 border-l-4 border-green-600 mt-2">
                    <div className="text-left">
                      <div className="font-bold text-gray-900 dark:text-gray-100 text-sm mb-1">🆕 Pull Request Opened</div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">Add user authentication endpoint</div>
                      <div className="text-gray-600 dark:text-gray-400 text-sm mb-1">your-app/backend</div>
                      <div className="text-gray-700 dark:text-gray-300 text-xs mb-3">@john.doe</div>
                      <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded font-medium transition-colors">
                        View on GitHub
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
              <FiGithub size={20} className="mr-2" />
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
