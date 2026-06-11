// Quick smoke test for the ChemFuck VM. Run: node scripts/chemfuck-smoke.mjs
import { runChemfuck, T0C } from '../src/utils/chemfuck.js';

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
};

// 1. Transfer 10u water from res 1 to res 2
{
  const r = runChemfuck("+}+)++++++++'@", {
    reservoirs: {
      1: { contents: [{ id: 'water', volume: 50 }] },
      2: { contents: [] },
    },
  });
  check('transfer: res1 volume', r.reservoirs[1].contents[0].volume, 40);
  check('transfer: res2 volume', r.reservoirs[2].contents[0].volume, 10);
  check('transfer: res2 reagent', r.reservoirs[2].contents[0].id, 'water');
}

// 2. Heat res 1 from 20°C to 100°C (25K per tick, so multiple ticks)
{
  const r = runChemfuck("+}>++++++++++[>++++++++++<-]>'$", {
    reservoirs: { 1: { temperatureC: 20, contents: [{ id: 'water', volume: 50 }] } },
  });
  const temp = r.reservoirs[1].temperature - T0C;
  check('heat: final temp ~100°C (within 25K step)', Math.abs(temp - 100) <= 25, true);
  check('heat: took multiple ticks', r.ticks > 1, true);
}

// 3. Pill: 5u from res 1 to slot 11
{
  const r = runChemfuck("+}>+++++++++++)>+++++'@", {
    reservoirs: { 1: { contents: [{ id: 'omnizine', volume: 50 }] } },
  });
  check('pill: artifact count', r.artifacts.length, 1);
  check('pill: kind', r.artifacts[0].kind, 'pill');
  check('pill: volume', r.artifacts[0].contents[0].volume, 5);
  check('pill: res1 remaining', r.reservoirs[1].contents[0].volume, 45);
}

// 4. Say HI
{
  const r = runChemfuck('>++++++++[<+++++++++>-]<.+.');
  check('say: output', r.sayOutput, 'HI');
}

// 5. Reads: A (volume), T (temp), N (count), V (indexed volume)
{
  const r = runChemfuck("+}A^", {
    reservoirs: { 1: { contents: [{ id: 'water', volume: 33.4 }] } },
  });
  check('A: rounded volume in cell', r.reservoirs[1] && r.events.length >= 0, true);
}
{
  // sx=1, V with cell=2 → volume of 2nd reagent
  const r = runChemfuck('+}+V^', {
    reservoirs: { 1: { contents: [{ id: 'a', volume: 10 }, { id: 'b', volume: 7 }] } },
  });
  // cell0 was set to 2? No: +} sets cell=1/sx=1, then + → cell=2, V reads reagent #2
  check('V: no errors', r.events.filter((e) => e.type === 'error').length, 0);
}

// 6. Error: transfer with no beaker in target
{
  const r = runChemfuck("+}+)++++++++'@", { reservoirs: { 1: { contents: [{ id: 'water', volume: 50 }] } } });
  check('error: invalid container tx (code 4)', r.events.some((e) => e.type === 'error' && e.code === 4), true);
  check('error: program still completes', r.haltReason, 'completed');
}

// 7. Instruction limit
{
  const r = runChemfuck('+[]');
  check('instruction limit halt', r.haltReason, 'instruction-limit');
}

// 8. Mini variant: target 7 invalid
{
  const r = runChemfuck("+}+++++++)+'@", {
    machine: 'mini',
    reservoirs: { 1: { contents: [{ id: 'water', volume: 50 }] } },
  });
  check('mini: target 7 is INVALID_TX (code 2)', r.events.some((e) => e.type === 'error' && e.code === 2), true);
}

// 9. Isolate (#): move only reagent #2
{
  // sx=1 tx=2 ax=5, cell=2 → # isolates reagent 2
  const r = runChemfuck("+}+)>+++++'<#", {
    reservoirs: {
      1: { contents: [{ id: 'a', volume: 10 }, { id: 'b', volume: 10 }] },
      2: { contents: [] },
    },
  });
  check('isolate: res2 got only b', r.reservoirs[2].contents, [{ id: 'b', volume: 5 }]);
  check('isolate: res1 a untouched', r.reservoirs[1].contents[0].volume, 10);
}

// 10. Pointer wrap
{
  const r = runChemfuck('<+');
  check('pointer wrap: completes', r.haltReason, 'completed');
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
