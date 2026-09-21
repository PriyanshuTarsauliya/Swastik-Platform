import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type TextRevealProps = {
  /** The text to reveal */
  text: string
  /** Additional className for the container */
  className?: string
  /** Additional className for each word */
  wordClassName?: string
  /** Animation duration per word (ms) */
  duration?: number
  /** Stagger delay between words (ms) */
  stagger?: number
  /** Initial blur amount (px) */
  blur?: number
  /** Slide up distance (px) */
  yOffset?: number
  /** Trigger on scroll into view */
  triggerOnScroll?: boolean
  /** Intersection threshold */
  threshold?: number
  /** Render children after the text */
  children?: ReactNode
}

export default function TextReveal({
  text,
  className,
  wordClassName,
  duration = 500,
  stagger = 60,
  blur = 12,
  yOffset = 16,
  triggerOnScroll = true,
  threshold = 0.2,
  children,
}: TextRevealProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const [isVisible, setIsVisible] = useState(!triggerOnScroll)

  useEffect(() => {
    if (!triggerOnScroll) return
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold, rootMargin: '0px 0px -20px 0px' }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [triggerOnScroll, threshold])

  const words = text.split(' ')

  return (
    <span ref={containerRef} className={cn('inline', className)}>
      {words.map((word, i) => (
        <span
          key={i}
          className={cn('inline-block', wordClassName)}
          style={{
            opacity: isVisible ? 1 : 0,
            filter: isVisible ? 'blur(0px)' : `blur(${blur}px)`,
            transform: isVisible ? 'translateY(0)' : `translateY(${yOffset}px)`,
            transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${i * stagger}ms, filter ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${i * stagger}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${i * stagger}ms`,
            willChange: 'opacity, filter, transform',
          }}
        >
          {word}
          {i < words.length - 1 ? '\u00A0' : ''}
        </span>
      ))}
      {children}
    </span>
  )
}
