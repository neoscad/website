#!/usr/bin/env node
// The blog's renderer: blog/posts/*.md in, static pages out.
//
//   node tools/blog/build.mjs            # what gets committed
//   node tools/blog/build.mjs --drafts   # local preview, drafts included
//
// Writes blog/index.html, blog/<slug>/index.html, blog/tags/<tag>/index.html
// and blog/feed.xml, and the blog's lines in sitemap.xml (between the
// "Blog" markers; the rest of that file is hand-edited). Everything under
// blog/ outside posts/ and media/ is this script's: files it no longer
// generates are deleted, so a post turned back into a draft disappears.
//
// The output is committed and GitHub Pages serves it as plain files, so
// the site keeps no deploy-time build step, and a reader needs no script:
// highlighting, figures and anchors are all done here. CI
// (.github/workflows/blog.yml) re-runs this and fails if the committed
// output differs, which is why nothing here may depend on the clock, the
// machine or the order a directory lists in.
//
// Errors (a missing alt text, a broken link, an unknown code language,
// ...) are collected for every post and reported together, and nothing is
// written: a half-built blog would be worse than a stale one.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import ini from "highlight.js/lib/languages/ini";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import shell from "highlight.js/lib/languages/shell";
import swift from "highlight.js/lib/languages/swift";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import openscad from "./openscad.mjs";

export const SITE = "https://neoscad.org";
const BLOG_TITLE = "NeoSCAD blog";
const BLOG_SUMMARY = "Posts from the NeoSCAD project.";
// The feed's <updated> while there are no posts. Atom requires the element
// and the output must not depend on the clock, so it is the day the blog
// was added; the first post replaces it.
const EMPTY_FEED_UPDATED = "2026-10-02T00:00:00Z";
const DEFAULT_IMAGE = { url: "/assets/icon-512.png", width: 512, height: 512, alt: "The NeoSCAD icon: a threaded ring" };

// Code fence languages, by the name a post uses, with the label shown
// above the block. A name not listed fails the build rather than quietly
// rendering unhighlighted: it is almost always a typo.
const LANGUAGES = {
  openscad: ["OpenSCAD", openscad],
  scad: ["OpenSCAD", openscad],
  bash: ["Shell", bash],
  sh: ["Shell", bash],
  shell: ["Shell session", shell],
  console: ["Shell session", shell],
  c: ["C", c],
  cpp: ["C++", cpp],
  css: ["CSS", css],
  diff: ["Diff", diff],
  toml: ["TOML", ini],
  ini: ["INI", ini],
  js: ["JavaScript", javascript],
  javascript: ["JavaScript", javascript],
  json: ["JSON", json],
  python: ["Python", python],
  rust: ["Rust", rust],
  swift: ["Swift", swift],
  ts: ["TypeScript", typescript],
  typescript: ["TypeScript", typescript],
  html: ["HTML", xml],
  xml: ["XML", xml],
  yaml: ["YAML", yaml],
  text: ["", null],
  "": ["", null],
};
for (const [name, [, grammar]] of Object.entries(LANGUAGES)) if (grammar) hljs.registerLanguage(name, grammar);

const FRONT_MATTER_KEYS = ["title", "date", "updated", "summary", "author", "tags", "cover", "cover_alt", "draft"];
const POST_FILE = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const TAG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Directories under blog/ that a slug can't take.
const RESERVED_SLUGS = new Set(["posts", "media", "tags"]);
const CALLOUTS = { note: "Note", tip: "Tip", warning: "Warning" };
const VIDEO_TYPES = { ".mp4": "video/mp4", ".webm": "video/webm" };
const IMAGE_TYPES = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// --- Small helpers ---------------------------------------------------------

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function longDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/// The front matter's small YAML subset: `key: value` lines, a value
/// optionally in quotes, `[a, b]` lists and true/false. Anything else is
/// an error rather than a guess, so a typo can't silently drop a field.
export function parseFrontMatter(text, file, errors) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) {
    errors.push(`${file}: no front matter (a --- block at the top)`);
    return { data: {}, body: text, bodyLine: 1 };
  }
  const data = {};
  m[1].split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || line.trim().startsWith("#")) return;
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    const where = `${file}:${i + 2}`;
    if (!kv) return errors.push(`${where}: expected "key: value", got ${JSON.stringify(line)}`);
    const [, key, raw] = kv;
    if (!FRONT_MATTER_KEYS.includes(key)) return errors.push(`${where}: unknown front matter key "${key}" (known: ${FRONT_MATTER_KEYS.join(", ")})`);
    if (key in data) return errors.push(`${where}: "${key}" given twice`);
    const unquote = (v) => {
      v = v.trim();
      if (/^".*"$/.test(v)) {
        try {
          return JSON.parse(v);
        } catch {
          errors.push(`${where}: bad escape in ${v}`);
          return "";
        }
      }
      if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
      return v;
    };
    let value = raw.trim();
    if (value.startsWith("[")) {
      if (!value.endsWith("]")) return errors.push(`${where}: a list must close on the same line`);
      value = value.slice(1, -1).trim() ? value.slice(1, -1).split(",").map(unquote) : [];
    } else if (value === "true" || value === "false") {
      value = value === "true";
    } else {
      value = unquote(value);
    }
    data[key] = value;
  });
  return { data, body: text.slice(m[0].length), bodyLine: m[0].split("\n").length };
}

