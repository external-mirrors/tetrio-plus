// cool post: https://chidiwilliams.com/post/evaluator/
// this implementation is probably pretty jank

const expValCache = {};
class ExpVal {
  constructor(expr) {
    this.expr = expr;
    let exp = expr.trim();
    const tokenizers = {
      literal: /^-?[0-9]+(?:\.[0-9]*)?/,
      operator: /^(?:!|\*\*|==|>=|<=|!=|>|<|&&|\|\||[+\-*/%~])/,
      leftparan: /^\(/,
      rightparan: /^\)/,
      function: /^[A-Za-z]+\(/,
      variable: /^[A-Za-z$]\w*/,
      comma: /^,/
    };
    const precedence = {
      '!': 17,
      '**': 16,
      '*': 15,
      '/': 15,
      '%': 15,
      '+': 14,
      '-': 14,
      '>=': 12,
      '<=': 12,
      '!=': 12,
      '<': 12,
      '>': 12,
      '==': 11,
      '&&': 7,
      '||': 6
    }
    let tokens = [];
    let pos = 0;

    scan: while (exp.length > 0) {
      for (let [token, regex] of Object.entries(tokenizers)) {
        let result = regex.exec(exp);
        if (!result) continue;
        if (token == 'rightparan' && tokens[tokens.length-1]?.type == 'function')
          throw new Error(`Zero argument functions not allowed (at pos ${pos})`);
        tokens.push({
          type: token,
          value: token == 'literal' ? parseFloat(result[0]) : result[0],
          pos: pos
        });
        pos += result[0].length;
        exp = exp.slice(result[0].length).trim();
        continue scan;
      }
      throw new Error(`Unexpected token "${exp[0]}" at position ${pos}`);
    }

    let operators = [];
    let out = [];
    for (let token of tokens) {
      if (token.type == 'literal' || token.type == 'variable') {
        out.push(token);
      }
      if (token.type == 'leftparan' || token.type == 'function' || token.type == 'comma') {
        operators.push(token);
      }
      if (token.type == 'rightparan') {
        unwind: while (true) {
          if (operators.length == 0)
            throw new Error(`Couldn't find matching left paranthesis at position ${token.pos}`);
          let last = operators[operators.length - 1];
          switch (last.type) {
            case 'leftparan':
              operators.pop(); // remove '(';
              break unwind;
            case 'function':
              out.push(operators.pop()); // remove '(';
              break unwind;
            default:
              out.push(operators.pop());
              break;
          }
        }
      }
      if (token.type == 'operator') {
        let hasGreater = operators.some(op => precedence[op.value] >= precedence[token.value]);
        let hasParan = !operators.every(op => op.value != '(');
        if (hasGreater && !hasParan)
          while (operators.length)
            out.push(operators.pop());
        operators.push(token);
      }
    }
    while (operators.length)
      out.push(operators.pop());

    this.rpn = out;
  }

  static get(expression) {
    if (!expValCache[expression])
      expValCache[expression] = new ExpVal(expression);
    return expValCache[expression];
  }

  evaluate(variables={}, functions={}) {
    Object.assign(functions, {
      if(a, b, c) {
        return (a ? b : c) || 0;
      },
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      max: Math.max,
      min: Math.min
    })
    let stack = [];
    let args = [];
    let lastToken = null;
    let req = (size) => {
      if (stack.length < size)
        throw new Error(`Error evaluating expression: "${this.expr}", stack underflow.`);
    }
    for (let token of this.rpn) {
      if (token.type == 'literal') stack.push(token.value);
      if (token.type == 'variable') stack.push(variables[token.value] || 0);
      if (token.type == 'comma') {
        req(1);
        args.push(stack.pop());
      }
      if (token.type == 'function') {
        req(1);
        args.push(stack.pop());
        let func = functions[token.value.slice(0, -1)];
        if (!func) throw new Error(`Unknown function ${token.value.slice(0, -1)}`);
        stack.push(func(...args.reverse()));
        args.splice(0);
      }
      if (token.type == 'operator') {
        if (token.value == '!') {
          req(1);
          stack.push(+!stack.pop());
        } else {
          req(2);
          let a = stack.pop();
          let b = stack.pop();
          switch (token.value) {
            case  '+': stack.push(b  + a); break;
            case  '-': stack.push(b  - a); break;
            case  '*': stack.push(b  * a); break;
            case  '/': stack.push(b  / a); break;
            case  '%': stack.push(b  % a); break;
            case '**': stack.push(b ** a); break;
            case '==': stack.push(b == a); break;
            case '>=': stack.push(b >= a); break;
            case '<=': stack.push(b <= a); break;
            case  '>': stack.push(b  > a); break;
            case  '<': stack.push(b  < a); break;
            case '!=': stack.push(b != a); break;
            case '&&': stack.push(b && a); break;
            case '||': stack.push(b || a); break;
            default: throw new Error("Unknown operator " + token.value);
          }
        }
      }
    }
    if (stack.length !== 1)
      throw new Error(`Error evaluating expression: "${this.expr}". Ended with ${stack.length} values.`);
    return stack[0];
  }
}

// let exp = "counter + 1";
// let expval = new ExpVal(exp);
// console.log(exp, '=', expval.evaluate({ counter: 1 }));

if (typeof musicGraph != 'undefined') musicGraph(graph => graph.ExpVal = ExpVal);
if (typeof module != 'undefined' && module.exports) module.exports.ExpVal = ExpVal;
if (typeof window != 'undefined') window.ExpVal = ExpVal;
