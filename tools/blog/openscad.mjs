// An OpenSCAD grammar for highlight.js, used at build time only.
//
// highlight.js ships one (languages/openscad.js, 11.12.0), but it
// mis-highlights ordinary code: its `include|use <` rule matches a bare
// `include`, so `included = 1;` turns the rest of the line into a
// directive; `.5` colours only the `5`; and it doesn't know `each` or
// `assert` as keywords, nor builtins added since (`is_undef`, `roof`,
// `object`, ...). This one follows OpenSCAD's own lexer and builtin table:
//
//   keywords   src/core/lexer.l (the TOK_* rules: module ... undef)
//   include/use <file>   src/core/lexer.l, the cond_include/cond_use rules
//   builtins   every Builtins::init() name in src/core and src/geometry
//   PI         src/core/BuiltinContext.cc, set_variable("PI", ...)
//   numbers    src/core/lexer.l: 0x{H}+, {D}+{E}, {D}*.{D}+{E}?, {D}+.{D}*{E}?
//
// `$`-names ($fn, $t, $children and user ones) are one class: any
// identifier starting with `$` is dynamically scoped in OpenSCAD, so they
// read differently from ordinary variables.

export const KEYWORDS = ["module", "function", "if", "else", "let", "assert", "echo", "for", "each", "include", "use"];

export const LITERALS = ["true", "false", "undef"];

export const BUILTINS = [
  "abs", "acos", "asin", "atan", "atan2", "ceil", "children", "chr", "circle", "color",
  "concat", "cos", "cross", "cube", "cylinder", "difference", "dxf_cross", "dxf_dim", "exp",
  "fill", "floor", "fontmetrics", "group", "has_key", "hull", "import", "intersection",
  "intersection_for", "is_bool", "is_function", "is_list", "is_num", "is_object",
  "is_string", "is_undef", "len", "linear_extrude", "ln", "log", "lookup", "max", "min",
  "minkowski", "mirror", "multmatrix", "norm", "object", "offset", "ord", "parent_module",
  "polygon", "polyhedron", "pow", "projection", "rands", "render", "resize", "roof",
  "rotate", "rotate_extrude", "round", "scale", "search", "sign", "sin", "sphere", "sqrt",
  "square", "str", "surface", "tan", "text", "textmetrics", "translate", "union", "version",
  "version_num", "PI",
];

export default function openscad(hljs) {
  const reserved = [...KEYWORDS, ...LITERALS, ...BUILTINS].join("|");
  return {
    name: "OpenSCAD",
    aliases: ["scad"],
    keywords: {
      $pattern: /\$?[A-Za-z_][A-Za-z0-9_]*/,
      keyword: KEYWORDS,
      literal: LITERALS,
      built_in: BUILTINS,
    },
    contains: [
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      // `include <MCAD/gears.scad>`: the path is not a string in the
      // grammar (no escapes, ends at `>`), but reads as one.
      {
        match: [/\b(?:include|use)\b/, /\s*/, /<[^>\n]*>/],
        scope: { 1: "keyword", 3: "string" },
      },
      {
        scope: "string",
        begin: /"/,
        end: /"/,
        contains: [{ scope: "char.escape", match: /\\(?:x[0-7][0-9a-fA-F]|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{6}|.)/ }],
      },
      {
        scope: "number",
        relevance: 0,
        match: /\b0x[0-9a-fA-F]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:[eE][+-]?\d+)?\b/,
      },
      { scope: "variable.language", match: /\$[A-Za-z0-9_]+/ },
      // A definition's name: `module gear(` and `function f(`.
      {
        match: [/\b(?:module|function)\b/, /\s+/, /[A-Za-z_][A-Za-z0-9_]*/],
        scope: { 1: "keyword", 3: "title.function" },
      },
      // A call of a user module or function; builtins and keywords keep
      // their own colour.
      {
        scope: "title.function.invoke",
        relevance: 0,
        match: new RegExp(`\\b(?!(?:${reserved})\\b)[A-Za-z_][A-Za-z0-9_]*(?=\\s*\\()`),
      },
    ],
  };
}
