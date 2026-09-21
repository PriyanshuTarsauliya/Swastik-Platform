import React from 'react'
import { cn } from '../../lib/utils'

interface MarqueeProps {
  children: React.ReactNode
  className?: string
  reverse?: boolean
  pauseOnHover?: boolean
  vertical?: boolean
  repeat?: number
  duration?: string
  gap?: string
}

export const Marquee: React.FC<MarqueeProps> = ({
  children,
  className,
  reverse = false,
  pauseOnHover = true,
  vertical = false,
  repeat = 4,
  duration = '35s',
  gap = '1.5rem',
}) => {
  return (
    <div
      style={
        {
          '--duration': duration,
          '--gap': gap,
        } as React.CSSProperties
      }
      className={cn(
        'group flex overflow-hidden p-2 [--duration:35s] [--gap:1.5rem]',
        vertical ? 'flex-col' : 'flex-row',
        className
      )}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex shrink-0 items-center justify-around gap-[var(--gap)]',
            vertical
              ? reverse
                ? 'animate-marquee-vertical [animation-direction:reverse]'
                : 'animate-marquee-vertical'
              : reverse
                ? 'animate-marquee-reverse'
                : 'animate-marquee',
            pauseOnHover && 'group-hover:[animation-play-state:paused]'
          )}
        >
          {children}
        </div>
      ))}
    </div>
  )
}

export default Marquee
