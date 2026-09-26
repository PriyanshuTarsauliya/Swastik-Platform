import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { animate, onScroll } from "animejs";
import { prefersReducedMotion } from "./animeScroll";
 
interface Props {
  /** Cards / panels. They are laid out in a single row. */
  children: ReactNode;
  /** Space to leave under a fixed header, e.g. "96px". */
  topOffset?: string;
  smooth?: boolean | number;
  className?: string;
  trackClassName?: string;
  style?: CSSProperties;
}
 
/**
 * Pinned horizontal scroll: the section sticks to the screen while vertical
 * scroll drives the row sideways, then releases.
 *
 * Requirements: no ancestor may have overflow hidden/auto/scroll (it kills
 * position: sticky). Use `overflow-x: clip` on <body> instead of `hidden`.
 */
export default function AnimeHorizontalScroll({
  children,
  topOffset = "0px",
  smooth = true,
  className,
  trackClassName,
  style,
}: Props) {
  const outer = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
 
  useLayoutEffect(() => {
    const section = outer.current;
    const row = track.current;
    if (!section || !row || prefersReducedMotion()) return;
 
    let observer: ReturnType<typeof onScroll> | null = null;
    let anim: ReturnType<typeof animate> | null = null;
 
    const build = () => {
      observer?.revert();
      anim?.revert();
 
      const travel = Math.max(0, row.scrollWidth - window.innerWidth);
      // Scroll runway = one screen + however far the row has to travel.
      section.style.height = `${window.innerHeight + travel}px`;
      if (travel === 0) return;
 
      observer = onScroll({
        target: section,
        enter: "start start",
        leave: "end end",
        sync: smooth,
      });
      anim = animate(row, { x: -travel, ease: "linear", autoplay: observer });
    };
 
    build();
    let timer: number | undefined;
    const rebuild = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(build, 150);
    };
    const ro = new ResizeObserver(rebuild);
    ro.observe(row);
    window.addEventListener("resize", rebuild);
 
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", rebuild);
      ro.disconnect();
      observer?.revert();
      anim?.revert();
      section.style.height = "";
    };
  }, [smooth]);
 
  return (
    <section ref={outer} className={className} style={{ position: "relative", ...style }}>
      <div
        style={{
          position: "sticky",
          top: topOffset,
          height: `calc(100vh - ${topOffset})`,
          display: "flex",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        <div
          ref={track}
          className={trackClassName}
          style={{ display: "flex", gap: "1.5rem", padding: "0 8vw", willChange: "transform" }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
