/**
 * ChemScript code generator: AST → ChemFuck.
 *
 * Core invariants:
 * - The data pointer position is statically known at all times; moveTo()
 *   emits the > / < runs between fixed cell addresses.
 * - Cells obtained from alloc() are guaranteed to hold 0 at runtime. free()
 *   returns a cell to the pool; freeing a possibly-nonzero cell goes through
 *   freeDirty(), which emits a clear ([-]) first.
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
    this.freeList = [];
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

  alloc(node) {
    if (this.freeList.length > 0) return this.freeList.pop();
    if (this.nextCell >= RAM_SIZE) {
      throw new CompileError('Out of tape memory (1024 cells)', node?.line ?? 0, node?.col ?? 0);
    }
    return this.nextCell++;
  }

  free(cell) {
    this.freeList.push(cell);
  }

  freeDirty(cell) {
    this.clear(cell);
    this.free(cell);
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

  setConst(cell, n, { assumeZero = false } = {}) {
    if (!assumeZero) this.clear(cell);
    this.add(cell, n);
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

  /** dst += src, src preserved (via a scratch cell). */
  copyInto(src, dst, node) {
    const tmp = this.alloc(node);
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
    const scope = this.scopes[this.scopes.length - 1];
    if (scope.has(name)) {
      throw new CompileError(`Variable '${name}' already declared in this scope`, node.line, node.col);
    }
    const cell = this.alloc(node);
    scope.set(name, cell);
    if (this.scopes.length === 1 && !(name in this.globalSymbols)) {
      this.globalSymbols[name] = cell;
    }
    return cell;
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
      const cell = em.alloc(node);
      em.setConst(cell, constant, { assumeZero: true });
      return cell;
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
    const tmp = evalExpr(node);
    em.drainInto(tmp, dst);
    em.free(tmp);
  };

  /**
   * result = left * right by repeated addition: O(left · right) executed ops,
   * so keep non-constant products small (see docs). Constant products never
   * get here — tryConstEval folds them.
   */
  const genMultiply = (node) => {
    const left = evalExpr(node.left);
    const right = evalExpr(node.right);
    const result = em.alloc(node);
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

  /**
   * Comparisons produce 0/1 via a paired-decrement race on copies of the
   * operands: each round is O(1) thanks to ifZeroElse, so a comparison costs
   * ~60·min(a,b) executed ops and only terminates for non-negative operands.
   *
   * Race variants: lt → 1 iff A exhausts while B is nonzero;
   * le → 1 iff A exhausts first or simultaneously; eq → 1 iff both exhaust
   * together. '>'/' >=' swap which operand fills which block (source
   * evaluation order is preserved), '!=' inverts eq.
   */
  const genComparison = (node) => {
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

    if (node.op === '!=') {
      const inverted = em.alloc(node);
      em.add(inverted, 1);
      em.moveTo(result);
      em.emit('[');
      em.add(inverted, -1);
      em.moveTo(result);
      em.emit('-');
      em.emit(']');
      em.free(result);
      return inverted;
    }
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
      em.freeDirty(res);
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
    em.freeDirty(src);
    const tgt = loadRegister(tgtArg, ')');
    em.freeDirty(tgt);
    const amt = loadRegister(amtArg, "'");
    em.freeDirty(amt);
    if (indexArg) {
      const idx = evalExpr(indexArg);
      em.moveTo(idx); // # reads the reagent index from the current cell
      em.emit('#');
      em.freeDirty(idx);
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
        em.freeDirty(res);
        const degC = tryConstEval(node.args[1]);
        if (degC !== null && degC < 0) {
          const tx = em.alloc(node);
          em.setConst(tx, -degC, { assumeZero: true });
          em.moveTo(tx);
          em.emit(')');
          em.freeDirty(tx);
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
          em.freeDirty(ax);
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
          em.add(cell, code - current);
          em.moveTo(cell);
          em.emit('.');
          current = code;
        }
        em.freeDirty(cell);
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
          const cell = em.declare(node.name, node);
          em.setConst(cell, constant, { assumeZero: true });
          return;
        }
        // Evaluate the initializer before declaring, so `let x = x + 1;`
        // resolves x to an outer scope (or errors) instead of reading 0.
        const tmp = evalExpr(node.init);
        const cell = em.declare(node.name, node);
        em.drainInto(tmp, cell);
        em.free(tmp);
        return;
      }
      case 'Assign': {
        // Evaluate before clearing the destination so `x = x + 1;` works.
        const cell = em.resolve(node.name, node);
        const tmp = evalExpr(node.value);
        em.clear(cell);
        em.drainInto(tmp, cell);
        em.free(tmp);
        return;
      }
      case 'While': {
        const test = em.alloc(node);
        evalExprInto(node.test, test);
        em.moveTo(test);
        em.emit('[');
        em.enterScope();
        for (const stmt of node.body) genStatement(stmt);
        em.exitScope();
        em.clear(test);
        evalExprInto(node.test, test);
        em.moveTo(test);
        em.emit(']');
        em.free(test); // loop exits with test = 0
        return;
      }
      case 'If': {
        const test = em.alloc(node);
        evalExprInto(node.test, test);
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
          em.moveTo(elseFlag);
          em.emit('[');
          em.enterScope();
          for (const stmt of node.alternate) genStatement(stmt);
          em.exitScope();
          em.add(elseFlag, -1);
          em.moveTo(elseFlag);
          em.emit(']');
          em.free(elseFlag);
        }
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
