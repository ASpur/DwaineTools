import { useState, useMemo, useEffect } from 'react';
import ScriptItem from '../components/ScriptItem';
import CopyAllButton from '../components/CopyAllButton';
import NumberInput from '../components/NumberInput';
import { useAppStore } from '../store';
import { calculateTeleporterVariables, validateCalibration } from '../utils/teleporterMath';
import { generateAllScripts } from '../utils/scriptGenerator';

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
    isAdvancedMode: false,
    mx: '',
    my: '',
    xoff: '',
    yoff: '',
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
        if (parsed.isAdvancedMode === undefined) {
          parsed.isAdvancedMode = false;
          parsed.mx = '';
          parsed.my = '';
          parsed.xoff = '';
          parsed.yoff = '';
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
  
  const { isSyndicateUnlocked: isLoginPacketSetupUnlocked } = useAppStore();

  const [isCalibrationWarningOpen, setIsCalibrationWarningOpen] = useState(false);
  const [isCalibrationGuideOpen, setIsCalibrationGuideOpen] = useState(false);
  const [isDeployHelpOpen, setIsDeployHelpOpen] = useState(false);
  const [clearedCalibrationSnapshot, setClearedCalibrationSnapshot] = useState(null);

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
    if (clearedCalibrationSnapshot && name in clearedCalibrationSnapshot) {
      setClearedCalibrationSnapshot(null);
    }
    setInputs(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const clearCalibrationVariables = () => {
    setClearedCalibrationSnapshot({
      stationZ: inputs.stationZ,
      tx1: inputs.tx1,
      ty1: inputs.ty1,
      tx2: inputs.tx2,
      ty2: inputs.ty2,
      rx1: inputs.rx1,
      ry1: inputs.ry1,
      rx2: inputs.rx2,
      ry2: inputs.ry2,
    });
    setInputs(prev => ({
      ...prev,
      stationZ: '',
      tx1: '',
      ty1: '',
      tx2: '',
      ty2: '',
      rx1: '',
      ry1: '',
      rx2: '',
      ry2: '',
    }));
  };

  const restoreCalibrationVariables = () => {
    if (!clearedCalibrationSnapshot) return;
    setInputs(prev => ({
      ...prev,
      ...clearedCalibrationSnapshot,
    }));
    setClearedCalibrationSnapshot(null);
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

  const closeActiveModal = () => {
    if (wpToDelete) {
      setWpToDelete(null);
      return;
    }
    if (editingWp) {
      setEditingWp(null);
      return;
    }
    if (isAddingWp) {
      setIsAddingWp(false);
    }
    if (isCalibrationWarningOpen) {
      setIsCalibrationWarningOpen(false);
    }
    if (isCalibrationGuideOpen) {
      setIsCalibrationGuideOpen(false);
    }
    if (isDeployHelpOpen) {
      setIsDeployHelpOpen(false);
    }
  };

  const handleModalBackdropMouseDown = (event, closeModal) => {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  };

  useEffect(() => {
    if (!isAddingWp && !wpToDelete && !editingWp && !isCalibrationWarningOpen && !isCalibrationGuideOpen && !isDeployHelpOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isCalibrationGuideOpen) {
          setIsCalibrationGuideOpen(false);
        } else if (isCalibrationWarningOpen) {
          setIsCalibrationWarningOpen(false);
        } else if (wpToDelete) {
          setWpToDelete(null);
        } else if (editingWp) {
          setEditingWp(null);
        } else if (isAddingWp) {
          setIsAddingWp(false);
        } else if (isDeployHelpOpen) {
          setIsDeployHelpOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddingWp, wpToDelete, editingWp, isCalibrationWarningOpen, isCalibrationGuideOpen, isDeployHelpOpen]);

  const calc = useMemo(() => calculateTeleporterVariables(inputs), [inputs]);
  const { isMxInvalid, isMyInvalid, isXoffInvalid, isYoffInvalid, hasWarning, isCalibrationComplete } = validateCalibration(calc, inputs.teleporterNumber, inputs.stationZ);
  const { baseScripts, waypointGroups, allScripts } = useMemo(() => generateAllScripts(waypoints, calc), [waypoints, calc]);
  const configurationStatus = !isCalibrationComplete ? 'INCOMPLETE' : hasWarning ? 'CHECK VALUES' : 'READY';
  const waypointStatus = `${waypointGroups.length} WAYPOINT${waypointGroups.length === 1 ? '' : 'S'} / ${allScripts.length} SCRIPTS`;
  const shouldWarnBeforeScripts = !isCalibrationComplete || hasWarning;
  const continueLabel = shouldWarnBeforeScripts ? 'NOT READY' : 'CONTINUE --';
  const goToScripts = () => {
    if (shouldWarnBeforeScripts) {
      setIsCalibrationWarningOpen(true);
      return;
    }
    setActivePhase(2);
  };

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
        {/* Phase Steps Indicator */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-stretch my-4 gap-4">
          <button
            type="button"
            onClick={() => setActivePhase(1)}
            disabled={activePhase === 1}
            className={`border-2 p-4 text-left transition-colors uppercase ${activePhase === 1 ? 'border-term-text text-term-text opacity-95 cursor-default' : 'border-term-border text-term-text opacity-55 hover:opacity-90 cursor-pointer'}`}
            aria-current={activePhase === 1 ? 'step' : undefined}
          >
            <span className="block text-2xl font-bold">[ 1 ] CONFIGURATION</span>
            <span className="block text-base font-bold mt-1">STATUS: {configurationStatus}</span>
          </button>
          <div className="hidden md:flex items-center justify-center w-16">
            <div className="w-full h-px bg-term-border opacity-70"></div>
          </div>
          <button
            type="button"
            onClick={goToScripts}
            disabled={activePhase === 2}
            className={`border-2 p-4 text-left transition-colors uppercase ${activePhase === 2 ? 'border-term-text text-term-text opacity-95 cursor-default' : 'border-term-border text-term-text opacity-55 hover:opacity-90 cursor-pointer'}`}
            aria-current={activePhase === 2 ? 'step' : undefined}
          >
            <span className="block text-2xl font-bold">[ 2 ] WAYPOINTS & SCRIPTS</span>
            <span className="block text-base font-bold mt-1">STATUS: {waypointStatus}</span>
          </button>
        </div>

        <div>
          {activePhase === 1 ? (
            <div className="w-full space-y-6">
              {/* One-Time Setup Panel */}
              <div className="border border-term-border p-5 bg-term-bg relative">
                <div className="absolute -top-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text opacity-90">
                  [ ONE-TIME SETUP ]
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  <ScriptItem
                    script={{
                      id: 'copy_teleman',
                      name: 'copy_teleman',
                      code: 'cp /sys/srv/teleman .'
                    }}
                  />
                  {isLoginPacketSetupUnlocked ? (
                    <ScriptItem
                      script={{
                        id: 'login_packet_setup',
                        name: 'setup_login_packet',
                        code: 'echo registered=A|nassignment=A|naccess=34 ^ /mnt/term/loginpacket\n\nfile_send'
                      }}
                    />
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Input Variables Panel */}
                <div className="lg:col-span-8 border border-term-border p-6 bg-term-bg relative">
                  <div className="absolute -top-4 bg-term-bg px-2 flex items-center gap-2 text-xl font-bold uppercase tracking-widest text-term-text opacity-90">
                    <span>[ CALIBRATION VARIABLES ]</span>
                    <button
                      type="button"
                      onClick={() => setIsCalibrationGuideOpen(true)}
                      className="border border-term-border px-3 py-1 text-sm leading-normal hover:bg-term-hover hover:text-term-hover-text transition-colors"
                      aria-label="Open calibration guide"
                      title="Open calibration guide"
                    >
                      [ HELP ]
                    </button>
                  </div>

                  <div className="space-y-8 mt-4">
                    <div>
                      <div className="border-b border-term-border opacity-70 pb-2 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <h3 className="text-xl font-bold uppercase">Teleporter Selection</h3>
                        <button
                          type="button"
                          onClick={clearedCalibrationSnapshot ? restoreCalibrationVariables : clearCalibrationVariables}
                          className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1 uppercase font-bold text-sm transition-colors cursor-pointer w-fit"
                        >
                          {clearedCalibrationSnapshot ? '[ RESTORE CALIBRATION ]' : '[ CLEAR CALIBRATION ]'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-6 mb-4">
                        <NumberInput
                          label="Teleporter Number"
                          name="teleporterNumber"
                          value={inputs.teleporterNumber}
                          onChange={handleInputChange}
                          help="Which teleporter on the network to command. Telesci room is usually 1."
                        />
                        <NumberInput
                          label="Station Z"
                          name="stationZ"
                          value={inputs.stationZ}
                          onChange={handleInputChange}
                          help="The Z-level from your first valid scan. Use it for station destinations."
                        />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-6 mt-4">
                        {!inputs.isAdvancedMode && (
                          <label className="flex items-center gap-3 cursor-pointer group w-fit">
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
                        )}
                        <label className="flex items-center gap-3 cursor-pointer group w-fit">
                          <div className="relative flex items-center justify-center w-6 h-6 bg-term-bg border border-term-border group-hover:border-term-text transition-colors">
                            <input
                              type="checkbox"
                              name="isAdvancedMode"
                              checked={inputs.isAdvancedMode}
                              onChange={handleInputChange}
                              className="absolute opacity-0 w-full h-full cursor-pointer"
                            />
                            {inputs.isAdvancedMode && <span className="text-term-text font-bold text-lg leading-none">X</span>}
                          </div>
                          <span className="text-lg font-bold text-term-text uppercase tracking-wider group-hover:text-term-text opacity-90 transition-colors select-none">
                            Advanced Mode
                          </span>
                        </label>
                      </div>
                    </div>

                    {!inputs.isAdvancedMode && (
                      <>
                        <div>
                          <h3 className="text-xl font-bold border-b border-term-border opacity-70 pb-2 mb-4 uppercase">Teleporter Coordinates (Test Points)</h3>
                          <div className="grid grid-cols-2 gap-6">
                            <NumberInput
                              label="TX 1"
                              name="tx1"
                              value={inputs.tx1}
                              onChange={handleInputChange}
                              help="The first test X coordinate entered into the teleporter."
                            />
                            <NumberInput
                              label="TY 1"
                              name="ty1"
                              value={inputs.ty1}
                              onChange={handleInputChange}
                              help="The first test Y coordinate entered into the teleporter."
                            />
                            {!inputs.assumeOneTile && (
                              <>
                                <NumberInput
                                  label="TX 2"
                                  name="tx2"
                                  value={inputs.tx2}
                                  onChange={handleInputChange}
                                  help="The second test X coordinate entered into the teleporter."
                                />
                                <NumberInput
                                  label="TY 2"
                                  name="ty2"
                                  value={inputs.ty2}
                                  onChange={handleInputChange}
                                  help="The second test Y coordinate entered into the teleporter."
                                />
                              </>
                            )}
                          </div>
                        </div>

                        <div>
                          <h3 className="text-xl font-bold border-b border-term-border opacity-70 pb-2 mb-4 uppercase">Result Coordinates</h3>
                          <div className="grid grid-cols-2 gap-6">
                            <NumberInput
                              label="RX 1"
                              name="rx1"
                              value={inputs.rx1}
                              onChange={handleInputChange}
                              help="The real X coordinate where test 1 lands."
                            />
                            <NumberInput
                              label="RY 1"
                              name="ry1"
                              value={inputs.ry1}
                              onChange={handleInputChange}
                              help="The real Y coordinate where test 1 lands."
                            />
                            <NumberInput
                              label="RX 2"
                              name="rx2"
                              value={inputs.rx2}
                              onChange={handleInputChange}
                              help="The real X coordinate where test 2 lands."
                            />
                            <NumberInput
                              label="RY 2"
                              name="ry2"
                              value={inputs.ry2}
                              onChange={handleInputChange}
                              help="The real Y coordinate where test 2 lands."
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Derived Variables Panel */}
                <div className="lg:col-span-4 border border-term-border p-6 bg-term-bg h-fit relative">
                  <div className="absolute -top-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text opacity-90">
                    [ CALIBRATION STATUS ]
                  </div>
                  <div className={`mt-4 mb-4 border-2 p-3 font-bold uppercase text-xl ${configurationStatus === 'READY' ? 'border-term-text' : configurationStatus === 'CHECK VALUES' ? 'border-term-text bg-term-text text-term-bg animate-pulse' : 'border-term-border opacity-70'}`}>
                    STATUS: {configurationStatus}
                  </div>
                  
                  {inputs.isAdvancedMode ? (
                    <div className="flex flex-col gap-4 text-xl font-bold uppercase tracking-widest mt-6">
                      <div className={`flex flex-wrap items-center gap-2 border p-3 ${isMxInvalid || isXoffInvalid ? 'border-term-text text-term-text' : 'border-term-border opacity-90'}`}>
                        <span>RX =</span>
                        <input 
                          name="mx"
                          value={inputs.mx}
                          onChange={handleInputChange}
                          placeholder="MX"
                          className="w-20 bg-term-bg border-b-2 border-term-border text-center text-term-text focus:outline-none focus:border-term-text placeholder-term-border placeholder-opacity-50" 
                        />
                        <span>* TX +</span>
                        <input 
                          name="xoff"
                          value={inputs.xoff}
                          onChange={handleInputChange}
                          placeholder="XOFF"
                          className="w-20 bg-term-bg border-b-2 border-term-border text-center text-term-text focus:outline-none focus:border-term-text placeholder-term-border placeholder-opacity-50" 
                        />
                      </div>
                      <div className={`flex flex-wrap items-center gap-2 border p-3 ${isMyInvalid || isYoffInvalid ? 'border-term-text text-term-text' : 'border-term-border opacity-90'}`}>
                        <span>RY =</span>
                        <input 
                          name="my"
                          value={inputs.my}
                          onChange={handleInputChange}
                          placeholder="MY"
                          className="w-20 bg-term-bg border-b-2 border-term-border text-center text-term-text focus:outline-none focus:border-term-text placeholder-term-border placeholder-opacity-50" 
                        />
                        <span>* TY +</span>
                        <input 
                          name="yoff"
                          value={inputs.yoff}
                          onChange={handleInputChange}
                          placeholder="YOFF"
                          className="w-20 bg-term-bg border-b-2 border-term-border text-center text-term-text focus:outline-none focus:border-term-text placeholder-term-border placeholder-opacity-50" 
                        />
                      </div>
                    </div>
                  ) : (
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
                  )}

                  {hasWarning && (
                    <div className="mt-6 p-4 border-2 border-term-text bg-term-text text-term-bg animate-pulse shadow-lg">
                      <div className="font-bold text-xl mb-1 uppercase tracking-wider">[! WARNING !]</div>
                      <div className="text-base leading-snug uppercase font-bold">
                        CALCULATED VALUES ARE OUTSIDE EXPECTED GAME LIMITS (MULTIPLIERS: 1, 2, 4 | OFFSETS: -100 TO 0). CHECK INPUTTED COORDINATES.
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={goToScripts}
                    className={`mt-6 px-6 py-3 font-bold text-2xl uppercase transition-all border-2 focus:border-term-text w-full ${shouldWarnBeforeScripts ? 'group bg-term-bg text-term-text border-term-border hover:bg-term-hover hover:text-term-hover-text' : 'bg-term-hover text-term-hover-text border-transparent hover:opacity-90'}`}
                  >
                    {shouldWarnBeforeScripts ? (
                      <span className="relative inline-grid min-w-[13ch]">
                        <span className="col-start-1 row-start-1 transition-opacity duration-75 group-hover:opacity-0 group-focus:opacity-0">NOT READY</span>
                        <span className="col-start-1 row-start-1 opacity-0 transition-opacity duration-75 group-hover:opacity-100 group-focus:opacity-100">CONTINUE ANYWAY?</span>
                      </span>
                    ) : (
                      `${continueLabel}>`
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Map Context */}
              <div className="border-2 border-term-border p-4 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-term-bg">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
                  <span className="font-bold text-xl whitespace-nowrap uppercase">MAP CONTEXT:</span>
                  {isCreatingSession ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={newSessionName}
                        onChange={e => setNewSessionName(e.target.value)}
                        placeholder="NAME..."
                        aria-label="New map name"
                        className="bg-term-bg border border-term-border text-term-text px-3 py-1.5 text-lg focus:outline-none focus:border-term-text w-full sm:w-auto uppercase placeholder-term-text/50"
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleCreateSession();
                          if (e.key === 'Escape') setIsCreatingSession(false);
                        }}
                      />
                      <button type="button" onClick={handleCreateSession} className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg">
                        [ SAVE MAP ]
                      </button>
                      <button type="button" onClick={() => setIsCreatingSession(false)} className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg">
                        [ CANCEL ]
                      </button>
                    </div>
                  ) : isRenamingSession ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input
                        autoFocus
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        aria-label="Rename current map"
                        className="bg-term-bg border border-term-border text-term-text px-3 py-1.5 text-lg focus:outline-none focus:border-term-text w-full sm:w-auto uppercase placeholder-term-text/50"
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameSession();
                          if (e.key === 'Escape') setIsRenamingSession(false);
                        }}
                      />
                      <button type="button" onClick={handleRenameSession} className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg">
                        [ SAVE NAME ]
                      </button>
                      <button type="button" onClick={() => setIsRenamingSession(false)} className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg">
                        [ CANCEL ]
                      </button>
                    </div>
                  ) : (
                    <select
                      value={activeSessionId}
                      onChange={(e) => setActiveSessionId(e.target.value)}
                      aria-label="Select map"
                      className="bg-term-bg border border-term-border text-term-text text-xl px-3 py-1.5 focus:outline-none focus:border-term-text min-w-[220px] max-w-xs uppercase appearance-none"
                      style={{ backgroundImage: 'linear-gradient(45deg, transparent 50%, var(--color-border) 50%), linear-gradient(135deg, var(--color-border) 50%, transparent 50%)', backgroundPosition: 'calc(100% - 20px) calc(1em + 2px), calc(100% - 15px) calc(1em + 2px)', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat' }}
                    >
                      {sessions.map(s => (
                        <option key={s.id} value={s.id} className="bg-term-bg text-term-text">{s.name}</option>
                      ))}
                    </select>
                  )}
                  <span className="text-base font-bold uppercase opacity-75">
                    [ {waypointGroups.length} WAYPOINT{waypointGroups.length === 1 ? '' : 'S'} ]
                  </span>
                </div>

                {!isCreatingSession && !isRenamingSession && (
                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto lg:justify-end">
                    <button
                      type="button"
                      onClick={() => setIsCreatingSession(true)}
                      className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg whitespace-nowrap"
                    >
                      [ NEW MAP ]
                    </button>
                    <button
                      type="button"
                      onClick={startRenaming}
                      className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg whitespace-nowrap"
                    >
                      [ RENAME MAP ]
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSession}
                      disabled={sessions.length <= 1}
                      className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1.5 transition-colors uppercase font-bold text-lg whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      [ DELETE MAP ]
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center mb-4">
                <button
                  type="button"
                  onClick={() => setActivePhase(1)}
                  className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-4 py-2 uppercase font-bold text-xl transition-colors"
                >
                  {'<'}-- BACK
                </button>
              </div>

              <div className="w-full">
                {/* Generated Scripts & Waypoints Section */}
                <div className="border border-term-border p-6 bg-term-bg relative">
                  <div className="border-b border-term-border pb-4 mb-6 flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-bold uppercase tracking-wider text-term-text opacity-90">
                        [ GENERATED SCRIPTS & WAYPOINTS ]
                      </h3>
                      <div className="text-base text-term-text opacity-75 uppercase tracking-wider mt-1">
                        MAP: {activeSession.name} | BASE: {baseScripts.length} | WAYPOINTS: {waypointGroups.length} | TOTAL: {allScripts.length}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsDeployHelpOpen(true)}
                        className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-3 py-1 uppercase font-bold text-sm transition-colors cursor-pointer"
                        title="Deploy Help"
                      >
                        [ HELP ]
                      </button>
                      <div className="w-px h-6 bg-term-border opacity-50 mx-1"></div>
                      <CopyAllButton scripts={allScripts} label="[ DEPLOY ALL SCRIPTS ]" />
                      <CopyAllButton scripts={allScripts} label="[ DELETE ALL SCRIPTS ]" deleteOnly={true} />
                    </div>
                  </div>

                  <div className="text-base text-term-text uppercase tracking-wider mb-6 border-b border-term-border opacity-80 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setIsAddingWp(true)}
                      className="bg-term-hover text-term-hover-text border border-term-border px-4 py-2 uppercase font-bold text-lg hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>[+]</span> ADD WAYPOINT
                    </button>
                    <span className="font-bold opacity-90">[ SELECT A SCRIPT TO PREVIEW OR COPY ]</span>
                  </div>

                  <div className={`grid ${waypointGroups.length === 0 ? 'grid-cols-1' : waypointGroups.length === 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} gap-6`}>
                    {/* Base System Scripts Card */}
                    <div className="border border-term-border p-5 bg-term-bg relative opacity-80 hover:opacity-100 transition-opacity flex flex-col justify-between">
                      <div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-term-border opacity-80 pb-2 mb-4">
                          <div>
                            <h3 className="text-xl font-bold uppercase tracking-wider">BASE SYSTEM</h3>
                            <div className="text-xs text-term-text opacity-75 uppercase mt-0.5">{baseScripts.length} SCRIPTS</div>
                          </div>
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
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-term-border opacity-80 pb-2 mb-4">
                            <div>
                              <h4 className="text-xl font-bold text-term-text opacity-90 uppercase tracking-wider">{'>'} {group.name}</h4>
                              <div className="text-xs text-term-text opacity-75 uppercase mt-0.5">X: {group.x} | Y: {group.y} | {group.scripts.length} SCRIPTS</div>
                            </div>
                            <div className="flex flex-wrap justify-end items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingWp(group)}
                                className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-2 py-1 uppercase font-bold text-sm transition-colors cursor-pointer"
                                title="Edit Waypoint"
                              >
                                [ EDIT ]
                              </button>
                              <button
                                type="button"
                                onClick={() => setWpToDelete(group)}
                                className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-2 py-1 uppercase font-bold text-sm transition-colors cursor-pointer"
                                title="Delete Waypoint"
                              >
                                [ DELETE ]
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
                    {waypointGroups.length === 0 && (
                      <div className="border border-dashed border-term-border p-5 bg-term-bg opacity-70 uppercase text-xl font-bold">
                        [ NO WAYPOINTS SAVED FOR THIS MAP ]
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Calibration Guide Modal */}
        {isCalibrationGuideOpen && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4"
            onMouseDown={(event) => handleModalBackdropMouseDown(event, closeActiveModal)}
          >
            <div
              className="border-2 border-term-text bg-term-bg p-6 max-w-3xl w-full max-h-[85vh] relative shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              aria-labelledby="calibration-guide-title"
            >
              <div id="calibration-guide-title" className="absolute -top-4 left-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text">
                [ CALIBRATION GUIDE ]
              </div>
              <div className="space-y-6 mt-4 max-h-[calc(85vh-4rem)] overflow-y-auto pr-2 text-xl uppercase leading-relaxed">
                <section>
                  <h3 className="font-bold text-2xl mb-2">[ WHY CALIBRATE ]</h3>
                  <p className="opacity-90">
                    The telesci teleporter must be calibrated before generated scripts can reliably translate real map coordinates into teleporter coordinates.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-2xl mb-2">[ 1. SELECT TELEPORTER ]</h3>
                  <p className="opacity-90">
                    Choose the teleporter number on the network. The teleporter in the telesci room is usually 1. If you are using a constructed teleporter, count upward by 1 for each additional teleporter that exists, including teleporters built by other players.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-2xl mb-2">[ 2. FIND A VALID STATION POINT ]</h3>
                  <p className="opacity-90">
                    Use the console or teleman to set coordinates to 50 50 1, then scan. If X or Y is invalid, increase that coordinate by 50 and scan again. If Z is invalid, increase Z by 1 and scan again. Once the scan succeeds, record those values as TX 1, TY 1, and Station Z.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-2xl mb-2">[ 3. RECORD TEST LANDING 1 ]</h3>
                  <p className="opacity-90">
                    Name a GPS for testing and send it through the teleporter. Use a second GPS to find where the test GPS landed. Record that landing point as RX 1 and RY 1, then retrieve the test GPS.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-2xl mb-2">[ 4. RECORD TEST LANDING 2 ]</h3>
                  <p className="opacity-90">
                    Increase TX and TY by 1, send the GPS again, and record the new landing point as RX 2 and RY 2. If you do not want to use a 1-tile jump, uncheck Assume 1-Tile Jump for Test 2 and enter the second TX and TY manually.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-2xl mb-2">[ 5. CONTINUE ]</h3>
                  <p className="opacity-90">
                    When calibration status is ready, continue to waypoints and scripts. If calibration is incomplete or warning, generated scripts may not work as expected.
                  </p>
                </section>

                <div className="flex justify-end pt-4 border-t border-term-border">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setIsCalibrationGuideOpen(false)}
                    className="bg-term-text text-term-bg hover:opacity-90 px-6 py-2 uppercase font-bold text-xl transition-opacity cursor-pointer"
                  >
                    [ CLOSE ]
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calibration Warning Modal */}
        {isCalibrationWarningOpen && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4"
            onMouseDown={(event) => handleModalBackdropMouseDown(event, closeActiveModal)}
          >
            <div
              className="border-2 border-term-text bg-term-bg p-6 max-w-lg w-full relative shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              aria-labelledby="calibration-warning-title"
            >
              <div id="calibration-warning-title" className="absolute -top-4 left-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text">
                [ CALIBRATION WARNING ]
              </div>
              <div className="space-y-6 mt-4 text-center">
                <p className="text-xl uppercase font-bold">
                  Calibration is {configurationStatus}.
                </p>
                <p className="text-lg uppercase opacity-80">
                  Generated scripts may not work as expected until all calibration variables are filled out and warnings are resolved.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4 border-t border-term-border opacity-80">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setIsCalibrationWarningOpen(false)}
                    className="bg-term-text text-term-bg hover:opacity-90 px-6 py-2 uppercase font-bold text-xl transition-opacity cursor-pointer"
                  >
                    [ FINISH CALIBRATION ]
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCalibrationWarningOpen(false);
                      setActivePhase(2);
                    }}
                    className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-6 py-2 uppercase font-bold text-xl transition-colors cursor-pointer"
                  >
                    [ CONTINUE ANYWAY ]
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Deploy Help Modal */}
        {isDeployHelpOpen && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4"
            onMouseDown={(event) => handleModalBackdropMouseDown(event, closeActiveModal)}
          >
            <div
              className="border-2 border-term-text bg-term-bg p-6 max-w-2xl w-full relative shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              aria-labelledby="deploy-help-title"
            >
              <div id="deploy-help-title" className="absolute -top-4 left-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text">
                [ DEPLOYMENT HELP ]
              </div>
              <div className="space-y-4 mt-4 text-lg uppercase leading-relaxed opacity-90">
                <p>
                  To deploy the scripts click deploy all. This will copy a command that writes the scripts to your current directory.
                </p>
                <p>
                  Due to the command length limit, this might have to happen in chunks, if you see 1/x that means you have to copy the scripts over in x ammount of chunks.
                </p>
                <p>
                  For the scripts to work, <span className="font-bold text-term-text opacity-100">teleman</span> must also be present in the same directory.
                </p>
              </div>
              <div className="flex justify-end pt-6 mt-6 border-t border-term-border opacity-80">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setIsDeployHelpOpen(false)}
                  className="bg-term-text text-term-bg hover:opacity-90 px-6 py-2 uppercase font-bold text-xl transition-opacity cursor-pointer"
                >
                  [ CLOSE ]
                </button>
              </div>
            </div>
          </div>
        )}

        {isAddingWp && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4"
            onMouseDown={(event) => handleModalBackdropMouseDown(event, closeActiveModal)}
          >
            <div
              className="border-2 border-term-text bg-term-bg p-6 max-w-md w-full relative shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-waypoint-title"
            >
              <div id="add-waypoint-title" className="absolute -top-4 left-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text">
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
                    type="button"
                    onClick={() => setIsAddingWp(false)}
                    className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-6 py-2 uppercase font-bold text-xl transition-colors cursor-pointer"
                  >
                    [ CANCEL ]
                  </button>
                  <button
                    type="button"
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
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4"
            onMouseDown={(event) => handleModalBackdropMouseDown(event, closeActiveModal)}
          >
            <div
              className="border-2 border-term-text bg-term-bg p-6 max-w-md w-full relative shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-waypoint-title"
            >
              <div id="delete-waypoint-title" className="absolute -top-4 left-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text">
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
                    type="button"
                    autoFocus
                    onClick={() => setWpToDelete(null)}
                    className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-6 py-2 uppercase font-bold text-xl transition-colors cursor-pointer"
                  >
                    [ CANCEL ]
                  </button>
                  <button
                    type="button"
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
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm p-4"
            onMouseDown={(event) => handleModalBackdropMouseDown(event, closeActiveModal)}
          >
            <div
              className="border-2 border-term-text bg-term-bg p-6 max-w-md w-full relative shadow-2xl animate-in fade-in zoom-in-95 duration-150"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-waypoint-title"
            >
              <div id="edit-waypoint-title" className="absolute -top-4 left-4 bg-term-bg px-2 text-xl font-bold uppercase tracking-widest text-term-text">
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
                    type="button"
                    onClick={() => setEditingWp(null)}
                    className="text-term-text hover:bg-term-hover hover:text-term-hover-text border border-term-border px-6 py-2 uppercase font-bold text-xl transition-colors cursor-pointer"
                  >
                    [ CANCEL ]
                  </button>
                  <button
                    type="button"
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
