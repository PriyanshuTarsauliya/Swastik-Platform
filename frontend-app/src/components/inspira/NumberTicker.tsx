import React, { useEffect, useState, useRef } from 'react'
import { cn } from '../../lib/utils'

interface NumberTickerProps {
  value: number
  direction?: 'up' | 'down'
  delay?: number
  className?: string
  decimalPlaces?: number
  prefix?: string
  suffix?: string
}

export const NumberTicker: React.FC<NumberTickerProps> = ({
  value,
  direction = 'up',
  delay = 0,
  className,
  decimalPlaces = 0,
  prefix = '',
  suffix = '',
}) => {
  const [displayValue, setDisplayValue] = useState(direction === 'down' ? value : 0)
  const ref = useRef<HTMLSpanElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          setTimeout(() => {
            const duration = 1800
            const start = performance.now()
            const startVal = direction === 'down' ? value : 0
            const endVal = direction === 'down' ? 0 : value

            const step = (now: number) => {
              const elapsed = now - start
              const progress = Math.min(elapsed / duration, 1)
              // easeOutExpo
              const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
              const current = startVal + (endVal - startVal) * eased
              setDisplayValue(current)

              if (progress < 1) {
                requestAnimationFrame(step)
              }
            }

            requestAnimationFrame(step)
          }, delay * 1000)
        }
      },
      { threshold: 0.2 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [value, direction, delay])

  return (
    <span ref={ref} className={cn('inline-block tabular-nums font-bold tracking-tight', className)}>
      {prefix}
      {displayValue.toLocaleString('en-US', {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      })}
      {suffix}
    </span>
  )
}

export default NumberTicker
