import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import AboutTool from './tools/AboutTool';
import TeleporterTool from './tools/TeleporterTool';

const themeColors = {
  thinktronic: { text: '#19A319', bg: '#1B1E1B' },
  light: { text: '#000000', bg: '#FFFFFF' },
  dark: { text: '#FFFFFF', bg: '#000000' },
  amber: { text: '#E79C01', bg: '#1B1E1B' },
  blue: { text: '#A5A5FF', bg: '#4242E7' },
  syndicate: { text: '#FF0000', bg: '#1B1E1B' },
  rainbow: { text: '#FF4FD8', bg: '#1B1E1B' },
};

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

const glitchDuration = 1120;
const normalThemeTransitionMs = 240;
const normalThemeSettleMs = 260;
const syndicateEasterEggTransitionMs = 5000;
const defaultAppTitle = 'DWAINE TOOLS';
const uplinkCodePattern = /^[1-9][0-9]{2} (alpha|bravo|delta|omega|gamma|zeta)$/i;

const setThemeFavicon = (theme) => {
  const colors = themeColors[theme] || themeColors.thinktronic;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" fill="${colors.bg}"/>
      <rect x="6" y="6" width="52" height="52" fill="none" stroke="${colors.text}" stroke-width="4"/>
      <path d="M18 22 L30 32 L18 42" fill="none" stroke="${colors.text}" stroke-width="6" stroke-linecap="square" stroke-linejoin="miter"/>
      <path d="M34 42 H48" fill="none" stroke="${colors.text}" stroke-width="6" stroke-linecap="square"/>
    </svg>
  `;

  const href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  const favicon = document.getElementById('theme-favicon') || document.createElement('link');
  favicon.setAttribute('id', 'theme-favicon');
  favicon.setAttribute('rel', 'icon');
  favicon.setAttribute('type', 'image/svg+xml');
  favicon.setAttribute('href', href);
  document.head.appendChild(favicon);

  const themeColor = document.querySelector('meta[name="theme-color"]') || document.createElement('meta');
  themeColor.setAttribute('name', 'theme-color');
  themeColor.setAttribute('content', colors.bg);
  document.head.appendChild(themeColor);
};

export default function App() {
  const [isSyndicateUnlocked, setIsSyndicateUnlocked] = useState(() => {
    return localStorage.getItem('dwaine_login_packet_setup_unlocked') === 'true';
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('dwaine_theme') || 'thinktronic';
  });

  const [isRainbowUnlocked, setIsRainbowUnlocked] = useState(() => {
    return localStorage.getItem('dwaine_rainbow_unlocked') === 'true'
      || localStorage.getItem('dwaine_theme') === 'rainbow';
  });

  const [activeTool, setActiveTool] = useState(() => {
    return localStorage.getItem('dwaine_active_tool') || 'teleporter';
  });

  const [appTitle, setAppTitle] = useState(defaultAppTitle);
  const [teleporterUnlockSignal, setTeleporterUnlockSignal] = useState(0);
  const [isRingMessageOpen, setIsRingMessageOpen] = useState(false);
  const [ringMessage, setRingMessage] = useState('');

  const [fontMode, setFontMode] = useState(() => {
    return localStorage.getItem('dwaine_font_mode') || 'terminal';
  });

  const [isCrtEnabled, setIsCrtEnabled] = useState(() => {
    const savedCrtPreference = localStorage.getItem('dwaine_crt_filter');
    return savedCrtPreference === null ? true : savedCrtPreference === 'true';
  });

  const [isThemeSwitching, setIsThemeSwitching] = useState(false);
  const [themeSwitchDuration, setThemeSwitchDuration] = useState(normalThemeTransitionMs);
  const [isGlitching, setIsGlitching] = useState(false);
  const [glitchMessage, setGlitchMessage] = useState('');
  const [glitchKey, setGlitchKey] = useState(0);
  const themeSwitchTimer = useRef(null);
  const glitchTimer = useRef(null);
  const glitchThemeTimer = useRef(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const switchTheme = useCallback((nextTheme, options = {}) => {
    if (nextTheme === theme) return;

    const transitionMs = options.transitionMs ?? normalThemeTransitionMs;
    const settleMs = options.settleMs ?? normalThemeSettleMs;

    setThemeSwitchDuration(transitionMs);
    setIsThemeSwitching(true);
    window.clearTimeout(themeSwitchTimer.current);
    setTheme(nextTheme);
    themeSwitchTimer.current = window.setTimeout(() => {
      setIsThemeSwitching(false);
      setThemeSwitchDuration(normalThemeTransitionMs);
    }, settleMs);
  }, [theme]);

  const triggerGlitch = useCallback((message = '') => {
    setIsDrawerOpen(false);
    setIsGlitching(false);
    setGlitchMessage(message);
    window.clearTimeout(glitchTimer.current);
    window.requestAnimationFrame(() => {
      setGlitchKey(key => key + 1);
      setIsGlitching(true);
      glitchTimer.current = window.setTimeout(() => {
        setIsGlitching(false);
        setGlitchMessage('');
      }, glitchDuration);
    });
  }, []);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dwaine_theme', theme);
    setThemeFavicon(theme);
  }, [theme]);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-font', fontMode);
    localStorage.setItem('dwaine_font_mode', fontMode);
  }, [fontMode]);

  useEffect(() => {
    if (appTitle === defaultAppTitle) {
      document.title = 'Dwaine Tools';
    } else if (appTitle === 'Lives: 30') {
      document.title = 'Lives: 30';
    } else {
      document.title = 'Syndicate Tools';
    }
  }, [appTitle]);

  useEffect(() => {
    localStorage.setItem('dwaine_active_tool', activeTool);
  }, [activeTool]);

  useEffect(() => {
    localStorage.setItem('dwaine_crt_filter', String(isCrtEnabled));
  }, [isCrtEnabled]);

  useEffect(() => {
    return () => {
      window.clearTimeout(themeSwitchTimer.current);
      window.clearTimeout(glitchTimer.current);
      window.clearTimeout(glitchThemeTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleGlitchRequest = (event) => {
      triggerGlitch(event.detail?.message ?? '');

      if (event.detail?.title) {
        setAppTitle(event.detail.title);
      }

      const nextTheme = event.detail?.theme;
      if (!nextTheme) return;

      window.clearTimeout(glitchThemeTimer.current);
      glitchThemeTimer.current = window.setTimeout(() => {
        const transitionMs = event.detail?.themeTransitionMs
          ?? (nextTheme === 'syndicate' ? syndicateEasterEggTransitionMs : normalThemeTransitionMs);
        switchTheme(nextTheme, {
          transitionMs,
          settleMs: transitionMs,
        });
      }, event.detail?.themeDelayMs ?? 420);
    };

    window.addEventListener('dwaine:glitch', handleGlitchRequest);
    return () => window.removeEventListener('dwaine:glitch', handleGlitchRequest);
  }, [switchTheme, triggerGlitch]);


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
            setIsRainbowUnlocked(true);
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
  }, [switchTheme, triggerGlitch]);

  const tools = [
    { id: 'teleporter', name: 'Teleporter Generator' },
    { id: 'about', name: 'About' },
  ];

  const openRingMessage = () => {
    setRingMessage('');
    setIsDrawerOpen(false);
    setIsRingMessageOpen(true);
  };

  const submitRingMessage = () => {
    const message = ringMessage.trim().replace(/\s+/g, ' ');
    setIsRingMessageOpen(false);

    const isKonamiCode = message.toLowerCase() === '↑↑↓↓←→←→ba';

    if (isKonamiCode) {
      triggerGlitch();
      window.setTimeout(() => {
        setIsRainbowUnlocked(true);
        localStorage.setItem('dwaine_rainbow_unlocked', 'true');
        switchTheme('rainbow');
        setAppTitle('Lives: 30');
      }, 420);
      return;
    }

    if (!uplinkCodePattern.test(message)) return;

    localStorage.setItem('dwaine_login_packet_setup_unlocked', 'true');
    setIsSyndicateUnlocked(true);
    setActiveTool('teleporter');
    setTeleporterUnlockSignal(signal => signal + 1);
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
    if (isRingMessageOpen && ringMessage.trim().toLowerCase() === '↑↑↓↓←→←→ba') {
      submitRingMessage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringMessage, isRingMessageOpen]);

  return (
    <div className={`min-h-screen flex flex-col bg-term-bg selection:bg-term-hover selection:text-term-hover-text relative overflow-x-hidden ${isCrtEnabled ? 'crt-enabled' : ''} ${isThemeSwitching ? 'theme-switching' : ''} ${isGlitching ? 'crt-glitch-warping' : ''}`} style={{ '--theme-switch-duration': `${themeSwitchDuration}ms` }}>
      {isGlitching && (
        <svg key={`crt-glitch-filter-${glitchKey}`} className="crt-glitch-svg-filter" aria-hidden="true" focusable="false">
          <filter id="crt-glitch-warp" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.12" numOctaves="1" seed={(glitchKey % 97) + 1} result="noise">
              <animate attributeName="baseFrequency" dur={`${glitchDuration}ms`} values="0.012 0.08;0.034 0.16;0.018 0.11;0.042 0.2;0.01 0.07" repeatCount="1" fill="freeze" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G">
              <animate attributeName="scale" dur={`${glitchDuration}ms`} values="0;5;2;8;3;0" repeatCount="1" fill="freeze" />
            </feDisplacementMap>
          </filter>
        </svg>
      )}
      
      {/* Global Header */}
      <header className="border-b-2 border-term-border p-4 flex flex-wrap justify-between items-center gap-4 bg-term-bg z-30 relative">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            aria-label="Open tool menu"
            aria-expanded={isDrawerOpen}
            className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border p-2 transition-colors flex flex-col justify-center items-center gap-1.5 w-12 h-12"
          >
            <span className="w-6 h-0.5 bg-current block"></span>
            <span className="w-6 h-0.5 bg-current block"></span>
            <span className="w-6 h-0.5 bg-current block"></span>
          </button>
          <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-wider text-term-text hidden sm:block">
            <span className="title-prompt opacity-90" aria-hidden="true">
              <span>{'>'}</span>
              <span className="title-prompt-cursor">{'_'}</span>
            </span>
            <span className="sr-only">Command prompt</span> {appTitle}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-bold text-lg uppercase text-term-text opacity-75 hidden sm:inline">COLOR:</span>
          <select
            value={theme}
            onChange={(e) => switchTheme(e.target.value)}
            aria-label="Select color theme"
            className="bg-term-bg border border-term-border text-term-text text-lg px-2 py-1 focus:outline-none focus:border-term-text uppercase appearance-none cursor-pointer"
            style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, var(--color-border) 50%), linear-gradient(135deg, var(--color-border) 50%, transparent 50%)', backgroundPosition: 'calc(100% - 15px) calc(1em + 0px), calc(100% - 10px) calc(1em + 0px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat', paddingRight: '30px' }}
          >
            <option value="thinktronic">THINKTRONIC</option>
            <option value="amber">AMBER</option>
            <option value="blue">BLUE</option>
            {isSyndicateUnlocked && <option value="syndicate">SYNDICATE</option>}
            <option disabled>──────────</option>
            <option value="light">LIGHT</option>
            <option value="dark">DARK</option>
            {isRainbowUnlocked && <option value="rainbow">RAINBOW</option>}
          </select>
          <span className="font-bold text-lg uppercase text-term-text opacity-75 hidden sm:inline">FONT:</span>
          <select
            value={fontMode}
            onChange={(e) => setFontMode(e.target.value)}
            aria-label="Select font style"
            className="bg-term-bg border border-term-border text-term-text text-lg px-2 py-1 focus:outline-none focus:border-term-text uppercase appearance-none cursor-pointer"
            style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, var(--color-border) 50%), linear-gradient(135deg, var(--color-border) 50%, transparent 50%)', backgroundPosition: 'calc(100% - 15px) calc(1em + 0px), calc(100% - 10px) calc(1em + 0px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat', paddingRight: '30px' }}
          >
            <option value="terminal">TERMINAL</option>
            <option value="default">DEFAULT</option>
          </select>
          <label className="flex items-center gap-2 text-term-text font-bold text-lg uppercase cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isCrtEnabled}
              onChange={(e) => setIsCrtEnabled(e.target.checked)}
              className="term-checkbox"
              aria-label="Toggle CRT filter"
            />
            CRT
          </label>
        </div>
      </header>

      {/* Navigation Drawer Overlay */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-term-bg opacity-80 z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Slide-out Drawer */}
      <div className={`fixed top-0 left-0 h-full w-80 bg-term-bg border-r-2 border-term-border z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b-2 border-term-border flex justify-between items-center h-[82px]">
          <h2 className="text-2xl font-bold uppercase text-term-text tracking-wider">Select Tool</h2>
          <button 
            type="button"
            onClick={() => setIsDrawerOpen(false)}
            aria-label="Close tool menu"
            className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1 font-bold transition-colors text-xl"
          >
            [ CLOSE ]
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tools.filter(tool => tool.id !== 'about').map(tool => (
            <button
              type="button"
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id);
                setIsDrawerOpen(false);
              }}
              className={`w-full text-left px-4 py-3 font-bold text-xl uppercase transition-colors border-2 ${activeTool === tool.id ? 'bg-term-text text-term-bg border-term-text' : 'bg-term-bg text-term-text border-term-border hover:bg-term-hover hover:text-term-hover-text'}`}
            >
              {activeTool === tool.id ? '[*] ' : '[ ] '}
              {tool.name}
            </button>
          ))}
          <button
            type="button"
            onClick={openRingMessage}
            className="w-full text-left px-4 py-3 font-bold text-xl uppercase transition-colors border-2 bg-term-bg text-term-text border-term-border hover:bg-term-hover hover:text-term-hover-text"
          >
            [ ] Set Ring Message
          </button>
          {tools.filter(tool => tool.id === 'about').map(tool => (
            <button
              type="button"
              key={tool.id}
              onClick={() => {
                setActiveTool(tool.id);
                setIsDrawerOpen(false);
              }}
              className={`w-full text-left px-4 py-3 font-bold text-xl uppercase transition-colors border-2 ${activeTool === tool.id ? 'bg-term-text text-term-bg border-term-text' : 'bg-term-bg text-term-text border-term-border hover:bg-term-hover hover:text-term-hover-text'}`}
            >
              {activeTool === tool.id ? '[*] ' : '[ ] '}
              {tool.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full relative">
        {activeTool === 'teleporter' && <TeleporterTool key={teleporterUnlockSignal} />}
        {activeTool === 'about' && <AboutTool />}
      </main>

      {isRingMessageOpen && (
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
                    const dialogElement = document.getElementById('ring-message-dialog');
                    if (dialogElement) {
                      dialogElement.classList.remove('nudge-up', 'nudge-down', 'nudge-left', 'nudge-right', 'nudge-press');
                      void dialogElement.offsetWidth;
                    }
                    let nudgeClass = 'nudge-press';

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
                      const dir = event.key.replace('Arrow', '').toLowerCase();
                      nudgeClass = `nudge-${dir}`;
                    }

                    if (dialogElement) {
                      dialogElement.classList.add(nudgeClass);
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
      )}

      {isCrtEnabled && <div className="crt-filter" aria-hidden="true" />}
      {isGlitching && <div key={glitchKey} className="screen-glitch" aria-hidden="true" />}
      {isGlitching && glitchMessage && (
        <div key={`glitch-warning-${glitchKey}`} className="screen-glitch-warning" aria-hidden="true">
          {glitchMessage}
        </div>
      )}

    </div>
  );
}
