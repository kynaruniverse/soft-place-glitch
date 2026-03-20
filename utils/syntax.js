/**
 * MAKÉ UTILS — syntax.js
 * Lightweight no-dependency syntax highlighter for the code editor.
 *
 * Strategy: single-pass tokenisation.  Patterns are tested in priority order
 * (comments > strings > keywords > numbers > builtins).  Once a region of
 * source text is claimed by a token it cannot be re-claimed.
 *
 * CSS classes emitted:  sh-comment  sh-string  sh-keyword  sh-number
 *                       sh-fn       sh-tag      sh-attr     sh-builtin
 *                       sh-type     sh-decor    sh-prop     sh-bool
 */

import { esc } from './helpers.js';

// ── Language rule sets ────────────────────────────────────────

const JS_KEYWORDS = /\b(break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|of|return|static|super|switch|this|throw|try|typeof|var|void|while|with|yield|async|await|null|undefined|true|false)\b/g;
const JS_BUILTINS = /\b(console|window|document|Array|Object|String|Number|Boolean|Promise|Math|JSON|Date|Map|Set|Error|fetch|parseInt|parseFloat|setTimeout|setInterval|clearTimeout|clearInterval|navigator|localStorage|sessionStorage|indexedDB|URL|Blob|File|Event|CustomEvent|requestAnimationFrame|Symbol|Proxy|Reflect)\b/g;

const PY_KEYWORDS = /\b(and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|True|False|None)\b/g;
const PY_BUILTINS = /\b(print|len|range|type|str|int|float|list|dict|tuple|set|bool|open|super|self|cls|input|enumerate|zip|map|filter|sorted|reversed|any|all|min|max|sum|abs|round|repr|hasattr|getattr|setattr|isinstance|issubclass)\b/g;

const TS_TYPES    = /\b(string|number|boolean|void|never|any|unknown|object|symbol|bigint|null|undefined)\b/g;

const CSS_PROPS   = /\b(color|background|border|margin|padding|font|display|flex|grid|position|width|height|top|left|right|bottom|overflow|opacity|transform|transition|animation|cursor|outline|box-shadow|text-align|z-index|content|visibility|pointer-events)\b/g;

const RULES = {
  javascript:  makeJsRules(),
  typescript:  makeJsRules(true),
  python:      makePyRules(),
  html:        makeHtmlRules(),
  css:         makeCssRules(),
  json:        makeJsonRules(),
  bash:        makeBashRules(),
  sql:         makeSqlRules(),
  java:        makeJavaRules(),
  rust:        makeRustRules(),
  go:          makeGoRules(),
  swift:       makeSwiftRules(),
  kotlin:      makeSwiftRules(), // close enough
  cpp:         makeJavaRules(),  // close enough
  markdown:    makeMdRules(),
  plaintext:   [],
};

