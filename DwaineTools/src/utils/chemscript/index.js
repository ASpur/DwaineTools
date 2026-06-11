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

export function compile(source) {
  try {
    const ast = parse(source);
    const { code, symbols, cellsUsed } = generate(ast);
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
