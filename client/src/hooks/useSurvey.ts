"use client"

import { useEffect, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { DisplaySurveyType } from 'posthog-js'

export function useSurvey(surveyId: string) {
  const posthog = usePostHog()
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!posthog || !surveyId) return

    // Wait for surveys to be loaded
    posthog.onSurveysLoaded(() => {
      setIsReady(true)
    })
  }, [posthog, surveyId])

  const showSurvey = () => {
    if (!posthog || !surveyId || !isReady) {
      console.warn('Survey not ready or survey ID missing')
      return
    }

    // Display the survey as a popover
    posthog.displaySurvey(surveyId, { 
      displayType: DisplaySurveyType.Popover, 
      ignoreConditions: true, 
      ignoreDelay: true 
    })
  }

  return { showSurvey, isReady }
}
