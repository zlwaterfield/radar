'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FiHome, FiSettings, FiGithub, FiLogOut, FiBarChart2, FiBell } from 'react-icons/fi';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();

  // If not authenticated, this would be handled by the page components
  // redirecting to the login page
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-shrink-0 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <h1 className="text-xl font-bold text-primary-600 flex items-center">
            <FiBell className="mr-2" />
            Radar
          </h1>
        </div>
        <nav className="mt-4 flex-grow">
          <div className="px-4 mb-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Main</p>
          </div>
          <ul className="space-y-1">
            <li>
              <Link href="/dashboard" 
                className={`flex items-center px-4 py-2 mx-2 text-sm rounded-md transition-colors ${
                  pathname === '/dashboard' 
                    ? 'bg-primary-50 text-primary-700 dark:bg-gray-800 dark:text-primary-400 font-medium' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}>
                <FiHome className="mr-3 flex-shrink-0 h-5 w-5" />
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/dashboard/settings" 
                className={`flex items-center px-4 py-2 mx-2 text-sm rounded-md transition-colors ${
                  pathname === '/dashboard/settings' 
                    ? 'bg-primary-50 text-primary-700 dark:bg-gray-800 dark:text-primary-400 font-medium' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}>
                <FiSettings className="mr-3 flex-shrink-0 h-5 w-5" />
                Settings
              </Link>
            </li>
            <li>
              <Link href="/dashboard/stats" 
                className={`flex items-center px-4 py-2 mx-2 text-sm rounded-md transition-colors ${
                  pathname === '/dashboard/stats' 
                    ? 'bg-primary-50 text-primary-700 dark:bg-gray-800 dark:text-primary-400 font-medium' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}>
                <FiBarChart2 className="mr-3 flex-shrink-0 h-5 w-5" />
                Statistics
              </Link>
            </li>
          </ul>
          
          {!user?.github_id && (
            <>
              <div className="px-4 mt-6 mb-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Integrations</p>
              </div>
              <ul className="space-y-1">
                <li>
                  <Link href="/auth/github" 
                    className={`flex items-center px-4 py-2 mx-2 text-sm rounded-md transition-colors ${
                      pathname === '/auth/github' 
                        ? 'bg-primary-50 text-primary-700 dark:bg-gray-800 dark:text-primary-400 font-medium' 
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}>
                    <FiGithub className="mr-3 flex-shrink-0 h-5 w-5" />
                    Connect GitHub
                  </Link>
                </li>
              </ul>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mr-2">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || ''}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            <FiLogOut className="mr-2 h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-10">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              {pathname === '/dashboard' && 'Dashboard'}
              {pathname === '/settings' && 'Settings'}
              {pathname === '/stats' && 'Statistics'}
            </h2>
            <div className="flex items-center space-x-4">
              {/* Add header actions here if needed */}
            </div>
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
