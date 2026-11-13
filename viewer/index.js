// ../src/engine/protocol.js
var H = "/neoscad/libraries", Q = "/neoscad/fonts";
var y = {
  cancelled: "cancelled",
  invalidArgument: "invalidArgument",
  failed: "failed",
  panicked: "panicked",
  crashed: "crashed"
};
function ke(s) {
  return typeof s == "boolean" ? { kind: "bool", value: s } : typeof s == "number" ? { kind: "number", value: s } : Array.isArray(s) ? { kind: "vector", value: s.map(Number) } : { kind: "text", value: String(s) };
}
function ee(s) {
  return Object.keys(s).sort().map((e) => ({ name: e, value: ke(s[e]) }));
}
var te = (s, e = !1, t = []) => ({ overrides: ee(s), parts: e, enable: t }), d = {
  /// `seed` is the seed of unseeded `rands()`: the page keeps one across
  /// respawns, so a respawn does not change a model. Limits default to the
  /// worker's (Limits::AGENT with 1 GiB of memory); a host that passes its
  /// own `limits` (a ResourceLimits) has them replayed on every respawn.
  init: (s, e = null) => e ? { type: "init", seed: s, limits: e } : { type: "init", seed: s },
  defaults: () => ({ type: "defaults" }),
  stats: () => ({ type: "stats" }),
  open: (s, e) => ({ type: "open", path: s, text: e }),
  update: (s, e) => ({ type: "update", path: s, text: e }),
  /// `edits` are `{start, end, text}` in LSP positions (editorEdits).
  edit: (s, e) => ({ type: "edit", path: s, edits: e }),
  close: (s) => ({ type: "close", path: s }),
  /// `camera` ({vpt, vpr, vpd, vpf}, the view the model is shown in) sets
  /// `$vp*`; `colorScheme` names the scheme the face colours are baked in.
  run: ({ path: s, mode: e, values: t = {}, parts: i = !1, enable: n = [], camera: r = null, colorScheme: o = null }) => {
    let l = { type: "run", path: s, mode: e, overrides: ee(t), parts: i, enable: n };
    return r?.vpt && r?.vpr && r.vpd != null && (l.camera = { vpt: r.vpt, vpr: r.vpr, vpd: r.vpd, vpf: r.vpf ?? 22.5 }), o && (l.colorScheme = o), l;
  },
  parameters: (s) => ({ type: "parameters", path: s }),
  /// `options` are a whole `CheckOptions`: the page merges the panel's
  /// settings over the worker's `defaults`, because the wire has no
  /// per-field defaults.
  check: (s, e, t) => ({ type: "check", path: s, run: e, options: t }),
  measure: (s, e) => ({ type: "measure", path: s, run: e }),
  /// Measurement requests name the handle `measure` returned; the worker
  /// keeps only the latest, and none survives a respawn.
  section: (s, e, t, i = null) => {
    let n = { type: "section", measurement: s, axis: e, offset: t };
    return i && (n.part = i), n;
  },
  between: (s, e, t) => ({ type: "between", measurement: s, a: e, b: t }),
  pick: (s, e, t) => ({ type: "pick", measurement: s, origin: e, direction: t }),
  export: (s, e, t, i = (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d+Z$/, "Z")) => ({
    type: "export",
    path: s,
    format: e,
    run: t,
    creationDate: i
  }),
  /// `files` are `{path, data}` (a string or an ArrayBuffer); `tar` an
  /// uncompressed ustar archive unpacked under `root`. Not transferred:
  /// the client keeps its copy to replay after a respawn.
  addFiles: ({ files: s = [], tar: e = null, root: t = null } = {}) => {
    let i = { type: "addFiles", files: s };
    return e && (i.tar = e), t && (i.root = t), i;
  },
  readFile: (s) => ({ type: "readFile", path: s }),
  /// `enable`, when given: the language extensions the page's documents
  /// run with. Without it the server would know them only from the last
  /// run, so a document not run yet (a heavy example) or a toggle changed
  /// before the next run would complete and hover without them.
  lsp: (s, e = null) => e ? { type: "lsp", message: s, enable: e } : { type: "lsp", message: s }
};
function Z(s, e) {
  let t = 0, i = 0;
  for (let n = s.indexOf(`
`); n >= 0 && n < e; n = s.indexOf(`
`, n + 1))
    t += 1, i = n + 1;
  return { line: t, character: e - i };
}
function $(s, { line: e, character: t }) {
  let i = 0;
  for (let r = 0; r < e; r++) {
    let o = s.indexOf(`
`, i);
    if (o < 0) return s.length;
    i = o + 1;
  }
  let n = s.indexOf(`
`, i);
  return n < 0 && (n = s.length), Math.min(i + t, n);
}
function se(s, e) {
  let t = [];
  for (let [i, n, r] of e)
    t.push({ start: Z(s, i), end: Z(s, n), text: r }), s = s.slice(0, i) + r + s.slice(n);
  return { edits: t, text: s };
}
function Se(s) {
  let e = (t) => typeof t == "number" && Number.isFinite(t) ? t : null;
  switch (s?.kind) {
    case "checkbox":
      return { kind: "checkbox" };
    case "slider":
      return { kind: "slider", min: e(s.min) ?? 0, max: e(s.max) ?? 0, step: e(s.step) };
    case "spinBox":
      return { kind: "spinbox", min: e(s.min), max: e(s.max), step: e(s.step) };
    case "text":
      return { kind: "text", maxLength: e(s.maxLength) };
    case "vector":
      return { kind: "vector", min: e(s.min), max: e(s.max), step: e(s.step) };
    case "dropdown":
      return {
        kind: "dropdown",
        options: (s.options ?? []).map((t) => ({ label: String(t.label), value: ie(t.value) }))
      };
    default:
      return { kind: "text", maxLength: null };
  }
}
var ie = (s) => s !== null && typeof s == "object" && !Array.isArray(s) ? s.value : s;
function ne(s) {
  return (s ?? []).map((e) => ({
    name: String(e.name ?? ""),
    parameters: (e.parameters ?? []).map((t) => ({
      name: String(t.name),
      description: String(t.description ?? ""),
      control: Se(t.control),
      defaultValue: ie(t.defaultValue)
    }))
  }));
}
var Ee = /* @__PURE__ */ new Set(["error", "warning", "deprecated", "echo", "trace", "info"]);
function re(s) {
  return (s ?? []).map((e) => ({
    kind: Ee.has(e.kind) ? e.kind : "info",
    text: String(e.text ?? ""),
    location: e.location ?? null
  }));
}
function oe(s, e) {
  return new RegExp(`\\b(?:include|use)\\s*<\\s*${e}/`).test(s);
}
function ae(s) {
  return /\b(?:text|textmetrics|fontmetrics)\s*\(/.test(s);
}
function _(s, e) {
  return JSON.stringify(s ?? null) !== JSON.stringify(e ?? null);
}

// ../src/engine/client.js
var m = class extends Error {
  constructor(e) {
    super(`engine restarted: ${e}`), this.name = "EngineRestarted", this.reason = e;
  }
}, T = class extends Error {
  constructor(e) {
    super(e?.message ?? String(e)), this.name = "EngineError", this.kind = e?.kind ?? y.failed;
  }
}, Ae = "neoscad-replay-initialize", C = class {
  /// `spawn()` makes a worker (anything with postMessage, terminate and
  /// addEventListener for "message" and "error"). `seed` is the seed of
  /// unseeded `rands()`, the same for every worker this client starts.
  /// `timers` defaults to the global ones; the tests pass their own.
  /// `limits` (a ResourceLimits, or null for the worker's defaults) go
  /// with every `init`, the replayed ones too.
  constructor({ spawn: e, staleMs: t = 3e3, seed: i = 0, limits: n = null, now: r = () => performance.now(), timers: o = globalThis } = {}) {
    this.spawn = e, this.staleMs = t, this.seed = i >>> 0, this.limits = n, this.now = r, this.timers = o, this.listeners = /* @__PURE__ */ new Map(), this.worker = null, this.nextId = 1, this.pending = /* @__PURE__ */ new Map(), this.documents = /* @__PURE__ */ new Map(), this.fileRequests = [], this.libraries = /* @__PURE__ */ new Set(), this.lspInit = [], this.lspDocs = /* @__PURE__ */ new Map(), this.extensions = [], this.inFlight = null, this.waiting = null, this.staleTimer = null, this.busy = 0, this.info = null, this.defaults = null, this.restarts = 0, this.ready = new Promise((l) => this.firstStart = l);
  }
  // --- Events: "status" {state, message}, "lsp" message, "info" info ---
  on(e, t) {
    return this.listeners.has(e) || this.listeners.set(e, /* @__PURE__ */ new Set()), this.listeners.get(e).add(t), () => this.listeners.get(e).delete(t);
  }
  emit(e, t) {
    for (let i of this.listeners.get(e) ?? []) i(t);
  }
  status(e, t = "") {
    this.emit("status", { state: e, message: t });
  }
  // --- Life -------------------------------------------------------------
  /// Spawn the worker and initialise it; resolves to the worker's `init`
  /// answer ({version, limits, libraryDirs}). A respawn (`replay`) also
  /// gives the new worker what the old one had been told.
  start(e = !1) {
    this.worker = this.spawn();
    let t = this.worker;
    t.addEventListener("message", (n) => {
      t === this.worker && this.receive(n.data);
    }), t.addEventListener("error", (n) => {
      t === this.worker && (n.preventDefault?.(), this.restart(`worker error: ${n.message ?? "unknown"}`));
    }), t.addEventListener("messageerror", () => {
      t === this.worker && this.restart("a message could not be read");
    });
    let i = this.send(d.init(this.seed, this.limits)).then(async (n) => {
      this.info = n, this.defaults ??= await this.send(d.defaults());
      for (let { request: r } of this.fileRequests) await this.send(r);
      for (let [r, o] of this.documents) await this.send(d.open(r, o));
      return e && await this.replayLanguage(), this.emit("info", n), n;
    });
    return this.ready = i, this.firstStart?.(i), this.firstStart = null, i;
  }
  /// Terminate the worker and start another, failing everything the old
  /// one owed with `EngineRestarted`.
  restart(e) {
    this.worker?.terminate(), this.worker = null, this.restarts += 1;
    let t = this.now();
    this.recent = (this.recent ?? []).filter((r) => t - r < 1e4).concat(t);
    let i = [...this.pending.values()];
    this.pending.clear(), this.inFlight = null, this.busy = 0, this.clearStale();
    for (let r of i) r.reject(new m(e));
    if (this.recent.length > 4)
      return this.status("failed", `the engine keeps stopping (${e})`), this.ready = Promise.reject(new m(e)), this.ready.catch(() => {
      }), this.ready;
    this.status("restarted", e);
    let n = this.start(!0);
    return n.then(() => this.pump()).catch(() => {
    }), n;
  }
  dispose() {
    this.worker?.terminate(), this.worker = null, this.clearStale();
  }
  // --- Requests -----------------------------------------------------------
  /// Post a request now. `quiet` requests (the language server's) do not
  /// count as the engine working: the status and the Cancel button follow
  /// runs and panels, not hovers.
  send(e, { transfer: t = [], quiet: i = !1 } = {}) {
    if (!this.worker) return Promise.reject(new m("no worker"));
    let n = this.nextId++;
    return new Promise((r, o) => {
      this.pending.set(n, { resolve: r, reject: o, quiet: i }), i || (this.busy += 1, this.busy === 1 && this.status("working")), this.worker.postMessage({ id: n, ...e }, t);
    });
  }
  /// A request once the worker is initialised.
  async request(e, t) {
    return await this.ready, this.send(e, t);
  }
  receive(e) {
    if (!(e == null || typeof e != "object")) {
      if (e.id != null && this.pending.has(e.id)) {
        let t = this.pending.get(e.id);
        if (this.pending.delete(e.id), t.quiet || (this.busy = Math.max(0, this.busy - 1), this.busy === 0 && this.status("idle")), e.ok)
          t.resolve(e.result);
        else if (e.error?.kind === y.crashed || e.error?.kind === y.panicked) {
          let i = `crashed: ${e.error.message}`;
          t.reject(new m(i)), this.restart(i);
        } else
          t.reject(new T(e.error));
        return;
      }
      switch (e.type) {
        case "ready":
          this.emit("ready", e);
          break;
        case "crashed":
          this.restart(`crashed: ${e.message ?? "the engine stopped"}`);
          break;
      }
    }
  }
  // --- Documents and files, remembered for a respawn ----------------------
  open(e, t) {
    return this.documents.set(e, t), this.request(d.open(e, t));
  }
  /// The editor's edits (`[from, to, insert]`, UTF-16 offsets) to the
  /// document at `path`, sent as the wire's positions against the
  /// client's copy of its text.
  edit(e, t) {
    let { edits: i, text: n } = se(this.documents.get(e) ?? "", t);
    return this.documents.set(e, n), this.request(d.edit(e, i));
  }
  /// Replace the whole text of an open document.
  update(e, t) {
    return this.documents.set(e, t), this.request(d.update(e, t));
  }
  close(e) {
    return this.documents.delete(e) ? this.request(d.close(e)).catch(() => ({ closed: !1 })) : Promise.resolve({ closed: !1 });
  }
  /// Files or an archive copied into the worker's memory (not
  /// transferred: the client keeps its copy to give a respawned worker).
  /// `library` names the lazy library the request adds, if it is one.
  ///
  /// Only the latest copy of each file is kept for the replay: a host that
  /// sends a changed include at every edit (the npm package's `files`)
  /// would otherwise grow the replay, and the memory it holds, without
  /// bound. A library's archive replaces an earlier one of the same name.
  addFiles(e, t = null) {
    let i = d.addFiles(e), n = new Set(i.files.map((o) => o.path)), r = [];
    for (let o of this.fileRequests) {
      if (t && o.library === t) continue;
      let l = o.request.files.filter((h) => !n.has(h.path));
      l.length === o.request.files.length ? r.push(o) : (l.length || o.request.tar) && r.push({ ...o, request: { ...o.request, files: l } });
    }
    return r.push({ request: i, library: t }), this.fileRequests = r, t && this.libraries.add(t), this.request(i);
  }
  hasLibrary(e) {
    return this.libraries.has(e);
  }
  // --- The language server --------------------------------------------------
  /// One JSON-RPC message from the editor's language client. The server's
  /// replies come back as the request's result and go out as "lsp"
  /// events; the messages that set a server up are remembered for the
  /// next worker.
  lsp(e) {
    this.ready.then(() => (this.remember(e), this.send(d.lsp(e, this.extensions), { quiet: !0 }))).then((t) => {
      for (let i of t?.messages ?? []) this.emit("lsp", i);
    }).catch(() => {
    });
  }
  remember(e) {
    let t;
    try {
      t = JSON.parse(e);
    } catch {
      return;
    }
    let i = t.params?.textDocument;
    switch (t.method) {
      case "initialize":
        this.lspInit = [{ ...t, id: Ae }], this.lspDocs.clear();
        break;
      case "initialized":
        this.lspInit = [this.lspInit[0], t].filter(Boolean);
        break;
      case "textDocument/didOpen":
        this.lspDocs.set(i.uri, { languageId: i.languageId, version: i.version, text: i.text });
        break;
      case "textDocument/didChange": {
        let n = this.lspDocs.get(i.uri);
        if (!n) break;
        for (let r of t.params.contentChanges ?? [])
          r.range ? n.text = n.text.slice(0, $(n.text, r.range.start)) + r.text + n.text.slice($(n.text, r.range.end)) : n.text = r.text;
        n.version = i.version;
        break;
      }
      case "textDocument/didClose":
        this.lspDocs.delete(i.uri);
        break;
    }
  }
  /// Give a new worker's language server what the old one had been told.
  async replayLanguage() {
    if (this.lspInit.length) {
      for (let e of this.lspInit) await this.send(d.lsp(JSON.stringify(e), this.extensions), { quiet: !0 });
      for (let [e, t] of this.lspDocs) {
        let i = {
          jsonrpc: "2.0",
          method: "textDocument/didOpen",
          params: { textDocument: { uri: e, languageId: t.languageId, version: t.version, text: t.text } }
        };
        await this.send(d.lsp(JSON.stringify(i), this.extensions), { quiet: !0 });
      }
    }
  }
  /// The language extensions the page's documents run with (`--enable`
  /// names). Every language server message carries them from now on, and
  /// a respawned worker's replay too: runs also tell the server theirs,
  /// but a toggle changed before the next run, or a heavy example not run
  /// yet, would otherwise complete with the last run's set (or none).
  setExtensions(e) {
    this.extensions = [...e];
  }
  // --- Runs, coalesced ------------------------------------------------------
  /// A run (Requests.run's result). Resolves to the raw result, or to
  /// `{superseded: true}` when a newer run replaced this one first.
  run(e) {
    return new Promise((t, i) => {
      this.waiting && this.waiting.resolve({ superseded: !0 }), this.waiting = { request: e, resolve: t, reject: i }, this.pump(), this.armStale();
    });
  }
  async pump() {
    if (this.inFlight || !this.waiting || !this.worker) return;
    let { request: e, resolve: t, reject: i } = this.waiting;
    this.waiting = null;
    let n = { started: this.now(), request: e };
    this.inFlight = n;
    try {
      await this.ready, n.started = this.now(), t(await this.send(e));
    } catch (r) {
      r instanceof m ? t({ superseded: !0, restarted: !0 }) : r instanceof T && r.kind === y.cancelled ? t({ superseded: !0 }) : i(r);
    } finally {
      this.inFlight === n && (this.inFlight = null), this.clearStale(), this.pump();
    }
  }
  armStale() {
    if (this.clearStale(), !this.inFlight || !this.waiting) return;
    let e = Math.max(0, this.staleMs - (this.now() - this.inFlight.started));
    this.staleTimer = this.timers.setTimeout(() => {
      this.staleTimer = null, this.inFlight && this.waiting && this.restart("a newer run replaced a long one");
    }, e);
  }
  clearStale() {
    this.staleTimer != null && this.timers.clearTimeout(this.staleTimer), this.staleTimer = null;
  }
  /// Stop whatever the engine is doing (the Cancel button).
  cancel() {
    return this.waiting && (this.waiting.resolve({ superseded: !0 }), this.waiting = null), this.busy > 0 ? this.restart("cancelled") : Promise.resolve(this.info);
  }
};

// ../src/engine/index.js
function Te(s, e = import.meta.url) {
  return new URL(s === "wasm" ? "./core/worker.js" : "./mock-worker.js", e);
}
function le(s, e = import.meta.url, t = {}) {
  let i = Te(s.engine, e), {
    // One seed per page load, kept across respawns: unseeded rands()
    // differ between visits, as between app launches, but a respawn does
    // not change the model on screen.
    seed: n = Date.now() >>> 0,
    limits: r = null,
    spawn: o = () => new Worker(i, { type: "module", name: "neoscad-engine" }),
    // The wasm core's fonts are fetched on first use (FONTS); the mock
    // draws no text, and the mock build has no fonts.tar.gz.
    lazyFonts: l = s.engine === "wasm",
    staleMs: h
  } = t, a = new C({ spawn: o, seed: n, limits: r, ...h === void 0 ? {} : { staleMs: h } });
  return a.lazyFonts = l, a;
}
var Ce = [{ name: "BOSL2", archive: "bosl2.tar.gz", root: H }], j = { name: "fonts", archive: "fonts.tar.gz", root: Q };
async function he(s, e, { base: t = import.meta.url, onProgress: i = () => {
} } = {}) {
  let n = [];
  for (let r of Ce)
    !oe(e, r.name) || s.hasLibrary(r.name) || (await ce(s, r, { base: t, onProgress: i }), n.push(r.name));
  return ae(e) && await B(s, { base: t, onProgress: i }) && n.push(j.name), n;
}
async function B(s, { base: e = import.meta.url, onProgress: t = () => {
} } = {}) {
  return !s.lazyFonts || s.hasLibrary(j.name) ? !1 : (await ce(s, j, { base: e, onProgress: t }), !0);
}
async function ce(s, e, { base: t, onProgress: i }) {
  i(e.name);
  let n = await fetch(new URL(`./${e.archive}`, t));
  if (!n.ok) throw new Error(`${e.archive}: HTTP ${n.status}`);
  let r = new Uint8Array(await n.arrayBuffer()), o = r[0] === 31 && r[1] === 139 ? await Me(r) : r.buffer;
  await s.addFiles({ tar: o, root: e.root }, e.name);
}
async function Me(s) {
  let e = new Blob([s]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(e).arrayBuffer();
}

// src/assets.js
var Le = "./assets/", v = () => new URL(Le, import.meta.url);
function k(s, e, t = globalThis.document?.baseURI ?? globalThis.location?.href) {
  let i = s == null ? new URL(e) : new URL(String(s), t ?? e);
  return i.pathname.endsWith("/") || (i.pathname += "/"), i.search = "", i.hash = "", i;
}
function Re(s, e = globalThis.location?.origin) {
  let t = new URL(s);
  return t.protocol === "blob:" || t.protocol === "data:" ? !1 : e == null || e === "null" ? !0 : t.origin !== e;
}
var Oe = (s) => `import ${JSON.stringify(String(s))};
`;
function ue(s, { pageOrigin: e = globalThis.location?.origin } = {}) {
  let t = String(s), i = null;
  return Re(s, e) && (i = URL.createObjectURL(new Blob([Oe(s)], { type: "text/javascript" })), t = i), {
    url: String(s),
    viaBlob: i !== null,
    spawn: () => new Worker(t, { type: "module", name: "neoscad-engine" }),
    dispose() {
      i && URL.revokeObjectURL(i), i = null;
    }
  };
}
function U(s, e, t) {
  let i = e ? "the page's Content-Security-Policy must allow `worker-src blob:` and `script-src` and `connect-src` for that origin, with 'wasm-unsafe-eval'" : "the page's Content-Security-Policy must allow the worker (`worker-src`) and 'wasm-unsafe-eval'";
  return `NeoSCAD's engine could not start from ${s.href}core/worker.js (${t}). Check that the assets are served there (a bundled app copies node_modules/@neoscad/viewer/dist/assets and passes assetsUrl), that a server on another origin sends Access-Control-Allow-Origin, and that ${i}. Self-hosting the assets, or the \`worker\` option, avoids the cross-origin worker.`;
}

// src/result.js
var De = /^(?:ERROR|WARNING|DEPRECATED|TRACE|ECHO): /;
function Fe(s, e) {
  let t = new TextEncoder().encode(s), i = Math.max(0, Math.min(t.length, e - 1));
  return new TextDecoder().decode(t.subarray(0, i)).length;
}
function Ie(s, e) {
  if (!s) return null;
  let t = e == null ? null : e.split(`
`), i = (n, r) => t && t[n - 1] != null ? Fe(t[n - 1], r) : Math.max(0, r - 1);
  return {
    line: s.startLine - 1,
    column: i(s.startLine, s.startColumn),
    endLine: s.endLine - 1,
    endColumn: i(s.endLine, s.endColumn)
  };
}
var de = (s, e) => s && e && s.startsWith(e) ? s.slice(e.length) : s ?? null;
function fe(s, { text: e, message: t, path: i, pos: n, code: r = null, hints: o = [] }) {
  return {
    severity: s,
    message: t ?? e.replace(De, "").trim(),
    text: e,
    path: i,
    line: n?.line ?? null,
    column: n?.column ?? null,
    endLine: n?.endLine ?? null,
    endColumn: n?.endColumn ?? null,
    code: r,
    hints: o
  };
}
function z(s, { dir: e = null, texts: t = /* @__PURE__ */ new Map() } = {}) {
  let i = s?.render ?? {}, n = re(s?.console).map((a) => ({
    kind: a.kind,
    text: a.text,
    location: a.location ? {
      path: de(a.location.path, e),
      line: a.location.startLine,
      column: a.location.startCharacter,
      endLine: a.location.endLine,
      endColumn: a.location.endCharacter
    } : null
  })), r = { error: [], warning: [] }, o = /* @__PURE__ */ new Set();
  for (let a of i.diagnostics ?? []) {
    let c = a.severity === "error" ? "error" : "warning";
    o.add(a.text), r[c].push(
      fe(c, {
        text: a.text ?? a.message,
        message: a.message,
        path: de(a.file, e),
        pos: Ie(a.span, a.file ? t.get(a.file) : null),
        code: a.code ?? null,
        hints: (a.hints ?? []).map((u) => u.message)
      })
    );
  }
  for (let a of n) {
    let c = a.kind === "error" ? "error" : a.kind === "warning" || a.kind === "deprecated" ? "warning" : null;
    !c || o.has(a.text) || (o.add(a.text), r[c].push(fe(c, { text: a.text, path: a.location?.path ?? null, pos: a.location })));
  }
  let l = s?.scene ?? null, h = i.exitCode ?? 0;
  return {
    ok: h === 0 && r.error.length === 0,
    exitCode: h,
    summary: s?.summary ?? "",
    scene: l,
    console: n,
    errors: r.error,
    warnings: r.warning,
    bbox: Ne(l),
    geometry: i.geometry ?? null,
    fileView: s?.fileView ?? null,
    timings: i.timings ?? null
  };
}
function Ne(s) {
  if (!s?.meta) return null;
  try {
    let e = JSON.parse(s.meta).bbox;
    return Array.isArray(e) && e.length === 2 ? { min: e[0], max: e[1] } : null;
  } catch {
    return null;
  }
}
var S = class extends Error {
  constructor(e) {
    super(e.failure ?? `export failed (exit code ${e.exitCode})`), this.name = "ExportError", this.failure = e.failure ?? null, this.exitCode = e.exitCode, this.messages = e.messages ?? [];
  }
};
function pe(s, { dir: e = null, texts: t = /* @__PURE__ */ new Map() } = {}) {
  let i = z({ render: { diagnostics: s.diagnostics ?? [], exitCode: s.exitCode } }, { dir: e, texts: t }), n = s.data ? new Uint8Array(s.data) : null;
  return {
    data: n,
    ok: n !== null && s.exitCode === 0,
    exitCode: s.exitCode,
    failure: s.failure ?? null,
    mime: s.mime ?? null,
    format: s.format ?? null,
    messages: [...i.errors, ...i.warnings]
  };
}

// src/scheduler.js
var g = class extends Error {
  constructor(e = "The run was aborted.") {
    super(e), this.name = "AbortError";
  }
}, M = class {
  /// `client`: an EngineClient (started by the caller). `staleMs`: see above.
  constructor(e, { staleMs: t = 1 / 0, timers: i = globalThis, now: n = () => performance.now() } = {}) {
    this.client = e, this.staleMs = t, this.timers = i, this.now = n, this.queue = [], this.current = null, this.staleTimer = null, this.closed = !1;
  }
  /// Queue `job` under `key`. With `coalesce` (the default) it replaces a
  /// waiting job of the same key. Resolves to the job's value, or
  /// `{superseded: true}`; rejects with AbortError when `signal` aborts.
  submit(e, t, { signal: i = null, coalesce: n = !0 } = {}) {
    return new Promise((r, o) => {
      if (this.closed) return o(new Error("the engine was disposed"));
      if (i?.aborted) return o(new g());
      let l = { key: e, job: t, resolve: r, reject: o, signal: i, onAbort: null }, h = n ? this.queue.findIndex((a) => a.key === e) : -1;
      h >= 0 ? (this.detach(this.queue[h]), this.queue[h].resolve({ superseded: !0 }), this.queue[h] = l) : this.queue.push(l), i && (l.onAbort = () => this.abort(l), i.addEventListener("abort", l.onAbort, { once: !0 })), this.armStale(), this.pump();
    });
  }
  detach(e) {
    e.signal && e.onAbort && e.signal.removeEventListener("abort", e.onAbort), e.onAbort = null;
  }
  abort(e) {
    let t = this.queue.indexOf(e);
    if (t >= 0) {
      this.queue.splice(t, 1), this.detach(e), e.reject(new g()), this.armStale();
      return;
    }
    this.current?.entry === e && !this.current.killed && (this.current.killed = "abort", this.client.restart("aborted").catch(() => {
    }));
  }
  async pump() {
    if (this.current || !this.queue.length || this.closed) return;
    let e = this.queue.shift(), t = { entry: e, key: e.key, started: this.now(), killed: null };
    this.current = t, this.armStale();
    let i = !1;
    try {
      for (; ; )
        try {
          let n = await e.job(this.client);
          if (t.killed === "abort") throw new g();
          this.detach(e), e.resolve(t.killed === "stale" ? { superseded: !0 } : n);
          break;
        } catch (n) {
          if (t.killed === "abort") throw new g();
          if (t.killed === "stale") {
            e.resolve({ superseded: !0 });
            break;
          }
          let r = n instanceof m && /^crashed/.test(n.reason ?? "");
          if (n instanceof m && !r && !i && !this.closed) {
            i = !0;
            continue;
          }
          throw n;
        }
    } catch (n) {
      this.detach(e), e.reject(n);
    } finally {
      this.current === t && (this.current = null), this.armStale(), this.pump();
    }
  }
  armStale() {
    this.staleTimer != null && this.timers.clearTimeout(this.staleTimer), this.staleTimer = null;
    let e = this.current;
    if (!e || e.killed || !Number.isFinite(this.staleMs) || !this.queue.some((i) => i.key === e.key)) return;
    let t = Math.max(0, this.staleMs - (this.now() - e.started));
    this.staleTimer = this.timers.setTimeout(() => {
      this.staleTimer = null, this.current === e && !e.killed && this.queue.some((i) => i.key === e.key) && (e.killed = "stale", this.client.restart("a newer run replaced a long one").catch(() => {
      }));
    }, t);
  }
  /// Drop every waiting job of `key` (a model being disposed).
  forget(e) {
    for (let t of this.queue.filter((i) => i.key === e))
      this.detach(t), t.resolve({ superseded: !0 });
    this.queue = this.queue.filter((t) => t.key !== e);
  }
  dispose() {
    this.closed = !0, this.staleTimer != null && this.timers.clearTimeout(this.staleTimer);
    for (let e of this.queue.splice(0))
      this.detach(e), e.reject(new Error("the engine was disposed"));
  }
};

// src/engine.js
var L = "0.7.1", Pe = "1970-01-01T00:00:00Z", w = class extends Error {
  constructor(e) {
    super(e), this.name = "EngineStartError";
  }
};
function R(s) {
  let e = String(s);
  if (!e || e.startsWith("/") || e.includes("\\") || e.split("/").some((t) => t === "" || t === "." || t === ".."))
    throw new TypeError(`NeoSCAD: "${e}" is not a relative path inside the model's directory`);
  return e;
}
function me(s) {
  let t = (typeof s == "string" ? s.split(/[\s,]+/) : [...s ?? []]).map((i) => String(i).trim()).filter(Boolean);
  return { parts: t.includes("part"), enable: t.filter((i) => i !== "part") };
}
var qe = (s, e) => {
  if (typeof s == "string" || typeof e == "string") return s === e;
  let t = s instanceof Uint8Array ? s : new Uint8Array(s), i = e instanceof Uint8Array ? e : new Uint8Array(e);
  if (t.length !== i.length) return !1;
  for (let n = 0; n < t.length; n++) if (t[n] !== i[n]) return !1;
  return !0;
};
function we(s = {}) {
  let e = s.base ?? v(), t = k(s.assetsUrl, e), i = s.worker ? { url: null, viaBlob: !1, spawn: s.worker, dispose() {
  } } : ue(new URL("core/worker.js", t), { pageOrigin: s.pageOrigin }), n = le({ engine: "wasm" }, t.href, {
    seed: s.seed ?? 0,
    limits: s.limits ?? null,
    spawn: i.spawn,
    lazyFonts: s.lazyFonts ?? !0,
    // The scheduler decides what is stale, per model; the client's own
    // kill would fire for any model's waiting run.
    staleMs: 1 / 0
  });
  return new O(n, { assets: t, spawner: i, staleMs: s.staleMs ?? 1 / 0, timers: s.timers });
}
var O = class {
  constructor(e, { assets: t, spawner: i, staleMs: n = 1 / 0, timers: r = globalThis }) {
    this.client = e, this.assets = t, this.spawner = i, this.scheduler = new M(e, { staleMs: n, timers: r }), this.nextModel = 1, this.failure = null, this.started = !1, this.version = null, this.info = null, this.scratch = null, this.ready = new Promise((o, l) => {
      e.on("info", (h) => {
        this.started || (this.started = !0, this.info = h, this.version = h?.version ?? null, L !== "dev" && this.version && this.version !== L && !/mock/.test(this.version) && console.warn(`NeoSCAD: the package is ${L} but its engine is ${this.version}; are the assets from another version?`), o(h));
      }), e.on("status", ({ state: h, message: a }) => {
        h === "failed" && (this.failure = this.started ? `NeoSCAD's engine keeps stopping (${a}).` : U(t, i.viaBlob, a), l(new w(this.failure)));
      }), e.ready.catch(() => {
      });
      try {
        e.start().catch(() => {
        });
      } catch (h) {
        this.failure = U(t, i.viaBlob, h?.message ?? String(h)), l(new w(this.failure));
      }
    }), this.ready.catch(() => {
    });
  }
  /// A model: one document the worker keeps for repeated runs.
  model(e = {}) {
    return new D(this, this.nextModel++, e);
  }
  /// Submit a job, turning a dead engine into an EngineStartError.
  async submit(e, t, i) {
    try {
      return await this.ready, await this.scheduler.submit(e, t, i);
    } catch (n) {
      throw n instanceof g ? n : this.failure && (n instanceof m || n instanceof w) ? new w(this.failure) : n;
    }
  }
  scratchModel(e) {
    return R(e ?? "main.scad"), this.scratch ??= this.model({ name: "main.scad", scratch: !0 }), this.scratch;
  }
  /// One run of `source` (never coalesced with another call).
  async run(e, t = {}) {
    return this.scratchModel(t.name).run(e, { ...t, coalesce: !1 });
  }
  async export(e, t, i = {}) {
    return this.scratchModel(i.name).export(e, t, i);
  }
  async parameters(e, t = {}) {
    return this.scratchModel(t.name).parameters(e, t);
  }
  dispose() {
    this.scheduler.dispose(), this.client.dispose(), this.spawner.dispose(), this.failure ??= "the engine was disposed";
  }
}, D = class {
  constructor(e, t, { name: i = "main.scad", camera: n = null, scratch: r = !1 } = {}) {
    this.engine = e, this.key = r ? "scratch" : `m${t}`, this.dir = r ? "/doc/run/" : `/doc/m${t}/`, this.camera = n, this.opened = /* @__PURE__ */ new Map(), this.files = /* @__PURE__ */ new Map(), this.disposed = !1, this.scratch = r, this.setName(i);
  }
  setName(e) {
    this.name = R(e), this.path = this.dir + this.name;
  }
  /// At the start of a job: the scratch model (engine.run and friends)
  /// takes the call's file name then, not when the call was queued, since
  /// a queued call must not rename the document of the one before it.
  claim(e) {
    this.scratch && this.setName(e ?? "main.scad");
  }
  alive() {
    if (this.disposed) throw new Error("NeoSCAD: the model was disposed");
  }
  /// Make the worker's copy of the document and its files current, and
  /// fetch the lazy libraries they include. Inside a job, so no other
  /// model's requests come between this and the run.
  async prepare(e, t, i) {
    let n = String(t ?? ""), r = [];
    for (let [l, h] of Object.entries(i ?? {})) {
      let a = this.dir + R(l);
      if (a === this.path) throw new TypeError(`NeoSCAD: files["${l}"] is the model itself`);
      let c = typeof h == "string" || h instanceof ArrayBuffer ? h : ArrayBuffer.isView(h) ? h.slice().buffer : String(h);
      this.files.has(a) && qe(this.files.get(a), c) || (this.files.set(a, c), r.push({ path: a, data: c }));
    }
    r.length && await e.addFiles({ files: r }), this.opened.has(this.path) ? this.opened.get(this.path) !== n && await e.update(this.path, n) : await e.open(this.path, n), this.opened.set(this.path, n);
    let o = [n, ...[...this.files.values()].filter((l) => typeof l == "string")].join(`
`);
    await he(e, o, { base: this.engine.assets.href });
  }
  texts() {
    let e = /* @__PURE__ */ new Map([[this.path, this.opened.get(this.path)]]);
    for (let [t, i] of this.files) typeof i == "string" && e.set(t, i);
    return e;
  }
  /// Run `source`. Options: mode ("preview" | "render"), enable, overrides,
  /// files, colorScheme, signal. Resolves to the result (result.js), or to
  /// `{superseded: true}` when a newer run of this model replaced it.
  async run(e, t = {}) {
    this.alive();
    let i = t.mode ?? "preview";
    if (!["preview", "render", "force"].includes(i)) throw new TypeError(`NeoSCAD: unknown mode "${i}"`);
    let { parts: n, enable: r } = me(t.enable);
    return this.engine.submit(
      this.key,
      async (o) => {
        this.claim(t.name), await this.prepare(o, e, t.files);
        let l = () => d.run({
          path: this.path,
          mode: i,
          values: t.overrides ?? {},
          parts: n,
          enable: r,
          camera: this.camera?.() ?? null,
          colorScheme: t.colorScheme ?? null
        }), h = await o.request(l());
        return h?.fontsWanted && await B(o, { base: this.engine.assets.href }) && (h = await o.request(l())), z(h, { dir: this.dir, texts: this.texts() });
      },
      { signal: t.signal, coalesce: t.coalesce ?? !0 }
    );
  }
  /// Export `source` as `format` ("binstl", "stl", "3mf", "off", "svg",
  /// ...). Resolves to `{data, ok, exitCode, failure, mime, messages}`;
  /// rejects with ExportError when no file was written.
  async export(e, t, i = {}) {
    this.alive();
    let { parts: n, enable: r } = me(i.enable), o = await this.engine.submit(
      `${this.key}:export`,
      async (l) => {
        this.claim(i.name), await this.prepare(l, e, i.files);
        let h = d.export(this.path, t, te(i.overrides ?? {}, n, r), i.creationDate ?? Pe);
        return i.options && (h.options = i.options), pe(await l.request(h), { dir: this.dir, texts: this.texts() });
      },
      { signal: i.signal, coalesce: !1 }
    );
    if (o.data === null) throw new S(o);
    return o;
  }
  /// The customizer's parameters: [{name, parameters: [{name, description,
  /// control, defaultValue}]}].
  async parameters(e, t = {}) {
    return this.alive(), this.engine.submit(
      `${this.key}:parameters`,
      async (i) => (this.claim(t.name), await this.prepare(i, e, t.files), ne((await i.request(d.parameters(this.path))).groups)),
      { signal: t.signal, coalesce: !1 }
    );
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = !0;
    let e = this.engine.scheduler;
    e.forget(this.key), !this.engine.failure && e.submit(`${this.key}:close`, (t) => Promise.all([...this.opened.keys()].map((i) => t.close(i))), { coalesce: !1 }).catch(
      () => {
      }
    );
  }
}, ge = /* @__PURE__ */ new Map();
function W(s = {}) {
  let e = s.base ?? v(), t = k(s.assetsUrl, e).href, i = ge.get(t);
  return (!i || i.failure && i.started) && (i = we(s), ge.set(t, i)), i;
}

// ../src/view/canvas2d.js
var F = {
  top: [0, 0, 0],
  bottom: [180, 0, 0],
  left: [90, 0, 270],
  right: [90, 0, 90],
  front: [90, 0, 0],
  back: [90, 0, 180],
  diagonal: [55, 0, 25]
}, G = {
  Cornfield: { bg: "#ffffe5", face: [0.98, 0.84, 0.17], edge: "#ff0000" },
  Metallic: { bg: "#aaaaff", face: [0.87, 0.87, 1], edge: "#ff0000" },
  Sunset: { bg: "#aa4444", face: [1, 0.67, 0.67], edge: "#ff0000" },
  Starnight: { bg: "#000000", face: [1, 1, 0.88], edge: "#0000ff" },
  "Tomorrow Night": { bg: "#1d1f21", face: [0.51, 0.64, 0.75], edge: "#c5c8c6" }
}, Ve = (s) => s * Math.PI / 180;
function X(s) {
  let [e, , t] = s.map(Ve), i = Math.cos(e), n = Math.sin(e), r = Math.cos(t), o = Math.sin(t);
  return [
    [r, o, 0],
    [-i * o, i * r, n],
    [n * o, -n * r, i]
  ];
}
var $e = (s, e) => [
  s[0][0] * e[0] + s[0][1] * e[1] + s[0][2] * e[2],
  s[1][0] * e[0] + s[1][1] * e[1] + s[1][2] * e[2],
  s[2][0] * e[0] + s[2][1] * e[1] + s[2][2] * e[2]
], x = (s, e) => [
  s[0][0] * e[0] + s[1][0] * e[1] + s[2][0] * e[2],
  s[0][1] * e[0] + s[1][1] * e[1] + s[2][1] * e[2],
  s[0][2] * e[0] + s[1][2] * e[1] + s[2][2] * e[2]
], E = 44, xe = 24;
function _e(s) {
  let e = { tris: [], edges: [], edgeColor: "#ff0000", bbox: null, count: 0 };
  if (!s) return e;
  let t = typeof s.meta == "string" ? JSON.parse(s.meta) : s.meta, i = new DataView(s.faces), n = (l) => i.getFloat32(l, !0), r = (t.draws ?? []).filter((l) => l.state?.color_write !== !1);
  if (e.count = r.reduce((l, h) => l + Math.floor(h.count / 3), 0), e.count <= 15e4)
    for (let l of r)
      for (let h = 0; h + 2 < l.count; h += 3) {
        let a = (l.first + h) * E;
        if (a + 3 * E > s.faces.byteLength) break;
        let c = [0, 1, 2].map((p) => [n(a + p * E), n(a + p * E + 4), n(a + p * E + 8)]), u = [n(a + 12), n(a + 16), n(a + 20)], f = [n(a + 24), n(a + 28), n(a + 32), n(a + 36)];
        e.tris.push({ v: c, n: u[0] || u[1] || u[2] ? u : null, color: f });
      }
  let o = new DataView(s.edges ?? new ArrayBuffer(0));
  for (let l = 0; l + xe <= o.byteLength; l += xe) {
    let h = (a) => o.getFloat32(l + a * 4, !0);
    e.edges.push([[h(0), h(1), h(2)], [h(3), h(4), h(5)]]);
  }
  if (t.edge_color) {
    let [l, h, a] = t.edge_color.map((c) => Math.round(255 * c));
    e.edgeColor = `rgb(${l},${h},${a})`;
  }
  return t.bbox && (e.bbox = { min: t.bbox[0], max: t.bbox[1] }), e;
}
var b = class {
  constructor(e) {
    this.kind = "canvas2d", this.canvas = e, this.ctx = e.getContext("2d"), this.schemes = Object.keys(G), this.settings = { axes: !0, scales: !1, grid: !1, edges: !1, crosshairs: !1, orthographic: !1, scheme: "Cornfield" }, this.vpr = [...F.diagonal], this.vpt = [0, 0, 0], this.vpd = 140, this.tris = null, this.edges2d = [], this.edgeColor = "#ff0000", this.bbox = null, this.tooLarge = !1, this.annotations = { markers: [], lines: [] }, this.onPick = null, this.picking = !1, this.frame = 0, this.listen(), this.resize();
  }
  // --- The viewer API (web/src/view/index.js) ---
  /// A packed scene (render::packed, as the worker sends it): the face
  /// vertices of each draw that writes colour, in their baked colours.
  /// Depth-only draws and image-space CSG primitives (a preview's
  /// subtracted and intersected shapes) are left out: this view has no
  /// depth buffer to compose them in.
  setScene(e) {
    let { tris: t, bbox: i, edges: n, edgeColor: r, count: o } = _e(e);
    this.tooLarge = o > 15e4;
    let l = this.bbox === null;
    this.tris = this.tooLarge ? [] : t, this.edges2d = n, this.edgeColor = r, this.bbox = i, l && this.bbox && this.viewAll(), this.redraw();
  }
  setSettings(e) {
    this.settings = { ...this.settings, ...e }, this.redraw();
  }
  preset(e) {
    F[e] && (this.vpr = [...F[e]]), this.redraw();
  }
  viewAll() {
    if (!this.bbox) return;
    let { min: e, max: t } = this.bbox;
    this.vpt = e.map((i, n) => (i + t[n]) / 2), this.vpd = Math.max(10, 3.2 * Math.hypot(...t.map((i, n) => i - e[n]))), this.redraw();
  }
  resetView() {
    this.vpr = [...F.diagonal], this.viewAll();
  }
  setAnnotations(e) {
    this.annotations = { markers: e?.markers ?? [], lines: e?.lines ?? [] }, this.redraw();
  }
  focus(e) {
    e && (this.vpt = [...e]), this.redraw();
  }
  camera() {
    return { vpt: [...this.vpt], vpr: [...this.vpr], vpd: this.vpd, vpf: 22.5 };
  }
  /// The `$vp*` the program assigned (only those it did).
  setFileView(e) {
    this.setCamera(e);
  }
  setCamera(e) {
    e?.vpt && (this.vpt = [...e.vpt]), e?.vpr && (this.vpr = [...e.vpr]), e?.vpd && (this.vpd = e.vpd), this.redraw();
  }
  /// A ray through a point of the canvas (CSS pixels), in model
  /// coordinates: {origin, direction}.
  rayAt(e, t) {
    let { w: i, h: n, scale: r } = this.metrics(), o = X(this.vpr), l = (e - i / 2) / r, h = -(t - n / 2) / r;
    if (this.settings.orthographic)
      return { origin: x(o, [l, h, this.vpd]).map((p, A) => p + this.vpt[A]), direction: x(o, [0, 0, -1]) };
    let a = x(o, [0, 0, this.vpd]).map((f, p) => f + this.vpt[p]), c = x(o, [l, h, -this.vpd]), u = Math.hypot(...c);
    return { origin: a, direction: c.map((f) => f / u) };
  }
  dispose() {
    this.abort.abort(), cancelAnimationFrame(this.frame);
  }
  // --- Drawing ---
  resize() {
    let e = this.canvas.getBoundingClientRect(), t = globalThis.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(e.width * t)), this.canvas.height = Math.max(1, Math.round(e.height * t)), this.redraw();
  }
  metrics() {
    let e = globalThis.devicePixelRatio || 1, t = this.canvas.width / e, i = this.canvas.height / e, n = Math.min(t, i) / (this.vpd * 0.45);
    return { w: t, h: i, dpr: e, scale: n };
  }
  project(e, t, i) {
    let n = $e(t, [e[0] - this.vpt[0], e[1] - this.vpt[1], e[2] - this.vpt[2]]), r = 1;
    if (!this.settings.orthographic) {
      let o = this.vpd - n[2];
      r = this.vpd / Math.max(o, 1e-3);
    }
    return [i.w / 2 + n[0] * r * i.scale, i.h / 2 - n[1] * r * i.scale, n[2]];
  }
  redraw() {
    this.frame || (this.frame = requestAnimationFrame(() => {
      this.frame = 0, this.draw();
    }));
  }
  draw() {
    let e = this.ctx, t = this.metrics(), { w: i, h: n, dpr: r } = t, o = G[this.settings.scheme] ?? G.Cornfield;
    e.setTransform(r, 0, 0, r, 0, 0), e.fillStyle = o.bg, e.fillRect(0, 0, i, n);
    let l = X(this.vpr), h = x(l, [0, 0, 1]);
    if (this.tris && !this.tooLarge) {
      let a = this.tris.map((c) => {
        let u = c.v.map((f) => this.project(f, l, t));
        return { p: u, z: (u[0][2] + u[1][2] + u[2][2]) / 3, t: c };
      });
      a.sort((c, u) => c.z - u.z), e.lineJoin = "round";
      for (let { p: c, t: u } of a) {
        let f = u.color ?? o.face, p = u.n ? 0.35 + 0.65 * Math.abs(u.n[0] * h[0] + u.n[1] * h[1] + u.n[2] * h[2]) : 1, A = `rgb(${[0, 1, 2].map((ve) => Math.round(255 * Math.min(1, f[ve] * p))).join(",")})`;
        e.beginPath(), e.moveTo(c[0][0], c[0][1]), e.lineTo(c[1][0], c[1][1]), e.lineTo(c[2][0], c[2][1]), e.closePath(), e.fillStyle = A, e.fill(), e.strokeStyle = this.settings.edges ? o.edge : A, e.lineWidth = this.settings.edges ? 0.7 : 0.5, e.stroke();
      }
    } else this.tooLarge && this.bbox && this.drawBox(this.bbox.min, this.bbox.max, l, t, o.edge);
    if (this.edges2d.length) {
      e.strokeStyle = this.edgeColor, e.lineWidth = 2, e.beginPath();
      for (let [a, c] of this.edges2d) {
        let u = this.project(a, l, t), f = this.project(c, l, t);
        e.moveTo(u[0], u[1]), e.lineTo(f[0], f[1]);
      }
      e.stroke();
    }
    if (this.settings.axes) {
      let a = this.vpd * 0.3, c = this.project([0, 0, 0], l, t);
      [
        [[a, 0, 0], "#d33"],
        [[0, a, 0], "#3a3"],
        [[0, 0, a], "#33d"]
      ].forEach(([u, f]) => {
        let p = this.project(u, l, t);
        e.strokeStyle = f, e.lineWidth = 1, e.beginPath(), e.moveTo(c[0], c[1]), e.lineTo(p[0], p[1]), e.stroke();
      });
    }
    this.settings.crosshairs && (e.strokeStyle = "rgba(128,128,128,0.8)", e.beginPath(), e.moveTo(i / 2 - 10, n / 2), e.lineTo(i / 2 + 10, n / 2), e.moveTo(i / 2, n / 2 - 10), e.lineTo(i / 2, n / 2 + 10), e.stroke());
    for (let a of this.annotations.lines) {
      let c = (a.points ?? []).map((u) => this.project(u, l, t));
      if (!(c.length < 2)) {
        e.strokeStyle = a.color ?? "#e0f", e.lineWidth = 2, e.beginPath(), e.moveTo(c[0][0], c[0][1]);
        for (let u of c.slice(1)) e.lineTo(u[0], u[1]);
        a.closed && e.closePath(), e.stroke();
      }
    }
    for (let a of this.annotations.markers) {
      if (a.bboxMin && a.bboxMax && this.drawBox(a.bboxMin, a.bboxMax, l, t, a.color ?? "#e0f"), a.point?.length !== 3) continue;
      let c = this.project(a.point, l, t);
      e.fillStyle = a.color ?? "#e0f", e.beginPath(), e.arc(c[0], c[1], 9, 0, 2 * Math.PI), e.fill(), a.label != null && (e.fillStyle = "#fff", e.font = "bold 11px system-ui, sans-serif", e.textAlign = "center", e.textBaseline = "middle", e.fillText(String(a.label), c[0], c[1] + 0.5));
    }
  }
  drawBox(e, t, i, n, r) {
    let o = [];
    for (let a of [e[0], t[0]]) for (let c of [e[1], t[1]]) for (let u of [e[2], t[2]]) o.push(this.project([a, c, u], i, n));
    let l = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]], h = this.ctx;
    h.strokeStyle = r, h.lineWidth = 1, h.setLineDash([4, 3]), h.beginPath();
    for (let [a, c] of l)
      h.moveTo(o[a][0], o[a][1]), h.lineTo(o[c][0], o[c][1]);
    h.stroke(), h.setLineDash([]);
  }
  // --- Input: drag to orbit, right or shift drag to pan, wheel to zoom ---
  listen() {
    this.abort = new AbortController();
    let e = { signal: this.abort.signal }, t = this.canvas, i = null;
    t.addEventListener(
      "pointerdown",
      (n) => {
        t.setPointerCapture(n.pointerId), i = { x: n.clientX, y: n.clientY, pan: n.button === 2 || n.shiftKey, moved: !1 };
      },
      e
    ), t.addEventListener(
      "pointermove",
      (n) => {
        if (!i) return;
        let r = n.clientX - i.x, o = n.clientY - i.y;
        if (Math.abs(r) + Math.abs(o) > 2 && (i.moved = !0), i.x = n.clientX, i.y = n.clientY, i.pan) {
          let { scale: l } = this.metrics(), h = X(this.vpr), a = x(h, [-r / l, o / l, 0]);
          this.vpt = this.vpt.map((c, u) => c + a[u]);
        } else
          this.vpr = [Math.max(0, Math.min(180, this.vpr[0] - o * 0.5)), 0, (this.vpr[2] - r * 0.5 + 360) % 360];
        this.redraw();
      },
      e
    ), t.addEventListener(
      "pointerup",
      (n) => {
        if (i && !i.moved && this.onPick) {
          let r = t.getBoundingClientRect();
          this.onPick(this.rayAt(n.clientX - r.left, n.clientY - r.top));
        }
        i = null;
      },
      e
    ), t.addEventListener("contextmenu", (n) => n.preventDefault(), e), t.addEventListener(
      "wheel",
      (n) => {
        n.preventDefault(), this.vpd = Math.max(1, this.vpd * Math.exp(n.deltaY * 2e-3)), this.redraw();
      },
      { ...e, passive: !1 }
    );
  }
};

