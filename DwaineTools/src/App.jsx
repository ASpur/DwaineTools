import { useState, useEffect } from 'react';
import TeleporterTool from './tools/TeleporterTool';

export default function App() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('dwaine_theme') || 'thinktronic';
  });

  const [activeTool, setActiveTool] = useState(() => {
    return localStorage.getItem('dwaine_active_tool') || 'teleporter';
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dwaine_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('dwaine_active_tool', activeTool);
  }, [activeTool]);

  const tools = [
    { id: 'teleporter', name: 'Teleporter Generator' },
    // Future tools can be added here
  ];

  return (
    <div className="min-h-screen flex flex-col bg-term-bg selection:bg-term-hover selection:text-term-hover-text relative overflow-x-hidden">
      
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

        <div className="flex items-center gap-2">
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
      </main>

    </div>
  );
}
