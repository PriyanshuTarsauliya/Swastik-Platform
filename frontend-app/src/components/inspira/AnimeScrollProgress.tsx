import { useEffect, useRef } from "react";
import { createAnimatable, utils } from "animejs";
 
interface Props {
  height?: number;
  from?: string;
  to?: string;
  zIndex?: number;
}
 
/**
 * Top-edge reading progress bar.
 * Two layers chase the real scroll position at different speeds: a tight
 * bar and a slower, blurred trail. The lag between them is the "spring tail".
 * It reads window.scrollY, so it works with Lenis (Lenis scrolls the window).
 */
export default function AnimeScrollProgress({
  height = 3,
  from = "#14c8b2",
  to = "#00e5ff",
  zIndex = 9999,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
 
  useEffect(() => {
    const bar = barRef.current;
    const trail = trailRef.current;
    if (!bar || !trail) return;
 
    const barA = createAnimatable(bar, { scaleX: 380, ease: "out(3)" });
    const trailA = createAnimatable(trail, { scaleX: 1100, ease: "out(3)" });
 
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? utils.clamp(window.scrollY / max, 0, 1) : 0;
      barA.scaleX(p);
      trailA.scaleX(p);
    };
 
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Page height changes when images/fonts/sections mount, so watch it too.
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
 
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
      barA.revert();
      trailA.revert();
    };
  }, []);
 
  const layer = {
    position: "absolute" as const,
    inset: 0,
    transformOrigin: "left center",
    transform: "scaleX(0)",
    background: `linear-gradient(90deg, ${from}, ${to})`,
  };
 
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height,
        zIndex,
        pointerEvents: "none",
      }}
    >
      <div
        ref={trailRef}
        style={{ ...layer, opacity: 0.55, filter: "blur(6px)", height: height * 3, top: -height }}
      />
      <div ref={barRef} style={{ ...layer, boxShadow: `0 0 12px ${to}99` }} />
    </div>
  );
}
