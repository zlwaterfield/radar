'use client'

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/Button';
import GitHubStarButton from '@/components/GitHubStarButton';
import { FiArrowRight, FiGithub, FiBell, FiFilter, FiZap } from 'react-icons/fi';

export default function Home() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

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
      <div className="flex flex-col items-center min-h-screen py-2 relative">
        {/* Header */}
        <div className="w-full max-w-5xl px-4 sm:px-8 py-6 flex justify-between items-center relative z-20">
          <div className="flex items-center">
            <img
              src="/logo-full-dark.png"
              alt="Radar"
              className="h-8 w-auto dark:hidden block"
            />
            <img
              src="/logo-full-light.png"
              alt="Radar"
              className="h-8 w-auto hidden dark:block"
            />
          </div>
          <div className="flex items-center gap-3">
            <GitHubStarButton repo="zlwaterfield/radar" />
            {isAuthenticated ? (
              <Button
                onClick={() => router.push('/dashboard')}
                variant="secondary"
                icon={<FiArrowRight size={18} />}
                iconPosition="right"
                className="bg-white/90 dark:bg-gray-800 backdrop-blur-sm"
              >
                Dashboard
              </Button>
            ) : (
              <Button
                onClick={() => router.push('/auth/signin')}
                variant="secondary"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>

        <main className="flex flex-col items-center w-full max-w-5xl px-4 sm:px-8 pb-20 relative z-10">
          {/* Hero Section */}
          <div className="w-full border border-gray-200 dark:border-gray-700 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-16 mt-12 text-center shadow-xl hover:shadow-2xl transition-shadow duration-300">
            <div className="space-y-8">
              <h1 className="text-6xl md:text-7xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent tracking-tight leading-tight">
                Stay in Sync with Your Pull Requests
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto font-medium">
                Smart GitHub notifications for your Slack workspace. Stay informed without the noise.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-6">
                <div className="px-5 py-2.5 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200 dark:border-green-700 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-sm font-mono font-bold text-green-700 dark:text-green-400">REAL-TIME SYNC</span>
                </div>
                <div className="px-5 py-2.5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-200 dark:border-blue-700 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-sm font-mono font-bold text-blue-700 dark:text-blue-400">AI-POWERED FILTERING</span>
                </div>
                <div className="px-5 py-2.5 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-pink-900/30 border border-purple-200 dark:border-purple-700 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <span className="text-sm font-mono font-bold text-purple-700 dark:text-purple-400">ZERO CONFIG</span>
                </div>
              </div>
              {!isAuthenticated && (
                <div className="pt-8 flex justify-center">
                  <Button
                    onClick={() => router.push('/auth/signup')}
                    variant="primary"
                    className="text-lg px-10 py-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                  >
                    Get Started Free
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Features Grid */}
          <div className="w-full mt-24 space-y-8">
            {/* Feature 1 - Real-time Notifications */}
            <div className="group w-full border border-gray-200 dark:border-gray-700 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-10 border-l-4 border-l-green-500 shadow-lg hover:shadow-2xl hover:scale-[1.01] transition-all duration-300">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <FiBell className="text-green-600 dark:text-green-400" size={28} />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Real-time Notifications</h2>
                  </div>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                    Get instant Slack notifications for pull requests, reviews, issues, and comments. Configure multiple notification profiles with priority-based routing to ensure the right messages reach the right channels.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-mono px-3 py-1.5 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 font-semibold">PRs</span>
                    <span className="text-xs font-mono px-3 py-1.5 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 font-semibold">Reviews</span>
                    <span className="text-xs font-mono px-3 py-1.5 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 font-semibold">Issues</span>
                    <span className="text-xs font-mono px-3 py-1.5 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 font-semibold">Comments</span>
                  </div>
                </div>
                <div className="flex-1 max-w-md">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-md group-hover:shadow-lg transition-shadow">
                    <div className="flex items-start space-x-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
                        <span className="text-white text-sm font-bold">R</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline space-x-2 mb-1">
                          <span className="font-bold text-gray-900 dark:text-gray-100 text-sm">Radar</span>
                          <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] rounded font-medium">APP</span>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border-l-4 border-green-500 mt-2 shadow-sm">
                          <div className="text-left">
                            <div className="font-bold text-gray-900 dark:text-gray-100 text-sm mb-1">🆕 PR Opened</div>
                            <div className="text-gray-700 dark:text-gray-300 text-xs mb-1">Add auth endpoint</div>
                            <div className="text-gray-500 dark:text-gray-400 text-[11px]">your-app/backend</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2 - Smart Filtering */}
            <div className="group w-full border border-gray-200 dark:border-gray-700 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-10 border-l-4 border-l-orange-500 shadow-lg hover:shadow-2xl hover:scale-[1.01] transition-all duration-300">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1 order-2 md:order-1">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-md group-hover:shadow-lg transition-shadow">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-gray-700 dark:text-gray-300">Priority: High</span>
                        <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 rounded font-medium">Active</span>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">FILTERS</div>
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded text-blue-700 dark:text-blue-400">review_requested</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded text-blue-700 dark:text-blue-400">assigned</span>
                        </div>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">KEYWORDS (AI)</div>
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded text-purple-700 dark:text-purple-400">security</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded text-purple-700 dark:text-purple-400">authentication</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 order-1 md:order-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <FiFilter className="text-orange-600 dark:text-orange-400" size={28} />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Intelligent Filtering</h2>
                  </div>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                    Create custom notification profiles with repository filters, event preferences, and AI-powered keyword matching. Only get notified about what matters to you.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-mono px-3 py-1.5 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 font-semibold">Custom profiles</span>
                    <span className="text-xs font-mono px-3 py-1.5 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 font-semibold">Priority routing</span>
                    <span className="text-xs font-mono px-3 py-1.5 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 font-semibold">AI keywords</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 3 - Digest Summaries */}
            <div className="group w-full border border-gray-200 dark:border-gray-700 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-10 border-l-4 border-l-pink-500 shadow-lg hover:shadow-2xl hover:scale-[1.01] transition-all duration-300">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                      <FiZap className="text-pink-600 dark:text-pink-400" size={28} />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Daily Digests</h2>
                  </div>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                    Schedule personalized digest summaries of GitHub activity. Multiple configurations for different teams, repositories, and time zones. Never lose track of what&apos;s happening.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs font-mono px-3 py-1.5 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 font-semibold">Scheduled</span>
                    <span className="text-xs font-mono px-3 py-1.5 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 font-semibold">Team-scoped</span>
                    <span className="text-xs font-mono px-3 py-1.5 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-600 rounded-md shadow-sm text-gray-700 dark:text-gray-300 font-semibold">Customizable</span>
                  </div>
                </div>
                <div className="flex-1 max-w-md">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-md group-hover:shadow-lg transition-shadow">
                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400 mb-2">📊 Daily Digest</div>
                    <div className="space-y-2">
                      <div className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
                        <div className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 mb-0.5">5 PRs opened</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">3 reviews requested</div>
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
                        <div className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 mb-0.5">12 comments</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">Across 4 repositories</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="w-full mt-32 border border-gray-200 dark:border-gray-700 rounded-xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-16 shadow-xl">
            <h2 className="text-4xl md:text-5xl font-bold text-center mb-16 text-gray-900 dark:text-white">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="relative text-center group">
                <div className="relative inline-flex mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-2xl transition-all duration-300">
                    <FiGithub className="text-white" size={36} />
                  </div>
                </div>
                <div className="mb-3">
                  <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 tracking-wider">STEP 1</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Connect</h3>
                <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">Link your GitHub and Slack accounts with OAuth</p>
              </div>
              <div className="relative text-center group">
                <div className="relative inline-flex mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-2xl transition-all duration-300">
                    <FiFilter className="text-white" size={36} />
                  </div>
                </div>
                <div className="mb-3">
                  <span className="text-sm font-mono font-bold text-purple-600 dark:text-purple-400 tracking-wider">STEP 2</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Configure</h3>
                <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">Set up notification profiles and digest schedules</p>
              </div>
              <div className="relative text-center group">
                <div className="relative inline-flex mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity"></div>
                  <div className="relative w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-2xl transition-all duration-300">
                    <FiBell className="text-white" size={36} />
                  </div>
                </div>
                <div className="mb-3">
                  <span className="text-sm font-mono font-bold text-green-600 dark:text-green-400 tracking-wider">STEP 3</span>
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Stay Informed</h3>
                <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">Receive smart notifications in Slack channels or DMs</p>
              </div>
            </div>
          </div>
        </main>

        <footer className="w-full border-t border-gray-200 dark:border-gray-700 py-8 mt-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center space-x-6">
                <a
                  className="flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                  href="https://github.com/zlwaterfield/radar"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FiGithub size={18} className="mr-2" />
                  <span className="text-sm">GitHub</span>
                </a>
                <Link href="/terms" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                  Terms
                </Link>
                <Link href="/privacy" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                  Privacy
                </Link>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                Built for developers, by developers
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
