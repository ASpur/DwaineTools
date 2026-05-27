import { useEffect } from 'react';
import { useAppStore } from '../store';

const konamiCode = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
];

export function useKonamiCode() {
  const { triggerGlitch, unlockRainbow, switchTheme, setAppTitle } = useAppStore();

  useEffect(() => {
    let progress = 0;

    const handleKeyDown = (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        return;
      }

      if (event.code === konamiCode[progress]) {
        progress += 1;
        if (progress === konamiCode.length) {
          triggerGlitch();
          window.setTimeout(() => {
            unlockRainbow();
            localStorage.setItem('dwaine_rainbow_unlocked', 'true');
            switchTheme('rainbow');
            setAppTitle('Lives: 30');
          }, 420);
          progress = 0;
        }
        return;
      }

      progress = event.code === konamiCode[0] ? 1 : 0;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerGlitch, unlockRainbow, switchTheme, setAppTitle]);
}
