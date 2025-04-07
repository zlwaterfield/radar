import React, { ReactNode } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FiLogOut, FiBell } from 'react-icons/fi';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title = 'Radar' }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  return (
    <>
      <Head>
        <title>{title} | Radar</title>
        <meta name="description" content="Track GitHub activity and receive notifications in Slack" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {isAuthenticated ? (
        <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-950">
          {/* Sidebar */}
          <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex-shrink-0 flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
              <h1 className="text-xl font-bold text-primary-600 flex items-center">
                <FiBell className="mr-2" />
                Radar
              </h1>
            </div>
            
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
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
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
      ) : (
        <main>{children}</main>
      )}
    </>
  );
};

export default Layout;