// ../src/view/index.js
var Y = {
  axes: !0,
  scales: !1,
  grid: !1,
  edges: !1,
  crosshairs: !1,
  orthographic: !1,
  lighting: "openscad",
  scheme: "Cornfield"
}, je = "This browser has neither WebGPU nor WebGL 2, so the 3D view is a simplified one (large models show only their box; previews of differences show only what is kept). Everything else works as usual.";
async function be(s, { view: e = "none", base: t = import.meta.url, gpu: i = globalThis.navigator?.gpu, scheme: n = "Cornfield", backend: r = "auto" } = {}) {
  if (e !== "wasm") return { viewer: new b(s), canvas: s, notice: null };
  let o = [], l = (i ? [["view", "webgpu"], ["view-webgl", "webgl"]] : [["view-webgl", "webgl"]]).filter(
    ([, h]) => r === "auto" || r === h
  );
  if (r === "canvas2d") return { viewer: new b(s), canvas: s, notice: null, errors: o };
  for (let [h, a] of l)
    try {
      let c = await import(
        /* webpackIgnore: true */
        /* @vite-ignore */
        new URL(`./${h}/web_view.js`, t).href
      );
      await Be(c);
      let u = await c.Viewer.create(s, { backend: a, colorScheme: n });
      return { viewer: Xe(c, u, s), canvas: s, notice: null };
    } catch (c) {
      o.push(`${a}: ${c?.message ?? c}`), console.warn(`3D view (${a}):`, c), s = Ue(s);
    }
  return { viewer: new b(s), canvas: s, notice: je, errors: o };
}
var I = /* @__PURE__ */ new WeakMap();
function Be(s) {
  if (!I.has(s)) {
    let e = s.default();
    e.catch(() => I.delete(s)), I.set(s, e);
  }
  return I.get(s);
}
function Ue(s) {
  let e = s.cloneNode(!1);
  return s.replaceWith(e), e;
}
function J(s) {
  if (Array.isArray(s)) return s;
  let e = String(s ?? "#e0f").replace(/^#/, "");
  e.length === 3 && (e = [...e].map((i) => i + i).join(""));
  let t = parseInt(e.slice(0, 6), 16);
  return Number.isFinite(t) ? [t >> 16 & 255, t >> 8 & 255, t & 255].map((i) => i / 255).concat(1) : [1, 0, 1, 1];
}
function ze(s, e, t) {
  let i = [];
  for (let r of [s[0], e[0]]) for (let o of [s[1], e[1]]) for (let l of [s[2], e[2]]) i.push([r, o, l]);
  return [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]].map(([r, o]) => ({ points: [i[r], i[o]], closed: !1, color: t }));
}
function We(s) {
  let e = [], t = [];
  for (let i of s?.lines ?? [])
    (i.points?.length ?? 0) >= 2 && e.push({ points: i.points, closed: !!i.closed, color: J(i.color) });
  for (let i of s?.markers ?? [])
    i.bboxMin?.length === 3 && i.bboxMax?.length === 3 && e.push(...ze(i.bboxMin, i.bboxMax, J(i.color))), i.point?.length === 3 && t.push({ point: i.point, label: String(i.label ?? ""), color: J(i.color) });
  return { lines: e, markers: t };
}
var Ge = ["axes", "scales", "grid", "edges", "crosshairs", "orthographic", "lighting"];
function Xe(s, e, t) {
  let i = 0, n = e.colorScheme(), r = {
    kind: e.backend,
    adapter: e.adapter,
    schemes: s.Viewer.colorSchemes(),
    onPick: null,
    raw: e,
    supportsTransforms: !0,
    addScene: (o) => e.addModel(new Uint8Array(o.faces), new Uint8Array(o.edges), o.meta),
    setSceneMatrix: (o, l) => e.setModelTransform(o, l),
    removeScene: (o) => e.removeModel(o),
    setScene(o) {
      if (!o) {
        e.clearModel();
        return;
      }
      e.setModel(new Uint8Array(o.faces), new Uint8Array(o.edges), o.meta, ++i);
    },
    setSettings(o) {
      let l = {};
      for (let h of Ge) o[h] !== void 0 && (l[h] = o[h]);
      if (e.setSettings(l), o.scheme && o.scheme !== n && (e.setColorScheme(o.scheme), n = o.scheme), o.background !== void 0) {
        let [h, a] = Array.isArray(o.background) ? o.background : [o.background, o.background];
        e.setBackground(h ?? void 0, a ?? void 0);
      }
    },
    preset: (o) => e.setView(o),
    viewAll: () => e.viewAll(),
    resetView: () => e.resetView(),
    setAnnotations: (o) => e.setAnnotations(We(o)),
    focus: (o) => o?.length === 3 && e.lookAt(o[0], o[1], o[2]),
    camera: () => e.camera(),
    setFileView: (o) => e.setFileView(o),
    rayAt: (o, l) => e.rayAt(o, l),
    // The view as shown (grid and annotations too), drawn offscreen: an
    // agent's capture (agent/page.js). A WebGPU or WebGL canvas cannot be
    // read back once presented, so the canvas itself is never copied.
    image: (o, l) => e.image(o, l, !0),
    resize: () => e.resize(),
    dispose: () => e.free(),
    canvas: t
  };
  return e.onClick((o, l) => r.onPick?.(e.rayAt(o, l))), r;
}

