import { useAppStore } from '../store';

const tools = [
  { id: 'teleporter', name: 'Teleporter Generator' },
  { id: 'chemicompiler', name: 'Chemicompiler Emulator' },
  { id: 'chemscript', name: 'ChemScript Compiler' },
  { id: 'about', name: 'About' },
];

export default function Sidebar() {
  const { 
    isDrawerOpen, 
    setIsDrawerOpen, 
    activeTool, 
    setActiveTool, 
    setIsRingMessageOpen 
  } = useAppStore();

  const openRingMessage = () => {
    setIsDrawerOpen(false);
    setIsRingMessageOpen(true);
  };

  return (
    <>
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
    </>
  );
}
