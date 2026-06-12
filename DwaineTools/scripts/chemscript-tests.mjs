// ChemScript compiler tests, verified against the ChemFuck emulator.
// Run: node DwaineTools/scripts/chemscript-tests.mjs
import { compile } from '../src/utils/chemscript/index.js';
import { ChemfuckVM, MACHINE_TYPES, T0C, createBeaker } from '../src/utils/chemfuck.js';

let failures = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
};

function runScript(source, setup = {}) {
  const compiled = compile(source);
  if (!compiled.ok) {
    throw new Error(`Compile failed: ${JSON.stringify(compiled.errors)}\nSource: ${source}`);
  }
  const machine = MACHINE_TYPES[setup.machine ?? 'stationary'];
  const vm = new ChemfuckVM({ maxReservoir: machine.maxReservoir });
  for (const [slot, spec] of Object.entries(setup.reservoirs ?? {})) {
    vm.setReservoir(Number(slot), createBeaker(spec));
  }
  vm.loadProgram(compiled.code);
  vm.start();
  const run = vm.run();
  return { vm, compiled, run };
}

const cellOf = ({ vm, compiled }, name) => vm.data[compiled.symbols[name]];

// --- variables & arithmetic ---
{
  const r = runScript('let x = 5;');
  check('let constant', cellOf(r, 'x'), 5);
}
{
  const r = runScript('let x = 2 + 3 - 1;');
  check('constant folding', cellOf(r, 'x'), 4);
  check('folded code is short', r.compiled.code.length < 10, true);
}
{
  const r = runScript('let a = 2; let b = a + 3; let c = b - a;');
  check('variable arithmetic: b', cellOf(r, 'b'), 5);
  check('variable arithmetic: c', cellOf(r, 'c'), 3);
  check('source vars preserved by copy', cellOf(r, 'a'), 2);
}
{
  const r = runScript('let x = 3; x = x + 2;');
  check('self-referencing assignment', cellOf(r, 'x'), 5);
}
{
  const r = runScript('let a = 1; let b = 2; let x = (a + b) - (b - a);');
  check('nested parens', cellOf(r, 'x'), 2);
}

// --- control flow ---
{
  const r = runScript('let x = 5; let y = 0; while (x) { y = y + 2; x = x - 1; }');
  check('while countdown: y', cellOf(r, 'y'), 10);
  check('while countdown: x', cellOf(r, 'x'), 0);
  check('while completes', r.run.haltReason, 'completed');
}
{
  // multiplication by nested loops, with a block-scoped let inside the loop
  const r = runScript(`
    let a = 3; let b = 4; let result = 0;
    while (a) {
      let i = b;
      while (i) { result = result + 1; i = i - 1; }
      a = a - 1;
    }
  `);
  check('nested while (3*4)', cellOf(r, 'result'), 12);
}
{
  const r = runScript('let x = 1; let y = 0; if (x) { y = 7; }');
  check('if taken', cellOf(r, 'y'), 7);
}
{
  const r = runScript('let x = 0; let y = 0; if (x) { y = 7; }');
  check('if not taken', cellOf(r, 'y'), 0);
}
{
  const r = runScript('let x = 0; let y = 0; if (x) { y = 1; } else { y = 2; }');
  check('else branch', cellOf(r, 'y'), 2);
}
{
  const r = runScript('let x = 3; let y = 0; if (x - 3) { y = 1; } else { if (x) { y = 2; } else { y = 3; } }');
  check('else-if chain', cellOf(r, 'y'), 2);
}
{
  const r = runScript('let x = 1; if (x) { let x = 9; x = x + 1; }');
  check('block scoping: outer x untouched', cellOf(r, 'x'), 1);
}

// --- say ---
{
  const r = runScript('say("HELLO");');
  check('say output', r.run.sayOutput, 'HELLO');
}

// --- chem reads ---
const TWO_REAGENTS = {
  reservoirs: {
    1: { temperatureC: 20, contents: [{ id: 'water', volume: 30 }, { id: 'oil', volume: 12 }] },
    2: { contents: [] },
  },
};
{
  const r = runScript('let v = volume(1); let t = temp(1); let n = reagentCount(1); let v2 = volumeOf(1, 2);', TWO_REAGENTS);
  check('volume()', cellOf(r, 'v'), 42);
  check('temp()', cellOf(r, 't'), 20);
  check('reagentCount()', cellOf(r, 'n'), 2);
  check('volumeOf(1, 2)', cellOf(r, 'v2'), 12);
}

