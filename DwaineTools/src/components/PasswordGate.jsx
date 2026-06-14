import { useState } from 'react';

const PASSWORD = 'dwainiscool';
const STORAGE_KEY = 'dwaine_unlocked';

export function isUnlocked() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export default function PasswordGate({ onUnlock }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  const attempt = () => {
    if (value === PASSWORD) {
      localStorage.setItem(STORAGE_KEY, 'true');
      onUnlock();
    } else {
      setError(true);
      setValue('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-term-bg">
      <div className="border border-term-border p-8 flex flex-col gap-4 w-72">
        <div className="text-term-text text-center font-mono text-lg tracking-widest">
          DWAINE TOOLS
        </div>
        <div className="text-term-text font-mono text-sm text-center opacity-60">
          ENTER ACCESS CODE
        </div>
        <input
          autoFocus
          type="password"
          value={value}
          onChange={e => { setValue(e.target.value); setError(false); }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          className="bg-term-bg border border-term-border text-term-text font-mono px-3 py-2 outline-none focus:border-term-text w-full"
        />
        {error && (
          <div className="text-term-text font-mono text-xs text-center opacity-60">
            ACCESS DENIED
          </div>
        )}
        <button
          onClick={attempt}
          className="border border-term-border text-term-text font-mono py-2 hover:bg-term-hover hover:text-term-hover-text transition-colors"
        >
          UNLOCK
        </button>
      </div>
    </div>
  );
}
