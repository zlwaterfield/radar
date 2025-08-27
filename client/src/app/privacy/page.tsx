'use client';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Privacy Policy</h1>
          
          <div className="space-y-6 text-gray-600 dark:text-gray-300">
            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">What We Collect</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>GitHub username and email</li>
                <li>Repository names you choose to monitor</li>
                <li>GitHub activity from monitored repositories</li>
                <li>Slack workspace information for notifications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">How We Use It</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Send you GitHub notifications in Slack</li>
                <li>Filter activities based on your preferences</li>
                <li>Generate activity summaries and digests</li>
                <li>Improve our service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">What We Don&apos;t Do</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Sell your data to third parties</li>
                <li>Share your repository data with other users</li>
                <li>Access private repositories without permission</li>
                <li>Store unnecessary personal information</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Data Storage</h2>
              <p>Your data is stored securely using industry-standard encryption. We retain activity data for 90 days to power your digests and summaries.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Third-Party Services</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>GitHub:</strong> We access only what you authorize</li>
                <li><strong>Slack:</strong> We send notifications to channels you specify</li>
                <li><strong>OpenAI:</strong> May be used to summarize activity (data is not stored by OpenAI)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Your Rights</h2>
              <ul className="list-disc pl-5 space-y-2">
                <li>Access your data anytime through settings</li>
                <li>Delete your account and associated data</li>
                <li>Revoke GitHub/Slack access at any time</li>
                <li>Export your notification history</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Security</h2>
              <p>We use HTTPS everywhere, encrypt sensitive data, and follow security best practices. If you find a vulnerability, please report it responsibly.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Updates</h2>
              <p>We&apos;ll notify you of significant privacy policy changes through the app or email.</p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Contact</h2>
              <p>Privacy questions? Reach out through GitHub or your account settings.</p>
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