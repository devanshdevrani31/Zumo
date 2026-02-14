'use client'

type HeartbeatStatus = 'running' | 'paused' | 'stopped'
type HeartbeatSize = 'sm' | 'md' | 'lg'

interface HeartbeatIndicatorProps {
  status: HeartbeatStatus
  size?: HeartbeatSize
}

const sizeConfig: Record<HeartbeatSize, { dot: string; ring: string; label: string; gap: string }> = {
  sm: { dot: 'w-2 h-2', ring: 'w-2 h-2', label: 'text-xs', gap: 'gap-1.5' },
  md: { dot: 'w-3 h-3', ring: 'w-3 h-3', label: 'text-sm', gap: 'gap-2' },
  lg: { dot: 'w-4 h-4', ring: 'w-4 h-4', label: 'text-base', gap: 'gap-2.5' },
}

const statusConfig: Record<HeartbeatStatus, { color: string; ringColor: string; label: string }> = {
  running: {
    color: 'bg-emerald-500',
    ringColor: 'bg-emerald-500',
    label: 'Running',
  },
  paused: {
    color: 'bg-yellow-500',
    ringColor: 'bg-yellow-500',
    label: 'Paused',
  },
  stopped: {
    color: 'bg-red-500',
    ringColor: 'bg-red-500',
    label: 'Stopped',
  },
}

export default function HeartbeatIndicator({
  status,
  size = 'md',
}: HeartbeatIndicatorProps) {
  const sizeInfo = sizeConfig[size]
  const statusInfo = statusConfig[status]

  return (
    <div className={`inline-flex items-center ${sizeInfo.gap}`}>
      <span className="relative flex items-center justify-center">
        {/* Expanding ring animation for running state */}
        {status === 'running' && (
          <span
            className={`
              absolute ${sizeInfo.ring} rounded-full ${statusInfo.ringColor}
              animate-ping opacity-40
            `}
          />
        )}
        {/* Core dot */}
        <span
          className={`
            relative ${sizeInfo.dot} rounded-full ${statusInfo.color}
            ${status === 'running' ? 'animate-heartbeat' : ''}
          `}
        />
      </span>
      <span className={`${sizeInfo.label} text-slate-400 font-medium`}>
        {statusInfo.label}
      </span>
    </div>
  )
}
