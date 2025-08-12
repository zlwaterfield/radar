"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GithubAuthRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the new settings/github page
    router.replace('/settings/github');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-marian-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}