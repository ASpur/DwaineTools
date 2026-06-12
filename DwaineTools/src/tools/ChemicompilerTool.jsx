import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  ChemfuckVM,
  MACHINE_TYPES,
  T0C,
  beakerTotalVolume,
  createBeaker,
} from '../utils/chemfuck';

const INSTRUCTION_REFERENCE = [
  ['>', 'Move data pointer right (wraps at 1024)'],
  ['<', 'Move data pointer left (wraps at 0)'],
  ['+', 'Increment cell at pointer'],
  ['-', 'Decrement cell at pointer'],
  ['.', 'Append cell (as character code) to the text buffer'],
  ['{', 'Store sx into cell'],
  ['}', 'Load cell into sx'],
  ['(', 'Store tx into cell'],
  [')', 'Load cell into tx'],
  ['^', 'Store ax into cell'],
  ["'", 'Load cell into ax'],
  ['[', 'Jump past matching ] if cell is 0'],
  [']', 'Jump back to matching [ if cell is not 0'],
  ['T', 'ax = temperature of reservoir sx (°C, rounded)'],
  ['A or ,', 'ax = total volume of reservoir sx (rounded)'],
  ['V', 'ax = volume of reagent #cell in reservoir sx'],
  ['N', 'ax = number of reagents in reservoir sx'],
  ['$', 'Heat reservoir sx toward (ax - tx) °C, 25K per tick'],
  ['@', 'Transfer ax units from reservoir sx to tx'],
  ['#', 'Transfer ax units of reagent #cell from sx to tx'],
  ['*', 'Wait for the next reaction tick'],
  ['~', 'Mark program as read-protected (no runtime effect)'],
];

const PRESETS = [
  { name: 'Transfer 10u: res 1 to res 2', code: "+}+)++++++++'@" },
  { name: 'Heat res 1 to 100 deg C', code: "+}>++++++++++[>++++++++++<-]>'$" },
  { name: 'Make a 5u pill from res 1', code: "+}>+++++++++++)>+++++'@" },
  { name: 'Say HI', code: '>++++++++[<+++++++++>-]<.+.' },
];

const DEFAULT_LOADOUT = {
  1: { maxVolume: 50, temperatureC: 20, contents: [{ id: 'water', volume: 50 }] },
  2: { maxVolume: 50, temperatureC: 20, contents: [] },
};

const STORAGE_KEYS = {
  code: 'dwaine_chemfuck_code',
  machine: 'dwaine_chemfuck_machine',
  loadout: 'dwaine_chemfuck_loadout',
};

const loadStored = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

const formatVolume = (volume) => {
  const rounded = Math.round(volume * 100) / 100;
  return `${rounded}u`;
};

const formatTempC = (kelvin) => `${Math.round((kelvin - T0C) * 10) / 10}°C`;

const describeContents = (contents) =>
  contents.length === 0
    ? 'empty'
    : contents.map((r) => `${r.id} ${formatVolume(r.volume)}`).join(', ');

const buildVM = (machineId, loadout) => {
  const vm = new ChemfuckVM({ maxReservoir: MACHINE_TYPES[machineId].maxReservoir });
  for (const [slot, spec] of Object.entries(loadout)) {
    if (!spec || Number(slot) > vm.maxReservoir) continue;
    vm.setReservoir(
      Number(slot),
      createBeaker({
        maxVolume: spec.maxVolume,
        temperature: T0C + Number(spec.temperatureC || 0),
        contents: spec.contents,
      })
    );
  }
  return vm;
};

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

