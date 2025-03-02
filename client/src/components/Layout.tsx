import React, { ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { FiHome, FiSettings, FiGithub, FiLogOut, FiBarChart2 } from 'react-icons/fi';

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
        <div className="h-screen flex overflow-hidden">
          {/* Sidebar - fixed height */}
          <aside className="w-64 bg-white dark:bg-gray-800 shadow-md flex-shrink-0 flex flex-col">
            <div className="p-6">
              <h1 className="text-2xl font-bold text-primary-600">Radar</h1>
            </div>
            <nav className="mt-6 flex-grow">
              <ul>
                <li>
                  <Link href="/dashboard" 
                    className={`flex items-center px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      router.pathname === '/dashboard' ? 'bg-gray-100 dark:bg-gray-700 border-l-4 border-primary-500' : ''
                    }`}>
                    <FiHome className="mr-3" />
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link href="/settings" 
                    className={`flex items-center px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      router.pathname === '/settings' ? 'bg-gray-100 dark:bg-gray-700 border-l-4 border-primary-500' : ''
                    }`}>
                    <FiSettings className="mr-3" />
                    Settings
                  </Link>
                </li>
                <li>
                  <Link href="/stats" 
                    className={`flex items-center px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      router.pathname === '/stats' ? 'bg-gray-100 dark:bg-gray-700 border-l-4 border-primary-500' : ''
                    }`}>
                    <FiBarChart2 className="mr-3" />
                    Statistics
                  </Link>
                </li>
                {!user?.github_id && (
                  <li>
                    <Link href="/connect-github" 
                      className={`flex items-center px-6 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        router.pathname === '/connect-github' ? 'bg-gray-100 dark:bg-gray-700 border-l-4 border-primary-500' : ''
                      }`}>
                      <FiGithub className="mr-3" />
                      Connect GitHub
                    </Link>
                  </li>
                )}
              </ul>
            </nav>
            <div className="p-6">
              <button 
                onClick={logout}
                className="flex items-center w-full px-4 py-2 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                <FiLogOut className="mr-3" />
                Logout
              </button>
            </div>
          </aside>

          {/* Main content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Fixed header */}
            <header className="bg-white dark:bg-gray-800 shadow-sm">
              <div className="px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">{title}</h2>
              </div>
            </header>
            
            {/* Scrollable content area */}
            <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-900">
              <div className="p-6">
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