// --- chem actions ---
{
  const r = runScript('let a = volume(1) - 32; transfer(1, 2, a);', TWO_REAGENTS);
  check('transfer computed amount', Math.round((r.vm.reservoirs[2].contents[0]?.volume ?? 0) * 100) / 100 > 0, true);
  check('transfer total moved', Math.round(r.vm.reservoirs[2].contents.reduce((s, c) => s + c.volume, 0)), 10);
}
{
  const r = runScript('while (volume(1) - 40) { transfer(1, 2, 1); }', {
    reservoirs: { 1: { contents: [{ id: 'water', volume: 50 }] }, 2: { contents: [] } },
  });
  check('sensor-driven while: res1', Math.round(r.vm.reservoirs[1].contents[0].volume), 40);
  check('sensor-driven while: res2', Math.round(r.vm.reservoirs[2].contents[0].volume), 10);
}
{
  const r = runScript('heat(1, 100);', { reservoirs: { 1: { temperatureC: 20, contents: [{ id: 'water', volume: 50 }] } } });
  check('heat to 100C', Math.round(r.vm.reservoirs[1].temperature - T0C), 100);
}
{
  const r = runScript('heat(1, -50);', { reservoirs: { 1: { temperatureC: 20, contents: [{ id: 'water', volume: 50 }] } } });
  check('cool to -50C (constant)', Math.round(r.vm.reservoirs[1].temperature - T0C), -50);
}
{
  const r = runScript('pill(1, 5); vial(1, 3); drain(1, 10);', {
    reservoirs: { 1: { contents: [{ id: 'omnizine', volume: 50 }] } },
  });
  check('artifact kinds', r.vm.artifacts.map((a) => a.kind), ['pill', 'vial', 'splash']);
  check('pill volume', r.vm.artifacts[0].contents[0].volume, 5);
}
{
  const r = runScript('isolate(1, 2, 5, 2);', TWO_REAGENTS);
  check('isolate reagent #2', r.vm.reservoirs[2].contents, [{ id: 'oil', volume: 5 }]);
  check('isolate leaves reagent #1', r.vm.reservoirs[1].contents[0].volume, 30);
}
{
  const r = runScript('waitReaction(); say("OK");');
  check('waitReaction completes', r.run.sayOutput, 'OK');
}

