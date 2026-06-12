import { useEffect, useMemo, useState } from 'react';
import { compile } from '../utils/chemscript';
import { useAppStore } from '../store';

const PRESETS = [
  {
    name: 'Drain reservoir 1 down to 40u',
    code: `// Cheap loop condition: difference instead of comparison
while (volume(1) - 40) {
  transfer(1, 2, 1);
}
say("DONE");`,
  },
  {
    name: 'Heat and make a pill',
    code: `heat(1, 100);
pill(1, 5);`,
  },
  {
    name: 'Fill five vials',
    code: `let n = 0;
while (n < 5) {
  vial(1, 5);
  n = n + 1;
}`,
  },
  {
    name: 'Sensor branch',
    code: `if (temp(1) >= 100) {
  say("HOT");
} else {
  say("COLD");
}`,
  },
  {
    name: 'Arithmetic demo',
    code: `let a = 6;
let b = 7;
let p = a * b;
let big = p > 40;
if (big) { say("BIG"); }`,
  },
];

const REFERENCE = [
  ['let x = expr;', 'Declare a variable (non-negative integers)'],
  ['x = expr;', 'Assign'],
  ['while (expr) { }', 'Loop while expr != 0'],
  ['if (expr) { } else { }', 'Branch on expr != 0'],
  ['+ - *', 'Arithmetic (* costs ~25·a·b ops at runtime; constants fold)'],
  ['== != < <= > >=', 'Comparisons, produce 0/1 (~70·min(a,b) ops; no chaining)'],
  ['transfer(src, tgt, amt)', 'Move amt units from reservoir src to tgt'],
  ['isolate(src, tgt, amt, i)', 'Move amt units of reagent #i only'],
  ['heat(res, degC)', 'Heat/cool reservoir toward degC (25K per tick)'],
  ['pill(res, amt)', 'Eject a pill holding up to 100u — a transfer to slot 11, the pill press'],
  ['vial(res, amt)', 'Eject a vial holding up to 5u — a transfer to slot 12, the vial printer'],
  ['drain(res, amt)', 'Dump onto the floor — a transfer to slot 13, the ejection drain'],
  ['waitReaction();', 'Wait for the next reaction tick'],
  ['temp(res)', 'Read temperature in °C (can be negative — beware in math!)'],
  ['volume(res)', 'Read total volume'],
  ['volumeOf(res, i)', 'Read volume of reagent #i'],
  ['reagentCount(res)', 'Read number of reagents'],
  ['say("text")', 'Speak through the machine'],
  ['// and /* */', 'Comments'],
];

const STORAGE_KEY = 'dwaine_chemscript_source';

const SectionTitle = ({ children }) => (
  <h3 className="text-xl font-bold uppercase tracking-wider text-term-text border-b border-term-border pb-1 mb-3">
    {children}
  </h3>
);

const TermButton = ({ onClick, children, disabled, active }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`px-3 py-2 font-bold uppercase border-2 transition-colors ${
      active
        ? 'bg-term-text text-term-bg border-term-text'
        : 'bg-term-bg text-term-text border-term-border hover:bg-term-hover hover:text-term-hover-text'
    } ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-term-bg hover:text-term-text' : ''}`}
  >
    {children}
  </button>
);

export default function ChemScriptTool() {
  const [source, setSource] = useState(() => localStorage.getItem(STORAGE_KEY) ?? PRESETS[0].code);
  const [showReference, setShowReference] = useState(false);
  const [copied, setCopied] = useState(false);
  const { setActiveTool } = useAppStore();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, source);
  }, [source]);

  const result = useMemo(() => compile(source), [source]);

  const handleCopy = async () => {
    if (!result.ok || !result.code) return;
    try {
      await navigator.clipboard.writeText(result.code);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = result.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSendToEmulator = () => {
    if (!result.ok) return;
    localStorage.setItem('dwaine_chemfuck_code', result.code);
    setActiveTool('chemicompiler');
  };

  return (
    <div className="p-4 md:p-8 selection:bg-term-hover selection:text-term-hover-text">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-4 border-b-2 border-term-border pb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-4 uppercase tracking-wider">
            <span className="text-term-text opacity-90">{'>_'}</span>
            ChemScript Compiler
          </h2>
          <TermButton onClick={() => setShowReference(!showReference)} active={showReference}>
            {showReference ? 'Hide' : 'Show'} Reference
          </TermButton>
        </div>

        {showReference && (
          <div className="border-2 border-term-border p-4">
            <SectionTitle>Language Reference</SectionTitle>
            <table className="w-full text-term-text">
              <tbody>
                {REFERENCE.map(([syntax, desc]) => (
                  <tr key={syntax} className="border-b border-term-border/40">
                    <td className="font-mono font-bold py-1 pr-4 whitespace-nowrap">{syntax}</td>
                    <td className="py-1">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-term-text opacity-70 mt-2">
              Values are non-negative integers; programs are limited to 50000 executed instructions per run.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border-2 border-term-border p-4">
            <SectionTitle>ChemScript Source</SectionTitle>
            <div className="flex flex-wrap gap-2 mb-3">
              <select
                value=""
                onChange={(e) => {
                  const preset = PRESETS.find((p) => p.name === e.target.value);
                  if (preset) setSource(preset.code);
                }}
                className="bg-term-bg text-term-text border-2 border-term-border px-2 py-2 font-bold uppercase focus:outline-none focus:border-term-text"
              >
                <option value="" disabled>
                  Load preset...
                </option>
                {PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
              rows={16}
              className="w-full bg-term-bg text-term-text border border-term-border focus:border-term-text focus:outline-none p-3 font-mono text-lg resize-y"
              placeholder="ChemScript source..."
            />
          </div>

          <div className="space-y-6">
            <div className="border-2 border-term-border p-4">
              <SectionTitle>Compiled ChemFuck</SectionTitle>
              {result.ok ? (
                <>
                  <div className="flex flex-wrap gap-2 mb-3 items-center">
                    <TermButton onClick={handleCopy} disabled={!result.code}>
                      {copied ? 'Copied!' : 'Copy'}
                    </TermButton>
                    <TermButton onClick={handleSendToEmulator} disabled={!result.code}>
                      Send to Emulator
                    </TermButton>
                    <span className="text-term-text opacity-70">
                      {result.stats.instructions} instructions · {result.stats.cellsUsed} cells
                    </span>
                  </div>
                  <pre className="font-mono text-term-text border border-term-border p-3 whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
                    {result.code || '(empty program)'}
                  </pre>
                </>
              ) : (
                <div className="font-mono space-y-1">
                  {result.errors.map((error, i) => (
                    <div key={i} className="bg-term-text text-term-bg px-2 py-1">
                      Line {error.line}, col {error.col}: {error.message}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-2 border-term-border p-4">
              <SectionTitle>Variables</SectionTitle>
              {result.ok && Object.keys(result.symbols).length > 0 ? (
                <div className="font-mono text-term-text">
                  {Object.entries(result.symbols).map(([name, cell]) => (
                    <div key={name}>
                      {name} → cell {cell}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-term-text opacity-50 font-mono">No top-level variables.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