/// Width and height from an image file's header, for the <img> attributes
/// that stop the page jumping as images load.
export function imageSize(buf, ext) {
  if (ext === ".png" && buf.toString("ascii", 1, 4) === "PNG") return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  if (ext === ".gif" && buf.toString("ascii", 0, 3) === "GIF") return [buf.readUInt16LE(6), buf.readUInt16LE(8)];
  if ((ext === ".jpg" || ext === ".jpeg") && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) return null;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)];
      i += 2 + len;
    }
    return null;
  }
  if (ext === ".webp" && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const kind = buf.toString("ascii", 12, 16);
    if (kind === "VP8 ") return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
    if (kind === "VP8L") {
      const b = buf.readUInt32LE(21);
      return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1];
    }
    if (kind === "VP8X") return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
    return null;
  }
  if (ext === ".svg") {
    const head = buf.toString("utf8", 0, 4096);
    const tag = head.match(/<svg\b[^>]*>/)?.[0] ?? "";
    const num = (name) => tag.match(new RegExp(`\\s${name}="([\\d.]+)(?:px)?"`))?.[1];
    if (num("width") && num("height")) return [Math.round(Number(num("width"))), Math.round(Number(num("height")))];
    const vb = tag.match(/viewBox="[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/);
    if (vb) return [Math.round(Number(vb[1])), Math.round(Number(vb[2]))];
    return null;
  }
  return null;
}

// --- Markdown ----------------------------------------------------------------

