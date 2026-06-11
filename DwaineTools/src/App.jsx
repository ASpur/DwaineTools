import { useEffect, useLayoutEffect } from 'react';
import AboutTool from './tools/AboutTool';
import ChemicompilerTool from './tools/ChemicompilerTool';
import TeleporterTool from './tools/TeleporterTool';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import RingMessageDialog from './components/RingMessageDialog';
import GlitchEffects from './components/GlitchEffects';
import { useKonamiCode } from './hooks/useKonamiCode';
import { useAppStore } from './store';

const themeColors = {
  thinktronic: { text: '#19A319', bg: '#1B1E1B' },
  light: { text: '#000000', bg: '#FFFFFF' },
  dark: { text: '#FFFFFF', bg: '#000000' },
  amber: { text: '#E79C01', bg: '#1B1E1B' },
  blue: { text: '#A5A5FF', bg: '#4242E7' },
  syndicate: { text: '#FF0000', bg: '#1B1E1B' },
  rainbow: { text: '#FF4FD8', bg: '#1B1E1B' },
};

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
  const { 
    theme, 
    fontMode, 
    isCrtEnabled, 
    activeTool, 
    appTitle, 
    teleporterUnlockSignal,
    isThemeSwitching,
    themeSwitchDuration,
    isGlitching,
    switchTheme,
    triggerGlitch,
    setAppTitle
  } = useAppStore();

  useKonamiCode();

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
    if (appTitle === 'DWAINE TOOLS') {
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
    const handleGlitchRequest = (event) => {
      triggerGlitch(event.detail?.message ?? '');

      if (event.detail?.title) {
        setAppTitle(event.detail.title);
      }

      const nextTheme = event.detail?.theme;
      if (!nextTheme) return;

      setTimeout(() => {
        const transitionMs = event.detail?.themeTransitionMs
          ?? (nextTheme === 'syndicate' ? 5000 : 240);
        switchTheme(nextTheme, {
          transitionMs,
          settleMs: transitionMs,
        });
      }, event.detail?.themeDelayMs ?? 420);
    };

    window.addEventListener('dwaine:glitch', handleGlitchRequest);
    return () => window.removeEventListener('dwaine:glitch', handleGlitchRequest);
  }, [switchTheme, triggerGlitch, setAppTitle]);

  return (
    <div className={`min-h-screen flex flex-col bg-term-bg selection:bg-term-hover selection:text-term-hover-text relative overflow-x-hidden ${isCrtEnabled ? 'crt-enabled' : ''} ${isThemeSwitching ? 'theme-switching' : ''} ${isGlitching ? 'crt-glitch-warping' : ''}`} style={{ '--theme-switch-duration': `${themeSwitchDuration}ms` }}>
      <Header />
      <Sidebar />
      <RingMessageDialog />
      <GlitchEffects />

      <main className="flex-1 overflow-y-auto w-full relative">
        {activeTool === 'teleporter' && <TeleporterTool key={teleporterUnlockSignal} />}
        {activeTool === 'chemicompiler' && <ChemicompilerTool />}
        {activeTool === 'about' && <AboutTool />}
      </main>
    </div>
  );
}
