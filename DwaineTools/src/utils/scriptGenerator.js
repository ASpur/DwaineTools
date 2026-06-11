// According to termos_scripting_guide.md, s_telepad (called by teleman) sleeps for 0.6 seconds.
// We match this exact delay in our scripts to ensure the hardware has time to process the coordinates.
const TELEPAD_SLEEP_DELAY = 0.6;

const templates = {
  set: `#!|neval $arg0 %xoff% - to tempx|neval $tempx %mx% / to tx|neval $arg1 %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty $arg2|nsleep ${TELEPAD_SLEEP_DELAY}|necho Setting to $tx $ty $arg2`,
  send: `#!|neval $arg0 %xoff% - to tempx|neval $tempx %mx% / to tx|neval $arg1 %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty %stationZ%|nsleep ${TELEPAD_SLEEP_DELAY}|nteleman -p %tpnumber% send`,
  get: `#!|neval $arg0 %xoff% - to tempx|neval $tempx %mx% / to tx|neval $arg1 %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty %stationZ%|nsleep ${TELEPAD_SLEEP_DELAY}|nteleman -p %tpnumber% receive`,
  relay: `#!|neval $arg0 %xoff% - to tempx1|neval $tempx1 %mx% / to tx1|neval $arg1 %yoff% - to tempy1|neval $tempy1 %my% / to ty1|neval $arg2 %xoff% - to tempx2|neval $tempx2 %mx% / to tx2|neval $arg3 %yoff% - to tempy2|neval $tempy2 %my% / to ty2|nteleman -p %tpnumber% relay $tx1 $ty1 %stationZ% $tx2 $ty2 %stationZ%`
};

export function generateScriptContent(rawScript, calc, scriptName) {
  const subbed = rawScript
    .replace(/%xoff%/g, calc.xoff)
    .replace(/%mx%/g, calc.mx)
    .replace(/%yoff%/g, calc.yoff)
    .replace(/%my%/g, calc.my)
    .replace(/%tpnumber%/g, calc.teleporterNumber)
    .replace(/%stationZ%/g, calc.stationZ);

  return `echo "${subbed}" ^ ${scriptName}`;
}

export function generateAllScripts(waypoints, calc) {
  const baseScripts = [
    { id: 'set', name: 'set', code: generateScriptContent(templates.set, calc, "set") },
    { id: 'send', name: 'send', code: generateScriptContent(templates.send, calc, "send") },
    { id: 'get', name: 'get', code: generateScriptContent(templates.get, calc, "get") },
    { id: 'relay', name: 'relay', code: generateScriptContent(templates.relay, calc, "relay") }
  ];

  const waypointGroups = waypoints.map(wp => {
    const safeName = wp.name.replace(/\s+/g, '');
    const sendToRaw = `#!|neval ${wp.x} %xoff% - to tempx|neval $tempx %mx% / to tx|neval ${wp.y} %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty %stationZ%|nsleep ${TELEPAD_SLEEP_DELAY}|nteleman -p %tpnumber% send`;
    const getFromRaw = `#!|neval ${wp.x} %xoff% - to tempx|neval $tempx %mx% / to tx|neval ${wp.y} %yoff% - to tempy|neval $tempy %my% / to ty|nteleman -p %tpnumber% coords $tx $ty %stationZ%|nsleep ${TELEPAD_SLEEP_DELAY}|nteleman -p %tpnumber% receive`;
    const relayToRaw = `#!|neval $arg0 %xoff% - to tempx1|neval $tempx1 %mx% / to tx1|neval $arg1 %yoff% - to tempy1|neval $tempy1 %my% / to ty1|neval ${wp.x} %xoff% - to tempx2|neval $tempx2 %mx% / to tx2|neval ${wp.y} %yoff% - to tempy2|neval $tempy2 %my% / to ty2|nteleman -p %tpnumber% relay $tx1 $ty1 %stationZ% $tx2 $ty2 %stationZ%`;

    return {
      id: wp.id,
      name: wp.name,
      x: wp.x,
      y: wp.y,
      scripts: [
        { id: `sendTo${safeName}`, name: `sendTo${safeName}`, code: generateScriptContent(sendToRaw, calc, `sendTo${safeName}`) },
        { id: `getFrom${safeName}`, name: `getFrom${safeName}`, code: generateScriptContent(getFromRaw, calc, `getFrom${safeName}`) },
        { id: `relayTo${safeName}`, name: `relayTo${safeName}`, code: generateScriptContent(relayToRaw, calc, `relayTo${safeName}`) }
      ]
    };
  });

  const allScripts = [
    ...baseScripts,
    ...waypointGroups.flatMap(g => g.scripts)
  ];

  return { baseScripts, waypointGroups, allScripts };
}
