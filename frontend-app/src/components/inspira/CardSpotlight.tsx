import React, { useRef, useState, useCallback } from 'react'
import { cn } from '../../lib/utils'

interface CardSpotlightProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  slotClassName?: string
  gradientSize?: number
  gradientColor?: string
  gradientOpacity?: number
}

export const CardSpotlight: React.FC<CardSpotlightProps> = ({
  children,
  className,
  slotClassName,
  gradientSize = 260,
  gradientColor = 'rgba(20, 200, 178, 0.16)',
  gradientOpacity = 0.85,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: -1000, y: -1000 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }, [])

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
    setPosition({ x: -1000, y: -1000 })
  }, [])

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(8,14,23,0.85)] p-6 backdrop-blur-xl transition-all duration-300 hover:border-[rgba(20,200,178,0.3)] hover:shadow-[0_8px_30px_rgba(20,200,178,0.12)]',
        className
      )}
      {...props}
    >
      {/* Dynamic Cursor Spotlight Layer */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-300"
        style={{
          opacity: isHovered ? gradientOpacity : 0,
          background: `radial-gradient(${gradientSize}px circle at ${position.x}px ${position.y}px, ${gradientColor}, transparent 80%)`,
        }}
      />
      {/* Inner Content Slot */}
      <div className={cn('relative z-10 h-full w-full', slotClassName)}>
        {children}
      </div>
    </div>
  )
}

export default CardSpotlight