/// `{autoplay loop poster=clip.png}` after an image: flags and key=value.
function parseAttrs(text) {
  const attrs = {};
  for (const part of text.trim().split(/\s+/).filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq < 0) attrs[part] = true;
    else attrs[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return attrs;
}

/// A reference in a post (link, image, poster), resolved to a URL on the
/// site. Relative paths are relative to the Markdown file, as in any
/// Markdown viewer, so `../media/<slug>/x.png` and a file beside the post
/// both preview on GitHub too; a link to another post's .md becomes that
/// post's page.
function resolveRef(ref, env) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith("//")) return { url: ref, external: true };
  if (ref.startsWith("#") || ref === "") return { url: ref };
  const cut = ref.search(/[?#]/);
  const path = cut < 0 ? ref : ref.slice(0, cut);
  const suffix = cut < 0 ? "" : ref.slice(cut);
  let abs = path.startsWith("/") ? path : posix.join("/", posix.dirname(env.source), path);
  if (path.endsWith("/") && !abs.endsWith("/")) abs += "/";
  const post = abs.match(/^\/blog\/posts\/\d{4}-\d{2}-\d{2}-([a-z0-9-]+)\.md$/);
  if (post) abs = `/blog/${post[1]}/`;
  return { url: abs + suffix, path: abs };
}

/// The file a root-relative URL path is served from.
function servedFile(root, path) {
  const decoded = decodeURIComponent(path);
  return join(root, decoded.endsWith("/") ? `${decoded}index.html` : decoded);
}

function mediaFile(env, path, line, what) {
  const file = servedFile(env.root, path);
  if (!existsSync(file) || !statSync(file).isFile()) {
    env.errors.push(`${env.source}:${line}: ${what} ${path} doesn't exist`);
    return null;
  }
  return file;
}

function sizeOf(env, path, line) {
  const file = mediaFile(env, path, line, "image");
  if (!file) return null;
  const ext = posix.extname(path).toLowerCase();
  const size = imageSize(readFileSync(file), ext);
  if (!size) env.errors.push(`${env.source}:${line}: can't read the size of ${path}`);
  return size;
}

/// Inline Markdown inside a rendered token (a caption, a callout's title).
/// Its own env, sharing the post's error list: markdown-it-footnote appends
/// the footnote list to any render whose env has footnotes, so passing the
/// post's env would repeat the list inside every caption.
function inline(md, text, env) {
  return md.renderInline(text, { ...env, footnotes: undefined });
}

/// `::: kind [argument]` ... `:::` blocks: callouts (note, tip, warning,
/// with an optional title as the argument) and `::: youtube VIDEO_ID`,
/// whose body is the video's title. A small rule of our own rather than
/// markdown-it-container, to keep to one plugin.
function directives(md) {
  md.block.ruler.before(
    "fence",
    "directive",
    (state, startLine, endLine, silent) => {
      if (state.sCount[startLine] - state.blkIndent >= 4) return false;
      const lineText = (n) => state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n]);
      const open = lineText(startLine).match(/^:::\s*([a-z]+)(?:\s+(.*?))?\s*$/);
      if (!open) return false;
      if (silent) return true;
      const [, kind, arg = ""] = open;
      let depth = 1;
      let close = startLine + 1;
      for (; close < endLine; close++) {
        const t = lineText(close).trim();
        if (/^:::\s*[a-z]+/.test(t)) depth++;
        else if (t === ":::" && --depth === 0) break;
      }
      const line = state.env.lineOffset + startLine + 1;
      if (close >= endLine) state.env.errors.push(`${state.env.source}:${line}: "::: ${kind}" is never closed with ":::"`);
      if (kind === "youtube") {
        const body = [];
        for (let n = startLine + 1; n < close; n++) body.push(lineText(n));
        const token = state.push("youtube", "", 0);
        token.info = arg;
        token.content = body.join(" ").replace(/\s+/g, " ").trim();
        token.map = [startLine, close];
        token.meta = { line };
      } else {
        if (!(kind in CALLOUTS)) state.env.errors.push(`${state.env.source}:${line}: unknown block "::: ${kind}" (known: ${[...Object.keys(CALLOUTS), "youtube"].join(", ")})`);
        const oldParent = state.parentType;
        const oldMax = state.lineMax;
        state.parentType = "callout";
        state.lineMax = close;
        const o = state.push("callout_open", "div", 1);
        o.info = kind;
        o.meta = { title: arg };
        o.map = [startLine, close];
        state.md.block.tokenize(state, startLine + 1, close);
        state.push("callout_close", "div", -1);
        state.parentType = oldParent;
        state.lineMax = oldMax;
      }
      state.line = Math.min(close + 1, endLine);
      return true;
    },
    { alt: ["paragraph", "reference", "blockquote", "list"] },
  );

  // role="note", not <aside>: a named aside is a complementary landmark,
  // and a post with five callouts would list five landmarks.
  md.renderer.rules.callout_open = (tokens, idx, options, env) => {
    const t = tokens[idx];
    const label = CALLOUTS[t.info] ?? "Note";
    const title = t.meta.title ? inline(md, t.meta.title, env) : label;
    return `<div class="callout callout-${esc(t.info)}" role="note">\n<p class="callout-title">${title}</p>\n`;
  };
  md.renderer.rules.callout_close = () => "</div>\n";

  // Click to load: until the reader asks for the video, the page makes no
  // request to YouTube (no thumbnail either, which would be one). Without
  // scripts the placeholder is a plain link to the video on youtube.com;
  // blog.js swaps in the youtube-nocookie.com player, which the page's CSP
  // allows only on posts that have one.
  md.renderer.rules.youtube = (tokens, idx, options, env) => {
    const t = tokens[idx];
    const id = t.info.trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) env.errors.push(`${env.source}:${t.meta.line}: "::: youtube" needs an 11-character video id, got ${JSON.stringify(id)}`);
    if (!t.content) env.errors.push(`${env.source}:${t.meta.line}: "::: youtube" needs the video's title as its body`);
    env.youtube = true;
    const title = esc(t.content);
    return (
      `<figure class="post-figure youtube">\n` +
      `<a class="youtube-load" href="https://www.youtube.com/watch?v=${esc(id)}" data-youtube="${esc(id)}" data-title="${title}">` +
      `<span class="youtube-play" aria-hidden="true">▶</span>` +
      `<span class="youtube-label">Play “${title}”<span class="youtube-note">Loads the video from YouTube</span></span></a>\n` +
      `<figcaption>${inline(md, t.content, env)}</figcaption>\n</figure>\n`
    );
  };
}

