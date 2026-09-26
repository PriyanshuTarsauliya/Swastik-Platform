import { useEffect, useRef } from 'react';
import { onScroll, createMotionPath, animate, morphTo } from 'animejs';

export default function AnimeCallFlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const iconRef = useRef<SVGPathElement>(null);
  const waveformRef = useRef<SVGPathElement>(null);

  // SVG Paths for morphing
  const phonePath = "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z";
  const waveformPath = "M2 12h4l3-9 5 18 3-9h5"; // generic activity pulse path

  useEffect(() => {
    if (!containerRef.current || !pathRef.current || !dotRef.current) return;

    // Line Drawing scrubbed by scroll
    const drawScroll = onScroll({
      target: containerRef.current,
      enter: '0% end',
      leave: '100% start',
      sync: true, // Sync with smooth scroll (Lenis)
      onUpdate: (self) => {
        // We use animate with 0 duration to manually set the draw position based on scroll progress
        animate(pathRef.current!, {
          draw: [`0 0`, `0 ${self.progress}`],
          duration: 0,
        });
        
        // Similarly for the dot along the motion path
        animate(dotRef.current!, {
          motionPath: createMotionPath(pathRef.current!),
          progress: self.progress,
          duration: 0,
        } as any);
      }
    });

    return () => {
      drawScroll.revert();
    };
  }, []);

  useEffect(() => {
    // Morph loop for the icon
    if (!iconRef.current) return;

    const morphAnim = animate(iconRef.current, {
      d: morphTo(waveformRef.current!),
      duration: 1500,
      ease: 'inOut(3)',
      direction: 'alternate',
      loop: true,
    });

    return () => {
      morphAnim.revert();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-3xl mx-auto py-20 flex flex-col items-center">
      <div className="flex w-full items-center justify-between text-white font-bold text-sm mb-4 px-10">
        <div className="flex flex-col items-center">
          <svg className="w-12 h-12 mb-2 text-[#14c8b2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path ref={iconRef} d={phonePath} />
            <path ref={waveformRef} d={waveformPath} style={{ display: 'none' }} />
          </svg>
          Patient
        </div>
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 mb-2 rounded-xl bg-gradient-to-br from-[#14c8b2] to-[#00e5ff] flex items-center justify-center text-black">
            AI
          </div>
          Swastik Voice
        </div>
        <div className="flex flex-col items-center">
          <svg className="w-12 h-12 mb-2 text-[#f5a623]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          EHR System
        </div>
      </div>
      
      <div className="relative w-full h-32">
        <svg viewBox="0 0 600 100" className="w-full h-full overflow-visible">
          {/* Background track */}
          <path
            d="M 50,50 C 150,150 250,-50 350,50 C 450,150 500,50 550,50"
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="4"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          {/* Animated line drawing */}
          <path
            ref={pathRef}
            d="M 50,50 C 150,150 250,-50 350,50 C 450,150 500,50 550,50"
            fill="none"
            stroke="#14c8b2"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* The packet traveling along the path */}
          <circle
            ref={dotRef}
            r="8"
            fill="#00e5ff"
            className="shadow-[0_0_15px_#00e5ff]"
          />
        </svg>
      </div>
    </div>
  );
}
