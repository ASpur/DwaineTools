import { useState, useMemo, useEffect } from 'react';
import ScriptItem from '../components/ScriptItem';
import CopyAllButton from '../components/CopyAllButton';
import NumberInput from '../components/NumberInput';

export default function TeleporterTool() {
  const defaultInputs = {
    teleporterNumber: '0',
    stationZ: '',
    tx1: '50',
    ty1: '50',
    tx2: '51',
    ty2: '51',
    rx1: '',
    ry1: '',
    rx2: '',
    ry2: '',
    assumeOneTile: true,
  };

  const defaultSession = {
    id: 'default',
    name: 'Default Map',
    waypoints: []
  };

  const [inputs, setInputs] = useState(() => {
    try {
      const saved = localStorage.getItem('dwaine_global_inputs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.assumeOneTile === undefined) {
          parsed.assumeOneTile = true;
        }
        return parsed;
      }
      return defaultInputs;
    } catch {
      return defaultInputs;
    }
  });

  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('dwaine_sessions');
      return saved ? JSON.parse(saved) : [defaultSession];
    } catch {
      return [defaultSession];
    }
  });

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
  const [isAddingWp, setIsAddingWp] = useState(false);
  const [wpToDelete, setWpToDelete] = useState(null);
  const [editingWp, setEditingWp] = useState(null);

  useEffect(() => {
    localStorage.setItem('dwaine_global_inputs', JSON.stringify(inputs));
  }, [inputs]);

  useEffect(() => {
    localStorage.setItem('dwaine_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('dwaine_active_session', activeSessionId);
  }, [activeSessionId]);

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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInputs(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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

  const handleEditWaypoint = () => {
    if (!editingWp || !editingWp.name || !editingWp.x || !editingWp.y) return;
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          waypoints: s.waypoints.map(wp => wp.id === editingWp.id ? { ...editingWp } : wp)
        };
      }
      return s;
    }));
    setEditingWp(null);
  };

  const calc = useMemo(() => {
    const requiredKeys = ['tx1', 'ty1', 'rx1', 'ry1', 'rx2', 'ry2'];
    if (!inputs.assumeOneTile) {
      requiredKeys.push('tx2', 'ty2');
    }
    const isReady = requiredKeys.every(key => inputs[key] !== '' && !isNaN(parseFloat(inputs[key])));

    const n = Object.keys(inputs).reduce((acc, key) => {
      acc[key] = key === 'assumeOneTile' ? inputs[key] : (parseFloat(inputs[key]) || 0);
      return acc;
    }, {});

    if (!isReady) {
      return { ...n, mx: '-', my: '-', xoff: '-', yoff: '-', tx2: '-', ty2: '-' };
    }

    let tx2_val, ty2_val;
    if (n.assumeOneTile) {
      tx2_val = n.tx1 + 1;
      ty2_val = n.ty1 + 1;
    } else {
      tx2_val = n.tx2;
      ty2_val = n.ty2;
    }

    const dx = (tx2_val - n.tx1) || 1; // Fallback to 1 to prevent division by zero if they only moved one axis
    const dy = (ty2_val - n.ty1) || 1;

    const mx = (n.rx2 - n.rx1) / dx;
    const my = (n.ry2 - n.ry1) / dy;
    const xoff = (mx * n.tx1 - n.rx1) * -1;
    const yoff = (my * n.ty1 - n.ry1) * -1;

    return { ...n, mx, my, xoff, yoff, tx2: tx2_val, ty2: ty2_val };
  }, [inputs]);

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

  const templates = {
    set: "#!|neval $arg0 %xoff% - to tempx|neval $tempx %mx% / to tx|neval $arg1 %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty $arg2|necho Setting to $tx $ty $arg2",
    send: "#!|neval $arg0 %xoff% - to tempx|neval $tempx %mx% / to tx|neval $arg1 %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty %stationZ%|nteleman -p %tpnumber% send",
    get: "#!|neval $arg0 %xoff% - to tempx|neval $tempx %mx% / to tx|neval $arg1 %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty %stationZ%|nteleman -p %tpnumber% receive",
    relay: "#!|neval $arg0 %xoff% - to tempx1|neval $tempx1 %mx% / to tx1|neval $arg1 %yoff% - to tempy1|neval $tempy1 %my% / to ty1|neval $arg2 %xoff% - to tempx2|neval $tempx2 %mx% / to tx2|neval $arg3 %yoff% - to tempy2|neval $tempy2 %my% / to ty2|nteleman -p %tpnumber% relay $tx1 $ty1 %stationZ% $tx2 $ty2 %stationZ%"
  };

  const baseScripts = [
    { id: 'set', name: 'set', code: generateScript(templates.set, "set") },
    { id: 'send', name: 'send', code: generateScript(templates.send, "send") },
    { id: 'get', name: 'get', code: generateScript(templates.get, "get") },
    { id: 'relay', name: 'relay', code: generateScript(templates.relay, "relay") }
  ];

  const waypointGroups = waypoints.map(wp => {
    const safeName = wp.name.replace(/\s+/g, '');
    const sendToRaw = `#!|neval ${wp.x} %xoff% - to tempx|neval $tempx %mx% / to tx|neval ${wp.y} %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty %stationZ%|nteleman -p %tpnumber% send`;
    const getFromRaw = `#!|neval ${wp.x} %xoff% - to tempx|neval $tempx %mx% / to tx|neval ${wp.y} %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty %stationZ%|nteleman -p %tpnumber% receive`;
    const relayToRaw = `#!|neval $arg0 %xoff% - to tempx1|neval $tempx1 %mx% / to tx1|neval $arg1 %yoff% - to tempy1|neval $tempy1 %my% / to ty1|neval ${wp.x} %xoff% - to tempx2|neval $tempx2 %mx% / to tx2|neval ${wp.y} %yoff% - to tempy2|neval $tempy2 %my% / to ty2|nteleman -p %tpnumber% relay $tx1 $ty1 %stationZ% $tx2 $ty2 %stationZ%`;

    return {
      id: wp.id,
      name: wp.name,
      x: wp.x,
      y: wp.y,
      scripts: [
        { id: `sendTo${safeName}`, name: `sendTo${safeName}`, code: generateScript(sendToRaw, `sendTo${safeName}`) },
        { id: `getFrom${safeName}`, name: `getFrom${safeName}`, code: generateScript(getFromRaw, `getFrom${safeName}`) },
        { id: `relayTo${safeName}`, name: `relayTo${safeName}`, code: generateScript(relayToRaw, `relayTo${safeName}`) }
      ]
    };
  });

  const allScripts = [
    ...baseScripts,
    ...waypointGroups.flatMap(g => g.scripts)
  ];

  const isMxInvalid = calc.mx !== '-' && ![1, 2, 4].includes(calc.mx);
  const isMyInvalid = calc.my !== '-' && ![1, 2, 4].includes(calc.my);
  const isXoffInvalid = calc.xoff !== '-' && (calc.xoff < -100 || calc.xoff > 0 || !Number.isInteger(calc.xoff));
  const isYoffInvalid = calc.yoff !== '-' && (calc.yoff < -100 || calc.yoff > 0 || !Number.isInteger(calc.yoff));
  const hasWarning = isMxInvalid || isMyInvalid || isXoffInvalid || isYoffInvalid;

  return (
    <div className="p-4 md:p-8 selection:bg-term-hover selection:text-term-hover-text">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="mb-4 border-b-2 border-term-border pb-4">
          <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-4 uppercase tracking-wider">
            <span className="text-term-text opacity-90">{'>_'}</span>
            Teleporter Script Generator
          </h2>
          <p className="mt-2 text-xl text-term-text opacity-75 uppercase">Configure variables and waypoints to dynamically generate DWAINE scripts.</p>
        </div>
        {/* Session Manager Panel */}
        {activePhase === 2 && (
          <div className="border-2 border-term-border p-4 flex flex-col md:flex-row gap-4 justify-between items-center bg-term-bg">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <span className="font-bold text-xl whitespace-nowrap uppercase">MAP:</span>
              {isCreatingSession ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={newSessionName}
                    onChange={e => setNewSessionName(e.target.value)}
                    placeholder="NAME..."
                    className="bg-term-bg border border-term-border text-term-text px-3 py-1.5 text-lg focus:outline-none focus:border-term-text w-full md:w-auto uppercase placeholder-term-text/50"
                    onKeyDown={e => e.key === 'Enter' && handleCreateSession()}
                  />
                  <button onClick={handleCreateSession} className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg">
                    [ OK ]
                  </button>
                  <button onClick={() => setIsCreatingSession(false)} className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg">
                    [ X ]
                  </button>
                </div>
              ) : isRenamingSession ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    className="bg-term-bg border border-term-border text-term-text px-3 py-1.5 text-lg focus:outline-none focus:border-term-text w-full md:w-auto uppercase placeholder-term-text/50"
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRenameSession();
                      if (e.key === 'Escape') setIsRenamingSession(false);
                    }}
                  />
                  <button onClick={handleRenameSession} className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg">
                    [ OK ]
                  </button>
                  <button onClick={() => setIsRenamingSession(false)} className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg">
                    [ X ]
                  </button>
                </div>
              ) : (
                <select
                  value={activeSessionId}
                  onChange={(e) => setActiveSessionId(e.target.value)}
                  className="bg-term-bg border border-term-border text-term-text text-xl px-3 py-1.5 focus:outline-none focus:border-term-text min-w-[200px] max-w-xs uppercase appearance-none"
                  style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, var(--color-border) 50%), linear-gradient(135deg, var(--color-border) 50%, transparent 50%)', backgroundPosition: 'calc(100% - 20px) calc(1em + 2px), calc(100% - 15px) calc(1em + 2px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                >
                  {sessions.map(s => (
                    <option key={s.id} value={s.id} className="bg-term-bg text-term-text">{s.name}</option>
                  ))}
                </select>
              )}
            </div>

            {!isCreatingSession && !isRenamingSession && (
              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <button
                  onClick={() => setIsCreatingSession(true)}
                  className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg whitespace-nowrap"
                >
                  [ + NEW ]
                </button>
                <button
                  onClick={startRenaming}
                  className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg whitespace-nowrap"
                >
                  [ EDIT ]
                </button>
                {sessions.length > 1 && (
                  <button
                    onClick={handleDeleteSession}
                    className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg whitespace-nowrap"
                  >
                    [ DEL ]
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Phase Steps Indicator */}
        <div className="flex flex-col md:flex-row items-center justify-center my-4 gap-4">
          <div className={`text-2xl font-bold transition-colors ${activePhase === 1 ? 'text-term-text opacity-90' : 'text-term-text opacity-50'}`}>
            [ 1 ] CONFIGURATION
          </div>
          <div className="hidden md:block w-16 h-px bg-term-border opacity-70"></div>
          <div className={`text-2xl font-bold transition-colors ${activePhase === 2 ? 'text-term-text opacity-90' : 'text-term-text opacity-50'}`}>
            [ 2 ] WAYPOINTS & SCRIPTS
          </div>
        </div>

        <div>
          {activePhase === 1 ? (
            <div className="w-full space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* One-Time Setup Panel */}
                <div className="lg:col-span-4 border border-term-border p-6 bg-term-bg relative">
                  <div className="absolute -top-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text opacity-90">
                    [ ONE-TIME SETUP ]
                  </div>
                  <div className="grid grid-cols-1 gap-6 mt-4">
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
                    <ScriptItem
                      script={{
                        id: 'pdatest',
                        name: 'pda_listener_test',
                        code: `mount pr6_radio radio ^ rm -r /mnt/radio/1149 ^ mkdir /mnt/radio/1149 ^ rm pdatest ^ eval '#!|nwhile 1 ^ if $(grep -r -i message /mnt/radio/1149) # 0 gt ^ echo *** PDA PACKET RECEIVED *** ^ grep -r -i -h . /mnt/radio/1149 ^ echo *************************** ^ rm -r /mnt/radio/1149 ^ mkdir /mnt/radio/1149 ^ else ^ sleep 2' to _t ^ eval _t ^ pdatest`
                      }}
                    />
                  </div>
                </div>

                {/* Input Variables Panel */}
                <div className="lg:col-span-5 border border-term-border p-6 bg-term-bg relative">
                  <div className="absolute -top-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text opacity-90">
                    [ VARIABLES ]
                  </div>

                  <div className="space-y-8 mt-4">
                    <div>
                      <h3 className="text-xl font-bold border-b border-term-border opacity-70 pb-2 mb-4 uppercase">General Settings</h3>
                      <div className="grid grid-cols-2 gap-6 mb-4">
                        <NumberInput label="Teleporter Number" name="teleporterNumber" value={inputs.teleporterNumber} onChange={handleInputChange} />
                        <NumberInput label="Station Z" name="stationZ" value={inputs.stationZ} onChange={handleInputChange} />
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer group w-fit mt-4">
                        <div className="relative flex items-center justify-center w-6 h-6 bg-term-bg border border-term-border group-hover:border-term-text transition-colors">
                          <input
                            type="checkbox"
                            name="assumeOneTile"
                            checked={inputs.assumeOneTile}
                            onChange={handleInputChange}
                            className="absolute opacity-0 w-full h-full cursor-pointer"
                          />
                          {inputs.assumeOneTile && <span className="text-term-text font-bold text-lg leading-none">X</span>}
                        </div>
                        <span className="text-lg font-bold text-term-text uppercase tracking-wider group-hover:text-term-text opacity-90 transition-colors select-none">
                          Assume 1-Tile Jump for Test 2
                        </span>
                      </label>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold border-b border-term-border opacity-70 pb-2 mb-4 uppercase">Teleporter Coordinates (Test Points)</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <NumberInput label="TX 1" name="tx1" value={inputs.tx1} onChange={handleInputChange} />
                        <NumberInput label="TY 1" name="ty1" value={inputs.ty1} onChange={handleInputChange} />
                        {!inputs.assumeOneTile && (
                          <>
                            <NumberInput label="TX 2" name="tx2" value={inputs.tx2} onChange={handleInputChange} />
                            <NumberInput label="TY 2" name="ty2" value={inputs.ty2} onChange={handleInputChange} />
                          </>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold border-b border-term-border opacity-70 pb-2 mb-4 uppercase">Result Coordinates</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <NumberInput label="RX 1" name="rx1" value={inputs.rx1} onChange={handleInputChange} />
                        <NumberInput label="RY 1" name="ry1" value={inputs.ry1} onChange={handleInputChange} />
                        <NumberInput label="RX 2" name="rx2" value={inputs.rx2} onChange={handleInputChange} />
                        <NumberInput label="RY 2" name="ry2" value={inputs.ry2} onChange={handleInputChange} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Derived Variables Panel */}
                <div className="lg:col-span-3 border border-term-border p-6 bg-term-bg h-fit relative">
                  <div className="absolute -top-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text opacity-90">
                    [ DERIVED ]
                  </div>
                  <div className="grid grid-cols-2 gap-6 mt-4">
                    <div className={`border p-4 transition-colors ${isMxInvalid ? 'border-term-text bg-term-text text-term-bg animate-pulse' : 'border-term-border opacity-70'}`}>
                      <div className="text-lg uppercase mb-2 opacity-75">MX (Multiplier X)</div>
                      <div className="text-3xl font-bold opacity-90">{calc.mx}</div>
                    </div>
                    <div className={`border p-4 transition-colors ${isMyInvalid ? 'border-term-text bg-term-text text-term-bg animate-pulse' : 'border-term-border opacity-70'}`}>
                      <div className="text-lg uppercase mb-2 opacity-75">MY (Multiplier Y)</div>
                      <div className="text-3xl font-bold opacity-90">{calc.my}</div>
                    </div>
                    <div className={`border p-4 transition-colors ${isXoffInvalid ? 'border-term-text bg-term-text text-term-bg animate-pulse' : 'border-term-border opacity-70'}`}>
                      <div className="text-lg uppercase mb-2 opacity-75">XOFF (X Offset)</div>
                      <div className="text-3xl font-bold opacity-90">{calc.xoff}</div>
                    </div>
                    <div className={`border p-4 transition-colors ${isYoffInvalid ? 'border-term-text bg-term-text text-term-bg animate-pulse' : 'border-term-border opacity-70'}`}>
                      <div className="text-lg uppercase mb-2 opacity-75">YOFF (Y Offset)</div>
                      <div className="text-3xl font-bold opacity-90">{calc.yoff}</div>
                    </div>
                  </div>

                  {hasWarning && (
                    <div className="mt-6 p-4 border-2 border-term-text bg-term-text text-term-bg animate-pulse shadow-lg">
                      <div className="font-bold text-xl mb-1 uppercase tracking-wider">[! WARNING !]</div>
                      <div className="text-base leading-snug uppercase font-bold">
                        CALCULATED VALUES ARE OUTSIDE EXPECTED GAME LIMITS (MULTIPLIERS: 1, 2, 4 | OFFSETS: -100 TO 0). CHECK INPUTTED COORDINATES.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Phase 1 Footer Actions */}
              <div className="flex flex-col sm:flex-row justify-end items-center gap-4 pt-4">
                <button
                  onClick={() => setActivePhase(2)}
                  className="bg-term-hover text-term-hover-text px-8 py-3 font-bold text-2xl uppercase hover:opacity-90 transition-all border-2 border-transparent focus:border-term-text w-full sm:w-auto"
                >
                  CONTINUE --{'>'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center mb-4">
                <button
                  onClick={() => setActivePhase(1)}
                  className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-4 py-2 uppercase font-bold text-xl transition-colors"
                >
                  {'<'}-- BACK
                </button>
              </div>

              <div className="w-full">
                {/* Generated Scripts & Waypoints Section */}
                <div className="border border-term-border p-6 bg-term-bg relative">
                  <div className="absolute -top-4 left-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text opacity-90">
                    [ GENERATED SCRIPTS & WAYPOINTS ]
                  </div>
                  <div className="absolute -top-4 right-4 bg-term-bg px-2 flex items-center gap-2">
                    <CopyAllButton scripts={allScripts} label="[ DEPLOY ALL SCRIPTS ]" />
                    <CopyAllButton scripts={allScripts} label="[ DELETE ALL SCRIPTS ]" deleteOnly={true} />
                  </div>

                  <div className="text-base text-term-text opacity-75 uppercase tracking-wider mt-2 mb-6 border-b border-term-border opacity-70 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <button
                      onClick={() => setIsAddingWp(true)}
                      className="bg-term-hover text-term-hover-text border border-term-border px-4 py-2 uppercase font-bold text-lg hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>[+]</span> ADD WAYPOINT
                    </button>
                    <span className="font-bold opacity-90">[ TOTAL SCRIPTS: {allScripts.length} ]</span>
                  </div>

                  <div className={`grid ${waypointGroups.length === 0 ? 'grid-cols-1' : waypointGroups.length === 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-6`}>
                    {/* Base System Scripts Card */}
                    <div className="border border-term-border p-5 bg-term-bg relative opacity-80 hover:opacity-100 transition-opacity flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-center border-b border-term-border opacity-70 pb-2 mb-4">
                          <h3 className="text-xl font-bold uppercase tracking-wider">BASE SYSTEM</h3>
                          <CopyAllButton scripts={baseScripts} />
                        </div>
                        <div className="space-y-4 mb-4">
                          {baseScripts.map(script => (
                            <ScriptItem key={script.id} script={script} />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Waypoint Group Cards */}
                    {waypointGroups.map(group => (
                      <div key={group.id} className="border border-term-border p-5 bg-term-bg relative opacity-80 hover:opacity-100 transition-opacity flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center border-b border-term-border opacity-70 pb-2 mb-4">
                            <div>
                              <h4 className="text-xl font-bold text-term-text opacity-90 uppercase tracking-wider">{'>'} {group.name}</h4>
                              <div className="text-xs text-term-text opacity-75 uppercase mt-0.5">X: {group.x} | Y: {group.y}</div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setEditingWp(group)}
                                className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-2 py-1 uppercase font-bold text-sm transition-colors cursor-pointer"
                                title="Edit Waypoint"
                              >
                                [ EDIT ]
                              </button>
                              <button
                                onClick={() => setWpToDelete(group)}
                                className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-2 py-1 uppercase font-bold text-sm transition-colors cursor-pointer"
                                title="Delete Waypoint"
                              >
                                [ X ]
                              </button>
                              <CopyAllButton scripts={group.scripts} />
                            </div>
                          </div>
                          <div className="space-y-4 mb-4">
                            {group.scripts.map(script => (
                              <ScriptItem key={script.id} script={script} />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Add Waypoint Modal */}
        {isAddingWp && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="border-2 border-term-text bg-term-bg p-6 max-w-md w-full relative shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="absolute -top-4 left-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text">
                [ ADD WAYPOINT ]
              </div>
              <div className="space-y-6 mt-4">
                <div>
                  <label className="text-lg font-bold mb-1 block uppercase tracking-wider">WAYPOINT NAME</label>
                  <input
                    type="text"
                    placeholder="E.G. MEDBAY"
                    value={newWp.name}
                    onChange={e => setNewWp({ ...newWp, name: e.target.value })}
                    className="w-full bg-term-bg border border-term-border px-3 py-2 focus:outline-none focus:border-term-text text-xl placeholder-term-text/50 uppercase"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-lg font-bold mb-1 block uppercase tracking-wider">X COORDINATE</label>
                    <input
                      type="number"
                      placeholder="X"
                      value={newWp.x}
                      onChange={e => setNewWp({ ...newWp, x: e.target.value })}
                      className="w-full bg-term-bg border border-term-border px-3 py-2 focus:outline-none focus:border-term-text text-xl"
                    />
                  </div>
                  <div>
                    <label className="text-lg font-bold mb-1 block uppercase tracking-wider">Y COORDINATE</label>
                    <input
                      type="number"
                      placeholder="Y"
                      value={newWp.y}
                      onChange={e => setNewWp({ ...newWp, y: e.target.value })}
                      className="w-full bg-term-bg border border-term-border px-3 py-2 focus:outline-none focus:border-term-text text-xl"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-4 pt-4 border-t border-term-border opacity-70">
                  <button
                    onClick={() => setIsAddingWp(false)}
                    className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-6 py-2 uppercase font-bold text-xl transition-colors cursor-pointer"
                  >
                    [ CANCEL ]
                  </button>
                  <button
                    onClick={() => {
                      handleAddWaypoint();
                      setIsAddingWp(false);
                    }}
                    disabled={!newWp.name || !newWp.x || !newWp.y}
                    className="bg-term-text text-term-bg hover:opacity-90 disabled:opacity-50 px-6 py-2 uppercase font-bold text-xl transition-opacity cursor-pointer disabled:cursor-not-allowed"
                  >
                    [ CONFIRM ]
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Waypoint Confirmation Modal */}
        {wpToDelete && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="border-2 border-term-text bg-term-bg p-6 max-w-md w-full relative shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="absolute -top-4 left-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text">
                [ CONFIRM DELETION ]
              </div>
              <div className="space-y-6 mt-4 text-center">
                <p className="text-xl uppercase">
                  ARE YOU SURE YOU WANT TO DELETE WAYPOINT <span className="font-bold text-term-text opacity-90">"{wpToDelete.name}"</span>?
                </p>
                <p className="text-base text-term-text opacity-75 uppercase">
                  THIS ACTION CANNOT BE UNDONE.
                </p>
                <div className="flex justify-center gap-6 pt-4 border-t border-term-border opacity-70">
                  <button
                    onClick={() => setWpToDelete(null)}
                    className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-6 py-2 uppercase font-bold text-xl transition-colors cursor-pointer"
                  >
                    [ CANCEL ]
                  </button>
                  <button
                    onClick={() => {
                      removeWaypoint(wpToDelete.id);
                      setWpToDelete(null);
                    }}
                    className="bg-term-text text-term-bg hover:opacity-90 px-6 py-2 uppercase font-bold text-xl transition-opacity cursor-pointer"
                  >
                    [ DELETE ]
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Waypoint Modal */}
        {editingWp && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="border-2 border-term-text bg-term-bg p-6 max-w-md w-full relative shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="absolute -top-4 left-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text">
                [ EDIT WAYPOINT ]
              </div>
              <div className="space-y-6 mt-4">
                <div>
                  <label className="text-lg font-bold mb-1 block uppercase tracking-wider">WAYPOINT NAME</label>
                  <input
                    type="text"
                    placeholder="E.G. MEDBAY"
                    value={editingWp.name}
                    onChange={e => setEditingWp({ ...editingWp, name: e.target.value })}
                    className="w-full bg-term-bg border border-term-border px-3 py-2 focus:outline-none focus:border-term-text text-xl placeholder-term-text/50 uppercase"
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-lg font-bold mb-1 block uppercase tracking-wider">X COORDINATE</label>
                    <input
                      type="number"
                      placeholder="X"
                      value={editingWp.x}
                      onChange={e => setEditingWp({ ...editingWp, x: e.target.value })}
                      className="w-full bg-term-bg border border-term-border px-3 py-2 focus:outline-none focus:border-term-text text-xl"
                    />
                  </div>
                  <div>
                    <label className="text-lg font-bold mb-1 block uppercase tracking-wider">Y COORDINATE</label>
                    <input
                      type="number"
                      placeholder="Y"
                      value={editingWp.y}
                      onChange={e => setEditingWp({ ...editingWp, y: e.target.value })}
                      className="w-full bg-term-bg border border-term-border px-3 py-2 focus:outline-none focus:border-term-text text-xl"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-4 pt-4 border-t border-term-border opacity-70">
                  <button
                    onClick={() => setEditingWp(null)}
                    className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-6 py-2 uppercase font-bold text-xl transition-colors cursor-pointer"
                  >
                    [ CANCEL ]
                  </button>
                  <button
                    onClick={handleEditWaypoint}
                    disabled={!editingWp.name || !editingWp.x || !editingWp.y}
                    className="bg-term-text text-term-bg hover:opacity-90 disabled:opacity-50 px-6 py-2 uppercase font-bold text-xl transition-opacity cursor-pointer disabled:cursor-not-allowed"
                  >
                    [ SAVE ]
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
