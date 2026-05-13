import React, { useState, useMemo, useEffect } from 'react';
import { Copy, Check, Terminal, Calculator, Settings, MapPin, Plus, Trash2, ChevronRight, ChevronDown, Map, X, ArrowRight, ArrowLeft, Edit2 } from 'lucide-react';

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
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-sm transition-all hover:border-slate-600">
      <div
        className="flex justify-between items-center bg-slate-800 px-4 py-2 hover:bg-slate-750 transition-colors cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 flex-1 py-1">
          {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          <span className="font-mono text-sm text-blue-300 font-semibold select-none">
            {script.name}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors ml-4 z-10 relative"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      {isOpen && (
        <div className="p-4 overflow-x-auto border-t border-slate-700 bg-slate-900/50">
          <pre className="text-sm font-mono text-slate-300 break-all whitespace-pre-wrap">
            {script.code}
          </pre>
        </div>
      )}
    </div>
  );
};

const NumberInput = ({ label, name, value, onChange }) => (
  <div className="flex flex-col">
    <label className="text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">{label}</label>
    <input
      type="number"
      name={name}
      value={value}
      onChange={onChange}
      className="bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
    />
  </div>
);

export default function App() {
  const defaultInputs = {
    teleporterNumber: '1',
    stationZ: '',
    tx1: '50',
    ty1: '50',
    rx1: '',
    ry1: '',
    rx2: '',
    ry2: '',
  };

  const defaultSession = {
    id: 'default',
    name: 'Default Map',
    waypoints: []
  };

  // 1. Global Inputs (Persistent across all map sessions)
  const [inputs, setInputs] = useState(() => {
    try {
      const saved = localStorage.getItem('dwaine_global_inputs');
      return saved ? JSON.parse(saved) : defaultInputs;
    } catch {
      return defaultInputs;
    }
  });

  // 2. Map Sessions (Contains only session-specific waypoints)
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('dwaine_sessions');
      return saved ? JSON.parse(saved) : [defaultSession];
    } catch {
      return [defaultSession];
    }
  });

  // 3. Active Session Tracking
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const saved = localStorage.getItem('dwaine_active_session');
    return saved ? saved : 'default';
  });

  const [activePhase, setActivePhase] = useState(1);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isRenamingSession, setIsRenamingSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [newWp, setNewWp] = useState({ name: '', x: '', y: '' });

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('dwaine_global_inputs', JSON.stringify(inputs));
  }, [inputs]);

  useEffect(() => {
    localStorage.setItem('dwaine_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('dwaine_active_session', activeSessionId);
  }, [activeSessionId]);

  // Derive data for UI
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const waypoints = activeSession.waypoints;

  const handleCreateSession = () => {
    if (!newSessionName.trim()) return;
    const newSession = {
      id: Date.now().toString(),
      name: newSessionName.trim(),
      waypoints: []
    };
    setSessions([...sessions, newSession]);
    setActiveSessionId(newSession.id);
    setNewSessionName('');
    setIsCreatingSession(false);
  };

  const startRenaming = () => {
    setRenameValue(activeSession.name);
    setIsRenamingSession(true);
  };

  const handleRenameSession = () => {
    if (!renameValue.trim()) return;
    setSessions(prev => prev.map(s =>
      s.id === activeSessionId ? { ...s, name: renameValue.trim() } : s
    ));
    setIsRenamingSession(false);
  };

  const handleDeleteSession = () => {
    if (sessions.length <= 1) return;
    const updatedSessions = sessions.filter(s => s.id !== activeSessionId);
    setSessions(updatedSessions);
    setActiveSessionId(updatedSessions[0].id);
  };

  // Global Input Handler
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleAddWaypoint = () => {
    if (!newWp.name || !newWp.x || !newWp.y) return;
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, waypoints: [...s.waypoints, { ...newWp, id: Date.now() }] };
      }
      return s;
    }));
    setNewWp({ name: '', x: '', y: '' });
  };

  const removeWaypoint = (id) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, waypoints: s.waypoints.filter(wp => wp.id !== id) };
      }
      return s;
    }));
  };

  // Derived calculations
  const calc = useMemo(() => {
    const requiredKeys = ['tx1', 'ty1', 'rx1', 'ry1', 'rx2', 'ry2'];
    const isReady = requiredKeys.every(key => inputs[key] !== '' && !isNaN(parseFloat(inputs[key])));

    const n = Object.keys(inputs).reduce((acc, key) => {
      acc[key] = parseFloat(inputs[key]) || 0;
      return acc;
    }, {});

    if (!isReady) {
      return { ...n, mx: '-', my: '-', xoff: '-', yoff: '-', tx2: '-', ty2: '-' };
    }

    const mx = n.rx2 - n.rx1;
    const my = n.ry2 - n.ry1;
    const xoff = (mx * n.tx1 - n.rx1) * -1;
    const yoff = (my * n.ty1 - n.ry1) * -1;
    const tx2 = n.tx1 + 1;
    const ty2 = n.ty1 + 1;

    return { ...n, mx, my, xoff, yoff, tx2, ty2 };
  }, [inputs]);

  // Script Generator Function
  const generateScript = (rawScript, scriptName) => {
    const subbed = rawScript
      .replace(/%xoff%/g, calc.xoff)
      .replace(/%mx%/g, calc.mx)
      .replace(/%yoff%/g, calc.yoff)
      .replace(/%my%/g, calc.my)
      .replace(/%tpnumber%/g, calc.teleporterNumber)
      .replace(/%stationZ%/g, calc.stationZ);

    return `echo "${subbed}" ^ ${scriptName}`;
  };

  // The raw templates
  const templates = {
    set: "#!|neval $arg0 %xoff% - to tempx|neval $tempx %mx% / to tx|neval $arg1 %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty $arg2|necho Setting to $tx $ty $arg2",
    send: "#!|nset $arg0 $arg1 %stationZ%|nteleman -p %tpnumber% send",
    get: "#!|nset $arg0 $arg1 %stationZ%|nteleman -p %tpnumber% receive",
    relay: "#!|neval $arg0 %xoff% - to tempx1|neval $tempx1 %mx% / to tx1|neval $arg1 %yoff% - to tempy1|neval $tempy1 %my% / to ty1|neval $arg2 %xoff% - to tempx2|neval $tempx2 %mx% / to tx2|neval $arg3 %yoff% - to tempy2|neval $tempy2 %my% / to ty2|nteleman -p %tpnumber% relay $tx1 $ty1 %stationZ% $tx2 $ty2 %stationZ%"
  };

  const baseScripts = [
    { id: 'set', name: 'set', code: generateScript(templates.set, "set") },
    { id: 'send', name: 'send', code: generateScript(templates.send, "send") },
    { id: 'get', name: 'get', code: generateScript(templates.get, "get") },
    { id: 'relay', name: 'relay', code: generateScript(templates.relay, "relay") }
  ];

  const waypointScripts = waypoints.flatMap(wp => {
    const safeName = wp.name.replace(/\s+/g, '');
    const sendToRaw = `#!|neval ${wp.x} %xoff% - to tempx|neval $tempx %mx% / to tx|neval ${wp.y} %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty %stationZ%|nteleman -p %tpnumber% send`;
    const getFromRaw = `#!|neval ${wp.x} %xoff% - to tempx|neval $tempx %mx% / to tx|neval ${wp.y} %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty %stationZ%|nteleman -p %tpnumber% receive`;
    const relayToRaw = `#!|neval $arg0 %xoff% - to tempx1|neval $tempx1 %mx% / to tx1|neval $arg1 %yoff% - to tempy1|neval $tempy1 %my% / to ty1|neval ${wp.x} %xoff% - to tempx2|neval $tempx2 %mx% / to tx2|neval ${wp.y} %yoff% - to tempy2|neval $tempy2 %my% / to ty2|nteleman -p %tpnumber% relay $tx1 $ty1 %stationZ% $tx2 $ty2 %stationZ%`;

    return [
      { id: `sendTo${safeName}`, name: `sendTo${safeName}`, code: generateScript(sendToRaw, `sendTo${safeName}`) },
      { id: `getFrom${safeName}`, name: `getFrom${safeName}`, code: generateScript(getFromRaw, `getFrom${safeName}`) },
      { id: `relayTo${safeName}`, name: `relayTo${safeName}`, code: generateScript(relayToRaw, `relayTo${safeName}`) }
    ];
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">

        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
            <Terminal className="text-blue-500 w-8 h-8" />
            Teleporter Script Generator
          </h1>
          <p className="text-slate-400 mt-2">Configure variables and waypoints to dynamically generate DWAINE scripts.</p>
        </header>

        {/* Session Manager Panel */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-lg flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Map className="text-blue-400 w-5 h-5" />
            <span className="font-semibold text-slate-200 whitespace-nowrap">Current Map:</span>
            {isCreatingSession ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newSessionName}
                  onChange={e => setNewSessionName(e.target.value)}
                  placeholder="Map Name..."
                  className="bg-slate-900 border border-slate-700 text-slate-100 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full md:w-auto"
                  onKeyDown={e => e.key === 'Enter' && handleCreateSession()}
                />
                <button onClick={handleCreateSession} className="text-emerald-400 hover:bg-slate-700 p-1.5 rounded transition-colors">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setIsCreatingSession(false)} className="text-slate-400 hover:bg-slate-700 p-1.5 rounded transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : isRenamingSession ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-100 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 w-full md:w-auto"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameSession();
                    if (e.key === 'Escape') setIsRenamingSession(false);
                  }}
                />
                <button onClick={handleRenameSession} className="text-emerald-400 hover:bg-slate-700 p-1.5 rounded transition-colors">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setIsRenamingSession(false)} className="text-slate-400 hover:bg-slate-700 p-1.5 rounded transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <select
                value={activeSessionId}
                onChange={(e) => setActiveSessionId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] max-w-xs"
              >
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>

          {!isCreatingSession && !isRenamingSession && (
            <div className="flex items-center gap-2 w-full md:w-auto justify-end">
              <button
                onClick={() => setIsCreatingSession(true)}
                className="flex items-center gap-1.5 text-sm bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> New Map
              </button>
              <button
                onClick={startRenaming}
                className="flex items-center gap-1.5 text-sm bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" /> Rename
              </button>
              {sessions.length > 1 && (
                <button
                  onClick={handleDeleteSession}
                  className="flex items-center gap-1.5 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              )}
            </div>
          )}
        </div>

        {/* Phase Steps Indicator */}
        <div className="flex items-center justify-center mb-6 mt-4">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 transition-colors ${activePhase === 1 ? 'text-blue-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${activePhase === 1 ? 'bg-blue-600/20 border-2 border-blue-500' : 'bg-slate-800 border-2 border-slate-700'}`}>1</div>
              <span className="font-semibold hidden sm:inline">Configuration</span>
            </div>
            <div className="w-16 h-px bg-slate-700"></div>
            <div className={`flex items-center gap-2 transition-colors ${activePhase === 2 ? 'text-purple-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${activePhase === 2 ? 'bg-purple-600/20 border-2 border-purple-500' : 'bg-slate-800 border-2 border-slate-700'}`}>2</div>
              <span className="font-semibold hidden sm:inline">Waypoints & Scripts</span>
            </div>
          </div>
        </div>

        <div>
          {activePhase === 1 ? (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Input Variables Panel */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg">
                  <div className="flex items-center gap-2 mb-4 text-lg font-semibold text-white">
                    <Settings className="w-5 h-5 text-blue-400" />
                    <h2>Configuration Variables</h2>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2 mb-3">General Settings</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <NumberInput label="Teleporter Number" name="teleporterNumber" value={inputs.teleporterNumber} onChange={handleInputChange} />
                        <NumberInput label="Station Z" name="stationZ" value={inputs.stationZ} onChange={handleInputChange} />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2 mb-3">Initial Coordinates</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <NumberInput label="TX 1" name="tx1" value={inputs.tx1} onChange={handleInputChange} />
                        <NumberInput label="TY 1" name="ty1" value={inputs.ty1} onChange={handleInputChange} />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-slate-300 border-b border-slate-700 pb-2 mb-3">Result Coordinates</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <NumberInput label="RX 1" name="rx1" value={inputs.rx1} onChange={handleInputChange} />
                        <NumberInput label="RY 1" name="ry1" value={inputs.ry1} onChange={handleInputChange} />
                        <NumberInput label="RX 2" name="rx2" value={inputs.rx2} onChange={handleInputChange} />
                        <NumberInput label="RY 2" name="ry2" value={inputs.ry2} onChange={handleInputChange} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Derived Variables Panel */}
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 h-fit">
                  <div className="flex items-center gap-2 mb-4 text-lg font-semibold text-white">
                    <Calculator className="w-5 h-5 text-emerald-400" />
                    <h2>Derived Outputs</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-800">
                      <div className="text-xs text-slate-400 font-mono">mx (Multiplier X)</div>
                      <div className="text-lg text-emerald-400 font-semibold font-mono">{calc.mx}</div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-800">
                      <div className="text-xs text-slate-400 font-mono">my (Multiplier Y)</div>
                      <div className="text-lg text-emerald-400 font-semibold font-mono">{calc.my}</div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-800">
                      <div className="text-xs text-slate-400 font-mono">xoff (X Offset)</div>
                      <div className="text-lg text-emerald-400 font-semibold font-mono">{calc.xoff}</div>
                    </div>
                    <div className="bg-slate-900 rounded-lg p-3 border border-slate-800">
                      <div className="text-xs text-slate-400 font-mono">yoff (Y Offset)</div>
                      <div className="text-lg text-emerald-400 font-semibold font-mono">{calc.yoff}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* One-Time Setup Panel */}
              <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5">
                <div className="flex items-center gap-2 mb-4 text-lg font-semibold text-white">
                  <Terminal className="w-5 h-5 text-slate-400" />
                  <h2>One-Time Setup Scripts</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ScriptItem
                    script={{
                      id: 'copy_teleman',
                      name: 'copy_teleman',
                      code: 'cp /sys/srv/teleman .'
                    }}
                  />
                  <ScriptItem
                    script={{
                      id: 'login_packet_setup',
                      name: 'setup_login_packet',
                      code: 'echo registered=A|nassignment=A|naccess=34 ^ /mnt/term/loginpacket\n\nfile_send'
                    }}
                  />
                </div>
              </div>

              {/* Phase 1 Footer Actions */}
              <div className="flex flex-col-reverse sm:flex-row justify-end items-center gap-4 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setActivePhase(2)}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-semibold transition-all shadow-lg shadow-blue-900/20 w-full sm:w-auto"
                >
                  Continue to Waypoints <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center mb-2">
                <button
                  onClick={() => setActivePhase(1)}
                  className="flex items-center gap-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Configuration
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Waypoints Column */}
                <div className="lg:col-span-5">
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-lg">
                    <div className="flex items-center gap-2 mb-4 text-lg font-semibold text-white">
                      <MapPin className="w-5 h-5 text-purple-400" />
                      <h2>Waypoints</h2>
                    </div>

                    <div className="flex items-end gap-3 mb-4">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Medbay"
                          value={newWp.name}
                          onChange={e => setNewWp({ ...newWp, name: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">X</label>
                        <input
                          type="number"
                          value={newWp.x}
                          onChange={e => setNewWp({ ...newWp, x: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div className="w-24">
                        <label className="text-xs font-semibold text-slate-400 mb-1 block uppercase tracking-wider">Y</label>
                        <input
                          type="number"
                          value={newWp.y}
                          onChange={e => setNewWp({ ...newWp, y: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <button
                        onClick={handleAddWaypoint}
                        disabled={!newWp.name || !newWp.x || !newWp.y}
                        className="bg-purple-600 hover:bg-purple-500 disabled:bg-slate-700 disabled:text-slate-500 transition-colors p-2 rounded-lg text-white font-medium flex items-center justify-center h-[42px] w-[42px]"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      {waypoints.map(wp => (
                        <div key={wp.id} className="flex justify-between items-center bg-slate-900 p-3 rounded-lg border border-slate-700">
                          <span className="font-medium text-slate-200">{wp.name}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-mono text-slate-400">
                              X: <span className="text-purple-300">{wp.x}</span> | Y: <span className="text-purple-300">{wp.y}</span>
                            </span>
                            <button
                              onClick={() => removeWaypoint(wp.id)}
                              className="text-slate-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {waypoints.length === 0 && (
                        <div className="text-sm text-slate-500 italic text-center py-4 border border-dashed border-slate-700 rounded-lg">
                          No waypoints added yet. Add one above to generate quick-jump scripts.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Generated Scripts Section */}
                <div className="lg:col-span-7">
                  <h2 className="text-xl font-semibold text-white px-1 mb-4 flex items-center gap-2">
                    Generated Scripts
                  </h2>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">Base System Scripts</h3>
                      <div className="space-y-3">
                        {baseScripts.map(script => (
                          <ScriptItem key={script.id} script={script} />
                        ))}
                      </div>
                    </div>

                    {waypointScripts.length > 0 && (
                      <div>
                        <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider text-purple-400">Waypoint Quick-Scripts</h3>
                        <div className="space-y-3">
                          {waypointScripts.map(script => (
                            <ScriptItem key={script.id} script={script} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}