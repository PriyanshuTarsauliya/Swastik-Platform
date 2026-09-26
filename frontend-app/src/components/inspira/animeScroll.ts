/**
 * Shared helpers for the Anime.js scroll components.
 * Everything here is framework-free and safe to import anywhere.
 */
 
export type RevealDirection = "up" | "down" | "left" | "right" | "zoom" | "fade";
 
/** True when the visitor asked the OS to reduce motion. */
export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 
/** Starting pose (before the reveal) for each direction. */
export function fromPose(direction: RevealDirection, distance: number) {
  switch (direction) {
    case "up":    return { x: 0, y: distance, scale: 1 };
    case "down":  return { x: 0, y: -distance, scale: 1 };
    case "left":  return { x: distance, y: 0, scale: 1 };   // slides in from the right
    case "right": return { x: -distance, y: 0, scale: 1 };  // slides in from the left
    case "zoom":  return { x: 0, y: distance * 0.4, scale: 0.92 };
    default:      return { x: 0, y: 0, scale: 1 };
  }
}
 
/** Clears inline styles that Anime.js leaves behind so Tailwind hover/transform classes work again. */
export function clearInline(els: HTMLElement[]) {
  els.forEach((el) => {
    el.style.opacity = "";
    el.style.transform = "";
    el.style.willChange = "";
  });
}
