import {
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
} from "react";
import { animate, onScroll, splitText, stagger, utils } from "animejs";
import { prefersReducedMotion } from "./animeScroll";
 
interface Props {
  /** Plain text only (the splitter rewrites the element's DOM). */
  children: string;
  as?: ElementType;
  by?: "lines" | "words" | "chars";
  /**
   * reveal: plays once when visible (words/lines rise out of a mask).
   * scrub:  text lights up word by word as you scroll (tied to scroll position).
   */
  mode?: "reveal" | "scrub";
  staggerMs?: number;
  className?: string;
  style?: CSSProperties;
}
 
/**
 * Headline choreography.
 * NOTE: background-clip:text gradients break when words are split into
 * separate boxes. For gradient headlines use by="lines".
 */
export default function AnimeSplitText({
  children,
  as: Tag = "h2",
  by = "words",
  mode = "reveal",
  staggerMs = 60,
  className,
  style,
}: Props) {
  const ref = useRef<HTMLElement>(null);
 
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
 
    let cancelled = false;
    let cleanup: (() => void) | undefined;
 
    // Wait for fonts, otherwise line breaks are measured with the fallback font.
    document.fonts.ready.then(() => {
      if (cancelled) return;
 
      const split = splitText(el, {
        lines: by === "lines" ? { wrap: "clip" } : false,
        words: by === "words" ? { wrap: "clip" } : true,
        chars: by === "chars",
      });
      const targets = split[by] as HTMLElement[];
 
      if (mode === "scrub") {
        utils.set(targets, { opacity: 0.15 });
        const observer = onScroll({
          target: el,
          enter: "85% start",
          leave: "40% end",
          sync: true,
        });
        const anim = animate(targets, {
          opacity: 1,
          ease: "linear",
          delay: stagger(80),
          autoplay: observer,
        });
        cleanup = () => {
          observer.revert();
          anim.revert();
          split.revert();
        };
        return;
      }
 
      // reveal
      const rise = by === "chars" ? "0.6em" : "110%";
      utils.set(targets, { y: rise, opacity: by === "chars" ? 0 : 1 });
      let anim: ReturnType<typeof animate> | null = null;
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          io.disconnect();
          anim = animate(targets, {
            y: by === "chars" ? "0em" : "0%",
            opacity: 1,
            duration: 900,
            ease: "outExpo",
            delay: stagger(staggerMs),
          });
        },
        { threshold: 0.3 },
      );
      io.observe(el);
      cleanup = () => {
        io.disconnect();
        anim?.revert();
        split.revert();
      };
    });
 
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [by, mode, staggerMs, children]);
 
  return (
    <Tag ref={ref} className={className} style={style}>
      {children}
    </Tag>
  );
}