/// The core pass over the parsed tokens: ids on headings, figures for
/// images alone in a paragraph, `{...}` attributes after images, resolved
/// links, and table alignment as classes (the CSP allows no inline style).
function postProcess(md) {
  md.core.ruler.push("neoscad", (state) => {
    const env = state.env;
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const line = t.map ? env.lineOffset + t.map[0] + 1 : env.lineOffset;
      if (t.type === "heading_open") {
        if (t.tag === "h1") env.errors.push(`${env.source}:${line}: a "# " heading: the title is the page's only h1, so sections start at "## "`);
        const text = md.renderer.renderInlineAsText(tokens[i + 1].children, md.options, env);
        let slug = slugify(text) || "section";
        if (env.ids.has(slug)) {
          let n = 2;
          while (env.ids.has(`${slug}-${n}`)) n++;
          slug = `${slug}-${n}`;
        }
        env.ids.add(slug);
        t.attrSet("id", slug);
        tokens.find((x, j) => j > i && x.type === "heading_close").meta = { slug, text };
      }
      if (t.type === "th_open" || t.type === "td_open") {
        const align = t.attrGet("style")?.match(/text-align:(\w+)/)?.[1];
        if (align) {
          t.attrs = t.attrs.filter(([k]) => k !== "style");
          t.attrJoin("class", `align-${align}`);
        }
      }
      if (t.type !== "inline" || !t.children) continue;
      const kids = t.children;
      for (let k = 0; k < kids.length; k++) {
        const kid = kids[k];
        kid.meta = { ...kid.meta, line };
        if (kid.type === "image") {
          const next = kids[k + 1];
          const m = next?.type === "text" && next.content.match(/^\{([^}]*)\}/);
          if (m) {
            kid.meta.attrs = parseAttrs(m[1]);
            next.content = next.content.slice(m[0].length);
          }
        }
        if (kid.type === "link_open") {
          const r = resolveRef(kid.attrGet("href"), env);
          kid.attrSet("href", r.url);
        }
      }
      // An image alone in its paragraph (bar a {...} and whitespace)
      // becomes a figure, its title the caption.
      const solid = kids.filter((x) => !(x.type === "text" && !x.content.trim()) && x.type !== "softbreak");
      if (solid.length === 1 && solid[0].type === "image" && tokens[i - 1]?.type === "paragraph_open" && tokens[i + 1]?.type === "paragraph_close") {
        solid[0].meta.figure = true;
        tokens[i - 1].hidden = true;
        tokens[i + 1].hidden = true;
      }
    }
  });

  md.renderer.rules.heading_close = (tokens, idx) => {
    const { slug, text } = tokens[idx].meta ?? {};
    const anchor = slug ? ` <a class="heading-anchor" href="#${esc(slug)}" aria-label="Link to the section ${esc(text)}">#</a>` : "";
    return `${anchor}</${tokens[idx].tag}>\n`;
  };
  md.renderer.rules.table_open = () => `<div class="table-scroll">\n<table>\n`;
  md.renderer.rules.table_close = () => `</table>\n</div>\n`;

  md.renderer.rules.image = (tokens, idx, options, env) => {
    const t = tokens[idx];
    const line = t.meta?.line;
    const alt = md.renderer.renderInlineAsText(t.children ?? [], options, env).trim();
    const src = t.attrGet("src");
    const caption = t.attrGet("title");
    const attrs = t.meta?.attrs ?? {};
    const r = resolveRef(src, env);
    if (!alt) env.errors.push(`${env.source}:${line}: ${src} has no alt text; describe it in the [brackets]`);
    if (r.external) {
      env.errors.push(`${env.source}:${line}: ${src} is on another site; media must be on this one (the CSP allows only 'self')`);
      return "";
    }
    const ext = posix.extname(r.path).toLowerCase();
    const figure = (inner) =>
      t.meta?.figure ? `<figure class="post-figure${ext in VIDEO_TYPES ? " post-media" : ""}">\n${inner}\n${caption ? `<figcaption>${inline(md, caption, env)}</figcaption>\n` : ""}</figure>\n` : inner;

    if (ext in VIDEO_TYPES) {
      const unknown = Object.keys(attrs).filter((k) => !["autoplay", "loop", "muted", "poster"].includes(k));
      if (unknown.length) env.errors.push(`${env.source}:${line}: unknown video attribute ${unknown.join(", ")} (known: autoplay, loop, muted, poster=)`);
      if (!t.meta?.figure) env.errors.push(`${env.source}:${line}: a video goes on a line of its own`);
      mediaFile(env, r.path, line, "video");
      // The poster is what shows before playing, and all a reader who
      // asked for reduced motion sees of an autoplaying video. Required:
      // given, or a picture beside the video with the same name.
      let poster = typeof attrs.poster === "string" ? resolveRef(attrs.poster, env).path : null;
      if (!poster) {
        const stem = r.path.slice(0, -ext.length);
        poster = [".webp", ".jpg", ".png"].map((e) => stem + e).find((p) => existsSync(servedFile(env.root, p))) ?? null;
      }
      if (!poster) {
        env.errors.push(`${env.source}:${line}: ${src} has no poster: add {poster=...} or a .webp/.jpg/.png of the same name beside it`);
        return "";
      }
      const size = sizeOf(env, poster, line);
      // Autoplay only ever muted (browsers refuse it otherwise, and sound
      // that starts on its own is hostile); site.js removes it for readers
      // who ask for reduced motion, as on the home page's hero.
      const auto = attrs.autoplay ? " autoplay muted loop playsinline" : `${attrs.loop ? " loop" : ""}${attrs.muted ? " muted" : ""}`;
      return figure(
        `<video controls preload="metadata"${auto} poster="${esc(poster)}"${size ? ` width="${size[0]}" height="${size[1]}"` : ""} aria-label="${esc(alt)}">\n` +
          `<source src="${esc(r.url)}" type="${VIDEO_TYPES[ext]}">\n` +
          `<a href="${esc(r.url)}">Download the video</a>\n</video>`,
      );
    }
    if (!IMAGE_TYPES.has(ext)) {
      env.errors.push(`${env.source}:${line}: ${src}: unsupported media type (images: ${[...IMAGE_TYPES].join(" ")}; video: .mp4 .webm)`);
      return "";
    }
    if (Object.keys(attrs).length) env.errors.push(`${env.source}:${line}: images take no {attributes}`);
    const size = sizeOf(env, r.path, line);
    return figure(
      `<img src="${esc(r.url)}" alt="${esc(alt)}"${size ? ` width="${size[0]}" height="${size[1]}"` : ""} loading="lazy" decoding="async">`,
    );
  };

  // Code: highlighted here, so the page needs no script for it. Each block
  // gets a bar with its language; blog.js adds a Copy button to it. An
  // OpenSCAD block whose fence says `try=<example>` links to that example
  // in /try (`/try/#example=<id>`, the one way /try takes a model from its
  // URL today, web/src/app.js in the NeoSCAD repo); /try can't yet open
  // arbitrary source from a link, so other blocks have no such link.
  md.renderer.rules.fence = (tokens, idx, options, env) => {
    const t = tokens[idx];
    const line = env.lineOffset + t.map[0] + 1;
    const [lang = "", ...rest] = t.info.trim().split(/\s+/);
    const attrs = parseAttrs(rest.join(" "));
    const known = LANGUAGES[lang.toLowerCase()];
    if (!known) {
      env.errors.push(`${env.source}:${line}: unknown code language "${lang}" (known: ${Object.keys(LANGUAGES).filter(Boolean).join(", ")})`);
      return "";
    }
    const [label, grammar] = known;
    const name = lang.toLowerCase();
    const body = grammar ? hljs.highlight(t.content, { language: name, ignoreIllegals: true }).value : esc(t.content);
    let tryLink = "";
    for (const k of Object.keys(attrs)) {
      if (k !== "try") env.errors.push(`${env.source}:${line}: unknown code block attribute "${k}" (known: try=<example id>)`);
    }
    if (attrs.try !== undefined) {
      if (grammar !== openscad) env.errors.push(`${env.source}:${line}: try= is for OpenSCAD blocks`);
      else if (!env.examples.has(attrs.try))
        env.errors.push(`${env.source}:${line}: try=${attrs.try}: no such example in try/examples/manifest.json (${[...env.examples].join(", ")})`);
      else tryLink = ` <a class="code-try" href="/try/#example=${esc(encodeURIComponent(attrs.try))}">Open in NeoSCAD</a>`;
    }
    const cls = grammar ? ` class="hljs language-${grammar === openscad ? "openscad" : esc(name)}"` : "";
    return (
      `<div class="code-block">\n<div class="code-bar"><span class="code-lang">${esc(label)}</span>${tryLink}</div>\n` +
      `<pre><code${cls}>${body}</code></pre>\n</div>\n`
    );
  };
}

