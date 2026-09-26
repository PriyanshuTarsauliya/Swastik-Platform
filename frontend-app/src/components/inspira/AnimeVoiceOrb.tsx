import { useEffect, useRef } from 'react';
import { animate, utils } from 'animejs';

export default function AnimeVoiceOrb() {
  const containerRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // We want to animate the bars continuously
    const anim = animate(barsRef.current.filter(Boolean) as HTMLElement[], {
      y: () => utils.random(-25, 25),
      scaleY: () => utils.random(0.5, 1.8),
      duration: () => utils.random(500, 1200),
      ease: 'inOut(3)', // built in ease
      direction: 'alternate',
      loop: true,
      composition: 'blend', // blend with any running motion
    });

    return () => {
      anim.revert();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative flex items-center justify-center gap-1 h-12 w-16 mb-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { barsRef.current[i] = el; }}
          className="w-1 h-6 rounded-full bg-white shadow-sm"
        />
      ))}
    </div>
  );
}
