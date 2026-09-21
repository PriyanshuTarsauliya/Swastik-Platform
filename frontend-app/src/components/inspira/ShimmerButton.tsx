import React from 'react'
import { cn } from '../../lib/utils'

export interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string
  shimmerSize?: string
  borderRadius?: string
  shimmerDuration?: string
  background?: string
  className?: string
  children: React.ReactNode
  href?: string
  target?: string
  rel?: string
}

export const ShimmerButton: React.FC<ShimmerButtonProps> = ({
  shimmerColor = '#14c8b2',
  shimmerSize = '0.08em',
  borderRadius = '9999px',
  shimmerDuration = '3s',
  background = 'rgba(8, 14, 23, 0.95)',
  className,
  children,
  href,
  target,
  rel,
  ...props
}) => {
  const commonStyle = {
    '--shimmer-color': shimmerColor,
    '--radius': borderRadius,
    '--speed': shimmerDuration,
    '--cut': shimmerSize,
    '--bg': background,
  } as React.CSSProperties

  const commonClass = cn(
    'group relative z-0 inline-flex cursor-pointer items-center justify-center overflow-hidden border border-white/15 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.02] hover:border-[rgba(20,200,178,0.5)] active:scale-[0.98]',
    '[border-radius:var(--radius)] [background:var(--bg)]',
    'shadow-[0_0_20px_rgba(20,200,178,0.25)] hover:shadow-[0_0_35px_rgba(20,200,178,0.5)]',
    className
  )

  const content = (
    <>
      {/* Animated Conic Shimmer Highlight */}
      <div className="absolute inset-0 -z-30 overflow-hidden [border-radius:var(--radius)]">
        <div
          className="animate-shimmer-spin absolute -inset-[150%] opacity-70"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, transparent 320deg, ${shimmerColor} 340deg, #00e5ff 360deg)`,
            animationDuration: shimmerDuration,
          }}
        />
      </div>

      {/* Backdrop */}
      <div className="absolute inset-[var(--cut)] -z-20 rounded-[calc(var(--radius)-var(--cut))] bg-[var(--bg)]" />

      {/* Button Content */}
      <div className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </div>
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        style={commonStyle}
        className={commonClass}
        onClick={props.onClick as any}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      style={commonStyle}
      className={commonClass}
      {...props}
    >
      {content}
    </button>
  )
}

export default ShimmerButton