export function createMarkdown() {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: true });
  md.use(footnote);
  md.use(directives);
  md.use(postProcess);
  md.renderer.rules.footnote_block_open = () => `<section class="footnotes" aria-label="Footnotes">\n<ol class="footnotes-list">\n`;
  return md;
}

// --- Pages -----------------------------------------------------------------

/// The site's header and footer, taken from index.html so the blog's pages
/// can't drift from the hand-written ones; only the current-page marker
/// moves to the Blog link.
function chrome(root, errors) {
  const index = readFileSync(join(root, "index.html"), "utf8");
  let header = index.match(/<header class="topbar">[\s\S]*?<\/header>/)?.[0];
  const footer = index.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)?.[0];
  if (!header || !footer) {
    errors.push(`index.html: no <header class="topbar"> or <footer class="site-footer"> to copy`);
    return { header: "", footer: "" };
  }
  header = header.replace(/ aria-current="page"/g, "");
  if (!header.includes('<a href="/blog/">')) errors.push(`index.html: the nav has no <a href="/blog/"> link`);
  return { header, footer };
}

function csp({ youtube }) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self'",
    "media-src 'self'",
    `frame-src ${youtube ? "https://www.youtube-nocookie.com" : "'none'"}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

function page({ chrome: ch, current, title, description, path, type, image, published, noindex, youtube, source, body }) {
  const img = image ?? DEFAULT_IMAGE;
  const header = current ? ch.header.replace('<a href="/blog/">', '<a href="/blog/" aria-current="page">') : ch.header;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Generated by tools/blog/build.mjs${source ? ` from ${source}` : ""}: edit that, not this file. -->
  <meta http-equiv="Content-Security-Policy" content="${csp({ youtube })}">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="color-scheme" content="light dark">${noindex ? '\n  <meta name="robots" content="noindex">' : ""}
  <link rel="canonical" href="${SITE}${path}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="NeoSCAD">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${SITE}${path}">
  <meta property="og:image" content="${SITE}${esc(img.url)}">
  <meta property="og:image:width" content="${img.width}">
  <meta property="og:image:height" content="${img.height}">
  <meta property="og:image:alt" content="${esc(img.alt)}">${published ? `\n  <meta property="article:published_time" content="${published}">` : ""}
  <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
  <link rel="alternate" type="application/atom+xml" title="${BLOG_TITLE}" href="/blog/feed.xml">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
  <link rel="apple-touch-icon" href="/assets/icon-512.png">
  <link rel="stylesheet" href="/theme.css">
  <link rel="stylesheet" href="/styles.css">
  <script src="/site.js"></script>
  <script src="/blog.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>

  ${header}

  <main id="main">
${body}
  </main>

  ${ch.footer}
</body>
</html>
`;
}

