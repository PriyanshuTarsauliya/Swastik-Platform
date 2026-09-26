import { useEffect, useRef, type CSSProperties } from "react";
import { animate } from "animejs";
import { prefersReducedMotion } from "./animeScroll";
 
interface Props {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  locale?: string;
  className?: string;
  style?: CSSProperties;
}
 
/** Number that counts up once when it scrolls into view. */
export default function AnimeCounter({
  to,
  from = 0,
  duration = 1800,
  decimals = 0,
  prefix = "",
  suffix = "",
  locale = "en-IN",
  className,
  style,
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
 
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
 
    const fmt = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const write = (v: number) => {
      el.textContent = `${prefix}${fmt.format(v)}${suffix}`;
    };
 
    if (prefersReducedMotion()) {
      write(to);
      return;
    }
 
    const state = { v: from };
    write(from);
    let anim: ReturnType<typeof animate> | null = null;
 
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        anim = animate(state, {
          v: to,
          duration,
          ease: "outExpo",
          onUpdate: () => write(state.v),
        });
      },
      { threshold: 0.6 },
    );
    io.observe(el);
 
    return () => {
      io.disconnect();
      anim?.revert();
    };
  }, [to, from, duration, decimals, prefix, suffix, locale]);
 
  return (
    <span
      ref={ref}
      className={className}
      style={{ fontVariantNumeric: "tabular-nums", ...style }}
      aria-label={`${prefix}${to}${suffix}`}
    >
      {`${prefix}${to}${suffix}`}
    </span>
  );
}