function makeJsRules(ts = false) {
  const rules = [
    { cls: 'comment', re: /\/\/[^\n]*/g },
    { cls: 'comment', re: /\/\*[\s\S]*?\*\//g },
    { cls: 'string',  re: /`(?:[^`\\]|\\.)*`/g },
    { cls: 'string',  re: /"(?:[^"\\]|\\.)*"/g },
    { cls: 'string',  re: /'(?:[^'\\]|\\.)*'/g },
    { cls: 'keyword', re: JS_KEYWORDS },
    { cls: 'builtin', re: JS_BUILTINS },
    { cls: 'number',  re: /\b(0x[\da-fA-F]+|0b[01]+|\d+\.?\d*([eE][+-]?\d+)?n?)\b/g },
    { cls: 'fn',      re: /\b([a-zA-Z_$][\w$]*)\s*(?=\()/g },
  ];
  if (ts) rules.splice(6, 0, { cls: 'type', re: TS_TYPES });
  return rules;
}

function makePyRules() {
  return [
    { cls: 'comment', re: /#[^\n]*/g },
    { cls: 'string',  re: /"""[\s\S]*?"""/g },
    { cls: 'string',  re: /'''[\s\S]*?'''/g },
    { cls: 'string',  re: /"(?:[^"\\]|\\.)*"/g },
    { cls: 'string',  re: /'(?:[^'\\]|\\.)*'/g },
    { cls: 'decor',   re: /@[\w.]+/g },
    { cls: 'keyword', re: PY_KEYWORDS },
    { cls: 'builtin', re: PY_BUILTINS },
    { cls: 'number',  re: /\b\d+\.?\d*([eE][+-]?\d+)?\b/g },
    { cls: 'fn',      re: /\bdef\s+([\w]+)/g },
  ];
}

function makeHtmlRules() {
  return [
    { cls: 'comment', re: /<!--[\s\S]*?-->/g },
    { cls: 'string',  re: /"[^"]*"/g },
    { cls: 'string',  re: /'[^']*'/g },
    { cls: 'tag',     re: /<\/?[a-zA-Z][\w.-]*/g },
    { cls: 'tag',     re: /\/?>/g },
    { cls: 'attr',    re: /\s[\w-]+=?(?=["'\s>\/])/g },
  ];
}

function makeCssRules() {
  return [
    { cls: 'comment', re: /\/\*[\s\S]*?\*\//g },
    { cls: 'string',  re: /"[^"]*"/g },
    { cls: 'string',  re: /'[^']*'/g },
    { cls: 'number',  re: /-?\d+\.?\d*(px|em|rem|%|vh|vw|s|ms|deg)?\b/g },
    { cls: 'prop',    re: CSS_PROPS },
    { cls: 'keyword', re: /\b(var|calc|linear-gradient|rgba?|hsl|important|media|keyframes|from|to|none|auto|inherit|initial|unset)\b/g },
  ];
}

function makeJsonRules() {
  return [
    { cls: 'prop',    re: /"[^"]+"\s*(?=:)/g },
    { cls: 'string',  re: /"(?:[^"\\]|\\.)*"/g },
    { cls: 'number',  re: /-?\d+\.?\d*([eE][+-]?\d+)?\b/g },
    { cls: 'bool',    re: /\b(true|false|null)\b/g },
  ];
}

function makeBashRules() {
  return [
    { cls: 'comment', re: /#[^\n]*/g },
    { cls: 'string',  re: /"(?:[^"\\]|\\.)*"/g },
    { cls: 'string',  re: /'[^']*'/g },
    { cls: 'keyword', re: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|in|function|return|export|local|readonly|declare|echo|exit|break|continue|source|alias|unset|shift)\b/g },
    { cls: 'builtin', re: /\b(ls|cd|mkdir|rm|mv|cp|cat|grep|sed|awk|cut|sort|uniq|find|chmod|chown|tar|zip|curl|wget|git|npm|node|python|pip|sudo|apt|brew)\b/g },
    { cls: 'number',  re: /\b\d+\b/g },
    { cls: 'fn',      re: /\$[\w]+/g },
  ];
}

function makeSqlRules() {
  return [
    { cls: 'comment', re: /--[^\n]*/g },
    { cls: 'comment', re: /\/\*[\s\S]*?\*\//g },
    { cls: 'string',  re: /'(?:[^'\\]|\\.)*'/g },
    { cls: 'keyword', re: /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|GROUP BY|ORDER BY|HAVING|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|NOT|NULL|AND|OR|IN|BETWEEN|LIKE|AS|DISTINCT|LIMIT|OFFSET|COUNT|SUM|AVG|MIN|MAX|CASE|WHEN|THEN|ELSE|END|EXISTS|UNION|WITH)\b/gi },
    { cls: 'number',  re: /\b\d+\.?\d*\b/g },
  ];
}

function makeJavaRules() {
  return [
    { cls: 'comment', re: /\/\/[^\n]*/g },
    { cls: 'comment', re: /\/\*[\s\S]*?\*\//g },
    { cls: 'string',  re: /"(?:[^"\\]|\\.)*"/g },
    { cls: 'string',  re: /'(?:[^'\\]|\\.)*'/g },
    { cls: 'keyword', re: /\b(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|if|implements|import|instanceof|int|interface|long|native|new|null|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|true|false|nullptr|template|typename)\b/g },
    { cls: 'type',    re: /\b[A-Z][A-Za-z0-9]*\b/g },
    { cls: 'number',  re: /\b\d+\.?\d*[fFdDlL]?\b/g },
  ];
}

function makeRustRules() {
  return [
    { cls: 'comment', re: /\/\/[^\n]*/g },
    { cls: 'comment', re: /\/\*[\s\S]*?\*\//g },
    { cls: 'string',  re: /"(?:[^"\\]|\\.)*"/g },
    { cls: 'keyword', re: /\b(as|async|await|break|const|continue|crate|dyn|else|enum|extern|false|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|true|type|unsafe|use|where|while)\b/g },
    { cls: 'type',    re: /\b(bool|char|f32|f64|i8|i16|i32|i64|i128|isize|str|u8|u16|u32|u64|u128|usize|String|Vec|Option|Result|Box|Rc|Arc)\b/g },
    { cls: 'number',  re: /\b\d[\d_]*\.?[\d_]*([eE][+-]?[\d_]+)?\b/g },
    { cls: 'fn',      re: /\bfn\s+([\w]+)/g },
  ];
}

function makeGoRules() {
  return [
    { cls: 'comment', re: /\/\/[^\n]*/g },
    { cls: 'comment', re: /\/\*[\s\S]*?\*\//g },
    { cls: 'string',  re: /`[\s\S]*?`/g },
    { cls: 'string',  re: /"(?:[^"\\]|\\.)*"/g },
    { cls: 'keyword', re: /\b(break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var|nil|true|false)\b/g },
    { cls: 'type',    re: /\b(bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|rune|string|uint|uint8|uint16|uint32|uint64|uintptr|append|cap|close|copy|delete|len|make|new|panic|print|println|recover)\b/g },
    { cls: 'number',  re: /\b\d+\.?\d*\b/g },
  ];
}

function makeSwiftRules() {
  return [
    { cls: 'comment', re: /\/\/[^\n]*/g },
    { cls: 'comment', re: /\/\*[\s\S]*?\*\//g },
    { cls: 'string',  re: /"(?:[^"\\]|\\.)*"/g },
    { cls: 'keyword', re: /\b(associatedtype|class|deinit|enum|extension|fileprivate|func|import|init|inout|internal|let|open|operator|precedencegroup|private|protocol|public|rethrows|static|struct|subscript|typealias|var|break|case|continue|default|defer|do|else|fallthrough|for|guard|if|in|repeat|return|switch|throw|try|while|as|catch|false|is|nil|super|self|throw|throws|true|Any|AnyObject)\b/g },
    { cls: 'type',    re: /\b(Int|Double|Float|Bool|String|Character|Array|Dictionary|Set|Optional|Result|Void|Never|Data|Date|URL|UUID)\b/g },
    { cls: 'number',  re: /\b\d+\.?\d*\b/g },
  ];
}

function makeMdRules() {
  return [
    { cls: 'keyword', re: /^#{1,6}\s.*/gm },
    { cls: 'string',  re: /`[^`\n]+`/g },
    { cls: 'string',  re: /```[\s\S]*?```/g },
    { cls: 'comment', re: /\[.*?\]\(.*?\)/g },
    { cls: 'fn',      re: /\*\*[^*]+\*\*/g },
    { cls: 'builtin', re: /\*[^*]+\*/g },
  ];
}

