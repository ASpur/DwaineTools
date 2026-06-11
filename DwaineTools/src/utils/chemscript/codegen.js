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
    return node.op === '+' ? left + right : left - right;
  }
  return null;
}

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
    const tmp = evalExpr(node);
    em.drainInto(tmp, dst);
    em.free(tmp);
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

  const evalReadBuiltin = (node) => {
    if (node.callee in READ_BUILTINS) {
      expectArgs(node, 1);
      const cell = loadRegister(node.args[0], '}'); // sx = reservoir id
      em.emit(READ_BUILTINS[node.callee]);
      em.emit('^'); // overwrite the id cell with ax (the result)
      return cell;
    }
    if (node.callee === 'volumeOf') {
      expectArgs(node, 2);
      const res = loadRegister(node.args[0], '}');
      em.freeDirty(res);
      const idx = evalExpr(node.args[1]);
      em.moveTo(idx); // V reads the reagent index from the current cell
      em.emit('V');
      em.emit('^');
      return idx;
    }
    throw new CompileError(`Unknown function '${node.callee}' in expression`, node.line, node.col);
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
