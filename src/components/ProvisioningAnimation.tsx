'use client'

import { useEffect, useState, useCallback } from 'react'

interface ProvisioningStep {
  label: string
  duration: number
}

interface ProvisioningAnimationProps {
  active: boolean
  steps?: ProvisioningStep[]
  onComplete?: () => void
}

const defaultSteps: ProvisioningStep[] = [
  { label: 'Allocating sandbox...', duration: 800 },
  { label: 'Configuring network isolation...', duration: 1200 },
  { label: 'Deploying runtime...', duration: 1000 },
  { label: 'Starting supervisor...', duration: 900 },
  { label: 'Heartbeat active', duration: 600 },
]

export default function ProvisioningAnimation({
  active,
  steps,
  onComplete,
}: ProvisioningAnimationProps) {
  const provisioningSteps = steps || defaultSteps
  const [currentStep, setCurrentStep] = useState(-1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const reset = useCallback(() => {
    setCurrentStep(-1)
    setCompletedSteps(new Set())
  }, [])

  useEffect(() => {
    if (!active) {
      reset()
      return
    }

    // Start the first step after a brief delay
    const initialTimer = setTimeout(() => {
      setCurrentStep(0)
    }, 300)

    return () => clearTimeout(initialTimer)
  }, [active, reset])

  useEffect(() => {
    if (!active || currentStep < 0 || currentStep >= provisioningSteps.length) {
      return
    }

    const step = provisioningSteps[currentStep]

    const timer = setTimeout(() => {
      // Mark current step as completed
      setCompletedSteps((prev) => {
        const next = new Set(prev)
        next.add(currentStep)
        return next
      })

      // Move to next step or signal completion
      if (currentStep < provisioningSteps.length - 1) {
        setCurrentStep((prev) => prev + 1)
      } else {
        // All steps complete
        onComplete?.()
      }
    }, step.duration)

    return () => clearTimeout(timer)
  }, [active, currentStep, onComplete, provisioningSteps])

  if (!active && currentStep === -1) {
    return null
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <h3 className="text-sm font-semibold text-white">
          Provisioning VM
        </h3>
      </div>

      <div className="space-y-3">
        {provisioningSteps.map((step, idx) => {
          const isVisible = idx <= currentStep
          const isCompleted = completedSteps.has(idx)
          const isActive = idx === currentStep && !isCompleted

          if (!isVisible) return null

          return (
            <div
              key={idx}
              className="flex items-center gap-3 animate-[fadeIn_0.3s_ease-out]"
            >
              {/* Status icon */}
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                {isCompleted ? (
                  <svg
                    className="w-4 h-4 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                ) : isActive ? (
                  <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-slate-600" />
                )}
              </div>

              {/* Label */}
              <span
                className={`
                  text-sm font-mono transition-colors duration-300
                  ${isCompleted ? 'text-emerald-400' : ''}
                  ${isActive ? 'text-blue-300' : ''}
                  ${!isCompleted && !isActive ? 'text-slate-500' : ''}
                `}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${
              provisioningSteps.length > 0
                ? (completedSteps.size / provisioningSteps.length) * 100
                : 0
            }%`,
          }}
        />
      </div>
    </div>
  )
}