function postMeta(post, { link = true } = {}) {
  const parts = [`<time datetime="${post.date}">${longDate(post.date)}</time>`];
  if (post.author) parts.push(`<span>${esc(post.author)}</span>`);
  if (post.draft) parts.push(`<span class="badge badge-soon">Draft</span>`);
  const tags = post.tags.length
    ? ` <span class="post-tags">${post.tags.map((t) => (link ? `<a class="tag" href="/blog/tags/${t}/">${t}</a>` : `<span class="tag">${t}</span>`)).join(" ")}</span>`
    : "";
  return `<p class="post-meta">${parts.join(' <span aria-hidden="true">·</span> ')}${tags}</p>`;
}

function postList(posts, empty) {
  if (!posts.length) return `      <p class="post-list-empty">${empty}</p>`;
  const items = posts.map(
    (p) => `        <li class="post-card">
          <h2><a href="/blog/${p.slug}/">${esc(p.title)}</a></h2>
          ${postMeta(p)}
          <p>${esc(p.summary)}</p>
        </li>`,
  );
  return `      <ol class="post-list">\n${items.join("\n")}\n      </ol>`;
}

function listPage(ch, { title, eyebrow, heading, lede, path, posts, empty, noindex }) {
  return page({
    chrome: ch,
    current: true,
    title,
    description: lede,
    path,
    type: "website",
    noindex,
    body: `    <section class="hero blog-hero" aria-labelledby="blog-title">
      <div class="wrap prose">
        <p class="eyebrow">${eyebrow}</p>
        <h1 id="blog-title">${heading}</h1>
        <p class="lede">${lede}</p>
        <p class="small"><a href="/blog/feed.xml">Atom feed</a></p>
      </div>
    </section>
    <section class="section blog-list" aria-label="Posts">
      <div class="wrap prose">
${postList(posts, empty)}
      </div>
    </section>`,
  });
}

function postPage(ch, post) {
  const cover = post.cover
    ? `\n        <figure class="post-figure post-cover">
          <img src="${esc(post.cover.url)}" alt="${esc(post.cover.alt)}" width="${post.cover.width}" height="${post.cover.height}" decoding="async">
        </figure>`
    : "";
  const draft = post.draft
    ? `\n        <p class="notice">Draft preview: this post is <code>draft: true</code>, so the normal build leaves it out of every page, the feed and the sitemap.</p>`
    : "";
  return page({
    chrome: ch,
    current: true,
    title: `${post.title} · NeoSCAD`,
    description: post.summary,
    path: `/blog/${post.slug}/`,
    type: "article",
    image: post.cover,
    published: post.date,
    noindex: post.draft,
    youtube: post.youtube,
    source: post.source,
    body: `    <article class="post" aria-labelledby="post-title">
      <header class="post-header wrap prose">
        <p class="eyebrow"><a href="/blog/">Blog</a></p>
        <h1 id="post-title">${esc(post.title)}</h1>
        ${postMeta(post)}${draft}${cover}
      </header>
      <div class="post-body wrap prose">
${post.html.trimEnd()}
      </div>
      <footer class="post-footer wrap prose">
        <p><a href="/blog/">All posts</a> · <a href="/blog/feed.xml">Atom feed</a></p>
      </footer>
    </article>`,
  });
}

