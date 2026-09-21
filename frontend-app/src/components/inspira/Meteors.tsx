import React, { useMemo } from 'react'
import { cn } from '../../lib/utils'

interface MeteorsProps {
  count?: number
  className?: string
}

export const Meteors: React.FC<MeteorsProps> = ({ count = 20, className }) => {
  const meteors = useMemo(() => {
    return Array.from({ length: count }).map((_, idx) => ({
      id: idx,
      top: -20,
      left: Math.floor(Math.random() * 1200 - 300) + 'px',
      delay: (Math.random() * 5 + 0.2).toFixed(2) + 's',
      duration: (Math.random() * 6 + 4).toFixed(2) + 's',
    }))
  }, [count])

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {meteors.map((meteor) => (
        <span
          key={meteor.id}
          style={{
            top: `${meteor.top}px`,
            left: meteor.left,
            animationDelay: meteor.delay,
            animationDuration: meteor.duration,
          }}
          className={cn(
            'animate-meteor absolute h-0.5 w-0.5 rotate-[215deg] rounded-[9999px] bg-[#14c8b2] shadow-[0_0_8px_2px_#14c8b2]',
            "before:absolute before:top-1/2 before:h-[1px] before:w-[60px] before:-translate-y-1/2 before:bg-gradient-to-r before:from-[#14c8b2] before:to-transparent before:content-['']"
          )}
        />
      ))}
    </div>
  )
}

export default Meteors
