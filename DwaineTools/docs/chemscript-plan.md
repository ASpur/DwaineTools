# ChemScript → ChemFuck Compiler Plan

ChemScript is a small imperative language that compiles to ChemFuck, the
brainfuck dialect executed by the Goonstation chemicompiler. The compiler is
pure JS and is verified against the emulator in `src/utils/chemfuck.js`.

## Decisions (June 2026)

- **Language flavor:** imperative mini-language (C/JS-ish). A recipe-style DSL
  can be layered on top later as a frontend.
- **Priority:** correctness & simplicity first. Naive, obviously-correct
  codegen verified against the emulator on every construct; optimization
  passes come later once tests exist.
- **Scope:** lean core + comparisons & multiplication (comparisons/multiply in
  M3). Loops must be rock-solid. The design must not preclude adding
  functions later.
- **Delivery:** separate DwaineTools sidebar tool (M4), with a "send to
  emulator" handoff. The compiler itself is a UI-agnostic library.

## Target machine constraints that shape the design

- Loops can only test "current cell ≠ 0" — every `if`, comparison, and loop
  lowers to zero-tests.
- Cells hold plain numbers: **no byte wrap**, negatives allowed. Classic
  wrapping-BF idioms don't apply. `[-]` (clear) diverges on negative cells and
  comparison algorithms only terminate for non-negative operands, so the
  language semantics say **values are non-negative integers**; going negative
  is documented undefined behavior. (Watch out: `temp()` can legitimately be
  negative °C for cryo chems.)
- No random memory access — codegen statically tracks the data pointer and
  emits `>`/`<` runs between fixed cell addresses.
- Chem hardware is register-based: `sx`/`tx`/`ax` loaded from cells via
  `}` `)` `'`, results read back via `^`.
- Budgets: 50k executed instructions per run, ~30 op-cost per machine tick,
  output is pasted into an in-game text field. `a * b` by repeated addition is
  O(a·b) executed ops — constant folding mitigates the common cases.

## Language (v1)

```js
let amt = volume(1);          // non-negative integer variables
while (amt - 40) {            // truthiness: loops while value != 0
  transfer(1, 2, 5);
  amt = volume(1);
}
if (temp(1)) { pill(2, 5); } else { drain(2, 50); }
say("DONE");
```

- Statements: `let` (initializer required), assignment, `while`, `if`/`else`,
  builtin calls, `//` and `/* */` comments. Blocks are lexical scopes.
- Operators: `+ -` (M1), `* == != < <= > >=` (M3), parentheses, negative
  integer literals (for cooling targets).
- Builtins mapping 1:1 to hardware:
  - Actions: `transfer(src, tgt, amt)`, `isolate(src, tgt, amt, index)`,
    `heat(res, degC)`, `waitReaction()`, `pill(res, amt)` (target 11),
    `vial(res, amt)` (12), `drain(res, amt)` (13), `say("text")`
  - Reads (usable in expressions): `temp(res)` (°C), `volume(res)`,
    `volumeOf(res, index)`, `reagentCount(res)`

## Architecture

```
source → lexer → recursive-descent parser → AST → codegen → ChemFuck
```

`src/utils/chemscript/{lexer,parser,codegen,index}.js`. Entry point:
`compile(source) → { ok, code, errors, symbols, stats }` where `symbols` maps
top-level variable names to tape cells (used heavily by tests).

Codegen is an emitter with a small set of verified primitives — `moveTo`,
`setConst`, `clear`, `copyInto`, `addInto`/`subFrom`, `if`/`ifElse`/`while`
shells, register load/store — and everything composes from those. Cell
allocation is a bump allocator with a free list; temporaries follow the
"freed cells are zero" discipline (a dirty free emits a clear).

**Function-readiness:** scoped symbol table from day one. Planned v2 calling
convention is inline expansion (fresh cells per call site, no recursion), so
the pointer stays statically known and nothing in v1 changes.

## Testing