// src/frames.js
var N = class {
  /// `env` (tests replace it): requestAnimationFrame,
  /// cancelAnimationFrame, document, IntersectionObserver.
  constructor(e, t, i = globalThis) {
    if (typeof t != "function") throw new TypeError("NeoSCAD: onFrame needs a function");
    this.callback = t, this.env = i, this.elapsed = 0, this.last = null, this.handle = 0, this.userPaused = !1, this.visible = !0, this.stopped = !1, this.tick = (n) => this.frame(n), this.onVisibility = () => this.update(), i.document?.addEventListener?.("visibilitychange", this.onVisibility), e && typeof i.IntersectionObserver == "function" && (this.observer = new i.IntersectionObserver((n) => {
      let r = n[n.length - 1];
      r && (this.visible = r.isIntersecting, this.update());
    }), this.observer.observe(e)), this.update();
  }
  /// Whether frames are being delivered now.
  get running() {
    return !this.stopped && !this.userPaused && this.visible && !this.env.document?.hidden;
  }
  /// Whether the page paused the loop (not whether it is off screen).
  get paused() {
    return this.userPaused;
  }
  /// Milliseconds of running time so far.
  get time() {
    return this.elapsed;
  }
  pause() {
    this.userPaused = !0, this.update();
  }
  play() {
    this.userPaused = !1, this.update();
  }
  /// End the loop for good.
  stop() {
    this.stopped || (this.stopped = !0, this.update(), this.env.document?.removeEventListener?.("visibilitychange", this.onVisibility), this.observer?.disconnect(), this.observer = null);
  }
  update() {
    this.running ? this.handle || (this.handle = this.env.requestAnimationFrame(this.tick)) : (this.handle && this.env.cancelAnimationFrame(this.handle), this.handle = 0, this.last = null);
  }
  frame(e) {
    if (this.handle = 0, !this.running) return;
    let t = this.last === null ? 0 : Math.min(Math.max(e - this.last, 0), 100);
    this.last = e, this.elapsed += t, this.handle = this.env.requestAnimationFrame(this.tick), this.callback(this.elapsed, t);
  }
};

