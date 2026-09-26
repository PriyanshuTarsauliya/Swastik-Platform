import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { animate, onScroll } from "animejs";
import { prefersReducedMotion } from "./animeScroll";
 
interface Props {
  children: ReactNode;
  /**
   * Total vertical travel in px while the block crosses the viewport.
   * Positive = drifts slower than the page (background feel).
   * Negative = drifts faster (foreground feel).
   */
  distance?: number;
  /** Optional scale at the end of the pass, e.g. 1.15. */
  scaleTo?: number;
  /** Optional rotation in degrees, swings from -rotate to +rotate. */
  rotate?: number;
  /** true = locked to scroll (best with Lenis). A number 0-1 adds extra smoothing. */
  smooth?: boolean | number;
  className?: string;
  style?: CSSProperties;
}
 
/**
 * Scroll-linked depth. The outer div is the trigger (it never moves),
 * the inner div is what gets animated, so there is no feedback loop.
 */
export default function AnimeParallax({
  children,
  distance = 80,
  scaleTo,
  rotate,
  smooth = true,
  className,
  style,
}: Props) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
 
  useEffect(() => {
    const trigger = outer.current;
    const moving = inner.current;
    if (!trigger || !moving || prefersReducedMotion()) return;
 
    const observer = onScroll({ target: trigger, sync: smooth });
    const anim = animate(moving, {
      y: [-distance, distance],
      ...(scaleTo ? { scale: [1, scaleTo] } : {}),
      ...(rotate ? { rotate: [-rotate, rotate] } : {}),
      ease: "linear",
      autoplay: observer,
    });
 
    return () => {
      observer.revert();
      anim.revert();
    };
  }, [distance, scaleTo, rotate, smooth]);
 
  return (
    <div ref={outer} className={className} style={style}>
      <div ref={inner} style={{ willChange: "transform" }}>
        {children}
      </div>
    </div>
  );
}
