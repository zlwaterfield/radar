import React, { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/Button';
import { FiArrowLeft, FiLogOut } from 'react-icons/fi';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  showBackButton?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, title = 'Radar', showBackButton = false }) => {
  const { user, isAuthenticated, signOut } = useAuth();
  const router = useRouter();

  return (
    <>
      <Head>
        <title>{title} | Radar</title>
        <meta name="description" content="Track GitHub activity and receive notifications in Slack" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {isAuthenticated ? (
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
            
            {showBackButton && (
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <Button
                  onClick={() => router.push('/settings/notifications')}
                  variant="ghost"
                  size="sm"
                  icon={<FiArrowLeft size={20} />}
                  className="w-full justify-start"
                >
                  Go back
                </Button>
              </div>
            )}
            
            {/* Navigation */}
            <nav className="flex-1 px-4 py-6">
            </nav>
            
            {/* Footer Links */}
            
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
                onClick={signOut}
                variant="ghost"
                size="sm"
                icon={<FiLogOut size={20} />}
                className="w-full justify-start"
              >
                Logout
              </Button>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-center space-x-4 text-xs">
                <Link href="/terms" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  Terms
                </Link>
                <span className="text-gray-400 dark:text-gray-600">·</span>
                <Link href="/privacy" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                  Privacy
                </Link>
              </div>
            </div>
          </aside>

          {/* Main content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
              <div className="px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{title}</h2>
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
      ) : (
        <main>{children}</main>
      )}
    </>
  );
};

export default Layout;
