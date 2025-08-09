"use client"

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';
import { FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import axios from 'axios';

export default function AuthSuccess() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  
  const provider = searchParams.get('provider');
  const token = searchParams.get('token');

  useEffect(() => {
    if (token) {
      handleTokenAuth(token);
    } else {
      setError('No authentication token received');
    }
  }, [token]);

  const handleTokenAuth = async (authToken: string) => {
    try {
      // Validate token and get user info
      const response = await axios.post('/api/auth/validate', { token: authToken });
      
      if (response.data.user) {
        // Store token and user info
        Cookies.set('auth_token', authToken, { expires: 7 });
        Cookies.set('user_id', response.data.user.id, { expires: 7 });
        
        // Set axios auth header for immediate use
        axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
        
        // Redirect to dashboard immediately
        router.push('/settings/notifications');
      } else {
        setError('Invalid authentication response');
      }
    } catch (err) {
      console.error('Token validation failed:', err);
      setError('Authentication failed. Please try logging in again.');
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="card max-w-md w-full text-center p-8">
          <div className="flex justify-center mb-4">
            <FiAlertCircle className="text-red-500 text-6xl" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
          <p className="mb-4 text-red-600">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="btn btn-primary"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="card max-w-md w-full text-center p-8">
        <div className="flex justify-center mb-4">
          <FiCheckCircle className="text-green-500 text-6xl" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Authentication Successful</h1>
        <p className="mb-4">
          {provider === 'slack' 
            ? 'You have successfully logged in with Slack.' 
            : 'Your GitHub account has been successfully connected.'}
        </p>
        <p className="text-gray-600">Redirecting to dashboard...</p>
      </div>
    </div>
  );
}