// ── Tokeniser ─────────────────────────────────────────────────

/**
 * highlight(code, lang)
 * Returns an HTML string with syntax-highlighted code.
 * Safe to insert via innerHTML inside a <pre> element.
 */
export function highlight(code, lang = 'plaintext') {
  const rules = RULES[lang] || [];
  if (!rules.length) return esc(code);

  // Collect non-overlapping tokens in source order.
  const tokens = []; // { start, end, cls }

  for (const { re, cls } of rules) {
    // Clone the regex so lastIndex resets each pass.
    const rx = new RegExp(re.source, re.flags.replace('g', '') + 'g');
    let m;
    while ((m = rx.exec(code)) !== null) {
      const start = m.index;
      const end   = start + m[0].length;
      // Skip if this range overlaps an already-claimed token.
      if (tokens.some(t => start < t.end && end > t.start)) continue;
      tokens.push({ start, end, cls });
    }
  }

  // Sort ascending so we can walk the code linearly.
  tokens.sort((a, b) => a.start - b.start);

  // Build highlighted HTML.
  let result = '';
  let pos    = 0;
  for (const tok of tokens) {
    if (tok.start > pos) result += esc(code.slice(pos, tok.start));
    result += `<span class="sh-${tok.cls}">${esc(code.slice(tok.start, tok.end))}</span>`;
    pos = tok.end;
  }
  if (pos < code.length) result += esc(code.slice(pos));
  return result;
}
