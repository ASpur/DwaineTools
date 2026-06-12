/**
 * ChemScript compiler entry point. See docs/chemscript-plan.md.
 *
 * compile(source) → {
 *   ok:       boolean
 *   code:     ChemFuck string ('' on failure)
 *   errors:   [{ message, line, col }]
 *   symbols:  { varName: tapeCell } for top-level variables (test hook)
 *   stats:    { instructions, cellsUsed }
 * }
 */
import { CompileError } from './lexer.js';
import { parse } from './parser.js';
import { generate } from './codegen.js';

export { CompileError } from './lexer.js';
export { parse } from './parser.js';

/**
 * Peephole pass over emitted ChemFuck. Every rule below is unconditionally
 * safe — no context analysis needed:
 * - `><` / `<>`: adjacent opposite moves with nothing between are a no-op.
 * - `+-` / `-+`: adjacent inc/dec of the same cell are a no-op. (Cancelling
 *   pairs can create `[]` from e.g. `[+-]`, but the original was an equally
 *   infinite loop, so behavior is preserved.)
 * - `][-]` → `]`: a `]` only falls through when the current cell is 0, so an
 *   immediately following clear is a no-op. (Any "[-]" substring is a
 *   complete balanced loop, so the match can't split a larger loop.)
 * - `[-][-]` → `[-]`: the second clear always sees a zero cell.
 *
 * Note: measured against this compiler's output these rules currently fire
 * rarely — static pointer tracking means the codegen doesn't emit adjacent
 * cancellable pairs. The pass is kept for hand-written input and as a safety
 * net for future emitters.
 */
export function optimize(code) {
  let prev;
  do {
    prev = code;
    code = code.replace(/><|<>/g, '');
    code = code.replace(/\+-|-\+/g, '');
    code = code.replace(/\](\[-\])+/g, ']');
    code = code.replace(/\[-\]\[-\]/g, '[-]');
  } while (code !== prev);
  return code;
}

export function compile(source) {
  try {
    const ast = parse(source);
    let { code, symbols, cellsUsed } = generate(ast);
    code = optimize(code);
    return {
      ok: true,
      code,
      errors: [],
      symbols,
      stats: { instructions: code.length, cellsUsed },
    };
  } catch (error) {
    if (error instanceof CompileError) {
      return {
        ok: false,
        code: '',
        errors: [{ message: error.message, line: error.line, col: error.col }],
        symbols: {},
        stats: { instructions: 0, cellsUsed: 0 },
      };
    }
    throw error;
  }
}
