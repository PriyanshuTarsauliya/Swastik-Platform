import { useEffect, useRef } from 'react';
import { createDraggable, createSpring } from 'animejs';

interface Chip {
  id: string;
  label: string;
  color: string;
}

const VOICE_CHIPS: Chip[] = [
  { id: '1', label: 'Empathetic Hindi', color: '#14c8b2' },
  { id: '2', label: 'Clinical English', color: '#00e5ff' },
  { id: '3', label: 'Friendly Hinglish', color: '#f5a623' },
];

export default function AnimeVoiceStudio() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!containerRef.current) return;

    const draggables = chipRefs.current.map((chip) => {
      if (!chip) return null;
      
      return createDraggable(chip, {
        bounds: containerRef.current!, // Constrain to their card
        releaseEase: createSpring({ stiffness: 120, damping: 6 }), // Spring release snap
        cursor: true
      } as any);
    });

    return () => {
      draggables.forEach((dr) => dr?.revert());
    };
  }, []);

  return (
    <div className="py-24 px-6 w-full max-w-5xl mx-auto">

      <div 
        ref={containerRef} 
        className="relative w-full h-80 rounded-3xl border border-white/10 bg-[rgba(8,14,23,0.8)] overflow-hidden flex items-center justify-center gap-4"
      >
        {VOICE_CHIPS.map((chip, i) => (
          <div
            key={chip.id}
            ref={(el) => { chipRefs.current[i] = el; }}
            className="px-6 py-3 rounded-full text-sm font-bold cursor-grab active:cursor-grabbing text-[#04070c] shadow-lg select-none"
            style={{ backgroundColor: chip.color }}
          >
            {chip.label}
          </div>
        ))}
        
        {/* Background decorative text */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-5 font-bold text-6xl text-white">
          PLAYGROUND
        </div>
      </div>
    </div>
  );
}
