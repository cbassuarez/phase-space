// Lightweight JS mirror of the phasecore expression grammar — a CI pre-check.
// The runtime Rust evaluator is the real authority; this catches obvious
// problems early and is the same whitelist (vars/params/consts/functions only).

const FUNCS = {
  sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1,
  sinh: 1, cosh: 1, tanh: 1, exp: 1, ln: 1, log: 1,
  sqrt: 1, abs: 1, sign: 1, floor: 1,
  atan2: 2, min: 2, max: 2, mod: 2, pow: 2,
};
const VARS = new Set(["x", "y", "z", "t"]);
const CONSTS = new Set(["pi", "e"]);
const MAX_LEN = 512;

function tokenize(src) {
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const start = i;
    if ("+-*/^(),".includes(c)) { toks.push({ t: c, pos: start }); i++; continue; }
    if (/[0-9.]/.test(c)) {
      while (i < src.length && /[0-9.eE]/.test(src[i]) || (("+-".includes(src[i])) && /[eE]/.test(src[i - 1]))) i++;
      const n = Number(src.slice(start, i));
      if (!Number.isFinite(n)) throw { message: `Bad number '${src.slice(start, i)}'`, pos: start };
      toks.push({ t: "num", v: n, pos: start });
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) i++;
      toks.push({ t: "id", v: src.slice(start, i), pos: start });
      continue;
    }
    throw { message: `Unexpected character '${c}'`, pos: start };
  }
  return toks;
}

function parse(src, params) {
  if (src.length > MAX_LEN) throw { message: "Expression too long", pos: 0 };
  const toks = tokenize(src);
  if (!toks.length) throw { message: "Empty expression", pos: 0 };
  let p = 0;
  const peek = () => toks[p];
  const expr = () => { add(); };
  function add() { mul(); while (peek() && (peek().t === "+" || peek().t === "-")) { p++; mul(); } }
  function mul() { unary(); while (peek() && (peek().t === "*" || peek().t === "/")) { p++; unary(); } }
  function unary() { if (peek() && (peek().t === "-" || peek().t === "+")) { p++; unary(); } else pow(); }
  function pow() { atom(); if (peek() && peek().t === "^") { p++; unary(); } }
  function atom() {
    const tk = toks[p++];
    if (!tk) throw { message: "Expected a value", pos: src.length };
    if (tk.t === "num") return;
    if (tk.t === "(") { expr(); const r = toks[p++]; if (!r || r.t !== ")") throw { message: "Expected ')'", pos: tk.pos }; return; }
    if (tk.t === "id") {
      if (peek() && peek().t === "(") {
        const arity = FUNCS[tk.v];
        if (arity === undefined) throw { message: `Unknown function '${tk.v}'`, pos: tk.pos };
        p++;
        let argc = 0;
        if (peek() && peek().t !== ")") { do { expr(); argc++; } while (peek() && peek().t === "," && (p++, true)); }
        const r = toks[p++]; if (!r || r.t !== ")") throw { message: "Expected ')'", pos: tk.pos };
        if (argc !== arity) throw { message: `'${tk.v}' takes ${arity} arg(s), got ${argc}`, pos: tk.pos };
        return;
      }
      if (VARS.has(tk.v) || CONSTS.has(tk.v) || params.includes(tk.v)) return;
      throw { message: `Unknown name '${tk.v}'`, pos: tk.pos };
    }
    throw { message: "Expected a value", pos: tk.pos };
  }
  expr();
  if (p !== toks.length) throw { message: "Unexpected trailing input", pos: peek()?.pos ?? src.length };
}

export function validateEquations(equations, paramNames) {
  const errors = {};
  for (const k of ["dx", "dy", "dz"]) {
    try { parse(String(equations?.[k] ?? ""), paramNames); errors[k] = null; }
    catch (e) { errors[k] = { message: e.message ?? String(e), pos: e.pos ?? 0 }; }
  }
  return { ok: !errors.dx && !errors.dy && !errors.dz, errors };
}