// src/viewer.js
var Je = /* @__PURE__ */ new Set(["auto", "webgpu", "webgl", "canvas2d"]);
function Ye(s) {
  if (s?.tagName === "CANVAS") return { canvas: s, made: !1 };
  if (!s?.appendChild) throw new TypeError("NeoSCAD: createViewer needs a canvas or a container element");
  let e = s.ownerDocument.createElement("canvas");
  return e.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none", e.tabIndex = 0, s.appendChild(e), { canvas: e, made: !0 };
}
async function Ke({ width: s, height: e, rgba: t }, i = "image/png") {
  let n = new ImageData(new Uint8ClampedArray(t.buffer, t.byteOffset, t.byteLength), s, e);
  if (typeof OffscreenCanvas < "u") {
    let o = new OffscreenCanvas(s, e);
    return o.getContext("2d").putImageData(n, 0, 0), o.convertToBlob({ type: i });
  }
  let r = document.createElement("canvas");
  return r.width = s, r.height = e, r.getContext("2d").putImageData(n, 0, 0), new Promise((o, l) => r.toBlob((h) => h ? o(h) : l(new Error("toBlob failed")), i));
}
function Ze(s, e, t, i) {
  let n = document.createElement("canvas");
  return n.width = e, n.height = t, n.getContext("2d").drawImage(s, 0, 0, e, t), new Promise((r, o) => n.toBlob((l) => l ? r(l) : o(new Error("toBlob failed")), i));
}
async function K(s, e = {}) {
  let t = e.backend ?? "auto";
  if (!Je.has(t)) throw new TypeError(`NeoSCAD: unknown backend "${t}"`);
  let i = k(e.assetsUrl, e.base ?? v()), n = { ...Y, ...e.settings ?? {} }, { canvas: r, made: o } = Ye(s), { viewer: l, canvas: h, notice: a, errors: c } = await be(r, {
    view: "wasm",
    base: i.href,
    scheme: n.scheme,
    backend: t
  });
  return l.setSettings(n), new P(l, h, { notice: a, errors: c ?? [], made: o, settings: n });
}
var P = class {
  constructor(e, t, { notice: i, errors: n, made: r, settings: o }) {
    this.inner = e, this.canvas = t, this.kind = e.kind, this.notice = i, this.errors = n, this.settings = o, this.made = r, this.loops = /* @__PURE__ */ new Set(), this.observer = typeof ResizeObserver < "u" ? new ResizeObserver(() => this.inner?.resize()) : null, this.observer?.observe(t);
  }
  get schemes() {
    return this.inner.schemes;
  }
  /// Show one scene (null: none). Scenes added with `addScene` go too.
  setScene(e) {
    this.inner.setScene(e ?? null);
  }
  /// Whether `addScene` works: the WebGPU and WebGL viewers place scenes;
  /// the canvas2d fallback does not, and a page should then show something
  /// else (a still, or one `setScene`).
  get supportsTransforms() {
    return !!this.inner?.supportsTransforms;
  }
  /// Show `scene` as well as the scenes already shown, moved by `matrix`
  /// (16 numbers, column-major, a rotation and a translation only;
  /// identity by default). Returns a handle: `setMatrix(m)` moves it,
  /// which only redraws (call it every frame if you like), and `remove()`
  /// takes it away. Throws on the canvas2d fallback (`supportsTransforms`
  /// is false), and on a preview of a difference or an intersection,
  /// which only `setScene` can show: run such models in `render` mode.
  addScene(e, { matrix: t } = {}) {
    if (!e?.faces) throw new TypeError("NeoSCAD: addScene needs a scene (a result's `scene`)");
    if (!this.supportsTransforms)
      throw new Error(`NeoSCAD: the ${this.kind} viewer cannot show several scenes (check viewer.supportsTransforms)`);
    let i = new q(this, this.inner.addScene(e));
    return t && i.setMatrix(t), i;
  }
  /// Call `callback(timeMs, stepMs)` on every animation frame while the
  /// canvas is on screen and the tab is visible; `timeMs` counts running
  /// time only, so an animation resumes where it paused. Returns
  /// `{pause(), play(), stop(), paused, running, time}`; `dispose()`
  /// stops it too.
  onFrame(e) {
    let t = new N(this.canvas, e);
    this.loops.add(t);
    let i = t.stop.bind(t);
    return t.stop = () => {
      i(), this.loops.delete(t);
    }, t;
  }
  setSettings(e) {
    this.settings = { ...this.settings, ...e }, this.inner.setSettings(e);
  }
  preset(e) {
    this.inner.preset(e);
  }
  viewAll() {
    this.inner.viewAll();
  }
  resetView() {
    this.inner.resetView();
  }
  camera() {
    return this.inner.camera();
  }
  setFileView(e) {
    e && this.inner.setFileView(e);
  }
  setAnnotations(e) {
    this.inner.setAnnotations(e ?? null);
  }
  resize() {
    this.inner.resize();
  }
  /// The view drawn at `width` by `height` pixels, as a Blob (PNG unless
  /// `type` says otherwise).
  async image(e, t, { type: i = "image/png" } = {}) {
    return this.kind === "canvas2d" ? (this.inner.draw(), Ze(this.canvas, e, t, i)) : Ke(await this.inner.image(e, t), i);
  }
  dispose() {
    for (let e of [...this.loops]) e.stop();
    this.observer?.disconnect(), this.observer = null, this.inner?.dispose(), this.inner = null, this.made && this.canvas.remove();
  }
}, q = class {
  constructor(e, t) {
    this.viewer = e, this.id = t, this.removed = !1, this.scratch = new Float32Array(16);
  }
  /// Move the scene: 16 numbers (an Array, a Float32Array or a
  /// DOMMatrix), column-major. False once the scene is gone (removed,
  /// replaced by `setScene`, or the viewer disposed). Throws on a matrix
  /// that scales, shears or mirrors.
  setMatrix(e) {
    let t = this.viewer.inner;
    if (this.removed || !t) return !1;
    let i = typeof e?.toFloat32Array == "function" ? e.toFloat32Array() : e;
    if (i?.length !== 16) throw new TypeError("NeoSCAD: a scene matrix has 16 numbers (column-major)");
    for (let r = 0; r < 16; r++) this.scratch[r] = i[r];
    let n = t.setSceneMatrix(this.id, this.scratch);
    return n || (this.removed = !0), n;
  }
  /// Take the scene away. Whether it was still shown.
  remove() {
    let e = this.viewer.inner;
    return this.removed || !e ? !1 : (this.removed = !0, e.removeScene(this.id));
  }
};