export default function ChemicompilerTool() {
  const [code, setCode] = useState(() => localStorage.getItem(STORAGE_KEYS.code) ?? PRESETS[0].code);
  const [machineId, setMachineId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.machine);
    return MACHINE_TYPES[saved] ? saved : 'stationary';
  });
  const [loadout, setLoadout] = useState(() => loadStored(STORAGE_KEYS.loadout, DEFAULT_LOADOUT));
  const [showReference, setShowReference] = useState(false);
  const [, bump] = useReducer((c) => c + 1, 0);

  // The VM is a mutable instance; handlers mutate it and bump() forces a re-render.
  const [vm, setVm] = useState(() => {
    const initial = buildVM(machineId, loadout);
    initial.loadProgram(code);
    return initial;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.code, code);
  }, [code]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.machine, machineId);
  }, [machineId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.loadout, JSON.stringify(loadout));
  }, [loadout]);

  const rebuildVM = (nextMachineId = machineId, nextLoadout = loadout, nextCode = code) => {
    const next = buildVM(nextMachineId, nextLoadout);
    next.loadProgram(nextCode);
    setVm(next);
    return next;
  };

  const handleRun = () => {
    let target = vm;
    if (!vm.running) {
      target = rebuildVM();
      target.start();
    }
    target.run();
    bump();
  };

  const handleTick = () => {
    let target = vm;
    if (!vm.running) {
      if (vm.haltReason) target = rebuildVM();
      target.start();
    }
    target.tick();
    bump();
  };

  const handleStep = () => {
    let target = vm;
    if (!vm.running) {
      if (vm.haltReason) target = rebuildVM();
      target.start();
    }
    target.step();
    bump();
  };

  const handleReset = () => rebuildVM();

  const handleCodeChange = (value) => {
    setCode(value);
    if (!vm.running) {
      vm.loadProgram(value);
    }
    bump();
  };

  const handleMachineChange = (id) => {
    setMachineId(id);
    rebuildVM(id, loadout);
  };

  const updateLoadout = (next) => {
    setLoadout(next);
    if (!vm.running) rebuildVM(machineId, next);
  };

  const updateSlot = (slot, spec) => updateLoadout({ ...loadout, [slot]: spec });

  const machine = MACHINE_TYPES[machineId];
  const slots = useMemo(
    () => Array.from({ length: machine.maxReservoir }, (_, i) => i + 1),
    [machine.maxReservoir]
  );

  const memoryWindowStart = Math.max(0, Math.min(vm.dp - 4, 1024 - 12));
  const memoryWindow = Array.from({ length: 12 }, (_, i) => memoryWindowStart + i);
  const nextOp = vm.ip < vm.prog.length ? vm.prog[vm.ip] : null;
  const recentEvents = vm.events.slice(-100);

  return (
    <div className="p-4 md:p-8 selection:bg-term-hover selection:text-term-hover-text">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="mb-4 border-b-2 border-term-border pb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-4 uppercase tracking-wider">
            <span className="text-term-text opacity-90">{'>_'}</span>
            Chemicompiler Emulator
          </h2>
          <div className="flex gap-2">
            {Object.values(MACHINE_TYPES).map((m) => (
              <TermButton key={m.id} active={machineId === m.id} onClick={() => handleMachineChange(m.id)}>
                {m.label} [{m.maxReservoir}]
              </TermButton>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: code + execution */}
          <div className="space-y-6">
            <div className="border-2 border-term-border p-4">
              <SectionTitle>ChemFuck Source</SectionTitle>
              <div className="flex flex-wrap gap-2 mb-3">
                <select
                  value=""
                  onChange={(e) => {
                    const preset = PRESETS.find((p) => p.name === e.target.value);
                    if (preset) handleCodeChange(preset.code);
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
                <TermButton onClick={() => setShowReference(!showReference)} active={showReference}>
                  {showReference ? 'Hide' : 'Show'} Reference
                </TermButton>
              </div>
              <textarea
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                spellCheck={false}
                rows={6}
                className="w-full bg-term-bg text-term-text border border-term-border focus:border-term-text focus:outline-none p-3 font-mono text-lg resize-y"
                placeholder="ChemFuck program..."
              />
              <p className="text-term-text opacity-70 mt-1">
                {vm.prog.length} instructions{vm.isProtected ? ' · ~ read-protected' : ''} · non-token characters
                are ignored (careful: T A V N are instructions)
              </p>
              {showReference && (
                <table className="w-full mt-3 text-term-text">
                  <tbody>
                    {INSTRUCTION_REFERENCE.map(([op, desc]) => (
                      <tr key={op} className="border-b border-term-border/40">
                        <td className="font-mono font-bold py-1 pr-4 whitespace-nowrap">{op}</td>
                        <td className="py-1">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-2 border-term-border p-4">
              <SectionTitle>Execution</SectionTitle>
              <div className="flex flex-wrap gap-2 mb-4">
                <TermButton onClick={handleRun}>Run</TermButton>
                <TermButton onClick={handleTick}>Tick</TermButton>
                <TermButton onClick={handleStep}>Step</TermButton>
                <TermButton onClick={() => { vm.abort(); bump(); }} disabled={!vm.running}>
                  Abort
                </TermButton>
                <TermButton onClick={handleReset}>Reset</TermButton>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 text-center mb-4">
                {[
                  ['SX', vm.sx],
                  ['TX', vm.tx],
                  ['AX', vm.ax],
                  ['DP', vm.dp],
                  ['IP', vm.ip],
                  ['EXEC', vm.exec],
                  ['TICKS', vm.ticks],
                  ['EST', vm.ticks ? `${vm.ticks * 2}s` : '0s'],
                ].map(([label, value]) => (
                  <div key={label} className="border border-term-border p-2">
                    <div className="text-term-text opacity-70 uppercase">{label}</div>
                    <div className="text-term-text font-bold text-xl font-mono">{value}</div>
                  </div>
                ))}
              </div>
              <div className="text-term-text mb-3">
                STATUS:{' '}
                <span className="font-bold uppercase">
                  {vm.running
                    ? vm.awaitingReactionTick
                      ? 'Awaiting reaction tick'
                      : 'Running'
                    : vm.haltReason
                      ? `Halted (${vm.haltReason})`
                      : 'Idle'}
                </span>
                {nextOp !== null && (
                  <span className="ml-4">
                    NEXT OP: <span className="font-mono font-bold">{nextOp}</span>
                  </span>
                )}
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                {memoryWindow.map((addr) => (
                  <div
                    key={addr}
                    className={`border p-1 text-center font-mono ${
                      addr === vm.dp
                        ? 'bg-term-text text-term-bg border-term-text font-bold'
                        : 'border-term-border text-term-text'
                    }`}
                  >
                    <div className="text-xs opacity-70">{addr}</div>
                    <div>{vm.data[addr]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-2 border-term-border p-4">
              <SectionTitle>Output Log</SectionTitle>
              <div className="font-mono text-term-text max-h-64 overflow-y-auto space-y-1">
                {recentEvents.length === 0 && <div className="opacity-50">No output yet.</div>}
                {recentEvents.map((event, i) => (
                  <div key={i} className={event.type === 'error' ? 'bg-term-text text-term-bg px-1' : ''}>
                    {event.type === 'say' && <>SAYS: &quot;{event.text}&quot;</>}
                    {event.type === 'message' && <>* {event.text}</>}
                    {event.type === 'error' && <>ERR {event.code}: {event.text}</>}
                    {event.type === 'notification' && <>-- {event.text}</>}
                    {event.type === 'eject' && (
                      <>EJECT [{event.kind.toUpperCase()}]: {describeContents(event.contents)}</>
                    )}
                    {event.type === 'status' && <>-- {event.running ? 'Program started.' : 'Program stopped.'}</>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: reservoirs + ejected items */}
          <div className="space-y-6">
            <div className="border-2 border-term-border p-4">
              <SectionTitle>Reservoirs 1-{machine.maxReservoir}</SectionTitle>
              <p className="text-term-text opacity-70 mb-3">
                Targets 11 = pill (100u) · 12 = vial (5u) · 13 = floor. Edits apply on reset.
              </p>
              <div className="space-y-3">
                {slots.map((slot) => {
                  const live = vm.getReservoir(slot);
                  const spec = loadout[slot];
                  return (
                    <div key={slot} className="border border-term-border p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-bold text-term-text uppercase">
                          [{slot}]{' '}
                          {live
                            ? `${formatVolume(beakerTotalVolume(live))} / ${live.maxVolume}u · ${formatTempC(live.temperature)}`
                            : 'Empty'}
                        </span>
                        {spec ? (
                          <TermButton onClick={() => updateSlot(slot, null)}>Remove</TermButton>
                        ) : (
                          <TermButton
                            onClick={() => updateSlot(slot, { maxVolume: 50, temperatureC: 20, contents: [] })}
                          >
                            Load Beaker
                          </TermButton>
                        )}
                      </div>
                      {live && (
                        <div className="text-term-text font-mono mt-1">{describeContents(live.contents)}</div>
                      )}
                      {spec && (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2 flex-wrap items-center">
                            <label className="text-term-text uppercase">
                              Cap{' '}
                              <input
                                type="number"
                                value={spec.maxVolume}
                                onChange={(e) =>
                                  updateSlot(slot, { ...spec, maxVolume: Number(e.target.value) || 0 })
                                }
                                className="w-20 bg-term-bg text-term-text border border-term-border px-2 py-1 font-mono focus:outline-none focus:border-term-text"
                              />
                            </label>
                            <label className="text-term-text uppercase">
                              Temp °C{' '}
                              <input
                                type="number"
                                value={spec.temperatureC}
                                onChange={(e) =>
                                  updateSlot(slot, { ...spec, temperatureC: Number(e.target.value) || 0 })
                                }
                                className="w-20 bg-term-bg text-term-text border border-term-border px-2 py-1 font-mono focus:outline-none focus:border-term-text"
                              />
                            </label>
                            <TermButton
                              onClick={() =>
                                updateSlot(slot, {
                                  ...spec,
                                  contents: [...spec.contents, { id: 'reagent', volume: 10 }],
                                })
                              }
                            >
                              + Reagent
                            </TermButton>
                          </div>
                          {spec.contents.map((reagent, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <span className="text-term-text font-mono opacity-70">#{idx + 1}</span>
                              <input
                                type="text"
                                value={reagent.id}
                                onChange={(e) => {
                                  const contents = spec.contents.map((r, i) =>
                                    i === idx ? { ...r, id: e.target.value } : r
                                  );
                                  updateSlot(slot, { ...spec, contents });
                                }}
                                className="flex-1 min-w-0 bg-term-bg text-term-text border border-term-border px-2 py-1 font-mono focus:outline-none focus:border-term-text"
                              />
                              <input
                                type="number"
                                value={reagent.volume}
                                onChange={(e) => {
                                  const contents = spec.contents.map((r, i) =>
                                    i === idx ? { ...r, volume: Number(e.target.value) || 0 } : r
                                  );
                                  updateSlot(slot, { ...spec, contents });
                                }}
                                className="w-20 bg-term-bg text-term-text border border-term-border px-2 py-1 font-mono focus:outline-none focus:border-term-text"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const contents = spec.contents.filter((_, i) => i !== idx);
                                  updateSlot(slot, { ...spec, contents });
                                }}
                                className="text-term-text font-bold border border-term-border px-2 py-1 hover:bg-term-hover hover:text-term-hover-text"
                                aria-label={`Remove reagent ${idx + 1}`}
                              >
                                X
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-2 border-term-border p-4">
              <SectionTitle>Ejected Items</SectionTitle>
              {vm.artifacts.length === 0 ? (
                <div className="text-term-text opacity-50 font-mono">Nothing ejected yet.</div>
              ) : (
                <div className="space-y-2 font-mono text-term-text">
                  {vm.artifacts.map((item, i) => (
                    <div key={i} className="border border-term-border p-2">
                      <span className="font-bold uppercase">[{item.kind}]</span> {describeContents(item.contents)} ·{' '}
                      {formatTempC(item.temperature)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
