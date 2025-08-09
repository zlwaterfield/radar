"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  name?: string;
  email?: string;
  slack_id?: string;
  github_id?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  connectGithub: () => void;
  reconnectGithub: () => void;
  manageGithubRepoAccess: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  
  const isAuthenticated = !!user;
  
  useEffect(() => {
    // Set up axios default auth header
    const authToken = Cookies.get('auth_token');
    if (authToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Check if user is already authenticated
    if (authToken) {
      validateToken(authToken);
    } else {
      setLoading(false);
      // Don't redirect to home if we're on auth pages (let them handle their own flow)
      if (!pathname.startsWith('/auth/')) {
        router.push('/');
      }
    }
  }, [pathname]);
  
  const validateToken = async (token: string) => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/auth/validate?token=${token}`);
      setUser(response.data.user);
      setError(null);
    } catch (err) {
      console.error('Error validating token:', err);
      setError('Session expired or invalid');
      Cookies.remove('auth_token');
      Cookies.remove('user_id');
      // Don't redirect to home if we're on auth pages (let them handle their own flow)
      if (!pathname.startsWith('/auth/')) {
        router.push('/');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const login = () => {
    window.location.href = '/api/auth/slack/login';
  };
  
  const logout = async () => {
    try {
      if (user) {
        await axios.get(`/api/auth/logout?user_id=${user.id}`);
      }
      Cookies.remove('auth_token');
      Cookies.remove('user_id');
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
      router.push('/');
    } catch (err) {
      console.error('Error logging out:', err);
      setError('Failed to log out');
    }
  };
  
  const connectGithub = () => {
    if (user) {
      window.location.href = `/api/auth/github/login?user_id=${user.id}`;
    } else {
      setError('You must be logged in to connect GitHub');
    }
  };
  
  const reconnectGithub = () => {
    if (user) {
      // Same endpoint but we're explicitly reconnecting to update permissions
      window.location.href = `/api/auth/github/login?user_id=${user.id}&reconnect=true`;
    } else {
      setError('You must be logged in to update GitHub permissions');
    }
  };
  
  const manageGithubRepoAccess = () => {
    // Redirect to GitHub's application settings page
    window.open('https://github.com/settings/installations', '_blank');
  };
  
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated,
        login,
        logout,
        connectGithub,
        reconnectGithub,
        manageGithubRepoAccess
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
