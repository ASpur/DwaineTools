import { useAppStore } from '../store';

export default function Header() {
  const { 
    appTitle, 
    isDrawerOpen, 
    setIsDrawerOpen,
    theme, 
    switchTheme, 
    fontMode, 
    setFontMode, 
    isCrtEnabled, 
    setIsCrtEnabled,
    isSyndicateUnlocked, 
    isRainbowUnlocked 
  } = useAppStore();

  return (
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
  );
}
