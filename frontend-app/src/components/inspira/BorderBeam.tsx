import React from 'react'
import { cn } from '../../lib/utils'

interface BorderBeamProps {
  className?: string
  size?: number
  duration?: number
  borderWidth?: number
  colorFrom?: string
  colorTo?: string
  delay?: number
}

export const BorderBeam: React.FC<BorderBeamProps> = ({
  className,
  size = 180,
  duration = 8,
  borderWidth = 1.5,
  colorFrom = '#14c8b2',
  colorTo = '#00e5ff',
  delay = 0,
}) => {
  return (
    <div
      style={
        {
          '--size': `${size}px`,
          '--duration': `${duration}s`,
          '--border-width': `${borderWidth}px`,
          '--color-from': colorFrom,
          '--color-to': colorTo,
          '--delay': `-${delay}s`,
          padding: `${borderWidth}px`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
        } as React.CSSProperties
      }
      className={cn(
        'pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden',
        className
      )}
    >
      <div
        className="absolute inset-[-150%] animate-shimmer-spin"
        style={{
          background: `conic-gradient(from 0deg at 50% 50%, transparent 0deg, transparent 300deg, ${colorFrom} 330deg, ${colorTo} 360deg)`,
          animationDuration: `${duration}s`,
          animationDelay: `-${delay}s`,
        }}
      />
    </div>
  )
}

export default BorderBeam
