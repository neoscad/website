// src/attributes.js
var u = [
  "src",
  "mode",
  "enable",
  "color-scheme",
  "axes",
  "scales",
  "grid",
  "edges",
  "crosshairs",
  "orthographic",
  "view",
  "assets-url",
  "backend",
  "name"
], m = /* @__PURE__ */ new Set(["axes", "scales", "grid", "edges", "crosshairs", "orthographic", "view"]), b = ["axes", "scales", "grid", "edges", "crosshairs", "orthographic"], g = /* @__PURE__ */ new Set(["top", "bottom", "left", "right", "front", "back", "diagonal"]);
function E(s, e) {
  return s == null ? e : !/^(false|0|off|no)$/i.test(String(s).trim());
}
function o(s, e) {
  let t = (s("mode") ?? "preview").trim().toLowerCase(), i = {};
  for (let c of b) {
    let d = E(s(c), void 0);
    d !== void 0 && (i[c] = d);
  }
  let n = s("color-scheme");
  n && (i.scheme = n.trim());
  let l = (s("view") ?? "").trim().toLowerCase(), h = (s("backend") ?? "auto").trim().toLowerCase();
  return {
    src: s("src") ?? null,
    mode: t === "render" ? "render" : "preview",
    enable: (s("enable") ?? "").split(/[\s,]+/).filter(Boolean),
    settings: { ...e, ...i },
    view: g.has(l) ? l : null,
    assetsUrl: s("assets-url") || null,
    backend: ["auto", "webgpu", "webgl", "canvas2d"].includes(h) ? h : "auto",
    name: s("name") || null
  };
}
function r(s) {
  if (!s) return "main.scad";
  let e;
  try {
    e = new URL(s, "http://x/").pathname;
  } catch {
    return "main.scad";
  }
  let t = decodeURIComponent(e.split("/").pop() ?? "");
  return /^[\w.-]+\.scad$/i.test(t) && t !== ".scad" ? t : "main.scad";
}
function p(s) {
  if (s == null) return null;
  let e = String(s).replace(/^\s*\n/, "").replace(/\s+$/, "").split(`
`), t = e.filter((n) => n.trim()).map((n) => n.match(/^[ \t]*/)[0].length), i = t.length ? Math.min(...t) : 0;
  return e.map((n) => n.slice(i)).join(`
`) + `
`;
}
var f = (s) => s?.tagName === "SCRIPT" && /^text\/(x-)?openscad$/i.test((s.getAttribute("type") ?? "").trim());

