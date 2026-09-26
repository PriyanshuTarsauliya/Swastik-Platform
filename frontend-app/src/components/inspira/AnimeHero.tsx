import { useEffect, useRef } from 'react';
import { createTimeline, stagger } from 'animejs';
import { Headphones, ChevronRight, PhoneCall, ExternalLink, Shield, Zap, Globe, UserCheck } from 'lucide-react';
import BorderBeam from './BorderBeam';
import TextReveal from './TextReveal';
import SparklesText from './SparklesText';
import AnimeParallax from './AnimeParallax';
import { useAnimeScope } from './useAnimeScope';
export default function AnimeHero() {
  const { scope, rootRef } = useAnimeScope();
  const timelineRef = useRef<any>(null);

  useEffect(() => {
    if (!rootRef.current) return;

    // Use Anime.js v4 createTimeline
    const tl = createTimeline({
      defaults: { ease: 'outExpo', duration: 800 }
    });

    // The dot grid behind the hero was removed, so we don't need this timeline step anymore
    // Timeline load sequence: Nav/Logo (if we targeted them globally, but they're in Navbar. 
    // We'll simulate the hero load sequence here: badge -> headline -> subtext -> CTAs -> Trust Badges
    tl.add('.hero-badge', {
      opacity: [0, 1],
      translateY: [20, 0],
    }, '+=100');

    tl.add('.hero-headline', {
      opacity: [0, 1],
      translateY: [30, 0],
      duration: 900,
      ease: 'outExpo'
    }, '-=400');

    tl.add('.hero-subtext', {
      opacity: [0, 1],
      translateY: [25, 0],
    }, '-=600');

    // CTAs with per-property params and keyframe arrays on the CTA glow
    tl.add('.hero-cta-main', {
      opacity: [0, 1],
      scale: [0.96, 1],
      boxShadow: [
        '0 0 0px rgba(20,200,178,0)', 
        '0 0 30px rgba(20,200,178,0.4)', 
        '0 0 20px rgba(20,200,178,0.3)'
      ]
    }, '-=500');

    tl.add('.hero-cta-secondary', {
      opacity: [0, 1],
      translateX: [-15, 0],
    }, '<'); // Play at the same time as the main CTA

    // Trust badges stagger
    tl.add('.hero-trust-badge', {
      opacity: [0, 1],
      translateY: [15, 0],
      delay: stagger(100),
    }, '-=300');

    timelineRef.current = tl;

  }, [scope]);

  return (
    <section ref={rootRef} className="relative min-h-[92vh] flex flex-col items-center justify-center pt-32 pb-16 px-6 overflow-hidden">
      

      <AnimeParallax distance={120} className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] bg-[rgba(20,200,178,0.09)] rounded-full blur-[140px] pointer-events-none -z-10">
        <div className="w-full h-full bg-transparent" />
      </AnimeParallax>

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        <div className="hero-badge relative inline-flex items-center gap-2 px-5 py-2 rounded-full overflow-hidden border border-[rgba(20,200,178,0.3)] bg-[rgba(8,14,23,0.8)] text-xs font-semibold text-[#14c8b2] mb-8 shadow-[0_0_25px_rgba(20,200,178,0.2)]">
          <BorderBeam size={100} duration={6} colorFrom="#14c8b2" colorTo="#f5a623" />
          <span className="flex h-2 w-2 rounded-full bg-[#14c8b2] animate-ping" />
          <span>Real-Time Voice Agents & Neural Audio Studio • Sub-400ms Turnaround</span>
        </div>

        <h1 className="hero-headline text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.08] mb-6 text-white opacity-0">
          <TextReveal text="Never Miss a Patient Call." stagger={50} blur={14} triggerOnScroll={false} />
          <br />
          <TextReveal text="The Autonomous" stagger={50} blur={14} triggerOnScroll={false} />{' '}
          <SparklesText
            text="Voice Infrastructure"
            className="gradient-text font-black"
            sparklesCount={8}
            colors={{ first: '#14C8B2', second: '#00E5FF' }}
          />
          <br />
          <TextReveal text="with Swastik AI." stagger={50} blur={14} triggerOnScroll={false} />
        </h1>

        <p className="hero-subtext text-lg sm:text-xl text-[#94a3b8] max-w-3xl mx-auto mb-10 leading-relaxed opacity-0">
          Deploy conversational <strong className="text-white">AI Voice Agents</strong> for 24/7 inbound clinic reception and proactive patient recalls — paired with an expressive <strong className="text-white">Voice Generation Studio</strong> that clones your doctors with human empathy.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          <a
            href="#solutions"
            className="hero-cta-main inline-flex items-center justify-center gap-2 py-4 px-8 rounded-full text-base font-bold bg-gradient-to-r from-[#14c8b2] to-[#00e5ff] text-[#04070c] transition-transform hover:-translate-y-0.5 opacity-0"
          >
            <Headphones className="w-5 h-5 text-[#04070c]" />
            <span>Explore Voice Solutions</span>
            <ChevronRight className="w-4 h-4 text-[#04070c]" />
          </a>

          <a
            href="/console/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hero-cta-secondary inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full border border-white/15 bg-white/5 text-sm font-semibold text-white hover:border-[#14c8b2] hover:bg-[rgba(20,200,178,0.1)] transition-all duration-300 backdrop-blur-xl opacity-0"
          >
            <PhoneCall className="w-4 h-4 text-[#14c8b2]" />
            <span>Launch Live Audio Console</span>
            <ExternalLink className="w-4 h-4 text-[#94a3b8]" />
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-[#94a3b8]">
          <span className="hero-trust-badge flex items-center gap-1.5 opacity-0"><Shield className="w-4 h-4 text-[#14c8b2]" /> HIPAA-Compliant Pipelines</span>
          <span className="hero-trust-badge flex items-center gap-1.5 opacity-0"><Zap className="w-4 h-4 text-[#f5a623]" /> &lt;380ms Gemini Live Latency</span>
          <span className="hero-trust-badge flex items-center gap-1.5 opacity-0"><Globe className="w-4 h-4 text-[#00e5ff]" /> Fluent Hinglish, Hindi & English</span>
          <span className="hero-trust-badge flex items-center gap-1.5 opacity-0"><UserCheck className="w-4 h-4 text-[#22c55e]" /> Instant Human Escalation</span>
        </div>
      </div>
    </section>
  );
}
