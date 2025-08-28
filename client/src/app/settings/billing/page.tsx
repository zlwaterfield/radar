'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import axios from '@/lib/axios'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import { formatDate } from '@/lib/utils'

interface PlanFeatures {
  repositories_limit: number | null
  notifications_limit: number | null
  ai_features: boolean
  digest_notifications: boolean
  priority_support: boolean
  team_features: boolean
}

interface Plan {
  id: string
  name: string
  monthly_price: number
  features: PlanFeatures
  stripe_price_id?: string
}

interface Subscription {
  id: string
  status: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  plan: Plan
}

interface Usage {
  repositories_tracked: number
  notifications_sent: number
  digest_notifications: number
  keyword_notifications: number
  ai_requests: number
}

interface UsageStats {
  current_period: Usage
  plan_limits: PlanFeatures
  usage_percentage: Record<string, number | null>
}

interface BillingConfig {
  billing_enabled: boolean
  is_self_hosted: boolean
  stripe_publishable_key: string | null
  default_plan: string
}

export default function BillingPage() {
  const { user, token } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [config, setConfig] = useState<BillingConfig | null>(null)
  const [upgrading, setUpgrading] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !token) {
      router.push('/auth/login')
      return
    }
    
    loadBillingData()
  }, [user, token, router])

  const loadBillingData = async () => {
    try {
      setLoading(true)
      
      // Load billing configuration
      const configResponse = await axios.get('/api/billing/config')
      setConfig(configResponse.data)
      
      // Load subscription
      const subResponse = await axios.get('/api/billing/subscription', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setSubscription(subResponse.data)
      
      // Load usage stats
      const usageResponse = await axios.get('/api/billing/usage', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsageStats(usageResponse.data)
      
      // Load available plans
      const plansResponse = await axios.get('/api/billing/plans')
      setPlans(plansResponse.data)
      
    } catch (error) {
      console.error('Error loading billing data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (planName: string) => {
    if (!config?.billing_enabled) {
      alert('Billing is not enabled for this installation')
      return
    }
    
    try {
      setUpgrading(planName)
      
      const response = await axios.post('/api/billing/checkout', {
        plan_name: planName,
        success_url: `${window.location.origin}/settings/billing?success=true`,
        cancel_url: `${window.location.origin}/settings/billing?canceled=true`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      // Redirect to Stripe checkout
      window.location.href = response.data.checkout_url
      
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to create checkout session. Please try again.')
      setUpgrading(null)
    }
  }

  const handleManageBilling = async () => {
    if (!config?.billing_enabled || !subscription?.plan?.stripe_price_id) {
      return
    }
    
    try {
      const response = await axios.post('/api/billing/portal', {
        return_url: `${window.location.origin}/settings/billing`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      })
      
      // Redirect to Stripe customer portal
      window.location.href = response.data.portal_url
      
    } catch (error) {
      console.error('Error creating portal session:', error)
      alert('Failed to open billing portal. Please try again.')
    }
  }

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`
  }

  const formatLimit = (limit: number | null) => {
    return limit === null ? 'Unlimited' : limit.toLocaleString()
  }

  const getUsagePercentage = (current: number, limit: number | null) => {
    if (limit === null) return 0
    return Math.min((current / limit) * 100, 100)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    )
  }

  if (!config) {
    return <div>Error loading billing configuration</div>
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Billing & Usage</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your subscription and monitor usage limits
        </p>
      </div>

      {config.is_self_hosted && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">Self-Hosted Installation</h3>
          <p className="text-blue-800 dark:text-blue-200 mt-1">
            You're running a self-hosted version with full {config.default_plan} features at no cost.
          </p>
        </div>
      )}

      {/* Current Subscription */}
      {subscription && (
        <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white capitalize">
                {subscription.plan.name} Plan
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {subscription.plan.monthly_price === 0 
                  ? 'Free' 
                  : `${formatPrice(subscription.plan.monthly_price)}/month`}
              </p>
            </div>
            {config.billing_enabled && subscription.plan.stripe_price_id && (
              <Button onClick={handleManageBilling} variant="secondary">
                Manage Billing
              </Button>
            )}
          </div>
          
          {subscription.current_period_end && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {subscription.cancel_at_period_end ? (
                <span className="text-orange-600 dark:text-orange-400">
                  Cancels on {formatDate(subscription.current_period_end)}
                </span>
              ) : (
                <span>
                  Renews on {formatDate(subscription.current_period_end)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Usage Stats */}
      {usageStats && (
        <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Current Usage</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Repositories */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-900 dark:text-white">Repositories</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {usageStats.current_period.repositories_tracked} / {formatLimit(usageStats.plan_limits.repositories_limit)}
                </span>
              </div>
              {usageStats.plan_limits.repositories_limit !== null && (
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${getUsagePercentage(
                        usageStats.current_period.repositories_tracked, 
                        usageStats.plan_limits.repositories_limit
                      )}%` 
                    }}
                  />
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-gray-900 dark:text-white">Notifications</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {usageStats.current_period.notifications_sent} / {formatLimit(usageStats.plan_limits.notifications_limit)}
                </span>
              </div>
              {usageStats.plan_limits.notifications_limit !== null && (
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${getUsagePercentage(
                        usageStats.current_period.notifications_sent, 
                        usageStats.plan_limits.notifications_limit
                      )}%` 
                    }}
                  />
                </div>
              )}
            </div>

            {/* AI Requests */}
            {usageStats.plan_limits.ai_features && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">AI Requests</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {usageStats.current_period.ai_requests}
                  </span>
                </div>
              </div>
            )}

            {/* Digest Notifications */}
            {usageStats.plan_limits.digest_notifications && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-gray-900 dark:text-white">Digest Notifications</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {usageStats.current_period.digest_notifications}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Available Plans */}
      {config.billing_enabled && plans.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Available Plans</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div 
                key={plan.id}
                className={`p-6 rounded-lg border ${
                  subscription?.plan.id === plan.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                    {plan.name}
                  </h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      {plan.monthly_price === 0 ? 'Free' : formatPrice(plan.monthly_price)}
                    </span>
                    {plan.monthly_price > 0 && (
                      <span className="text-gray-600 dark:text-gray-400">/month</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-center text-gray-700 dark:text-gray-300">
                    <span className="mr-2">📁</span>
                    {formatLimit(plan.features.repositories_limit)} repositories
                  </li>
                  <li className="flex items-center text-gray-700 dark:text-gray-300">
                    <span className="mr-2">📬</span>
                    {formatLimit(plan.features.notifications_limit)} notifications/month
                  </li>
                  {plan.features.ai_features && (
                    <li className="flex items-center text-gray-700 dark:text-gray-300">
                      <span className="mr-2">🤖</span>
                      AI-powered features
                    </li>
                  )}
                  {plan.features.digest_notifications && (
                    <li className="flex items-center text-gray-700 dark:text-gray-300">
                      <span className="mr-2">📊</span>
                      Daily digest notifications
                    </li>
                  )}
                  {plan.features.priority_support && (
                    <li className="flex items-center text-gray-700 dark:text-gray-300">
                      <span className="mr-2">⚡</span>
                      Priority support
                    </li>
                  )}
                  {plan.features.team_features && (
                    <li className="flex items-center text-gray-700 dark:text-gray-300">
                      <span className="mr-2">👥</span>
                      Team collaboration
                    </li>
                  )}
                </ul>

                {subscription?.plan.id === plan.id ? (
                  <Button disabled className="w-full">
                    Current Plan
                  </Button>
                ) : plan.stripe_price_id ? (
                  <Button 
                    onClick={() => handleUpgrade(plan.name)}
                    disabled={upgrading === plan.name}
                    className="w-full"
                  >
                    {upgrading === plan.name ? 'Processing...' : `Upgrade to ${plan.name}`}
                  </Button>
                ) : (
                  <Button disabled className="w-full">
                    Not Available
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}