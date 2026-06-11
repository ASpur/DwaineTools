/**
 * ChemScript lexer. Produces tokens with line/col for error reporting.
 * See docs/chemscript-plan.md for the language definition.
 */

export class CompileError extends Error {
  constructor(message, line, col) {
    super(message);
    this.name = 'CompileError';
    this.line = line;
    this.col = col;
  }
}

const KEYWORDS = new Set(['let', 'while', 'if', 'else']);
const PUNCTUATION = new Set(['(', ')', '{', '}', ';', ',', '=', '+', '-']);

export function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (source[i] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };

  while (i < source.length) {
    const ch = source[i];
    const startLine = line;
    const startCol = col;

    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      advance();
      continue;
    }

    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') advance();
      continue;
    }

    if (ch === '/' && source[i + 1] === '*') {
      advance(2);
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) advance();
      if (i >= source.length) throw new CompileError('Unterminated block comment', startLine, startCol);
      advance(2);
      continue;
    }

    if (ch >= '0' && ch <= '9') {
      let text = '';
      while (i < source.length && source[i] >= '0' && source[i] <= '9') {
        text += source[i];
        advance();
      }
      tokens.push({ type: 'number', value: Number(text), line: startLine, col: startCol });
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      let text = '';
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i])) {
        text += source[i];
        advance();
      }
      tokens.push({
        type: KEYWORDS.has(text) ? text : 'ident',
        value: text,
        line: startLine,
        col: startCol,
      });
      continue;
    }

    if (ch === '"') {
      advance();
      let text = '';
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\\') {
          advance();
          const esc = source[i];
          if (esc === 'n') text += '\n';
          else if (esc === 't') text += '\t';
          else if (esc === '"') text += '"';
          else if (esc === '\\') text += '\\';
          else throw new CompileError(`Unknown escape \\${esc}`, line, col);
          advance();
        } else {
          text += source[i];
          advance();
        }
      }
      if (i >= source.length) throw new CompileError('Unterminated string', startLine, startCol);
      advance(); // closing quote
      tokens.push({ type: 'string', value: text, line: startLine, col: startCol });
      continue;
    }

    if (PUNCTUATION.has(ch)) {
      tokens.push({ type: ch, value: ch, line: startLine, col: startCol });
      advance();
      continue;
    }

    throw new CompileError(`Unexpected character '${ch}'`, startLine, startCol);
  }

  tokens.push({ type: 'eof', value: null, line, col });
  return tokens;
}
