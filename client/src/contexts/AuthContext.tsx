"use client"

import React, { createContext, useContext, ReactNode } from 'react';
import { toast } from 'sonner';
import { authClient } from '../../lib/auth-client';

interface User {
  id: string;
  name?: string;
  email?: string;
  emailVerified?: boolean;
  image?: string;
  createdAt?: Date;
  updatedAt?: Date;
  // Integration fields for backward compatibility
  slackId?: string;
  githubId?: string;
  githubLogin?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  // Keep existing integrations for backward compatibility
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
  const { useSession } = authClient;
  const { data: session, isPending: loading, error } = useSession();
  
  const user = session?.user || null;
  const isAuthenticated = !!user;
  
  const signIn = async (email: string, password: string) => {
    try {
      await authClient.signIn.email({
        email,
        password,
      });
    } catch (err) {
      throw err;
    }
  };
  
  const signUp = async (email: string, password: string, name?: string) => {
    try {
      await authClient.signUp.email({
        email,
        password,
        name,
      });
    } catch (err) {
      throw err;
    }
  };
  
  const signOut = async () => {
    try {
      await authClient.signOut();
      toast.success('Signed out successfully');
    } catch (err) {
      console.error('Error signing out:', err);
      toast.error('Failed to sign out. Please try again.');
      throw err;
    }
  };
  
  // Legacy integration methods - these will redirect to the backend OAuth endpoints
  const connectGithub = () => {
    if (user) {
      window.location.href = `/api/integrations/github/connect`;
    } else {
      throw new Error('You must be logged in to connect GitHub');
    }
  };
  
  const reconnectGithub = () => {
    if (user) {
      window.location.href = `/api/integrations/github/connect?reconnect=true`;
    } else {
      throw new Error('You must be logged in to update GitHub permissions');
    }
  };
  
  const installGithubApp = () => {
    if (user) {
      window.location.href = `/api/integrations/github/install`;
    } else {
      throw new Error('You must be logged in to install the GitHub App');
    }
  };
  
  const checkGithubInstallations = async () => {
    if (!user) {
      throw new Error('You must be logged in to check GitHub installations');
    }
    
    try {
      const response = await fetch(`/api/integrations/github/installations`);
      return await response.json();
    } catch (error) {
      console.error('Error checking GitHub installations:', error);
      toast.error('Failed to check GitHub installations');
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
        error: error?.message || null,
        isAuthenticated,
        signIn,
        signUp,
        signOut,
        connectGithub,
        reconnectGithub,
        installGithubApp,
        manageGithubRepoAccess,
        checkGithubInstallations,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};