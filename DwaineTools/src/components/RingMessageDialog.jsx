import { useState, useEffect } from 'react';
import { useAppStore } from '../store';

const uplinkCodePattern = /^[1-9][0-9]{2} (alpha|bravo|delta|omega|gamma|zeta)$/i;

export default function RingMessageDialog() {
  const [ringMessage, setRingMessage] = useState('');
  const { 
    isRingMessageOpen, 
    setIsRingMessageOpen, 
    triggerGlitch, 
    unlockRainbow, 
    switchTheme, 
    setAppTitle,
    unlockSyndicate,
    setActiveTool,
    triggerTeleporterUnlockSignal
  } = useAppStore();

  const submitRingMessage = () => {
    const message = ringMessage.trim().replace(/\s+/g, ' ');
    setIsRingMessageOpen(false);

    const isKonamiCode = message.toLowerCase() === '↑↑↓↓←→←→ba';

    if (isKonamiCode) {
      triggerGlitch();
      window.setTimeout(() => {
        unlockRainbow();
        localStorage.setItem('dwaine_rainbow_unlocked', 'true');
        switchTheme('rainbow');
        setAppTitle('Lives: 30');
      }, 420);
      return;
    }

    if (!uplinkCodePattern.test(message)) return;

    localStorage.setItem('dwaine_login_packet_setup_unlocked', 'true');
    unlockSyndicate();
    setActiveTool('teleporter');
    triggerTeleporterUnlockSignal();
    
    // Simulate the old event approach via standard state/actions
    window.dispatchEvent(new CustomEvent('dwaine:glitch', {
      detail: {
        message: 'SYSTEM BREACHED',
        title: 'SYNDICATE TOOLS',
        theme: 'syndicate',
        themeDelayMs: 420,
        themeTransitionMs: 5000,
      },
    }));
  };

  useEffect(() => {
    if (isRingMessageOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRingMessage('');
    }
  }, [isRingMessageOpen]);

  useEffect(() => {
    if (isRingMessageOpen && ringMessage.trim().toLowerCase() === '↑↑↓↓←→←→ba') {
      submitRingMessage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringMessage, isRingMessageOpen]);

  if (!isRingMessageOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setIsRingMessageOpen(false);
      }}
    >
      <div
        id="ring-message-dialog"
        className="border-2 border-term-text bg-term-bg p-6 max-w-md w-full relative shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ring-message-title"
      >
        <div id="ring-message-title" className="absolute -top-4 left-4 bg-term-bg px-2 text-xl font-bold tracking-widest text-term-text">
          Please enter new ring message.
        </div>
        <div className="space-y-6 mt-4">
          <label className="block">
            <span className="block text-xl font-bold uppercase mb-2">Ring Message</span>
            <input
              autoFocus
              type="text"
              value={ringMessage}
              placeholder="beep"
              onChange={(event) => setRingMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submitRingMessage();
                  return;
                }
                if (event.key === 'Escape') {
                  setIsRingMessageOpen(false);
                  return;
                }
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                  event.preventDefault();
                  const arrowMap = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
                  setRingMessage(prev => prev + arrowMap[event.key]);

                  const dialogElement = document.getElementById('ring-message-dialog');
                  if (dialogElement) {
                    dialogElement.classList.remove('nudge-up', 'nudge-down', 'nudge-left', 'nudge-right', 'nudge-press');
                    void dialogElement.offsetWidth;
                    const dir = event.key.replace('Arrow', '').toLowerCase();
                    dialogElement.classList.add(`nudge-${dir}`);
                  }
                }
              }}
              className="w-full bg-term-bg border border-term-border text-term-text px-3 py-2 text-xl focus:border-term-text"
            />
          </label>
          <div className="flex justify-end gap-4 pt-4 border-t border-term-border opacity-80">
            <button
              type="button"
              onClick={() => setIsRingMessageOpen(false)}
              className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-6 py-2 uppercase font-bold text-xl transition-colors cursor-pointer"
            >
              [ CANCEL ]
            </button>
            <button
              type="button"
              onClick={submitRingMessage}
              className="bg-term-text text-term-bg hover:opacity-90 px-6 py-2 uppercase font-bold text-xl transition-opacity cursor-pointer"
            >
              [ OK ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
