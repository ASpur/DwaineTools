/**
 * ChemScript code generator: AST → ChemFuck.
 *
 * Core invariants:
 * - The data pointer position is statically known at all times; moveTo()
 *   emits the > / < runs between fixed cell addresses.
 * - Cells obtained from alloc() are guaranteed to hold 0 at runtime. Freed
 *   cells are NOT cleared: the free list tracks each cell's runtime value
 *   (0 / known constant / unknown), reallocation emits the cheapest write
 *   (nothing, a +/- delta, or a clear), and loop back-edges reconcile any
 *   freed cells to the values the body's allocations assumed.
 * - Language values are non-negative integers. Clears and zero-test loops
 *   diverge on negative cells; going negative is documented UB.
 *
 * Truthiness: while/if run while/when the tested value != 0.
 */
import { RAM_SIZE } from '../chemfuck.js';
import { CompileError } from './lexer.js';

const READ_BUILTINS = {
  temp: 'T',
  volume: 'A',
  reagentCount: 'N',
};

class Emitter {
  constructor() {
    this.out = [];
    this.ptr = 0;
    this.nextCell = 0;
    this.freeList = []; // entries {cell, dirty}; dirty = runtime value may be nonzero
    this.loopDepth = 0; // > 0 while emitting code inside a loop body
    this.branchDepth = 0; // > 0 while emitting code inside an if/else branch
    this.scopes = [new Map()];
    this.globalSymbols = {};
  }

  emit(text) {
    this.out.push(text);
  }

  moveTo(cell) {
    const delta = cell - this.ptr;
    if (delta > 0) this.emit('>'.repeat(delta));
    else if (delta < 0) this.emit('<'.repeat(-delta));
    this.ptr = cell;
  }

  /**
   * Take a cell from the free list or fresh from the bump. Entries carry the
   * cell's runtime value: 0 (clean), a number (a previous user left it behind
   * and knew it statically — see freeKnown), or null (unknown). Preference:
   * clean, then known (cheap delta writes), then unknown; proximity to `near`
   * breaks ties. Emits nothing — callers that need a specific value use
   * alloc() or writeConst().
   */
  allocRaw(node, near = null) {
    if (this.freeList.length > 0) {
      const rank = (v) => (v === 0 ? 0 : v !== null ? 1 : 2);
      let best = 0;
      for (let i = 1; i < this.freeList.length; i++) {
        const candidate = this.freeList[i];
        const current = this.freeList[best];
        if (rank(candidate.value) !== rank(current.value)) {
          if (rank(candidate.value) < rank(current.value)) best = i;
        } else if (near !== null && Math.abs(candidate.cell - near) < Math.abs(current.cell - near)) {
          best = i;
        }
      }
      return this.freeList.splice(best, 1)[0];
    }
    if (this.nextCell >= RAM_SIZE) {
      throw new CompileError('Out of tape memory (1024 cells)', node?.line ?? 0, node?.col ?? 0);
    }
    return { cell: this.nextCell++, value: 0 };
  }

  alloc(node, near = null) {
    const { cell, value } = this.allocRaw(node, near);
    this.writeConst(cell, value, 0);
    return cell;
  }

  /**
   * Emit code taking a cell from a known prior value (number, or null =
   * unknown) to a target constant: nothing if equal, a +/- delta when the
   * prior value is known and close, otherwise clear + (possibly
   * multiply-encoded) constant.
   */
  writeConst(cell, current, target) {
    if (current === target) return;
    if (current !== null && Math.abs(target - current) <= 30) {
      this.add(cell, target - current);
      return;
    }
    if (current !== 0) this.clear(cell);
    this.setConst(cell, target, { assumeZero: true });
  }

  free(cell) {
    this.freeList.push({ cell, value: 0 });
  }

  /** Free a cell whose runtime value is statically known, enabling cheap
      delta writes on reuse (e.g. register-argument constants). */
  freeKnown(cell, value) {
    this.freeList.push({ cell, value: Number.isInteger(value) ? value : null });
  }

  /**
   * Free a cell whose runtime value is unknown. No clear is emitted — the
   * value stays behind until (and unless) the cell is reallocated; loop
   * back-edges are squared up by reconcileFreeState().
   */
  freeDirty(cell) {
    this.freeList.push({ cell, value: null });
  }

