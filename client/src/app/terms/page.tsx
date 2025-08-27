'use client';

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Terms of Service</h1>
          
          <div className="space-y-6 text-gray-600 dark:text-gray-300">
            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">1. Acceptance</h2>
              <p>By using Radar, you agree to these terms. If you don&apos;t agree, please don&apos;t use our service.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">2. What We Do</h2>
              <p>Radar monitors your GitHub repositories and sends notifications to Slack. We process your GitHub activity data to provide this service.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">3. Your Account</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Keep your account credentials secure</li>
                <li>You&apos;re responsible for activity under your account</li>
                <li>We may suspend accounts violating these terms</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">4. Privacy</h2>
              <p>We only access GitHub data you authorize. Your data helps us provide notifications - we don&apos;t sell it.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">5. Fair Use</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Don&apos;t abuse the service or use it for illegal purposes</li>
                <li>Don&apos;t attempt to access unauthorized data</li>
                <li>Respect rate limits and API usage guidelines</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">6. Service Availability</h2>
              <p>We&apos;ll do our best to keep Radar running smoothly, but we can&apos;t guarantee 100% uptime. The service is provided &quot;as is&quot;.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">7. Changes</h2>
              <p>We may update these terms. Continued use means you accept the changes.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">8. Contact</h2>
              <p>Questions? Reach out through GitHub or your account settings.</p>
            </section>

            <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}