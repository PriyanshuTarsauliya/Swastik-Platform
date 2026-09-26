import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { animate, stagger, spring, utils } from "animejs";
import {
  clearInline,
  fromPose,
  prefersReducedMotion,
  type RevealDirection,
} from "./animeScroll";
 
interface Props {
  children: ReactNode;
  as?: ElementType;
  direction?: RevealDirection;
  /** Travel distance in px. */
  distance?: number;
  /** Start delay in ms. */
  delay?: number;
  /** Duration in ms. */
  duration?: number;
  /** Initial scale for zoom direction or custom scale modifier. */
  scale?: number;
  /** Easing function string. */
  ease?: string;
  /** If set, these descendants are revealed one after another instead of the wrapper. */
  childSelector?: string;
  /** Gap between children in ms (only used with childSelector). */
  staggerMs?: number;
  /** 0 = stiff, 1 = very bouncy. */
  bounce?: number;
  /** How much of the element must be visible (0-1). */
  threshold?: number;
  className?: string;
  style?: CSSProperties;
}
 
/**
 * Spring reveal that fires once when the element scrolls into view.
 * Uses IntersectionObserver as the trigger (robust with Lenis and any
 * scroll container) and Anime.js v4 springs for the motion.
 */
export default function AnimeScrollReveal({
  children,
  as: Tag = "div",
  direction = "up",
  distance = 48,
  delay = 0,
  childSelector,
  staggerMs = 70,
  bounce = 0.25,
  threshold = 0.12,
  className,
  style,
}: Props) {
  const ref = useRef<HTMLElement>(null);
 
  // Layout effect: hide before first paint so nothing flashes, then reveal.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion()) return;
 
    const targets = childSelector
      ? Array.from(root.querySelectorAll<HTMLElement>(childSelector))
      : [root];
    if (!targets.length) return;
 
    const pose = fromPose(direction, distance);
    utils.set(targets, { opacity: 0, x: pose.x, y: pose.y, scale: pose.scale });
 
    let anim: ReturnType<typeof animate> | null = null;
 
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect(); // reveal once
        anim = animate(targets, {
          x: 0,
          y: 0,
          scale: 1,
          opacity: { to: 1, duration: 600, ease: "outQuad" },
          delay: stagger(staggerMs, { start: delay }),
          ease: spring({ bounce, duration: 700 }),
          onComplete: () => clearInline(targets),
        });
      },
      { threshold, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(root);
 
    return () => {
      io.disconnect();
      anim?.revert();
      clearInline(targets);
    };
  }, [direction, distance, delay, childSelector, staggerMs, bounce, threshold]);
 
  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
}
