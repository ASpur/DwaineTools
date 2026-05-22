import { useState, useMemo } from 'react';

const CopyAllButton = ({ scripts, label = "[ COPY ALL ]", deleteOnly = false }) => {
  const [copiedChunk, setCopiedChunk] = useState(null);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);

  const chunks = useMemo(() => {
    const chunkList = [];
    let currentChunk = [];

    const flushChunk = () => {
      if (currentChunk.length > 0) {
        chunkList.push(currentChunk.join(' ^ '));
        currentChunk = [];
      }
    };

    const addToChunk = (commands) => {
      if (currentChunk.length + commands.length > 16) {
        flushChunk();
      }
      currentChunk.push(...commands);
    };

    const filenames = scripts.map(s => {
      const match = s.code.match(/echo "(.*?)" \^ (.*)/);
      return match ? match[2].trim() : null;
    }).filter(Boolean);

    filenames.forEach(f => addToChunk([`rm ${f}`]));
    
    // Add unset right after RM commands
    addToChunk(["unset arg0 arg1 arg2 arg3 tempx tempy tx ty tempx1 tempy1 tx1 ty1 tempx2 tempy2 tx2 ty2"]);

    if (!deleteOnly) {
      scripts.forEach(s => {
        const match = s.code.match(/echo "(.*?)" \^ (.*)/);
        if (match) {
          addToChunk([`eval '${match[1].trim()}' to _t`, `eval _t`, match[2].trim()]);
        } else {
          const parts = s.code.split('^').map(p => p.trim());
          addToChunk(parts);
        }
      });
    }

    flushChunk();
    return chunkList;
  }, [scripts, deleteOnly]);

  const safeChunkIndex = chunks.length > 0
    ? Math.min(currentChunkIndex, chunks.length - 1)
    : 0;

  const handleCopyAll = () => {
    if (chunks.length === 0 || copiedChunk !== null) return;

    const textArea = document.createElement("textarea");
    textArea.value = chunks[safeChunkIndex];
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);

    setCopiedChunk(safeChunkIndex);
    
    if (safeChunkIndex < chunks.length - 1) {
      setCurrentChunkIndex(prev => prev + 1);
    } else {
      setCurrentChunkIndex(0);
    }

    setTimeout(() => {
      setCopiedChunk(null);
    }, 1500);
  };

  const displayLabel = chunks.length > 1
    ? label.replace(/\s*\]$/, ` ${safeChunkIndex + 1}/${chunks.length} ]`)
    : label;

  const copiedMessage = chunks.length > 1 && copiedChunk !== null
    ? `[ COPIED ${copiedChunk + 1}/${chunks.length} ]` 
    : '[ COPIED ]';
  const buttonHint = chunks.length > 1
    ? `Copies command chunk ${safeChunkIndex + 1} of ${chunks.length}`
    : undefined;

  return (
    <div className="relative inline-flex z-10">
      {copiedChunk !== null && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-term-text opacity-90 font-bold bg-term-bg px-2 border border-term-border animate-float-up pointer-events-none whitespace-nowrap z-20 shadow-md shadow-term-bg">
          {copiedMessage}
        </div>
      )}
      <button
        type="button"
        onClick={handleCopyAll}
        disabled={chunks.length === 0 || copiedChunk !== null}
        title={buttonHint}
        aria-label={buttonHint || label.replace(/\[|\]/g, '').trim()}
        className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1 uppercase font-bold text-sm transition-colors whitespace-nowrap bg-term-bg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {displayLabel}
      </button>
    </div>
  );
};

export default CopyAllButton;