Every construct gets an emulator-backed test in `scripts/chemscript-tests.mjs`
(plain node, like `chemfuck-smoke.mjs`): compile a snippet, run it on
`ChemfuckVM`, assert on reservoir contents / artifacts / say output / variable
cells via the returned symbol table.

## Milestones

1. **M1 — loops work** ✅: lexer/parser/errors, `let`/assignment, `+ -`,
   constants, `while`/`if`-on-nonzero, `say`, emulator-backed test harness.
2. **M2 — chem end-to-end** ✅ (landed with M1; register ops were trivial once
   the emitter existed): all builtins, sensing reads into variables.
3. **M3 — comparisons & multiply** ✅: `== != < <= > >=` produce 0/1 via a
   paired-decrement race on operand copies; each round is O(1) thanks to a
   copy-free zero-branch built on the `[>]` pointer-split idiom (pointer lands
   in one of two statically-known cells and the paths re-converge, preserving
   static tracking — see `Emitter.ifZeroElse`). `*` is repeated addition.
   Comparisons are non-associative (`a < b < c` is a compile error).

   **Cost model (50k executed-instruction budget):**
   - Comparison: ~70·min(a,b) ops. Fine standalone even for values ~500, but
     inside loops it adds up — `while (volume(1) > 40)` with ten iterations
     uses ~42k. Prefer difference conditions (`while (volume(1) - 40)`) or
     compare against small values in hot loops.
   - Multiply: ~25·a·b ops for non-constant operands — keep products of
     runtime values small (≲ 40×40). Constant products fold at compile time.
   - Comparisons/multiplies only terminate for **non-negative operands**
     (negative cells diverge under zero-test loops; beware negative `temp()`).
4. **M4 — the tool** ✅: `src/tools/ChemScriptTool.jsx` — separate sidebar
   entry; source left / ChemFuck right, compile-on-change, errors with
   line/col, instruction/cell stats, variable→cell map, presets, language
   reference, and a "Send to Emulator" button (writes `dwaine_chemfuck_code`,
   switches tool; the emulator picks it up on mount).
5. **Optimization pass (June 2026)** ✅:
   - *Const-comparand comparisons:* `value OP constant` compiles to a guarded
     countdown (~35·min ops, ~120 chars) instead of the general race
     (~100·min ops, ~500 chars). Negative constants decide statically;
     `OP 0` reduces to boolify/invert.
   - *Lazy dirty-cell clearing:* freed cells defer their `[-]` until actually
     reallocated. Eager inside loop bodies (re-executing code must not see the
     previous iteration's garbage) with conservative dirty-merging around
     if/while for the skipped-branch path.
   - *Multiply-encoded constants:* `setConst` emits n ≥ 60 as a `√n × √n`
     loop (~2·√n chars). Threshold is deliberately high: encoding costs ~√n
     extra executed ops per evaluation, which compounds in hot loops.
   - *Peephole pass* (`optimize()` in index.js): cancels `><`, `+-`, and
     redundant clears. Measured at 0% on this compiler's output (static
     pointer tracking never emits cancellable pairs) — kept for hand-written
     input.
   - *Tick estimate in the tool:* compiled output is trial-run on a dummy
     bench (50u water everywhere) to show ~ticks and ops against the 50k cap.
   - *Copy elision:* `let` binds the variable directly to the cell its
     initializer evaluated into (always safe at the binding point), and
     straight-line assignments rebind instead of draining unit-by-unit.
     Rebinding is disabled inside loop bodies and branches — earlier emitted
     code would still read the old cell on re-execution or the skipped path.
     (~20% fewer ops on let/assign-heavy programs.)
   - Benchmark: `node DwaineTools/scripts/chemscript-bench.mjs`. Net effect vs
     pre-optimization: comparison-heavy programs ~45-55% smaller and ~50%
     fewer ops/ticks; `say` ~40% fewer ticks; worst regression +3% exec on
     heat-heavy code (accepted for the 54% size win).

6. **Later:** inlined functions, division/modulo, source-map stepping inside
   the emulator UI.
