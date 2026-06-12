/**
 * ChemScript recursive-descent parser.
 *
 * program    := statement*
 * statement  := 'let' IDENT '=' expr ';'
 *             | IDENT '=' expr ';'
 *             | 'while' '(' expr ')' block
 *             | 'if' '(' expr ')' block ('else' (block | ifStmt))?
 *             | call ';'
 * block      := '{' statement* '}'
 * expr       := additive (('=='|'!='|'<'|'<='|'>'|'>=') additive)?   -- no chaining
 * additive   := multiplicative (('+'|'-') multiplicative)*
 * multiplicative := term ('*' term)*
 * term       := NUMBER | '-' NUMBER | IDENT | call | '(' expr ')'
 * call       := IDENT '(' (expr (',' expr)*)? ')'
 */
import { CompileError, tokenize } from './lexer.js';

export function parse(source) {
  const tokens = tokenize(source);
  let pos = 0;

  const peek = (offset = 0) => tokens[pos + offset];
  const next = () => tokens[pos++];
  const expect = (type, what = type) => {
    const token = peek();
    if (token.type !== type) {
      throw new CompileError(`Expected ${what} but got '${token.value ?? 'end of input'}'`, token.line, token.col);
    }
    return next();
  };

  const parseBlock = () => {
    expect('{', "'{'");
    const body = [];
    while (peek().type !== '}' && peek().type !== 'eof') {
      body.push(parseStatement());
    }
    expect('}', "'}'");
    return body;
  };

  const parseCall = (nameToken) => {
    expect('(', "'('");
    const args = [];
    if (peek().type !== ')') {
      do {
        if (peek().type === 'string') {
          const str = next();
          args.push({ type: 'Str', value: str.value, line: str.line, col: str.col });
        } else {
          args.push(parseExpr());
        }
      } while (peek().type === ',' && next());
    }
    expect(')', "')'");
    return { type: 'Call', callee: nameToken.value, args, line: nameToken.line, col: nameToken.col };
  };

  const parseTerm = () => {
    const token = peek();
    if (token.type === 'number') {
      next();
      return { type: 'Num', value: token.value, line: token.line, col: token.col };
    }
    if (token.type === '-' && peek(1).type === 'number') {
      next();
      const num = next();
      return { type: 'Num', value: -num.value, line: token.line, col: token.col };
    }
    if (token.type === 'ident') {
      next();
      if (peek().type === '(') return parseCall(token);
      return { type: 'Var', name: token.value, line: token.line, col: token.col };
    }
    if (token.type === '(') {
      next();
      const expr = parseExpr();
      expect(')', "')'");
      return expr;
    }
    throw new CompileError(`Expected expression but got '${token.value ?? 'end of input'}'`, token.line, token.col);
  };

  const parseMultiplicative = () => {
    let left = parseTerm();
    while (peek().type === '*') {
      const op = next();
      const right = parseTerm();
      left = { type: 'Binary', op: op.type, left, right, line: op.line, col: op.col };
    }
    return left;
  };

  const parseAdditive = () => {
    let left = parseMultiplicative();
    while (peek().type === '+' || peek().type === '-') {
      const op = next();
      const right = parseMultiplicative();
      left = { type: 'Binary', op: op.type, left, right, line: op.line, col: op.col };
    }
    return left;
  };

  const COMPARISON_OPS = new Set(['==', '!=', '<', '<=', '>', '>=']);

  const parseExpr = () => {
    let left = parseAdditive();
    if (COMPARISON_OPS.has(peek().type)) {
      const op = next();
      const right = parseAdditive();
      if (COMPARISON_OPS.has(peek().type)) {
        const tok = peek();
        throw new CompileError('Chained comparisons are not supported', tok.line, tok.col);
      }
      left = { type: 'Binary', op: op.type, left, right, line: op.line, col: op.col };
    }
    return left;
  };

  const parseIf = (ifToken) => {
    expect('(', "'('");
    const test = parseExpr();
    expect(')', "')'");
    const consequent = parseBlock();
    let alternate = null;
    if (peek().type === 'else') {
      next();
      if (peek().type === 'if') {
        alternate = [parseIf(next())];
      } else {
        alternate = parseBlock();
      }
    }
    return { type: 'If', test, consequent, alternate, line: ifToken.line, col: ifToken.col };
  };

  const parseStatement = () => {
    const token = peek();

    if (token.type === 'let') {
      next();
      const name = expect('ident', 'variable name');
      expect('=', "'='");
      const init = parseExpr();
      expect(';', "';'");
      return { type: 'Let', name: name.value, init, line: token.line, col: token.col };
    }

    if (token.type === 'while') {
      next();
      expect('(', "'('");
      const test = parseExpr();
      expect(')', "')'");
      const body = parseBlock();
      return { type: 'While', test, body, line: token.line, col: token.col };
    }

    if (token.type === 'if') {
      next();
      return parseIf(token);
    }

    if (token.type === 'ident') {
      if (peek(1).type === '=') {
        next();
        next();
        const value = parseExpr();
        expect(';', "';'");
        return { type: 'Assign', name: token.value, value, line: token.line, col: token.col };
      }
      if (peek(1).type === '(') {
        next();
        const call = parseCall(token);
        expect(';', "';'");
        return { type: 'ExprStatement', expr: call, line: token.line, col: token.col };
      }
    }

    throw new CompileError(`Unexpected '${token.value ?? 'end of input'}'`, token.line, token.col);
  };

  const body = [];
  while (peek().type !== 'eof') {
    body.push(parseStatement());
  }
  return { type: 'Program', body };
}
