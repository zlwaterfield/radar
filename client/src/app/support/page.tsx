'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Support() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to email with pre-filled subject
    const email = 'support@radar.town';
    const subject = encodeURIComponent('Radar Support Request');
    const mailtoLink = `mailto:${email}?subject=${subject}`;
    
    window.location.href = mailtoLink;
    
    // Redirect back to home after a short delay
    setTimeout(() => {
      router.push('/');
    }, 100);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
          Opening your email client...
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Redirecting to support@radar.town
        </p>
      </div>
    </div>
  );
}