// src/render.js
var ye = ["mode", "enable", "overrides", "files", "colorScheme"];
async function He(s, e, t = {}) {
  let i = t.engine ?? W(t), n = await K(s, t), r = new V(i, n, t);
  return await r.update(e), r;
}
var V = class {
  constructor(e, t, i) {
    this.engine = e, this.viewer = t, this.options = {};
    for (let n of ye) i[n] !== void 0 && (this.options[n] = i[n]);
    this.options.colorScheme ??= t.settings.scheme, this.onResult = i.onResult ?? null, this.model = e.model({ name: i.name ?? "main.scad", camera: () => this.viewer?.camera() ?? null }), this.result = null, this.source = null, this.fileView = null;
  }
  /// Run `source` (the last one when omitted) with `options` merged over
  /// the handle's. Resolves to the result, or `{superseded: true}` when a
  /// newer update replaced it before it ran.
  async update(e = this.source, t = {}) {
    this.source = e;
    for (let n of ye) t[n] !== void 0 && (this.options[n] = t[n]);
    let i = await this.model.run(e, { ...this.options, signal: t.signal });
    return i.superseded || !this.viewer || this.show(i), i;
  }
  show(e) {
    this.result = e, (e.scene || e.ok) && this.viewer.setScene(e.scene), e.fileView && _(e.fileView, this.fileView) && this.viewer.setFileView(e.fileView), this.fileView = e.fileView, this.onResult?.(e);
  }
  export(e, t = {}) {
    return this.model.export(this.source, e, { ...this.options, ...t });
  }
  dispose() {
    this.model.dispose(), this.viewer?.dispose(), this.viewer = null;
  }
};
export {
  g as AbortError,
  Y as DEFAULT_VIEW,
  O as Engine,
  w as EngineStartError,
  S as ExportError,
  D as Model,
  q as SceneHandle,
  L as VERSION,
  V as View,
  P as Viewer,
  R as checkRelativePath,
  we as createEngine,
  K as createViewer,
  _ as fileViewChanged,
  He as render,
  W as sharedEngine
};
