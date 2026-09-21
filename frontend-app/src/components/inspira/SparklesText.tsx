import React, { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'

interface Sparkle {
  id: string
  createdAt: number
  color: string
  size: number
  style: {
    top: string
    left: string
  }
}

interface SparklesTextProps {
  text: string
  className?: string
  sparklesCount?: number
  colors?: {
    first?: string
    second?: string
  }
}

const DEFAULT_SPARKLE_COLORS = {
  first: '#14C8B2',
  second: '#00E5FF',
}

export const SparklesText: React.FC<SparklesTextProps> = ({
  text,
  className,
  sparklesCount = 8,
  colors = DEFAULT_SPARKLE_COLORS,
}) => {
  const [sparkles, setSparkles] = useState<Sparkle[]>([])

  useEffect(() => {
    const generateSparkle = (): Sparkle => {
      const color = Math.random() > 0.5 ? (colors.first || '#14C8B2') : (colors.second || '#00E5FF')
      return {
        id: Math.random().toString(36).substring(2, 9),
        createdAt: Date.now(),
        color,
        size: Math.floor(Math.random() * 10 + 8),
        style: {
          top: `${Math.floor(Math.random() * 90 + 5)}%`,
          left: `${Math.floor(Math.random() * 95 + 2.5)}%`,
        },
      }
    }

    const interval = setInterval(() => {
      setSparkles((prev) => {
        const now = Date.now()
        const filtered = prev.filter((s) => now - s.createdAt < 1200)
        if (filtered.length < sparklesCount) {
          return [...filtered, generateSparkle()]
        }
        return filtered
      })
    }, 180)

    return () => clearInterval(interval)
  }, [sparklesCount, colors])

  return (
    <span className={cn('relative inline-block font-extrabold', className)}>
      <span className="relative z-10">{text}</span>
      {sparkles.map((sparkle) => (
        <span
          key={sparkle.id}
          className="absolute pointer-events-none animate-pulse"
          style={{
            ...sparkle.style,
            width: `${sparkle.size}px`,
            height: `${sparkle.size}px`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill={sparkle.color}
            style={{ width: '100%', height: '100%', filter: `drop-shadow(0 0 8px ${sparkle.color})` }}
          >
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
          </svg>
        </span>
      ))}
    </span>
  )
}

export default SparklesText
