import { useState } from 'react';

const ScriptItem = ({ script }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    const textArea = document.createElement("textarea");
    textArea.value = script.code;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);

    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-term-bg border border-term-border mb-4 transition-colors hover:border-term-text">
      <div
        className="flex justify-between items-center px-4 py-2 hover:bg-term-dim transition-colors cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        style={{ borderBottom: isOpen ? '1px solid var(--color-border)' : 'none' }}
      >
        <div className="flex items-center gap-3 flex-1 py-1">
          <span className="text-term-text font-bold text-xl">{isOpen ? '[-]' : '[+]'}</span>
          <span className="text-xl text-term-text opacity-90 font-bold select-none uppercase">
            {script.name}
          </span>
        </div>
        <div className="relative inline-flex z-10 ml-4">
          {copied && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-term-text opacity-90 font-bold bg-term-bg px-2 border border-term-border animate-float-up pointer-events-none whitespace-nowrap z-20 shadow-md shadow-term-bg">
              [ COPIED ]
            </div>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 text-sm font-bold px-3 py-1 bg-term-bg border border-term-border hover:bg-term-hover hover:text-term-hover-text text-term-text transition-colors uppercase"
          >
            [ COPY ]
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="p-4 overflow-x-auto bg-term-bg">
          <pre className="text-xl text-term-text break-all whitespace-pre-wrap leading-relaxed">
            {script.code}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ScriptItem;
