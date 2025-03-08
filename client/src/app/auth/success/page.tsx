"use client"

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Cookies from 'js-cookie';
import { FiCheckCircle } from 'react-icons/fi';

export default function AuthSuccess() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const provider = searchParams.get('provider');
  const user_id = searchParams.get('user_id');

  useEffect(() => {
    if (user_id) {
      // Store user ID in cookie
      Cookies.set('user_id', user_id as string, { expires: 7 });
      
      // Redirect to dashboard after a short delay
      const timer = setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [user_id, router]);

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
