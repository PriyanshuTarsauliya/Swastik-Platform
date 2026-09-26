import { useEffect, useRef } from 'react';
import { createTimeline, stagger } from 'animejs';
import { Activity } from 'lucide-react';

export default function AnimeTimelineDemoStrip() {
  const stripRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<any>(null);

  const liveFeeds = [
    "⚡ Appointment confirmed with Dr. Sharma (Tomorrow 5:30 PM)",
    "💬 WhatsApp intake form sent to +91 98260 ••••",
    "📋 Patient intake form confirmed & synced with EHR",
    "🎙️ Hindi-speaking patient query resolved in 18 seconds",
    "📅 Rescheduled slot from Friday to Saturday 11:00 AM",
    "🚀 0 missed calls recorded across all partner clinics today",
  ];

  useEffect(() => {
    if (!stripRef.current) return;

    // Grab all items to animate
    const items = stripRef.current.querySelectorAll('.demo-item');
    if (!items.length) return;

    // Create timeline loop
    const tl = createTimeline({
      loop: true,
      defaults: { ease: 'linear', duration: 3000 },
    });

    // Simple horizontal translation loop
    tl.add(items, {
      translateX: ['100vw', '-100vw'],
      delay: stagger(1500),
      duration: 10000,
    } as any, 0);

    tlRef.current = tl;

    return () => {
      tl.revert();
    };
  }, []);

  const handleMouseEnter = () => {
    if (tlRef.current) tlRef.current.pause();
  };

  const handleMouseLeave = () => {
    if (tlRef.current) tlRef.current.play();
  };

  return (
    <section className="relative py-14 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto text-center mb-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#94a3b8]">
          Trusted by Top Doctors and Clinics Across India
        </p>
      </div>

      <div 
        ref={stripRef}
        className="relative flex h-14 w-full items-center overflow-hidden"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {liveFeeds.map((feed, idx) => (
          <div
            key={idx}
            className="demo-item absolute whitespace-nowrap flex items-center gap-2 rounded-full border border-[rgba(20,200,178,0.2)] bg-[rgba(4,7,12,0.7)] px-4 py-2 text-xs font-medium text-[#14c8b2] backdrop-blur-md"
            style={{ left: '0', transform: 'translateX(100vw)' }}
          >
            <Activity className="h-3.5 w-3.5 text-[#00e5ff]" />
            <span>{feed}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
