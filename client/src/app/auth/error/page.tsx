"use client"

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiAlertTriangle } from 'react-icons/fi';

export default function AuthError() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const provider = searchParams.get('provider');
  const error = searchParams.get('error');

  useEffect(() => {
    // Redirect to home after a delay
    const timer = setTimeout(() => {
      router.push('/');
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="card max-w-md w-full text-center p-8">
        <div className="flex justify-center mb-4">
          <FiAlertTriangle className="text-red-500 text-6xl" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Authentication Failed</h1>
        <p className="mb-4">
          {provider === 'slack' 
            ? 'There was a problem logging in with Slack.' 
            : 'Failed to connect your GitHub account.'}
        </p>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
        <p className="text-gray-600">Redirecting to home page...</p>
      </div>
    </div>
  );
}
