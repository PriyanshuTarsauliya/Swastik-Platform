import { useEffect, useState } from 'react';
import { onScroll } from 'animejs';

export function useAnimeNavSpy(sectionIds: string[]) {
  const [activeSection, setActiveSection] = useState<string>('');

  useEffect(() => {
    // We create a single onScroll watcher for each section
    const cleanups = sectionIds.map((id) => {
      const target = document.querySelector(id);
      if (!target) return () => {};

      const watcher = onScroll({
        target,
        enter: '85% start',
        leave: '40% end',
        onEnter: () => setActiveSection(id),
        onEnterBackward: () => setActiveSection(id),
      });
      return () => watcher.revert();
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [sectionIds]);

  return activeSection;
}
