//! A tiny, safe math-expression evaluator for user-defined attractors.
//!
//! User-defined attractors are entered as ordinary math *equations* — never
//! code. Each derivative (dx/dy/dz) is a formula over the variables `x y z t`
//! and named parameters. We parse it once into a flat stack-bytecode `Program`
//! and evaluate that per RK4 step. Only whitelisted math is permitted: there is
//! no I/O, no control flow, no variable assignment, nothing executable — so a
//! malicious expression can at worst be slow or diverge (both already bounded
//! by the integrator's step count and `max_radius`).

const MAX_LEN: usize = 512; // source length cap
const MAX_OPS: usize = 1024; // compiled-program length cap

#[derive(Debug, Clone)]
pub struct ExprError {
    pub message: String,
    pub pos: usize,
}

impl ExprError {
    fn new(message: impl Into<String>, pos: usize) -> Self {
        ExprError {
            message: message.into(),
            pos,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum Func {
    Sin,
    Cos,
    Tan,
    Asin,
    Acos,
    Atan,
    Sinh,
    Cosh,
    Tanh,
    Exp,
    Ln,
    Log,
    Sqrt,
    Abs,
    Sign,
    Floor,
    Atan2,
    Min,
    Max,
    Mod,
    Pow,
}

impl Func {
    fn arity(self) -> usize {
        matches!(self, Func::Atan2 | Func::Min | Func::Max | Func::Mod | Func::Pow) as usize + 1
    }

    fn from_name(s: &str) -> Option<Func> {
        Some(match s {
            "sin" => Func::Sin,
            "cos" => Func::Cos,
            "tan" => Func::Tan,
            "asin" => Func::Asin,
            "acos" => Func::Acos,
            "atan" => Func::Atan,
            "sinh" => Func::Sinh,
            "cosh" => Func::Cosh,
            "tanh" => Func::Tanh,
            "exp" => Func::Exp,
            "ln" => Func::Ln,
            "log" => Func::Log,
            "sqrt" => Func::Sqrt,
            "abs" => Func::Abs,
            "sign" => Func::Sign,
            "floor" => Func::Floor,
            "atan2" => Func::Atan2,
            "min" => Func::Min,
            "max" => Func::Max,
            "mod" => Func::Mod,
            "pow" => Func::Pow,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, Copy)]
enum Op {
    Const(f32),
    Var(u8), // 0=x 1=y 2=z 3=t
    Param(u16),
    Neg,
    Add,
    Sub,
    Mul,
    Div,
    Pow,
    Call(Func),
}

/// A compiled derivative expression — a flat stack program.
#[derive(Debug, Clone)]
pub struct Program {
    ops: Vec<Op>,
}

impl Program {
    /// Evaluate with `vars = [x, y, z, t]` and the resolved parameter values.
    pub fn eval(&self, vars: &[f32; 4], params: &[f32]) -> f32 {
        let mut stack: [f32; 64] = [0.0; 64];
        let mut sp: usize = 0;
        for op in &self.ops {
            match *op {
                Op::Const(c) => {
                    stack[sp] = c;
                    sp += 1;
                }
                Op::Var(i) => {
                    stack[sp] = vars[i as usize];
                    sp += 1;
                }
                Op::Param(i) => {
                    stack[sp] = params.get(i as usize).copied().unwrap_or(0.0);
                    sp += 1;
                }
                Op::Neg => {
                    stack[sp - 1] = -stack[sp - 1];
                }
                Op::Add => {
                    sp -= 1;
                    stack[sp - 1] += stack[sp];
                }
                Op::Sub => {
                    sp -= 1;
                    stack[sp - 1] -= stack[sp];
                }
                Op::Mul => {
                    sp -= 1;
                    stack[sp - 1] *= stack[sp];
                }
                Op::Div => {
                    sp -= 1;
                    stack[sp - 1] /= stack[sp];
                }
                Op::Pow => {
                    sp -= 1;
                    stack[sp - 1] = stack[sp - 1].powf(stack[sp]);
                }
                Op::Call(f) => {
                    if f.arity() == 1 {
                        let a = stack[sp - 1];
                        stack[sp - 1] = eval1(f, a);
                    } else {
                        sp -= 1;
                        let b = stack[sp];
                        let a = stack[sp - 1];
                        stack[sp - 1] = eval2(f, a, b);
                    }
                }
            }
        }
        if sp == 1 {
            stack[0]
        } else {
            f32::NAN
        }
    }
}

fn eval1(f: Func, a: f32) -> f32 {
    match f {
        Func::Sin => a.sin(),
        Func::Cos => a.cos(),
        Func::Tan => a.tan(),
        Func::Asin => a.asin(),
        Func::Acos => a.acos(),
        Func::Atan => a.atan(),
        Func::Sinh => a.sinh(),
        Func::Cosh => a.cosh(),
        Func::Tanh => a.tanh(),
        Func::Exp => a.exp(),
        Func::Ln => a.ln(),
        Func::Log => a.log10(),
        Func::Sqrt => a.sqrt(),
        Func::Abs => a.abs(),
        Func::Sign => a.signum(),
        Func::Floor => a.floor(),
        _ => f32::NAN,
    }
}

fn eval2(f: Func, a: f32, b: f32) -> f32 {
    match f {
        Func::Atan2 => a.atan2(b),
        Func::Min => a.min(b),
        Func::Max => a.max(b),
        Func::Mod => a.rem_euclid(b),
        Func::Pow => a.powf(b),
        _ => f32::NAN,
    }
}

// --- tokenizer --------------------------------------------------------------

#[derive(Debug, Clone, PartialEq)]
enum Tok {
    Num(f32),
    Ident(String),
    Plus,
    Minus,
    Star,
    Slash,
    Caret,
    LParen,
    RParen,
    Comma,
}

struct Lexed {
    tok: Tok,
    pos: usize,
}

fn tokenize(src: &str) -> Result<Vec<Lexed>, ExprError> {
    let bytes = src.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i] as char;
        if c.is_whitespace() {
            i += 1;
            continue;
        }
        let start = i;
        match c {
            '+' => { out.push(Lexed { tok: Tok::Plus, pos: start }); i += 1; }
            '-' => { out.push(Lexed { tok: Tok::Minus, pos: start }); i += 1; }
            '*' => { out.push(Lexed { tok: Tok::Star, pos: start }); i += 1; }
            '/' => { out.push(Lexed { tok: Tok::Slash, pos: start }); i += 1; }
            '^' => { out.push(Lexed { tok: Tok::Caret, pos: start }); i += 1; }
            '(' => { out.push(Lexed { tok: Tok::LParen, pos: start }); i += 1; }
            ')' => { out.push(Lexed { tok: Tok::RParen, pos: start }); i += 1; }
            ',' => { out.push(Lexed { tok: Tok::Comma, pos: start }); i += 1; }
            _ if c.is_ascii_digit() || c == '.' => {
                while i < bytes.len() {
                    let d = bytes[i] as char;
                    if d.is_ascii_digit() || d == '.' || d == 'e' || d == 'E'
                        || ((d == '+' || d == '-')
                            && i > start
                            && matches!(bytes[i - 1] as char, 'e' | 'E'))
                    {
                        i += 1;
                    } else {
                        break;
                    }
                }
                let s = &src[start..i];
                let n: f32 = s
                    .parse()
                    .map_err(|_| ExprError::new(format!("Bad number '{s}'"), start))?;
                out.push(Lexed { tok: Tok::Num(n), pos: start });
            }
            _ if c.is_ascii_alphabetic() || c == '_' => {
                while i < bytes.len() {
                    let d = bytes[i] as char;
                    if d.is_ascii_alphanumeric() || d == '_' {
                        i += 1;
                    } else {
                        break;
                    }
                }
                out.push(Lexed { tok: Tok::Ident(src[start..i].to_string()), pos: start });
            }
            _ => return Err(ExprError::new(format!("Unexpected character '{c}'"), start)),
        }
    }
    Ok(out)
}

// --- recursive-descent parser (emits postfix bytecode) ----------------------

struct Parser<'a> {
    toks: Vec<Lexed>,
    pos: usize,
    params: &'a [String],
    ops: Vec<Op>,
}

impl<'a> Parser<'a> {
    fn peek(&self) -> Option<&Tok> {
        self.toks.get(self.pos).map(|l| &l.tok)
    }
    fn at_pos(&self) -> usize {
        self.toks.get(self.pos).map(|l| l.pos).unwrap_or(0)
    }
    fn bump(&mut self) -> Option<Tok> {
        let t = self.toks.get(self.pos).map(|l| l.tok.clone());
        self.pos += 1;
        t
    }
    fn emit(&mut self, op: Op) -> Result<(), ExprError> {
        if self.ops.len() >= MAX_OPS {
            return Err(ExprError::new("Expression too complex", self.at_pos()));
        }
        self.ops.push(op);
        Ok(())
    }

    // expr := add
    fn parse_expr(&mut self) -> Result<(), ExprError> {
        self.parse_add()
    }

    fn parse_add(&mut self) -> Result<(), ExprError> {
        self.parse_mul()?;
        loop {
            match self.peek() {
                Some(Tok::Plus) => { self.bump(); self.parse_mul()?; self.emit(Op::Add)?; }
                Some(Tok::Minus) => { self.bump(); self.parse_mul()?; self.emit(Op::Sub)?; }
                _ => break,
            }
        }
        Ok(())
    }

    fn parse_mul(&mut self) -> Result<(), ExprError> {
        self.parse_unary()?;
        loop {
            match self.peek() {
                Some(Tok::Star) => { self.bump(); self.parse_unary()?; self.emit(Op::Mul)?; }
                Some(Tok::Slash) => { self.bump(); self.parse_unary()?; self.emit(Op::Div)?; }
                _ => break,
            }
        }
        Ok(())
    }

    fn parse_unary(&mut self) -> Result<(), ExprError> {
        if matches!(self.peek(), Some(Tok::Minus)) {
            self.bump();
            self.parse_unary()?;
            self.emit(Op::Neg)?;
            Ok(())
        } else if matches!(self.peek(), Some(Tok::Plus)) {
            self.bump();
            self.parse_unary()
        } else {
            self.parse_pow()
        }
    }

    // pow := atom ('^' unary)?   (right associative)
    fn parse_pow(&mut self) -> Result<(), ExprError> {
        self.parse_atom()?;
        if matches!(self.peek(), Some(Tok::Caret)) {
            self.bump();
            self.parse_unary()?; // right-assoc, also binds a following unary minus
            self.emit(Op::Pow)?;
        }
        Ok(())
    }

    fn parse_atom(&mut self) -> Result<(), ExprError> {
        let pos = self.at_pos();
        match self.bump() {
            Some(Tok::Num(n)) => self.emit(Op::Const(n)),
            Some(Tok::LParen) => {
                self.parse_expr()?;
                match self.bump() {
                    Some(Tok::RParen) => Ok(()),
                    _ => Err(ExprError::new("Expected ')'", self.at_pos())),
                }
            }
            Some(Tok::Ident(name)) => self.resolve_ident(&name, pos),
            _ => Err(ExprError::new("Expected a value", pos)),
        }
    }

    fn resolve_ident(&mut self, name: &str, pos: usize) -> Result<(), ExprError> {
        // Function call?
        if matches!(self.peek(), Some(Tok::LParen)) {
            let func = Func::from_name(name)
                .ok_or_else(|| ExprError::new(format!("Unknown function '{name}'"), pos))?;
            self.bump(); // '('
            let mut argc = 0;
            if !matches!(self.peek(), Some(Tok::RParen)) {
                loop {
                    self.parse_expr()?;
                    argc += 1;
                    match self.peek() {
                        Some(Tok::Comma) => { self.bump(); }
                        _ => break,
                    }
                }
            }
            match self.bump() {
                Some(Tok::RParen) => {}
                _ => return Err(ExprError::new("Expected ')'", self.at_pos())),
            }
            if argc != func.arity() {
                return Err(ExprError::new(
                    format!("'{name}' takes {} argument(s), got {argc}", func.arity()),
                    pos,
                ));
            }
            return self.emit(Op::Call(func));
        }
        // Variables / constants.
        match name {
            "x" => return self.emit(Op::Var(0)),
            "y" => return self.emit(Op::Var(1)),
            "z" => return self.emit(Op::Var(2)),
            "t" => return self.emit(Op::Var(3)),
            "pi" | "PI" => return self.emit(Op::Const(std::f32::consts::PI)),
            "e" if !self.params.iter().any(|p| p == "e") => {
                return self.emit(Op::Const(std::f32::consts::E))
            }
            _ => {}
        }
        // Parameter?
        if let Some(idx) = self.params.iter().position(|p| p == name) {
            return self.emit(Op::Param(idx as u16));
        }
        Err(ExprError::new(format!("Unknown name '{name}'"), pos))
    }
}

/// Compile a single derivative expression against the known parameter names.
pub fn compile(src: &str, params: &[String]) -> Result<Program, ExprError> {
    if src.len() > MAX_LEN {
        return Err(ExprError::new("Expression too long", 0));
    }
    let toks = tokenize(src)?;
    if toks.is_empty() {
        return Err(ExprError::new("Empty expression", 0));
    }
    let mut p = Parser {
        toks,
        pos: 0,
        params,
        ops: Vec::new(),
    };
    p.parse_expr()?;
    if p.pos != p.toks.len() {
        return Err(ExprError::new("Unexpected trailing input", p.at_pos()));
    }
    Ok(Program { ops: p.ops })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ev(src: &str, params: &[(&str, f32)], x: f32, y: f32, z: f32, t: f32) -> f32 {
        let names: Vec<String> = params.iter().map(|(n, _)| n.to_string()).collect();
        let vals: Vec<f32> = params.iter().map(|(_, v)| *v).collect();
        let prog = compile(src, &names).unwrap();
        prog.eval(&[x, y, z, t], &vals)
    }

    #[test]
    fn lorenz_dx() {
        // sigma*(y - x)
        let v = ev("sigma*(y - x)", &[("sigma", 10.0)], 1.0, 4.0, 0.0, 0.0);
        assert!((v - 30.0).abs() < 1e-4);
    }

    #[test]
    fn precedence_and_pow() {
        assert!((ev("2 + 3 * 4", &[], 0.0, 0.0, 0.0, 0.0) - 14.0).abs() < 1e-4);
        assert!((ev("2 ^ 3 ^ 2", &[], 0.0, 0.0, 0.0, 0.0) - 512.0).abs() < 1e-3); // right assoc
        assert!((ev("-2 ^ 2", &[], 0.0, 0.0, 0.0, 0.0) - (-4.0)).abs() < 1e-4); // unary binds looser than ^
    }

    #[test]
    fn functions() {
        assert!((ev("sin(0)", &[], 0.0, 0.0, 0.0, 0.0)).abs() < 1e-6);
        assert!((ev("max(x, y)", &[], 1.0, 5.0, 0.0, 0.0) - 5.0).abs() < 1e-6);
        assert!((ev("abs(-3)", &[], 0.0, 0.0, 0.0, 0.0) - 3.0).abs() < 1e-6);
    }

    #[test]
    fn errors() {
        assert!(compile("x +", &[]).is_err());
        assert!(compile("foo(x)", &[]).is_err());
        assert!(compile("nope", &[]).is_err());
        assert!(compile("sin(x, y)", &[]).is_err());
        assert!(compile("(x", &[]).is_err());
    }
}