// src/element.js
import { DEFAULT_VIEW as w, createViewer as k, fileViewChanged as x, sharedEngine as v } from "./index.js";
var y = 4e3, C = `
:host { display: block; position: relative; width: 400px; height: 300px; contain: content; }
:host([hidden]) { display: none; }
.view { position: absolute; inset: 0; }
.status, .notice { position: absolute; left: 8px; right: 8px; font: 12px/1.4 system-ui, sans-serif;
  padding: 4px 8px; border-radius: 4px; pointer-events: none; white-space: pre-wrap; overflow-wrap: anywhere; }
.status { bottom: 8px; background: rgba(0, 0, 0, 0.6); color: #fff; }
.status[data-kind="failed"] { background: rgba(160, 20, 20, 0.85); }
.notice { top: 8px; background: rgba(255, 255, 255, 0.85); color: #333; }
[hidden] { display: none; }
`, T = globalThis.HTMLElement ?? class {
}, a = class extends T {
  static observedAttributes = u;
  constructor() {
    super(), this.state = { connected: !1, visible: !1, sized: !1, started: !1 }, this._source = null, this._loaded = null, this.viewer = null, this.model = null, this.engine = null, this.result = null, this.scene = null, this.savedCamera = null, this.fileView = null, this.offTimer = null, this.viewerToken = 0, this.runToken = 0;
  }
  // --- Lifecycle -------------------------------------------------------------
  connectedCallback() {
    if (!this.shadowRoot) {
      let e = this.attachShadow({ mode: "open" }), t = document.createElement("style");
      t.textContent = C, this.host = document.createElement("div"), this.host.className = "view", this.host.setAttribute("part", "view"), this.statusEl = document.createElement("div"), this.statusEl.className = "status", this.statusEl.setAttribute("part", "status"), this.statusEl.setAttribute("role", "status"), this.statusEl.hidden = !0, this.noticeEl = document.createElement("div"), this.noticeEl.className = "notice", this.noticeEl.setAttribute("part", "notice"), this.noticeEl.hidden = !0, e.append(t, this.host, this.noticeEl, this.statusEl);
    }
    this.state.connected = !0, this.opts = o((e) => this.getAttribute(e), w), this.intersection = new IntersectionObserver((e) => {
      let t = e[e.length - 1];
      this.state.visible = t.isIntersecting, this.state.sized = t.boundingClientRect.width > 0 && t.boundingClientRect.height > 0, this.visibilityChanged();
    }), this.intersection.observe(this), this.sizes = new ResizeObserver(([e]) => {
      this.state.sized = e.contentRect.width > 0 && e.contentRect.height > 0, this.visibilityChanged();
    }), this.sizes.observe(this), this.mutations = new MutationObserver(() => {
      !this.state.started || this._source != null || this.opts.src || (this.loadInline(), this.run());
    }), this.mutations.observe(this, { childList: !0, subtree: !0, characterData: !0 });
  }
  disconnectedCallback() {
    this.state.connected = !1, this.state.started = !1, this.intersection?.disconnect(), this.sizes?.disconnect(), this.mutations?.disconnect(), clearTimeout(this.offTimer), this.disposeViewer(!1), this.model?.dispose(), this.model = null, this.scene = null;
  }
  attributeChangedCallback(e, t, i) {
    if (!(!this.state.connected || t === i)) {
      if (this.opts = o((n) => this.getAttribute(n), w), m.has(e)) {
        this.applyView(e === "view");
        return;
      }
      if (e === "assets-url" || e === "backend") {
        this.disconnectedCallback(), this.connectedCallback();
        return;
      }
      this.state.started && ((e === "src" || e === "name") && (this._loaded = null, this.model?.dispose(), this.model = null), e === "color-scheme" && this.applyView(!1), this.run());
    }
  }
  visibilityChanged() {
    this.state.connected && this.state.visible && this.state.sized ? (clearTimeout(this.offTimer), this.offTimer = null, this.viewer || this.makeViewer(), this.state.started || (this.state.started = !0, this.run())) : this.viewer && this.offTimer == null && (this.offTimer = setTimeout(() => {
      this.offTimer = null, this.disposeViewer(!0);
    }, y));
  }
  // --- The viewer --------------------------------------------------------------
  async makeViewer() {
    let e = ++this.viewerToken, t = await k(this.host, {
      assetsUrl: this.opts.assetsUrl,
      backend: this.opts.backend,
      settings: this.opts.settings
    });
    if (e !== this.viewerToken || !this.state.connected) {
      t.dispose();
      return;
    }
    this.viewer = t, this.dataset.backend = t.kind, this.noticeEl.textContent = t.notice ?? "", this.noticeEl.hidden = !t.notice, this.scene && t.setScene(this.scene), this.savedCamera ? t.setFileView(this.savedCamera) : this.opts.view && t.preset(this.opts.view), this.dispatchEvent(new CustomEvent("neoscad-viewer", { detail: { kind: t.kind } }));
  }
  disposeViewer(e) {
    this.viewerToken += 1, this.viewer && (this.savedCamera = e ? this.viewer.camera() : null, this.viewer.dispose(), this.viewer = null, delete this.dataset.backend);
  }
  applyView(e) {
    this.viewer && (this.viewer.setSettings(this.opts.settings), e && this.opts.view && this.viewer.preset(this.opts.view));
  }
  // --- The model -----------------------------------------------------------------
  /// The model's source: what was set through this property, else the
  /// fetched `src`, else the inline script's.
  get source() {
    return this._source ?? this._loaded;
  }
  set source(e) {
    this._source = e == null ? null : String(e), this.state.started && this.run();
  }
  loadInline() {
    let e = [...this.children].find(f);
    this._loaded = e ? p(e.textContent) : null;
  }
  async loadSource() {
    if (this._source != null) return this._source;
    if (this.opts.src) {
      let e = new URL(this.opts.src, document.baseURI), t = await fetch(e);
      if (!t.ok) throw new Error(`${this.opts.src}: HTTP ${t.status}`);
      this._loaded = await t.text();
    } else this._loaded == null && this.loadInline();
    return this._loaded;
  }
  /// Run the model again (after the page changed something it reads).
  /// Resolves to the result, or null when a newer run replaced it.
  async update() {
    return this.run();
  }
  async run() {
    if (!this.state.connected) return null;
    let e = ++this.runToken;
    this.say("Loading\u2026", "running");
    try {
      this.engine ??= v({ assetsUrl: this.opts.assetsUrl });
      let t = this._source ?? this._loaded ?? await this.loadSource();
      if (e !== this.runToken) return null;
      if (t == null)
        return this.say('No model: give the element a src, or a <script type="text/x-openscad"> inside it.', "failed"), null;
      this.model ??= this.engine.model({
        name: this.opts.name ?? r(this.opts.src),
        camera: () => this.viewer?.camera() ?? this.savedCamera
      }), this.say(this.opts.mode === "render" ? "Rendering\u2026" : "Previewing\u2026", "running");
      let i = await this.model.run(t, {
        mode: this.opts.mode,
        enable: this.opts.enable,
        colorScheme: this.opts.settings.scheme
      });
      return i.superseded || e !== this.runToken ? null : (this.show(i), i);
    } catch (t) {
      return e !== this.runToken || t?.name === "AbortError" || (this.say(t.message, "failed"), this.dataset.state = "failed", this.dispatchEvent(new CustomEvent("neoscad-error", { detail: { message: t.message, error: t, result: null } }))), null;
    }
  }
  show(e) {
    if (this.result = e, (e.scene || e.ok) && (this.scene = e.scene, this.viewer?.setScene(e.scene)), e.fileView && x(e.fileView, this.fileView) && (this.savedCamera = null, this.viewer?.setFileView(e.fileView)), this.fileView = e.fileView, this.dataset.state = e.ok ? "ok" : "failed", e.ok) this.say(null);
    else {
      let t = e.errors[0], i = t?.line != null ? ` (${t.path ?? "main.scad"}, line ${t.line + 1})` : "";
      this.say(t ? `${t.message}${i}` : e.summary || "The model failed.", "failed");
    }
    if (this.dispatchEvent(new CustomEvent("neoscad-result", { detail: e })), !e.ok) {
      let t = e.errors[0]?.text ?? e.summary;
      this.dispatchEvent(new CustomEvent("neoscad-error", { detail: { message: t, error: null, result: e } }));
    }
  }
  /// Export the model (see Model.export).
  async export(e, t = {}) {
    let i = this.source ?? await this.loadSource();
    return this.engine ??= v({ assetsUrl: this.opts.assetsUrl }), this.model ??= this.engine.model({ name: this.opts.name ?? r(this.opts.src) }), this.model.export(i, e, { enable: this.opts.enable, ...t });
  }
  /// The view as a PNG Blob (null while the element has no viewer).
  image(e, t, i) {
    return this.viewer ? this.viewer.image(e, t, i) : Promise.resolve(null);
  }
  say(e, t = "idle") {
    this.statusEl && (this.statusEl.hidden = e == null, this.statusEl.dataset.kind = t, this.statusEl.textContent = e ?? "");
  }
};
globalThis.customElements && !customElements.get("neoscad-viewer") && customElements.define("neoscad-viewer", a);
export {
  a as NeoSCADViewer,
  y as OFFSCREEN_MS
};
