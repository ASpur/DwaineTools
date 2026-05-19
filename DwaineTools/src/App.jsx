import { useState, useEffect, useLayoutEffect } from 'react';
import AboutTool from './tools/AboutTool';
import TeleporterTool from './tools/TeleporterTool';

const themeColors = {
  thinktronic: { text: '#19A319', bg: '#1B1E1B' },
  amber: { text: '#E79C01', bg: '#1B1E1B' },
  blue: { text: '#A5A5FF', bg: '#4242E7' },
  syndicate: { text: '#FF0000', bg: '#1B1E1B' },
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
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('dwaine_theme') || 'thinktronic';
  });

  const [activeTool, setActiveTool] = useState(() => {
    return localStorage.getItem('dwaine_active_tool') || 'teleporter';
  });

  const [isCrtEnabled, setIsCrtEnabled] = useState(() => {
    return localStorage.getItem('dwaine_crt_filter') === 'true';
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dwaine_theme', theme);
    setThemeFavicon(theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('dwaine_active_tool', activeTool);
  }, [activeTool]);

  useEffect(() => {
    localStorage.setItem('dwaine_crt_filter', String(isCrtEnabled));
  }, [isCrtEnabled]);

  const tools = [
    { id: 'teleporter', name: 'Teleporter Generator' },
    { id: 'about', name: 'About' },
  ];

  return (
    <div className={`min-h-screen flex flex-col bg-term-bg selection:bg-term-hover selection:text-term-hover-text relative overflow-x-hidden ${isCrtEnabled ? 'crt-enabled' : ''}`}>
      
      {/* Global Header */}
      <header className="border-b-2 border-term-border p-4 flex justify-between items-center bg-term-bg z-30 relative">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border p-2 transition-colors flex flex-col justify-center items-center gap-1.5 w-12 h-12"
          >
            <span className="w-6 h-0.5 bg-current block"></span>
            <span className="w-6 h-0.5 bg-current block"></span>
            <span className="w-6 h-0.5 bg-current block"></span>
          </button>
          <h1 className="text-3xl md:text-4xl font-bold uppercase tracking-wider text-term-text hidden sm:block">
            <span className="opacity-90">{'>_'}</span> DWAINE TOOLS
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-bold text-lg uppercase text-term-text opacity-75 hidden sm:inline">COLOR:</span>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="bg-term-bg border border-term-border text-term-text text-lg px-2 py-1 focus:outline-none focus:border-term-text uppercase appearance-none cursor-pointer"
            style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, var(--color-border) 50%), linear-gradient(135deg, var(--color-border) 50%, transparent 50%)', backgroundPosition: 'calc(100% - 15px) calc(1em + 0px), calc(100% - 10px) calc(1em + 0px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat', paddingRight: '30px' }}
          >
            <option value="thinktronic">THINKTRONIC</option>
            <option value="amber">AMBER</option>
            <option value="blue">BLUE</option>
            <option value="syndicate">SYNDICATE</option>
          </select>
          <label className="flex items-center gap-2 text-term-text font-bold text-lg uppercase cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isCrtEnabled}
              onChange={(e) => setIsCrtEnabled(e.target.checked)}
              className="term-checkbox"
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
            onClick={() => setIsDrawerOpen(false)}
            className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1 font-bold transition-colors text-xl"
          >
            [ X ]
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tools.map(tool => (
            <button
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
        {activeTool === 'teleporter' && <TeleporterTool />}
        {activeTool === 'about' && <AboutTool />}
      </main>

      {isCrtEnabled && <div className="crt-filter" aria-hidden="true" />}

    </div>
  );
}