  /** Snapshot free-list values before a conditionally-executed region. */
  snapshotFreeState() {
    return {
      values: new Map(this.freeList.map((entry) => [entry.cell, entry.value])),
      watermark: this.nextCell,
    };
  }

  /** The value a cell holds on the runtime path that skipped a region:
      its snapshot value, 0 if bump-fresh inside the region, else unknown. */
  startValueFor(snapshot, cell) {
    if (snapshot.values.has(cell)) return snapshot.values.get(cell);
    return cell >= snapshot.watermark ? 0 : null;
  }

  /** Degrade nonzero known values to unknown. Used at loop entry so in-body
      reallocations don't delta-encode against stale pre-loop values that the
      back-edge would then have to restore expensively every iteration. */
  degradeFreeValues() {
    for (const entry of this.freeList) {
      if (entry.value !== 0) entry.value = null;
    }
  }

  /**
   * Loop bodies re-execute: any cell an in-body allocation found at value V
   * must be back at V when the body loops around. Call just before the
   * closing ] with the snapshot taken just after the opening [ (and after
   * degradeFreeValues). Cells whose start value was unknown need nothing —
   * their in-body allocations emitted clears.
   */
  reconcileFreeState(snapshot) {
    for (const entry of this.freeList) {
      const start = this.startValueFor(snapshot, entry.cell);
      if (start === null) {
        entry.value = null;
        continue;
      }
      if (entry.value !== start) this.writeConst(entry.cell, entry.value, start);
      entry.value = start;
    }
  }

  /** Restore free-list values to a snapshot's view (for emitting an else
      branch, whose runtime path starts from the pre-if state). */
  restoreFreeValues(snapshot) {
    for (const entry of this.freeList) {
      entry.value = this.startValueFor(snapshot, entry.cell);
    }
  }

  /**
   * Conservative merge after a conditionally-executed region: a cell keeps
   * its tracked value only if both runtime paths agree on it, else unknown.
   */
  mergeFreeState(snapshot) {
    for (const entry of this.freeList) {
      const other = this.startValueFor(snapshot, entry.cell);
      if (entry.value !== other) entry.value = null;
    }
  }

  clear(cell) {
    this.moveTo(cell);
    this.emit('[-]');
  }

  add(cell, n) {
    if (n === 0) return;
    this.moveTo(cell);
    this.emit((n > 0 ? '+' : '-').repeat(Math.abs(n)));
  }

  setConst(cell, n, { assumeZero = false } = {}, node = null) {
    if (!assumeZero) this.clear(cell);
    const abs = Math.abs(n);
    // Encode large constants as a multiply loop: n = ±(a·b + r), emitted as
    // scratch=a; scratch[ cell±=b ]; cell±=r. ~2·√n chars instead of n.
    // The loop adds ~√n executed ops per evaluation, which compounds inside
    // hot loops — so only constants big enough for a clear size win (≥ 60,
    // e.g. heat targets and say() character codes) are encoded.
    if (abs < 60) {
      this.add(cell, n);
      return;
    }
    let best = null;
    for (let a = 2; a <= Math.ceil(Math.sqrt(abs)) + 2; a++) {
      const b = Math.round(abs / a);
      const r = abs - a * b;
      const chars = a + b + Math.abs(r);
      if (!best || chars < best.chars) best = { a, b, r, chars };
    }
    if (best.chars + 12 >= abs) {
      this.add(cell, n);
      return;
    }
    const scratch = this.allocRaw(node, cell);
    this.writeConst(scratch.cell, scratch.value, 0);
    this.add(scratch.cell, best.a);
    this.moveTo(scratch.cell);
    this.emit('[');
    this.add(cell, Math.sign(n) * best.b);
    this.moveTo(scratch.cell);
    this.emit('-');
    this.emit(']');
    this.free(scratch.cell); // loop exits with scratch = 0
    this.add(cell, Math.sign(n) * best.r);
  }

  /** dst += src; src ends 0. */
  drainInto(src, dst, sign = '+') {
    this.moveTo(src);
    this.emit('[-');
    this.moveTo(dst);
    this.emit(sign);
    this.moveTo(src);
    this.emit(']');
  }

