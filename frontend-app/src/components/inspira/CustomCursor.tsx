import React, { useEffect, useRef } from 'react'

/**
 * CustomCursor — Hyper-Futuristic Smooth Fluid Cursor
 * Inspired by modern Awwwards / Dribbble design (Prefactor style).
 * Features:
 *  - 120fps hardware-accelerated transform lerp
 *  - Interactive states: Default, Hover (links/buttons/interactive), Active (click/press)
 *  - Seamless hide on touch devices and window leave
 */
export const CustomCursor: React.FC = () => {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Only enable on devices that have a fine pointer (mouse/trackpad)
    if (!window.matchMedia('(pointer: fine)').matches) {
      return
    }

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    let mouseX = -100
    let mouseY = -100
    let ringX = -100
    let ringY = -100
    let isHovered = false
    let isClicking = false
    let isVisible = false
    let animationFrameId: number

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY

      if (!isVisible) {
        isVisible = true
        dot.style.opacity = '1'
        ring.style.opacity = '1'
      }

      // Check if target is interactive
      const target = e.target as HTMLElement | null
      if (target) {
        const isInteractive = Boolean(
          target.closest('a, button, [role="button"], input, select, textarea, .cursor-pointer, [data-cursor-hover]')
        )
        if (isInteractive !== isHovered) {
          isHovered = isInteractive
          updateCursorClasses()
        }
      }
    }

    const onMouseDown = () => {
      isClicking = true
      updateCursorClasses()
    }

    const onMouseUp = () => {
      isClicking = false
      updateCursorClasses()
    }

    const onMouseLeave = () => {
      isVisible = false
      dot.style.opacity = '0'
      ring.style.opacity = '0'
    }

    const onMouseEnter = () => {
      isVisible = true
      dot.style.opacity = '1'
      ring.style.opacity = '1'
    }

    const updateCursorClasses = () => {
      if (!ring || !dot) return

      if (isClicking) {
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(0.75)`
        ring.style.borderColor = 'rgba(20, 200, 178, 0.9)'
        ring.style.backgroundColor = 'rgba(20, 200, 178, 0.35)'
      } else if (isHovered) {
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(2.2)`
        ring.style.borderColor = 'rgba(20, 200, 178, 0.65)'
        ring.style.backgroundColor = 'rgba(20, 200, 178, 0.12)'
        ring.style.boxShadow = '0 0 25px rgba(20, 200, 178, 0.35)'
      } else {
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(1)`
        ring.style.borderColor = 'rgba(255, 255, 255, 0.35)'
        ring.style.backgroundColor = 'rgba(220, 235, 255, 0.45)'
        ring.style.boxShadow = '0 0 15px rgba(20, 200, 178, 0.2)'
      }
    }

    // High performance render loop with fluid interpolation (lerp)
    const render = () => {
      const lerpFactor = 0.18
      ringX += (mouseX - ringX) * lerpFactor
      ringY += (mouseY - ringY) * lerpFactor

      // Position inner dot directly at mouse
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`

      // Position outer ring with lerp
      if (isClicking) {
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(0.75)`
      } else if (isHovered) {
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(2.2)`
      } else {
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(1)`
      }

      animationFrameId = requestAnimationFrame(render)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mouseleave', onMouseLeave)
    document.addEventListener('mouseenter', onMouseEnter)

    animationFrameId = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mouseleave', onMouseLeave)
      document.removeEventListener('mouseenter', onMouseEnter)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <>
      {/* Outer Fluid Ring / Circle (matches Dribbble Prefactor video) */}
      <div
        ref={ringRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] h-6 w-6 rounded-full opacity-0 backdrop-blur-xs transition-[width,height,background-color,border-color,box-shadow] duration-200 ease-out will-change-transform"
        style={{
          backgroundColor: 'rgba(220, 235, 255, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.35)',
          boxShadow: '0 0 15px rgba(20, 200, 178, 0.2)',
        }}
      />
      {/* Center Precise Dot */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed top-0 left-0 z-[10000] h-1.5 w-1.5 rounded-full bg-[#14c8b2] opacity-0 shadow-[0_0_8px_#14c8b2] transition-opacity duration-150 will-change-transform"
      />
    </>
  )
}

export default CustomCursor
