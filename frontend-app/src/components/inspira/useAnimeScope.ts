import { useEffect, useMemo, useRef } from 'react';
import { createScope } from 'animejs';

export function useAnimeScope() {
  const rootRef = useRef<HTMLDivElement>(null);
  
  const scope = useMemo(() => {
    return createScope({
      mediaQueries: {
        mobile: '(max-width: 768px)',
        reduceMotion: '(prefers-reduced-motion: reduce)',
        portrait: '(orientation: portrait)',
      },
    });
  }, []);

  // Update scope root when ref attaches
  useEffect(() => {
    if (rootRef.current) {
      scope.root = rootRef.current;
    }
  }, [scope]);

  useEffect(() => {
    return () => {
      // Revert all animations and clean up watchers when the component unmounts
      scope.revert();
    };
  }, [scope]);

  return { scope, rootRef };
}