  /** dst += src, src preserved (via a scratch cell allocated near dst). */
  copyInto(src, dst, node) {
    const tmp = this.alloc(node, dst);
    this.moveTo(src);
    this.emit('[-');
    this.moveTo(dst);
    this.emit('+');
    this.moveTo(tmp);
    this.emit('+');
    this.moveTo(src);
    this.emit(']');
    this.drainInto(tmp, src);
    this.free(tmp);
  }

  /**
   * Allocate n consecutive cells (always fresh from the bump, never the free
   * list, since adjacency is required). Returned cells hold 0.
   */
  allocBlock(n, node) {
    if (this.nextCell + n > RAM_SIZE) {
      throw new CompileError('Out of tape memory (1024 cells)', node?.line ?? 0, node?.col ?? 0);
    }
    const base = this.nextCell;
    this.nextCell += n;
    return base;
  }

  freeBlock(base, n) {
    for (let i = 0; i < n; i++) this.free(base + i);
  }

  /**
   * Copy-free O(1) branch on whether cell `base` is zero, via the [>] pointer
   * split: the pointer lands in one of two statically known cells and the
   * paths re-converge, so static pointer tracking survives.
   *
   * Requires `base` to be the head of an allocBlock(4): [x, m1, z1, z2] where
   * m1/z1/z2 are scratch zeros owned by this primitive (z1 is the walk landing
   * pad and must never be touched by the branch bodies). `m2` is an ordinary
   * non-adjacent cell holding 0.
   *
   * thenZero / elseNonzero are emit callbacks; they may move the pointer
   * anywhere (pure pointer movement over z1 is fine — it doesn't write).
   * x is preserved. All scratch cells end at 0. x must be non-negative.
   * Callbacks must not allocate or free cells (so no setConst of large
   * constants, which allocates encoding scratch) — only one branch executes
   * at runtime, but allocator state changes would leak into both paths.
   */
  ifZeroElse(base, m2, thenZero, elseNonzero) {
    const x = base;
    const m1 = base + 1;
    const z2 = base + 3;
    this.add(m2, 1);
    this.add(m1, 1);
    this.moveTo(x);
    this.emit('[>]'); // x==0: stays at x; x!=0: walks x → m1(=1) → z1(=0)
    this.emit('>'); // now at m1 (==1, x was zero) or z2 (==0, x nonzero)
    this.emit('[');
    this.ptr = m1; // this body only executes on the x==0 path
    thenZero();
    this.add(m2, -1); // disarm the else branch
    this.moveTo(m1);
    this.emit('-'); // clear marker
    this.moveTo(z2);
    this.emit(']');
    this.ptr = z2; // both paths converge here
    this.clear(m1); // no-op on the zero path; clears the marker on the other
    this.moveTo(m2);
    this.emit('[');
    elseNonzero();
    this.moveTo(m2);
    this.emit('-');
    this.emit(']');
  }

  // --- scopes ---

  enterScope() {
    this.scopes.push(new Map());
  }

  exitScope() {
    const scope = this.scopes.pop();
    for (const cell of scope.values()) this.freeDirty(cell);
  }

  declare(name, node) {
    return this.declareAs(name, this.alloc(node), node);
  }

  /** Bind a variable directly to an existing cell (copy elision for let). */
  declareAs(name, cell, node) {
    const scope = this.scopes[this.scopes.length - 1];
    if (scope.has(name)) {
      throw new CompileError(`Variable '${name}' already declared in this scope`, node.line, node.col);
    }
    scope.set(name, cell);
    if (this.scopes.length === 1) {
      this.globalSymbols[name] = cell;
    }
    return cell;
  }

  /**
   * Rebind a variable to a new cell (copy elision for assignment). Only
   * valid in straight-line code: code emitted earlier in a loop body or
   * branch still reads the old cell when it re-executes or is skipped.
   */
  rebind(name, cell) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) {
        this.scopes[i].set(name, cell);
        if (i === 0) this.globalSymbols[name] = cell;
        return;
      }
    }
  }

  resolve(name, node) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) return this.scopes[i].get(name);
    }
    throw new CompileError(`Unknown variable '${name}'`, node.line, node.col);
  }
}

