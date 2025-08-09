"use client"

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { useRouter, usePathname } from 'next/navigation';

interface User {
  id: string;
  name?: string;
  email?: string;
  slack_id?: string;
  github_id?: string;
  github_login?: string;
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
  installGithubApp: () => void;
  manageGithubRepoAccess: () => void;
  checkGithubInstallations: () => Promise<any>;
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
  const isValidating = useRef(false);
  
  const isAuthenticated = !!user;
  
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Math.floor(Date.now() / 1000);
      return payload.exp < currentTime;
    } catch (error) {
      // If we can't parse the token, consider it expired
      return true;
    }
  };
  
  useEffect(() => {
    // Set up axios default auth header
    const authToken = Cookies.get('auth_token');
    console.log('AuthContext: Checking for auth token:', !!authToken);
    
    if (authToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    }
    
    // Set up axios interceptor to handle 401 responses
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token is invalid/expired, clear it
          Cookies.remove('auth_token');
          Cookies.remove('user_id');
          delete axios.defaults.headers.common['Authorization'];
          setUser(null);
          setError('Session expired');
        }
        return Promise.reject(error);
      }
    );
    
    // Check if user is already authenticated (only run once on mount)
    if (authToken && !isValidating.current) {
      console.log('AuthContext: Found auth token, checking if expired...');
      // Check if token is expired before making API call
      if (isTokenExpired(authToken)) {
        console.log('AuthContext: Token is expired, clearing...');
        // Token is expired, clear it
        Cookies.remove('auth_token');
        Cookies.remove('user_id');
        delete axios.defaults.headers.common['Authorization'];
        setLoading(false);
      } else {
        console.log('AuthContext: Token is valid, validating with API...');
        isValidating.current = true;
        validateToken(authToken);
      }
    } else if (!authToken) {
      console.log('AuthContext: No auth token found, setting loading to false');
      setLoading(false);
    }
    
    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []); // Remove pathname dependency
  
  // Handle route protection separately, only redirect when necessary
  useEffect(() => {
    if (!loading && !isAuthenticated && !pathname.startsWith('/auth/')) {
      router.push('/');
    }
  }, [loading, isAuthenticated, pathname, router]);
  
  const validateToken = async (token: string) => {
    try {
      console.log('AuthContext: Making API call to validate token...');
      setLoading(true);
      const response = await axios.post('/api/auth/validate', { token });
      console.log('AuthContext: Token validation successful, user:', response.data.user);
      setUser(response.data.user);
      setError(null);
    } catch (err) {
      console.error('AuthContext: Error validating token:', err);
      setError('Session expired or invalid');
      Cookies.remove('auth_token');
      Cookies.remove('user_id');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
      isValidating.current = false;
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
  
  const installGithubApp = () => {
    if (user) {
      window.location.href = `/api/auth/github/install?user_id=${user.id}`;
    } else {
      setError('You must be logged in to install the GitHub App');
    }
  };
  
  const checkGithubInstallations = async () => {
    if (!user) {
      throw new Error('You must be logged in to check GitHub installations');
    }
    
    try {
      const response = await axios.get(`/api/users/${user.id}/github-installations`);
      return response.data;
    } catch (error) {
      console.error('Error checking GitHub installations:', error);
      throw error;
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
        installGithubApp,
        manageGithubRepoAccess,
        checkGithubInstallations
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
