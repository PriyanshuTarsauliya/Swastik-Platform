import { useEffect, useRef, useState, type ReactNode, type ElementType } from 'react'
import { cn } from '../../lib/utils'

export type ScrollRevealProps = {
  children: ReactNode
  /** Delay before animation starts (ms) */
  delay?: number
  /** Slide direction */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  /** How far the element slides (px) */
  distance?: number
  /** Animation duration (ms) */
  duration?: number
  /** Only animate once */
  once?: boolean
  /** Intersection threshold (0-1) */
  threshold?: number
  /** Stagger delay for children (ms) — applied to direct children via CSS custom property */
  stagger?: number
  /** Additional className */
  className?: string
  /** Render as different element */
  as?: ElementType
}

export default function ScrollReveal({
  children,
  delay = 0,
  direction = 'up',
  distance = 40,
  duration = 700,
  once = true,
  threshold = 0.15,
  stagger = 0,
  className,
  as: Tag = 'div',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) observer.unobserve(el)
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [once, threshold])

  const translateMap = {
    up: `translateY(${distance}px)`,
    down: `translateY(-${distance}px)`,
    left: `translateX(${distance}px)`,
    right: `translateX(-${distance}px)`,
    none: 'none',
  }

  const Component = Tag as any

  return (
    <Component
      ref={ref}
      className={cn(className)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'none' : translateMap[direction],
        transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
        willChange: 'opacity, transform',
        ...(stagger > 0 ? { '--scroll-reveal-stagger': `${stagger}ms` } as React.CSSProperties : {}),
      }}
    >
      {children}
    </Component>
  )
}

/** 
 * Wrapper for staggered children — each direct child gets increasing delay.
 * Usage: <ScrollRevealGroup stagger={100}><div>A</div><div>B</div></ScrollRevealGroup>
 */
export function ScrollRevealGroup({
  children,
  stagger = 100,
  direction = 'up',
  distance = 30,
  duration = 600,
  threshold = 0.1,
  className,
}: {
  children: ReactNode
  stagger?: number
  direction?: ScrollRevealProps['direction']
  distance?: number
  duration?: number
  threshold?: number
  className?: string
}) {
  const childArray = Array.isArray(children) ? children : [children]

  return (
    <div className={className}>
      {childArray.map((child, i) => (
        <ScrollReveal
          key={i}
          delay={i * stagger}
          direction={direction}
          distance={distance}
          duration={duration}
          threshold={threshold}
        >
          {child}
        </ScrollReveal>
      ))}
    </div>
  )
}