// --- M3: comparisons ---
{
  // exhaustive: every operator over 0..6 × 0..6, checked against JS semantics
  const ops = { '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b };
  let bad = [];
  for (const [op, fn] of Object.entries(ops)) {
    for (let a = 0; a <= 6; a++) {
      for (let b = 0; b <= 6; b++) {
        const r = runScript(`let a = ${a}; let b = ${b}; let r = a ${op} b;`);
        if (cellOf(r, 'r') !== Number(fn(a, b))) bad.push(`${a} ${op} ${b} → ${cellOf(r, 'r')}`);
      }
    }
  }
  check('comparison fuzz 0..6 (294 cases)', bad, []);
}
{
  const r = runScript('let i = 0; while (i < 5) { i = i + 1; }');
  check('while with comparison', cellOf(r, 'i'), 5);
}
{
  const r = runScript('let a = 200; let b = 150; let r = a > b;');
  check('comparison with large values', cellOf(r, 'r'), 1);
  check('large comparison stays under exec limit', r.run.haltReason, 'completed');
}
{
  const r = runScript('let x = 3; let y = 0; if (x == 3) { y = 1; } else { y = 2; }');
  check('if on equality', cellOf(r, 'y'), 1);
}

// --- const-comparand comparisons (countdown specialization) ---
{
  const ops = { '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b };
  let bad = [];
  for (const [op, fn] of Object.entries(ops)) {
    for (let a = 0; a <= 6; a++) {
      for (let k = 0; k <= 6; k++) {
        const right = runScript(`let a = ${a}; let r = a ${op} ${k};`);
        if (cellOf(right, 'r') !== Number(fn(a, k))) bad.push(`${a} ${op} ${k}const → ${cellOf(right, 'r')}`);
        const left = runScript(`let a = ${a}; let r = ${k} ${op} a;`);
        if (cellOf(left, 'r') !== Number(fn(k, a))) bad.push(`${k}const ${op} ${a} → ${cellOf(left, 'r')}`);
      }
    }
  }
  check('const-comparand fuzz 0..6 both orientations (588 cases)', bad, []);
}
{
  let bad = [];
  for (const [op, expected] of [['>', 1], ['>=', 1], ['!=', 1], ['<', 0], ['<=', 0], ['==', 0]]) {
    const r = runScript(`let a = 3; let r = a ${op} -2;`);
    if (cellOf(r, 'r') !== expected) bad.push(`a ${op} -2 → ${cellOf(r, 'r')}`);
  }
  check('negative-constant comparisons fold statically', bad, []);
}
{
  const raw = runScript('let a = 200; let r = a > 150;');
  check('large const comparison', cellOf(raw, 'r'), 1);
}

// --- M3: multiplication ---
{
  const r = runScript('let a = 3; let b = 4; let p = a * b;');
  check('multiply variables', cellOf(r, 'p'), 12);
  check('multiply preserves nothing weird: a', cellOf(r, 'a'), 3);
}
{
  const r = runScript('let a = 0; let p = a * 5; let q = 5 * a;');
  check('multiply by zero (left)', cellOf(r, 'p'), 0);
  check('multiply by zero (right)', cellOf(r, 'q'), 0);
}
{
  const r = runScript('let p = 6 * 7;');
  check('constant-folded multiply', cellOf(r, 'p'), 42);
  check('folded multiply is short', r.compiled.code.length < 50, true);
}
{
  const r = runScript('let a = 3; let r = 2 + a * 4;');
  check('precedence: * binds tighter than +', cellOf(r, 'r'), 14);
}

// --- M3: comparisons driving chem logic ---
{
  const r = runScript('while (volume(1) > 40) { transfer(1, 2, 1); }', {
    reservoirs: { 1: { contents: [{ id: 'water', volume: 50 }] }, 2: { contents: [] } },
  });
  check('comparison-driven transfer loop: res1', Math.round(r.vm.reservoirs[1].contents[0].volume), 40);
  check('comparison-driven transfer loop: res2', Math.round(r.vm.reservoirs[2].contents[0].volume), 10);
  check('comparison-driven loop completes', r.run.haltReason, 'completed');
  console.log(`  (exec used: ${r.vm.exec} / 50000)`);
}

// --- optimizer preserves behavior (raw vs peephole-optimized output) ---
{
  const { parse } = await import('../src/utils/chemscript/index.js');
  const { optimize } = await import('../src/utils/chemscript/index.js');
  const { generate } = await import('../src/utils/chemscript/codegen.js');
  const corpus = [
    'let x = 5; let y = 0; while (x) { y = y + 2; x = x - 1; }',
    'while (volume(1) - 40) { transfer(1, 2, 1); } say("OK");',
    'let a = 12; let b = 9; let p = a * b; if (p > 100) { say("BIG"); } else { say("SMALL"); }',
    'heat(1, 100); pill(1, 5); let t = temp(1);',
  ];
  let bad = [];
  for (const source of corpus) {
    const raw = generate(parse(source)).code;
    const opt = optimize(raw);
    const runOn = (code) => {
      const vm = new ChemfuckVM({ maxReservoir: 10 });
      vm.setReservoir(1, createBeaker({ temperatureC: 20, contents: [{ id: 'water', volume: 50 }] }));
      vm.setReservoir(2, createBeaker({ contents: [] }));
      vm.loadProgram(code);
      vm.start();
      const result = vm.run();
      return JSON.stringify({
        data: vm.data,
        say: result.sayOutput,
        res: vm.reservoirs.map((b) => (b ? { contents: b.contents, temperature: b.temperature } : null)),
        artifacts: vm.artifacts,
        halt: result.haltReason,
      });
    };
    if (runOn(raw) !== runOn(opt)) bad.push(source.slice(0, 40));
  }
  check('peephole pass preserves behavior (memory, output, reservoirs)', bad, []);
}

// --- large constants are multiply-encoded ---
{
  const r = runScript('let x = 100;');
  check('encoded constant value', cellOf(r, 'x'), 100);
  check('encoded constant is short', r.compiled.code.length < 50, true);
}
{
  const r = runScript('let x = 0 - 0 + 251;');
  check('encoded odd constant value', cellOf(r, 'x'), 251);
}

// --- errors ---
{
  const r = compile('let x = 1 < 2 < 3;');
  check('chained comparison rejected', r.ok === false && r.errors[0].message.includes('Chained'), true);
}
{
  const r = compile('let = 5;');
  check('parse error reported', r.ok, false);
  check('parse error has line', r.errors[0].line, 1);
}
{
  const r = compile('x = 5;');
  check('unknown variable error', r.ok === false && r.errors[0].message.includes('Unknown variable'), true);
}
{
  const r = compile('let x = 1; let x = 2;');
  check('duplicate declaration error', r.ok === false && r.errors[0].message.includes('already declared'), true);
}
{
  const r = compile('transfer(1, 2);');
  check('arity error', r.ok === false && r.errors[0].message.includes('takes 3'), true);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
