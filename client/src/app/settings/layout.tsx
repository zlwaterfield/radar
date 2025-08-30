'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/Button';
import { FiBell, FiCalendar, FiGitBranch, FiSearch, FiGithub, FiLogOut } from 'react-icons/fi';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname === path;
  };

  // If not authenticated, this would be handled by the page components
  // redirecting to the login page
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 flex flex-col">
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
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
        </div>
        <nav className="mt-4 flex-grow px-2">
          <ul className="space-y-1">
          <li>
            <Link href="/settings/notifications"
              className={`flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
                isActive('/settings/notifications')
                  ? 'bg-gradient-to-r from-marian-blue-600 to-federal-blue-700 text-white font-medium shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}>
              <FiBell size={20} className="mr-3 flex-shrink-0" />
              Notifications
            </Link>
          </li>
          {/* <li>
            <Link href="/settings/digest"
              className={`flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
                isActive('/settings/digest')
                  ? 'bg-primary-50 text-primary-700 dark:bg-gray-700 dark:text-primary-400 font-medium'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}>
              <FiCalendar size={20} className="mr-3 flex-shrink-0" />
              Daily digest
            </Link>
          </li> */}
          <li>
            <Link href="/settings/repositories"
              className={`flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
                isActive('/settings/repositories')
                  ? 'bg-gradient-to-r from-marian-blue-600 to-federal-blue-700 text-white font-medium shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}>
              <FiGitBranch size={20} className="mr-3 flex-shrink-0" />
              Repositories
            </Link>
          </li>
          <li>
            <Link href="/settings/keywords"
              className={`flex items-center px-4 py-2 text-sm rounded-md transition-colors ${
                isActive('/settings/keywords')
                  ? 'bg-gradient-to-r from-marian-blue-600 to-federal-blue-700 text-white font-medium shadow-md'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}>
              <FiSearch size={20} className="mr-3 flex-shrink-0" />
              Keywords
            </Link>
          </li>
          </ul>
          
          {/* Always show GitHub integration */}
          <div className="px-4 mt-6 mb-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Integrations</p>
          </div>
          <ul className="space-y-1">
            <li>
              <Link href="/onboarding" 
                className={`flex items-center px-4 py-2 mx-2 text-sm rounded-md transition-colors ${
                  pathname === '/onboarding' 
                    ? 'bg-gradient-to-r from-marian-blue-600 to-federal-blue-700 text-white font-medium shadow-md' 
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}>
                <FiGithub size={20} className="mr-3 flex-shrink-0" />
                Setup Integrations
              </Link>
            </li>
          </ul>
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-marian-blue-600 to-federal-blue-700 text-white flex items-center justify-center mr-2 shadow-md">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || ''}</p>
            </div>
          </div>
          <Button 
            onClick={logout}
            variant="ghost"
            size="sm"
            icon={<FiLogOut size={20} />}
            className="w-full justify-start"
          >
            Logout
          </Button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              {pathname === '/settings/notifications' && 'Notifications'}
              {/* {pathname === '/settings/digest' && 'Daily digest'} */}
              {pathname === '/settings/repositories' && 'Repositories'}
              {pathname === '/settings/keywords' && 'Keywords'}
              {pathname === '/onboarding' && 'Setup Integrations'}
            </h2>
            <div className="flex items-center space-x-4">
              {/* Add header actions here if needed */}
            </div>
          </div>
        </header>
        
        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-transparent">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
