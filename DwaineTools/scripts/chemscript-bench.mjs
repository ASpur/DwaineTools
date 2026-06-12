// ChemScript optimization benchmark: code size, executed ops, machine ticks.
// Run: node DwaineTools/scripts/chemscript-bench.mjs
import { parse, optimize } from '../src/utils/chemscript/index.js';
import { generate } from '../src/utils/chemscript/codegen.js';
import { ChemfuckVM, createBeaker } from '../src/utils/chemfuck.js';

const CORPUS = [
  ['drain via difference', 'while (volume(1) - 40) { transfer(1, 2, 1); } say("DONE");'],
  ['drain via comparison', 'while (volume(1) > 40) { transfer(1, 2, 1); } say("DONE");'],
  ['heat & pill', 'heat(1, 100); pill(1, 5);'],
  ['five vials', 'let n = 0; while (n < 5) { vial(1, 5); n = n + 1; }'],
  ['five vials (countdown)', 'let n = 5; while (n) { vial(1, 5); n = n - 1; }'],
  ['sensor branch', 'if (temp(1) >= 100) { say("HOT"); } else { say("COLD"); }'],
  ['arithmetic demo', 'let a = 6; let b = 7; let p = a * b; let big = p > 40; if (big) { say("BIG"); }'],
  ['runtime multiply 12x9', 'let a = 12; let b = 9; let p = a * b;'],
  ['say sentence', 'say("THE MACHINE IS WORKING AS INTENDED");'],
];

const run = (code) => {
  const vm = new ChemfuckVM({ maxReservoir: 10 });
  vm.setReservoir(1, createBeaker({ temperatureC: 20, contents: [{ id: 'water', volume: 50 }] }));
  vm.setReservoir(2, createBeaker({ contents: [] }));
  vm.loadProgram(code);
  vm.start();
  const result = vm.run();
  return { exec: vm.exec, ticks: result.ticks, halt: result.haltReason };
};

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('program', 24) + pad('raw', 7) + pad('opt', 7) + pad('saved', 8) + pad('exec raw', 10) + pad('exec opt', 10) + pad('ticks', 7) + 'halt');
for (const [name, source] of CORPUS) {
  const raw = generate(parse(source)).code;
  const opt = optimize(raw);
  const rawRun = run(raw);
  const optRun = run(opt);
  const saved = `${(100 * (1 - opt.length / raw.length)).toFixed(0)}%`;
  console.log(
    pad(name, 24) +
    pad(raw.length, 7) +
    pad(opt.length, 7) +
    pad(saved, 8) +
    pad(rawRun.exec, 10) +
    pad(optRun.exec, 10) +
    pad(optRun.ticks, 7) +
    optRun.halt
  );
}