/// Root-relative URLs made absolute, for the feed: a feed reader resolves
/// them against the feed, which would mostly work, but not every reader
/// does, and fragment links must point at the post.
function absolutize(html, postUrl) {
  return html.replace(/\b(href|src|poster)="\/(?!\/)/g, `$1="${SITE}/`).replace(/\bhref="#/g, `href="${postUrl}#`);
}

function feed(posts) {
  const updated = posts.length ? posts.map((p) => p.updatedIso).sort().at(-1) : EMPTY_FEED_UPDATED;
  const entries = posts.map((p) => {
    const url = `${SITE}/blog/${p.slug}/`;
    return `  <entry>
    <title>${esc(p.title)}</title>
    <link rel="alternate" type="text/html" href="${url}"/>
    <id>${url}</id>
    <published>${p.date}T00:00:00Z</published>
    <updated>${p.updatedIso}</updated>${p.author ? `\n    <author><name>${esc(p.author)}</name></author>` : ""}${p.tags.map((t) => `\n    <category term="${t}"/>`).join("")}
    <summary>${esc(p.summary)}</summary>
    <content type="html">${esc(absolutize(p.html, url))}</content>
  </entry>`;
  });
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${BLOG_TITLE}</title>
  <subtitle>${esc(BLOG_SUMMARY)}</subtitle>
  <link rel="alternate" type="text/html" href="${SITE}/blog/"/>
  <link rel="self" type="application/atom+xml" href="${SITE}/blog/feed.xml"/>
  <id>${SITE}/blog/</id>
  <updated>${updated}</updated>
  <author><name>NeoSCAD</name></author>
  <icon>${SITE}/favicon.png</icon>
${entries.join("\n")}${entries.length ? "\n" : ""}</feed>
`;
}

const SITEMAP_START = "  <!-- Blog: written by tools/blog/build.mjs; edit outside these markers. -->";
const SITEMAP_END = "  <!-- /Blog -->";

function sitemap(text, posts, tags, errors) {
  const lines = [`  <url><loc>${SITE}/blog/</loc></url>`];
  for (const p of posts) lines.push(`  <url><loc>${SITE}/blog/${p.slug}/</loc><lastmod>${p.updatedIso.slice(0, 10)}</lastmod></url>`);
  for (const t of tags) lines.push(`  <url><loc>${SITE}/blog/tags/${t}/</loc></url>`);
  const block = `${SITEMAP_START}\n${lines.join("\n")}\n${SITEMAP_END}\n`;
  const start = text.indexOf(SITEMAP_START);
  const end = text.indexOf(SITEMAP_END);
  if (start >= 0 && end > start) return text.slice(0, start) + block + text.slice(end + SITEMAP_END.length + 1);
  if (!text.includes("</urlset>")) {
    errors.push("sitemap.xml: no </urlset>");
    return text;
  }
  return text.replace("</urlset>", `${block}</urlset>`);
}

// --- Build ------------------------------------------------------------------

function exampleIds(root) {
  const file = join(root, "try/examples/manifest.json");
  if (!existsSync(file)) return new Set();
  try {
    return new Set(JSON.parse(readFileSync(file, "utf8")).examples.map((e) => e.id));
  } catch {
    return new Set();
  }
}

function readPost(md, root, name, examples, errors) {
  const source = `blog/posts/${name}`;
  const m = name.match(POST_FILE);
  if (!m) {
    errors.push(`${source}: name it YYYY-MM-DD-slug.md (lowercase letters, digits and hyphens)`);
    return null;
  }
  const [, fileDate, slug] = m;
  const { data, body, bodyLine } = parseFrontMatter(readFileSync(join(root, source), "utf8"), source, errors);
  for (const k of ["title", "date", "summary"]) if (typeof data[k] !== "string" || !data[k].trim()) errors.push(`${source}: front matter needs "${k}"`);
  if (data.date && data.date !== fileDate) errors.push(`${source}: date ${data.date} doesn't match the file name's ${fileDate}`);
  if (data.date && !validDate(data.date)) errors.push(`${source}: date ${data.date} isn't a real YYYY-MM-DD date`);
  if (data.updated !== undefined && !(typeof data.updated === "string" && validDate(data.updated) && data.updated >= fileDate))
    errors.push(`${source}: updated must be a YYYY-MM-DD date on or after the post's date`);
  if (RESERVED_SLUGS.has(slug)) errors.push(`${source}: the slug "${slug}" is taken by blog/${slug}/`);
  const tags = data.tags === undefined ? [] : Array.isArray(data.tags) ? data.tags : [data.tags];
  for (const t of tags) if (!TAG.test(t)) errors.push(`${source}: tag "${t}": use lowercase letters, digits and hyphens`);
  if (data.draft !== undefined && typeof data.draft !== "boolean") errors.push(`${source}: draft is true or false`);
  for (const k of ["title", "summary", "author", "cover", "cover_alt"])
    if (data[k] !== undefined && typeof data[k] !== "string") errors.push(`${source}: "${k}" is text, not a list`);

  const env = { root, source, errors, examples, lineOffset: bodyLine - 1, ids: new Set(["main", "post-title", "site-nav"]), youtube: false };
  let cover = null;
  if (data.cover) {
    const r = resolveRef(data.cover, env);
    if (!data.cover_alt) errors.push(`${source}: a cover needs cover_alt, its alt text`);
    const size = r.external ? null : sizeOf(env, r.path, 1);
    if (r.external) errors.push(`${source}: the cover must be on this site`);
    if (size) cover = { url: r.url, width: size[0], height: size[1], alt: data.cover_alt ?? "" };
  } else if (data.cover_alt) {
    errors.push(`${source}: cover_alt without a cover`);
  }
  const html = md.render(body, env);
  return {
    source,
    slug,
    date: fileDate,
    updatedIso: `${data.updated ?? fileDate}T00:00:00Z`,
    title: data.title ?? slug,
    summary: data.summary ?? "",
    author: data.author ?? null,
    tags: [...new Set(tags)].sort(),
    draft: data.draft === true,
    cover,
    youtube: env.youtube,
    html,
  };
}

/// Every root-relative URL a generated page points at must be a file on
/// the site or another generated page: links in posts, media, and the
/// chrome copied from index.html.
function checkLinks(root, files, errors) {
  for (const [out, content] of files) {
    if (!out.endsWith(".html")) continue;
    for (const [, url] of content.matchAll(/\b(?:href|src|poster)="(\/[^"/][^"]*|\/)"/g)) {
      const path = url.replace(/[?#].*$/, "");
      const rel = (decodeURIComponent(path).endsWith("/") ? `${decodeURIComponent(path)}index.html` : decodeURIComponent(path)).slice(1);
      if (files.has(rel)) continue;
      const file = join(root, rel);
      if (existsSync(file) && statSync(file).isFile()) continue;
      if (existsSync(join(root, decodeURIComponent(path), "index.html"))) continue;
      errors.push(`${out}: broken link ${url}`);
    }
  }
}

/// Builds everything in memory: { files: Map(path -> text), errors }.
export function build({ root, drafts = false }) {
  const errors = [];
  const md = createMarkdown();
  const ch = chrome(root, errors);
  const examples = exampleIds(root);
  const dir = join(root, "blog/posts");
  const names = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith(".md") && n !== "README.md").sort() : [];
  const all = names.map((n) => readPost(md, root, n, examples, errors)).filter(Boolean);
  const seen = new Map();
  for (const p of all) {
    if (seen.has(p.slug)) errors.push(`${p.source}: slug "${p.slug}" is also ${seen.get(p.slug)}'s`);
    seen.set(p.slug, p.source);
  }
  const byDate = (a, b) => (a.date === b.date ? (a.slug < b.slug ? -1 : 1) : a.date < b.date ? 1 : -1);
  const shown = all.filter((p) => drafts || !p.draft).sort(byDate);
  const published = shown.filter((p) => !p.draft);

  const files = new Map();
  files.set(
    "blog/index.html",
    listPage(ch, {
      title: "Blog · NeoSCAD",
      eyebrow: "NeoSCAD",
      heading: "Blog",
      lede: BLOG_SUMMARY,
      path: "/blog/",
      posts: shown,
      empty: "No posts yet. The Atom feed will have them as they're published.",
      noindex: drafts && shown.some((p) => p.draft),
    }),
  );
  for (const p of shown) files.set(`blog/${p.slug}/index.html`, postPage(ch, p));
  const tags = [...new Set(shown.flatMap((p) => p.tags))].sort();
  for (const t of tags) {
    const tagged = shown.filter((p) => p.tags.includes(t));
    files.set(
      `blog/tags/${t}/index.html`,
      listPage(ch, {
        title: `Posts tagged “${t}” · NeoSCAD`,
        eyebrow: `<a href="/blog/">Blog</a>`,
        heading: `Tagged “${esc(t)}”`,
        lede: `${tagged.length} post${tagged.length === 1 ? "" : "s"} tagged “${esc(t)}”.`,
        path: `/blog/tags/${t}/`,
        posts: tagged,
        empty: "",
        noindex: tagged.every((p) => p.draft),
      }),
    );
  }
  files.set("blog/feed.xml", feed(published));
  const publishedTags = [...new Set(published.flatMap((p) => p.tags))].sort();
  const sm = join(root, "sitemap.xml");
  if (existsSync(sm)) files.set("sitemap.xml", sitemap(readFileSync(sm, "utf8"), published, publishedTags, errors));
  checkLinks(root, files, errors);
  return { files, errors, posts: shown };
}

/// Writes the files that changed and deletes generated files no longer
/// produced. Under blog/, only posts/ and media/ are authors'; anything
/// else there that isn't an index.html or feed.xml is reported, never
/// deleted, in case someone put a file there by hand.
export function write(root, files) {
  const errors = [];
  const stale = [];
  const walk = (rel) => {
    for (const name of readdirSync(join(root, rel)).sort()) {
      const r = `${rel}/${name}`;
      if (r === "blog/posts" || r === "blog/media") continue;
      if (statSync(join(root, r)).isDirectory()) walk(r);
      else if (!files.has(r)) (name === "index.html" || name === "feed.xml" ? stale : errors).push(r);
    }
  };
  if (existsSync(join(root, "blog"))) walk("blog");
  if (errors.length) return errors.map((r) => `${r}: not generated, and outside blog/posts/ and blog/media/; move or delete it`);
  let changed = 0;
  for (const [rel, content] of files) {
    const file = join(root, rel);
    if (existsSync(file) && readFileSync(file, "utf8") === content) continue;
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    changed++;
  }
  for (const rel of stale) {
    unlinkSync(join(root, rel));
    let d = dirname(rel);
    while (d !== "blog" && readdirSync(join(root, d)).length === 0) {
      rmdirSync(join(root, d));
      d = dirname(d);
    }
  }
  return { changed, removed: stale.length };
}

function main(argv) {
  const args = argv.slice(2);
  const root = resolve(args.includes("--root") ? args[args.indexOf("--root") + 1] : join(dirname(fileURLToPath(import.meta.url)), "../.."));
  const drafts = args.includes("--drafts");
  const { files, errors, posts } = build({ root, drafts });
  if (errors.length) {
    console.error(`The blog didn't build (${errors.length} error${errors.length === 1 ? "" : "s"}):`);
    for (const e of errors) console.error(`  ${e}`);
    return 1;
  }
  const result = write(root, files);
  if (Array.isArray(result)) {
    for (const e of result) console.error(e);
    return 1;
  }
  const d = posts.filter((p) => p.draft).length;
  console.log(`blog: ${posts.length} post${posts.length === 1 ? "" : "s"}${d ? ` (${d} draft${d === 1 ? "" : "s"}: preview only, don't commit)` : ""}; ${result.changed} file(s) written, ${result.removed} removed`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv);
