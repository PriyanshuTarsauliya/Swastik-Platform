import React from 'react'
import { cn } from '../../lib/utils'
import { ArrowRight } from 'lucide-react'

interface BentoGridProps {
  children: React.ReactNode
  className?: string
}

export const BentoGrid: React.FC<BentoGridProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'grid w-full grid-cols-1 md:grid-cols-3 gap-5 auto-rows-[22rem]',
        className
      )}
    >
      {children}
    </div>
  )
}

interface BentoCardProps {
  name: string
  className?: string
  background?: React.ReactNode
  Icon?: React.ComponentType<{ className?: string }>
  description: string
  href?: string
  cta?: string
  badge?: string
}

export const BentoCard: React.FC<BentoCardProps> = ({
  name,
  className,
  background,
  Icon,
  description,
  href = '#demo',
  cta = 'Explore feature',
  badge,
}) => {
  return (
    <div
      className={cn(
        'group relative col-span-1 flex flex-col overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(8,14,23,0.85)] p-6 backdrop-blur-xl transition-all duration-300 hover:border-[rgba(20,200,178,0.35)] hover:shadow-[0_10px_35px_rgba(20,200,178,0.1)]',
        className
      )}
    >
      {/* Background decoration slot */}
      {background && (
        <div className="absolute inset-0 -z-10 overflow-hidden opacity-30 transition-opacity duration-300 group-hover:opacity-60">
          {background}
        </div>
      )}

      {/* Top row: Icon + optional badge */}
      <div className="flex items-center justify-between mb-5">
        {Icon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(20,200,178,0.3)] bg-[rgba(20,200,178,0.1)] text-[#14c8b2] transition-transform duration-300 group-hover:scale-110">
            <Icon className="h-6 w-6" />
          </div>
        ) : (
          <div />
        )}
        {badge && (
          <span className="rounded-full border border-[rgba(245,166,35,0.3)] bg-[rgba(245,166,35,0.1)] px-2.5 py-0.5 text-xs font-semibold text-[#f5a623]">
            {badge}
          </span>
        )}
      </div>

      {/* Text & Content - Top-aligned under icon for consistent row alignment */}
      <div className="z-10 transition-all duration-300 group-hover:-translate-y-1">
        <h3 className="text-xl font-bold text-white group-hover:text-[#14c8b2] transition-colors">
          {name}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">
          {description}
        </p>
      </div>

      {/* CTA link - Pinned to bottom of card */}
      <a
        href={href}
        className="mt-auto pt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#14c8b2] transition-all duration-300 hover:text-[#00e5ff] group-hover:translate-x-1"
      >
        <span>{cta}</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </a>
    </div>
  )
}