/** Fold expressions made only of literals; returns a number or null. */
function tryConstEval(node) {
  if (node.type === 'Num') return node.value;
  if (node.type === 'Binary') {
    const left = tryConstEval(node.left);
    const right = tryConstEval(node.right);
    if (left === null || right === null) return null;
    switch (node.op) {
      case '+': return left + right;
      case '-': return left - right;
      case '*': return left * right;
      case '==': return Number(left === right);
      case '!=': return Number(left !== right);
      case '<': return Number(left < right);
      case '<=': return Number(left <= right);
      case '>': return Number(left > right);
      case '>=': return Number(left >= right);
      default: return null;
    }
  }
  return null;
}

const COMPARISON_OPS = new Set(['==', '!=', '<', '<=', '>', '>=']);

export function generate(program) {
  const em = new Emitter();

  /** Evaluate an expression into a fresh temp cell owned by the caller. */
  const evalExpr = (node) => {
    const constant = tryConstEval(node);
    if (constant !== null) {
      const entry = em.allocRaw(node);
      em.writeConst(entry.cell, entry.value, constant);
      return entry.cell;
    }

    switch (node.type) {
      case 'Var': {
        const src = em.resolve(node.name, node);
        const cell = em.alloc(node);
        em.copyInto(src, cell, node);
        return cell;
      }
      case 'Binary': {
        if (COMPARISON_OPS.has(node.op)) return genComparison(node);
        if (node.op === '*') return genMultiply(node);
        const left = evalExpr(node.left);
        const right = evalExpr(node.right);
        em.drainInto(right, left, node.op === '+' ? '+' : '-');
        em.free(right);
        return left;
      }
      case 'Call':
        return evalReadBuiltin(node);
      case 'Str':
        throw new CompileError('Strings are only allowed as the argument of say()', node.line, node.col);
      default:
        throw new CompileError(`Cannot evaluate ${node.type}`, node.line, node.col);
    }
  };

  /** Evaluate into an existing cell that currently holds 0. */
  const evalExprInto = (node, dst) => {
    const constant = tryConstEval(node);
    if (constant !== null) {
      em.add(dst, constant);
      return;
    }
    if (node.type === 'Call' && (node.callee in READ_BUILTINS || node.callee === 'volumeOf')) {
      // Reads can write straight to dst via ^, avoiding a long drain from a
      // faraway temp — this matters inside comparison loops.
      evalReadBuiltinInto(node, dst);
      return;
    }
    if (node.type === 'Var') {
      // Copy the variable straight into dst instead of via a temp (which
      // would move the whole value twice).
      em.copyInto(em.resolve(node.name, node), dst, node);
      return;
    }
    const tmp = evalExpr(node);
    em.drainInto(tmp, dst);
    em.free(tmp);
  };

  /**
   * Multiplication. Unary cells mean any product executes at least a·b
   * increments — the optimizations here attack the constant factor:
   * - value × constant k: one loop over the value emitting k '+'s per
   *   iteration (~1 op per product unit).
   * - var × var: repeated addition in a tight 4-cell block [L, B, R, T] so
   *   inner-loop pointer hops are 1-2 cells (~16 ops per product unit).
   * Fully-constant products never get here — tryConstEval folds them.
   */
  const genMultiply = (node) => {
    const leftConst = tryConstEval(node.left);
    const rightConst = tryConstEval(node.right);
    if (leftConst !== null || rightConst !== null) {
      const k = leftConst ?? rightConst;
      const valueNode = leftConst !== null ? node.right : node.left;
      if (k === 0) {
        // Still evaluate for read side effects (e.g. invalid-reservoir beeps).
        const v = evalExpr(valueNode);
        em.freeDirty(v);
        return em.alloc(node);
      }
      if (k === 1) return evalExpr(valueNode);
      const v = evalExpr(valueNode);
      const result = em.alloc(node, v);
      em.moveTo(v);
      em.emit('[');
      em.add(v, -1);
      em.add(result, k);
      em.moveTo(v);
      em.emit(']');
      em.free(v); // consumed to 0
      return result;
    }

    // var × var: repeated addition. No reserved block here — freelist/bump
    // allocation already lands these cells adjacent, and forcing a block
    // pushes the copy scratch further away (measured slower).
    const left = evalExpr(node.left);
    const right = evalExpr(node.right);
    const result = em.alloc(node, right);
    em.moveTo(left);
    em.emit('[');
    em.add(left, -1);
    em.copyInto(right, result, node);
    em.moveTo(left);
    em.emit(']');
    em.free(left); // consumed to 0
    em.freeDirty(right); // preserved by copyInto, so still nonzero
    return result;
  };

  /** out += (cell != 0) as 0/1; consumes cell. out must... already hold the
      base value the caller wants (usually 0). */
  const boolifyInto = (cell, out) => {
    em.moveTo(cell);
    em.emit('[');
    em.emit('[-]');
    em.add(out, 1);
    em.moveTo(cell);
    em.emit(']');
  };

  /** Returns a fresh cell holding 1 - cell, for cell ∈ {0, 1}; consumes cell. */
  const invertBool = (cell, node) => {
    const out = em.alloc(node);
    em.add(out, 1);
    em.moveTo(cell);
    em.emit('[');
    em.add(out, -1);
    em.moveTo(cell);
    em.emit('-');
    em.emit(']');
    em.free(cell);
    return out;
  };

  /**
   * result = (value > kk) for constant kk >= 0, via a guarded countdown:
   * decrement a copy of the value kk times, breaking early if it hits zero;
   * value > kk iff anything is left. ~35·min(value, kk) executed ops and
   * ~120 chars vs ~100·min ops and ~500 chars for the general race.
   * Block layout: [A, m1, z1, z2, m2, K, R].
   */
  const genGreaterThanConst = (valueNode, kk, node) => {
    const blk = em.allocBlock(7, node);
    const A = blk;
    const m2 = blk + 4;
    const K = blk + 5;
    const R = blk + 6;
    evalExprInto(valueNode, A);
    em.setConst(K, kk, { assumeZero: true }, node);
    em.moveTo(K);
    em.emit('[');
    em.ifZeroElse(
      A,
      m2,
      () => {
        // A exhausted early (value <= budget spent): force the loop to end.
        em.clear(K);
        em.add(K, 1);
      },
      () => em.add(A, -1)
    );
    em.moveTo(K);
    em.emit('-');
    em.emit(']');
    boolifyInto(A, R);
    em.freeBlock(blk, 6); // A..K all end at 0
    return R;
  };

  /**
   * result = (value == k) for constant k >= 1: same countdown, but with an
   * underflow flag (value < k). Equal iff the countdown completed (no
   * underflow) and nothing is left over. Block: [A, m1, z1, z2, m2, K, R, U].
   */
  const genEqualsConst = (valueNode, k, node) => {
    const blk = em.allocBlock(8, node);
    const A = blk;
    const m2 = blk + 4;
    const K = blk + 5;
    const R = blk + 6;
    const U = blk + 7;
    evalExprInto(valueNode, A);
    em.setConst(K, k, { assumeZero: true }, node);
    em.moveTo(K);
    em.emit('[');
    em.ifZeroElse(
      A,
      m2,
      () => {
        em.add(U, 1); // underflow: value < k
        em.clear(K);
        em.add(K, 1);
      },
      () => em.add(A, -1)
    );
    em.moveTo(K);
    em.emit('-');
    em.emit(']');
    // R = !U, then zeroed if the copy has leftovers (value > k).
    em.add(R, 1);
    em.moveTo(U);
    em.emit('[');
    em.add(R, -1);
    em.moveTo(U);
    em.emit('-');
    em.emit(']');
    em.moveTo(A);
    em.emit('[');
    em.emit('[-]');
    em.clear(R);
    em.moveTo(A);
    em.emit(']');
    em.freeBlock(blk, 6);
    em.free(U); // consumed to 0
    return R;
  };

  const MIRRORED_OP = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '==': '==', '!=': '!=' };

  /** Comparison where exactly one side is a compile-time constant: value OP k. */
  const genConstComparison = (op, valueNode, k, node) => {
    // Language values are non-negative, so negative constants decide statically.
    if (k < 0) {
      const cell = em.alloc(node);
      em.add(cell, op === '>' || op === '>=' || op === '!=' ? 1 : 0);
      return cell;
    }
    if (k === 0) {
      switch (op) {
        case '>=': {
          const cell = em.alloc(node);
          em.add(cell, 1);
          return cell;
        }
        case '<':
          return em.alloc(node); // always 0
        case '>':
        case '!=': {
          const v = evalExpr(valueNode);
          const out = em.alloc(node);
          boolifyInto(v, out);
          em.free(v);
          return out;
        }
        case '<=':
        case '==': {
          const v = evalExpr(valueNode);
          const out = em.alloc(node);
          boolifyInto(v, out);
          em.free(v);
          return invertBool(out, node);
        }
      }
    }
    switch (op) {
      case '>':
        return genGreaterThanConst(valueNode, k, node);
      case '>=':
        return genGreaterThanConst(valueNode, k - 1, node);
      case '<':
        return invertBool(genGreaterThanConst(valueNode, k - 1, node), node);
      case '<=':
        return invertBool(genGreaterThanConst(valueNode, k, node), node);
      case '==':
        return genEqualsConst(valueNode, k, node);
      case '!=':
        return invertBool(genEqualsConst(valueNode, k, node), node);
      default:
        throw new CompileError(`Unknown comparison '${op}'`, node.line, node.col);
    }
  };

  /**
   * Comparisons produce 0/1. When one operand is constant, the cheap
   * countdown forms above apply. Otherwise: a paired-decrement race on copies
   * of the operands; each round is O(1) thanks to ifZeroElse, so it costs
   * ~100·min(a,b) executed ops. Either way comparisons only terminate for
   * non-negative operands.
   *
   * Race variants: lt → 1 iff A exhausts while B is nonzero;
   * le → 1 iff A exhausts first or simultaneously; eq → 1 iff both exhaust
   * together. '>'/' >=' swap which operand fills which block (source
   * evaluation order is preserved), '!=' inverts eq.
   */
  const genComparison = (node) => {
    const leftConst = tryConstEval(node.left);
    const rightConst = tryConstEval(node.right);
    if (leftConst !== null || rightConst !== null) {
      // Fully-constant comparisons fold before reaching here.
      const k = leftConst ?? rightConst;
      const valueNode = leftConst !== null ? node.right : node.left;
      const op = leftConst !== null ? MIRRORED_OP[node.op] : node.op;
      return genConstComparison(op, valueNode, k, node);
    }

    const variant = { '<': 'lt', '<=': 'le', '>': 'lt', '>=': 'le', '==': 'eq', '!=': 'eq' }[node.op];
    const swapped = node.op === '>' || node.op === '>=';

    // One contiguous block keeps every pointer hop inside the race loop short
    // (the per-round cost is dominated by pointer travel):
    // [A, m1a, z1a, z2a, m2a, F, B, m1b, z1b, z2b, m2b, R]
    const blk = em.allocBlock(12, node);
    const aBlk = blk;
    const m2a = blk + 4;
    const flag = blk + 5;
    const bBlk = blk + 6;
    const m2b = blk + 10;
    const result = blk + 11;
    evalExprInto(node.left, swapped ? bBlk : aBlk);
    evalExprInto(node.right, swapped ? aBlk : bBlk);

    em.add(flag, 1);
    em.moveTo(flag);
    em.emit('[');
    em.ifZeroElse(
      aBlk,
      m2a,
      () => {
        // A exhausted (first, or together with B)
        em.add(flag, -1);
        if (variant === 'le') {
          em.add(result, 1);
        } else if (variant === 'lt') {
          em.ifZeroElse(bBlk, m2b, () => {}, () => em.add(result, 1));
        } else {
          em.ifZeroElse(bBlk, m2b, () => em.add(result, 1), () => {});
        }
      },
      () => {
        em.ifZeroElse(
          bBlk,
          m2b,
          () => em.add(flag, -1), // B exhausted first: a > b, result stays 0
          () => {
            em.add(aBlk, -1);
            em.add(bBlk, -1);
          }
        );
      }
    );
    em.moveTo(flag);
    em.emit(']');

    em.free(flag); // loop exits with flag = 0
    em.free(m2a); // ifZeroElse always consumes its m2
    em.free(m2b);
    em.freeDirty(aBlk); // leftover counter values
    em.freeDirty(bBlk);
    em.freeBlock(aBlk + 1, 3); // scratch cells are guaranteed 0
    em.freeBlock(bBlk + 1, 3);

    if (node.op === '!=') return invertBool(result, node);
    return result;
  };

  const expectArgs = (node, count) => {
    if (node.args.length !== count) {
      throw new CompileError(`${node.callee}() takes ${count} argument(s), got ${node.args.length}`, node.line, node.col);
    }
  };

  const loadRegister = (node, reg) => {
    // reg: '}' = sx, ')' = tx, "'" = ax — each reads the current cell.
    const cell = evalExpr(node);
    em.moveTo(cell);
    em.emit(reg);
    return cell;
  };

  /** Free an argument cell, recording its value when the argument was a
      constant (register loads don't consume the cell). */
  const freeArg = (cell, argNode) => {
    const k = tryConstEval(argNode);
    if (k !== null) em.freeKnown(cell, k);
    else em.freeDirty(cell);
  };

  /** Emit a read builtin so its result lands in dst (which must hold 0). */
  const evalReadBuiltinInto = (node, dst) => {
    if (node.callee in READ_BUILTINS) {
      expectArgs(node, 1);
      evalExprInto(node.args[0], dst); // reservoir id
      em.moveTo(dst);
      em.emit('}'); // sx = id
      em.emit(READ_BUILTINS[node.callee]);
      em.emit('^'); // overwrite the id cell with ax (the result)
      return;
    }
    if (node.callee === 'volumeOf') {
      expectArgs(node, 2);
      const res = loadRegister(node.args[0], '}');
      freeArg(res, node.args[0]);
      evalExprInto(node.args[1], dst); // reagent index
      em.moveTo(dst); // V reads the index from the current cell
      em.emit('V');
      em.emit('^');
      return;
    }
    throw new CompileError(`Unknown function '${node.callee}' in expression`, node.line, node.col);
  };

  const evalReadBuiltin = (node) => {
    const cell = em.alloc(node);
    evalReadBuiltinInto(node, cell);
    return cell;
  };

  const genTransfer = (node, srcArg, tgtArg, amtArg, indexArg = null) => {
    const src = loadRegister(srcArg, '}');
    freeArg(src, srcArg);
    const tgt = loadRegister(tgtArg, ')');
    freeArg(tgt, tgtArg);
    const amt = loadRegister(amtArg, "'");
    freeArg(amt, amtArg);
    if (indexArg) {
      const idx = evalExpr(indexArg);
      em.moveTo(idx); // # reads the reagent index from the current cell
      em.emit('#');
      freeArg(idx, indexArg);
    } else {
      em.emit('@');
    }
  };

  const genCallStatement = (node) => {
    switch (node.callee) {
      case 'transfer':
        expectArgs(node, 3);
        genTransfer(node, node.args[0], node.args[1], node.args[2]);
        return;
      case 'isolate':
        expectArgs(node, 4);
        genTransfer(node, node.args[0], node.args[1], node.args[2], node.args[3]);
        return;
      case 'pill':
      case 'vial':
      case 'drain': {
        expectArgs(node, 2);
        const target = { pill: 11, vial: 12, drain: 13 }[node.callee];
        genTransfer(node, node.args[0], { type: 'Num', value: target, line: node.line, col: node.col }, node.args[1]);
        return;
      }
      case 'heat': {
        // Heats toward (ax - tx) °C. Cooling below 0°C needs tx > 0, which we
        // support for constant arguments; runtime values must be >= 0 °C.
        expectArgs(node, 2);
        const res = loadRegister(node.args[0], '}');
        freeArg(res, node.args[0]);
        const degC = tryConstEval(node.args[1]);
        if (degC !== null && degC < 0) {
          const tx = em.alloc(node);
          em.setConst(tx, -degC, { assumeZero: true });
          em.moveTo(tx);
          em.emit(')');
          em.freeKnown(tx, -degC);
          const ax = em.alloc(node);
          em.moveTo(ax);
          em.emit("'"); // ax = 0
          em.free(ax);
        } else {
          const tx = em.alloc(node);
          em.moveTo(tx);
          em.emit(')'); // tx = 0
          em.free(tx);
          const ax = loadRegister(node.args[1], "'");
          freeArg(ax, node.args[1]);
        }
        em.emit('$');
        return;
      }
      case 'waitReaction':
        expectArgs(node, 0);
        em.emit('*');
        return;
      case 'say': {
        expectArgs(node, 1);
        const arg = node.args[0];
        if (arg.type !== 'Str') {
          throw new CompileError('say() takes a string literal', node.line, node.col);
        }
        const cell = em.alloc(node);
        let current = 0;
        for (const ch of arg.value) {
          const code = ch.codePointAt(0);
          if (current === 0) em.setConst(cell, code, { assumeZero: true }, node);
          else em.add(cell, code - current);
          em.moveTo(cell);
          em.emit('.');
          current = code;
        }
        if (current === 0) em.free(cell);
        else em.freeKnown(cell, current); // cell holds the last character code
        return;
      }
      case 'temp':
      case 'volume':
      case 'volumeOf':
      case 'reagentCount': {
        // Read builtin used as a statement: evaluate and discard.
        const cell = evalReadBuiltin(node);
        em.freeDirty(cell);
        return;
      }
      default:
        throw new CompileError(`Unknown function '${node.callee}'`, node.line, node.col);
    }
  };

  const genStatement = (node) => {
    switch (node.type) {
      case 'Let': {
        const constant = tryConstEval(node.init);
        if (constant !== null) {
          const entry = em.allocRaw(node);
          em.writeConst(entry.cell, entry.value, constant);
          em.declareAs(node.name, entry.cell, node);
          return;
        }
        // Evaluate the initializer before declaring, so `let x = x + 1;`
        // resolves x to an outer scope (or errors) instead of reading 0.
        // The variable then binds directly to the result cell (copy elision —
        // always safe at the binding point, drains nothing).
        const tmp = evalExpr(node.init);
        em.declareAs(node.name, tmp, node);
        return;
      }
      case 'Assign': {
        // Evaluate before touching the destination so `x = x + 1;` works.
        const cell = em.resolve(node.name, node);
        const tmp = evalExpr(node.value);
        if (em.loopDepth === 0 && em.branchDepth === 0) {
          // Straight-line code: rebind instead of draining (copy elision).
          em.rebind(node.name, tmp);
          em.freeDirty(cell);
        } else {
          em.clear(cell);
          em.drainInto(tmp, cell);
          em.free(tmp);
        }
        return;
      }
      case 'While': {
        const test = em.alloc(node);
        evalExprInto(node.test, test);
        em.moveTo(test);
        em.emit('[');
        em.degradeFreeValues(); // don't delta against stale pre-loop values
        const snapshot = em.snapshotFreeState();
        em.loopDepth++;
        em.enterScope();
        for (const stmt of node.body) genStatement(stmt);
        em.exitScope();
        em.clear(test);
        evalExprInto(node.test, test);
        em.reconcileFreeState(snapshot); // square up freed cells for the back-edge
        em.moveTo(test);
        em.loopDepth--;
        em.emit(']');
        em.mergeFreeState(snapshot); // covers the zero-iterations path
        em.free(test); // loop exits with test = 0
        return;
      }
      case 'If': {
        const test = em.alloc(node);
        evalExprInto(node.test, test);
        const snapshot = em.snapshotFreeState();
        em.branchDepth++;
        if (!node.alternate) {
          em.moveTo(test);
          em.emit('[');
          em.enterScope();
          for (const stmt of node.consequent) genStatement(stmt);
          em.exitScope();
          em.clear(test);
          em.emit(']');
          em.free(test);
        } else {
          const elseFlag = em.alloc(node);
          em.add(elseFlag, 1);
          em.moveTo(test);
          em.emit('[');
          em.enterScope();
          for (const stmt of node.consequent) genStatement(stmt);
          em.exitScope();
          em.add(elseFlag, -1);
          em.clear(test);
          em.emit(']');
          em.free(test);
          // The else path skipped the then-branch at runtime, so its code
          // must be emitted against the pre-if view of freed-cell values.
          const thenState = em.snapshotFreeState();
          em.restoreFreeValues(snapshot);
          em.moveTo(elseFlag);
          em.emit('[');
          em.enterScope();
          for (const stmt of node.alternate) genStatement(stmt);
          em.exitScope();
          em.add(elseFlag, -1);
          em.moveTo(elseFlag);
          em.emit(']');
          em.free(elseFlag);
          em.branchDepth--;
          em.mergeFreeState(thenState); // keep values only where both branches agree
          return;
        }
        em.branchDepth--;
        em.mergeFreeState(snapshot); // covers the skipped-branch path
        return;
      }
      case 'ExprStatement':
        genCallStatement(node.expr);
        return;
      default:
        throw new CompileError(`Cannot generate ${node.type}`, node.line ?? 0, node.col ?? 0);
    }
  };

  for (const stmt of program.body) genStatement(stmt);

  return {
    code: em.out.join(''),
    symbols: em.globalSymbols,
    cellsUsed: em.nextCell,
  };
}
