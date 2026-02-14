'use client'

export interface TimelineStep {
  label: string
  status: 'complete' | 'active' | 'pending'
  timestamp: string
  agent?: string
  details?: string
}

interface TimelineProps {
  steps: TimelineStep[]
}

const statusDotStyles: Record<TimelineStep['status'], string> = {
  complete: 'bg-emerald-500 border-emerald-500/30',
  active: 'bg-blue-500 border-blue-500/30',
  pending: 'bg-slate-600 border-slate-600/30',
}

const statusLineStyles: Record<TimelineStep['status'], string> = {
  complete: 'bg-emerald-500/40',
  active: 'bg-blue-500/40',
  pending: 'bg-slate-700',
}

export default function Timeline({ steps }: TimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="text-slate-500 text-sm py-4">
        No timeline steps available.
      </div>
    )
  }

  return (
    <div className="relative">
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1

        return (
          <div key={idx} className="relative flex gap-4">
            {/* Vertical line + dot column */}
            <div className="flex flex-col items-center">
              {/* Dot */}
              <div className="relative flex-shrink-0">
                {/* Pulsing ring for active step */}
                {step.status === 'active' && (
                  <span className="absolute inset-0 w-3.5 h-3.5 -m-[1px] rounded-full bg-blue-500/30 animate-ping" />
                )}
                <div
                  className={`
                    w-3 h-3 rounded-full border-2 z-10 relative
                    transition-all duration-300
                    ${statusDotStyles[step.status]}
                  `}
                />
              </div>
              {/* Connecting line */}
              {!isLast && (
                <div
                  className={`
                    w-0.5 flex-1 min-h-[2rem]
                    transition-colors duration-300
                    ${statusLineStyles[step.status]}
                  `}
                />
              )}
            </div>

            {/* Content */}
            <div className={`pb-6 -mt-0.5 flex-1 min-w-0 ${isLast ? 'pb-0' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`
                    text-sm font-medium
                    ${step.status === 'complete' ? 'text-slate-300' : ''}
                    ${step.status === 'active' ? 'text-blue-300' : ''}
                    ${step.status === 'pending' ? 'text-slate-500' : ''}
                  `}
                >
                  {step.label}
                </span>
                {step.agent && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    {step.agent}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{step.timestamp}</p>
              {step.details && (
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {step.details}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
