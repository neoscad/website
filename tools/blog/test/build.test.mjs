// Tests for the blog renderer: `cd tools/blog && npm test`.
// Each test builds a small site in a temporary directory.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import hljs from "highlight.js/lib/core";
import { build, imageSize, parseFrontMatter, postTitle, write } from "../build.mjs";
import openscad from "../openscad.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
// The example post's media serve as fixtures; if that post goes, copy them here.
const MEDIA = join(HERE, "../../../blog/media/example-post");

const INDEX = `<!doctype html><html><body>
  <header class="topbar"><nav><ul>
    <li><a href="/" aria-current="page">Home</a></li>
    <li><a href="/blog/">Blog</a></li>
    <li><a href="/try/">Try it</a></li>
  </ul></nav></header>
  <main></main>
  <footer class="site-footer"><a href="/">Home</a></footer>
</body></html>`;

function site(posts = {}) {
  const root = mkdtempSync(join(tmpdir(), "blog-test-"));
  writeFileSync(join(root, "index.html"), INDEX);
  for (const f of ["theme.css", "styles.css", "site.js", "blog.js", "favicon.png", "download.html", "site.webmanifest"]) writeFileSync(join(root, f), "");
  mkdirSync(join(root, "assets"));
  writeFileSync(join(root, "assets/icon-512.png"), "");
  writeFileSync(join(root, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset>\n  <url><loc>https://neoscad.org/</loc></url>\n</urlset>\n`);
  mkdirSync(join(root, "try/examples"), { recursive: true });
  writeFileSync(join(root, "try/index.html"), "");
  writeFileSync(join(root, "try/examples/manifest.json"), JSON.stringify({ examples: [{ id: "csg" }] }));
  mkdirSync(join(root, "blog/media/x"), { recursive: true });
  cpSync(MEDIA, join(root, "blog/media/x"), { recursive: true });
  mkdirSync(join(root, "blog/posts"), { recursive: true });
  for (const [name, text] of Object.entries(posts)) writeFileSync(join(root, "blog/posts", name), text);
  return root;
}

const post = (body, extra = "") => `---\ntitle: A post\ndate: 2026-10-03\nsummary: A summary.\n${extra}---\n\n${body}\n`;

function run(posts, opts = {}) {
  const root = site(posts);
  try {
    return build({ root, ...opts });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("no posts: an index that says so, an empty but valid feed", () => {
  const { files, errors } = run({});
  assert.deepEqual(errors, []);
  assert.match(files.get("blog/index.html"), /No posts yet/);
  assert.match(files.get("blog/feed.xml"), /<updated>2026-10-02T00:00:00Z<\/updated>/);
  assert.doesNotMatch(files.get("blog/feed.xml"), /<entry>/);
  assert.match(files.get("sitemap.xml"), /<loc>https:\/\/neoscad.org\/blog\/<\/loc>/);
  assert.match(files.get("blog/index.html"), /<a href="\/blog\/" aria-current="page">Blog<\/a>/);
  assert.doesNotMatch(files.get("blog/index.html"), /aria-current="page">Home/);
});

test("a draft is in no output unless --drafts, and never in the feed or sitemap", () => {
  const posts = { "2026-10-03-wip.md": post("Text.", "draft: true\ntags: [a]\n") };
  const plain = run(posts);
  assert.deepEqual(plain.errors, []);
  assert.deepEqual([...plain.files.keys()].sort(), ["blog/feed.xml", "blog/index.html", "sitemap.xml"]);
  const preview = run(posts, { drafts: true });
  assert.ok(preview.files.has("blog/wip/index.html"));
  assert.match(preview.files.get("blog/wip/index.html"), /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(preview.files.get("blog/feed.xml"), /wip/);
  assert.doesNotMatch(preview.files.get("sitemap.xml"), /wip/);
});

test("a published post: page, feed entry, sitemap line, tag page, meta tags", () => {
  const { files, errors } = run({ "2026-10-03-hello.md": post("Hello [home](/).", "tags: [news]\n") });
  assert.deepEqual(errors, []);
  const html = files.get("blog/hello/index.html");
  assert.match(html, /<link rel="canonical" href="https:\/\/neoscad.org\/blog\/hello\/">/);
  assert.match(html, /<meta property="og:type" content="article">/);
  assert.match(html, /<meta name="description" content="A summary.">/);
  assert.match(html, /frame-src 'none'/);
  assert.match(files.get("blog/feed.xml"), /<id>https:\/\/neoscad.org\/blog\/hello\/<\/id>/);
  assert.match(files.get("blog/feed.xml"), /href=&quot;https:\/\/neoscad.org\/&quot;/);
  assert.match(files.get("sitemap.xml"), /blog\/hello\/<\/loc><lastmod>2026-10-03/);
  assert.ok(files.has("blog/tags/news/index.html"));
});

// Every JSON-LD block on a page, parsed: a block that isn't valid JSON fails here.
const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

test("structured data: BlogPosting and breadcrumbs on a post, Blog on the index; lastmod on list pages", () => {
  const { files, errors } = run({
    "2026-10-03-hello.md": post("Hello.", "tags: [news]\nauthor: Ada </script><b>\nupdated: 2026-10-05\n"),
    "2026-10-04-two.md": post("Two.", "author: The NeoSCAD project\n").replace("2026-10-03", "2026-10-04"),
  });
  assert.deepEqual(errors, []);
  const html = files.get("blog/hello/index.html");
  // The author's "</script>" can't end the block early.
  assert.doesNotMatch(html, /Ada <\/script>/);
  const [data] = ld(html);
  assert.equal(data["@context"], "https://schema.org");
  const [article, crumbs] = data["@graph"];
  assert.equal(article["@type"], "BlogPosting");
  assert.equal(article.headline, "A post");
  assert.equal(article.datePublished, "2026-10-03");
  assert.equal(article.dateModified, "2026-10-05");
  assert.deepEqual(article.author, { "@type": "Person", name: "Ada </script><b>" });
  assert.equal(article.image, "https://neoscad.org/assets/icon-512.png");
  assert.deepEqual(crumbs.itemListElement.map((i) => [i.position, i.name, i.item]), [
    [1, "Home", "https://neoscad.org/"],
    [2, "Blog", "https://neoscad.org/blog/"],
    [3, "A post", undefined],
  ]);
  assert.match(html, /<meta property="og:title" content="A post">/);
  assert.match(html, /<meta property="article:modified_time" content="2026-10-05">/);
  assert.equal(ld(files.get("blog/two/index.html"))[0]["@graph"][0].author["@type"], "Organization");
  assert.equal(ld(files.get("blog/index.html"))[0]["@graph"][0]["@type"], "Blog");
  assert.equal(ld(files.get("blog/tags/news/index.html"))[0]["@type"], "BreadcrumbList");
  const sm = files.get("sitemap.xml");
  assert.match(sm, /<loc>https:\/\/neoscad.org\/blog\/<\/loc><lastmod>2026-10-05<\/lastmod>/);
  assert.match(sm, /blog\/tags\/news\/<\/loc><lastmod>2026-10-05<\/lastmod>/);
});

test("description: the meta, preview and structured-data line; summary stays the index blurb and feed summary", () => {
  const { files, errors } = run({ "2026-10-03-hello.md": post("Hello.", "description: A short line.\ntags: [news]\n") });
  assert.deepEqual(errors, []);
  const html = files.get("blog/hello/index.html");
  assert.match(html, /<meta name="description" content="A short line.">/);
  assert.match(html, /<meta property="og:description" content="A short line.">/);
  assert.doesNotMatch(html, /content="A summary."/);
  assert.equal(ld(html)[0]["@graph"][0].description, "A short line.");
  for (const list of ["blog/index.html", "blog/tags/news/index.html"]) {
    assert.match(files.get(list), /<p>A summary.<\/p>/);
    assert.doesNotMatch(files.get(list), /A short line/);
  }
  assert.match(files.get("blog/feed.xml"), /<summary>A summary.<\/summary>/);
  assert.doesNotMatch(files.get("blog/feed.xml"), /A short line/);
});

test("description must be text and not empty", () => {
  const { errors } = run({ "2026-10-03-a.md": post("x", 'description: ""\n'), "2026-10-03-b.md": post("x", "description: [a, b]\n") });
  const text = errors.join("\n");
  assert.match(text, /2026-10-03-a.md: "description" is empty/);
  assert.match(text, /2026-10-03-b.md: "description" is text, not a list/);
});

test("<title>: the site suffix only when it fits in 60 characters; og:title is the bare title", () => {
  assert.equal(postTitle("A post"), "A post · NeoSCAD");
  assert.equal(postTitle("x".repeat(50)), `${"x".repeat(50)} · NeoSCAD`);
  assert.equal(postTitle("x".repeat(51)), "x".repeat(51));
  const long = "NeoSCAD and OpenSCAD: what's the same, and what NeoSCAD adds";
  const { files, errors } = run({ "2026-10-03-a.md": post("x").replace("title: A post", `title: "${long}"`) });
  assert.deepEqual(errors, []);
  const html = files.get("blog/a/index.html");
  assert.match(html, /<title>NeoSCAD and OpenSCAD: what's the same, and what NeoSCAD adds<\/title>/);
  assert.match(html, /<meta property="og:title" content="NeoSCAD and OpenSCAD: what's the same, and what NeoSCAD adds">/);
});

test("an image without alt text fails the build", () => {
  const { errors } = run({ "2026-10-03-a.md": post("![](../media/x/placeholder-shapes.svg)") });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /2026-10-03-a.md:7: .*no alt text/);
});

test("figures: caption, size, lazy loading; video: poster and muted autoplay", () => {
  const { files, errors } = run({
    "2026-10-03-a.md": post(
      '![Shapes.](../media/x/placeholder-shapes.svg "The caption.")\n\n![A clip.](../media/x/placeholder-clip.mp4){autoplay}',
    ),
  });
  assert.deepEqual(errors, []);
  const html = files.get("blog/a/index.html");
  assert.match(html, /<figure class="post-figure">\n<img src="\/blog\/media\/x\/placeholder-shapes.svg" alt="Shapes." width="960" height="540" loading="lazy" decoding="async">\n<figcaption>The caption.<\/figcaption>/);
  assert.match(html, /<video controls preload="metadata" autoplay muted loop playsinline poster="\/blog\/media\/x\/placeholder-clip.png" width="640" height="360"/);
});

test("mistakes are errors, all reported at once", () => {
  const { errors } = run({
    "2026-10-03-a.md": post(
      "# Not a title\n\n```scadd\nx=1;\n```\n\n```openscad try=nope\ncube();\n```\n\n[gone](/nowhere.html)\n\n![Missing.](missing.png)\n\n::: aside\nx\n:::",
      "colour: red\n",
    ),
  });
  const text = errors.join("\n");
  for (const want of [/unknown front matter key "colour"/, /"# " heading/, /unknown code language "scadd"/, /try=nope: no such example/, /broken link \/nowhere.html/, /missing.png doesn't exist/, /unknown block "::: aside"/])
    assert.match(text, want);
});

test("the file name's date must match the front matter's", () => {
  const { errors } = run({ "2026-10-04-a.md": post("x") });
  assert.match(errors.join("\n"), /doesn't match the file name's 2026-10-04/);
});

test("code: OpenSCAD highlighted at build time, try= links to /try's example", () => {
  const { files, errors } = run({ "2026-10-03-a.md": post("```openscad try=csg\ncube(10); // c\n```") });
  assert.deepEqual(errors, []);
  const html = files.get("blog/a/index.html");
  assert.match(html, /<a class="code-try" href="\/try\/#example=csg">Open in NeoSCAD<\/a>/);
  assert.match(html, /<span class="hljs-built_in">cube<\/span>\(<span class="hljs-number">10<\/span>\); <span class="hljs-comment">\/\/ c<\/span>/);
});

test("callouts, tables as classes, footnotes once, heading anchors", () => {
  const md = "## Part\n\n## Part\n\n::: warning Careful\nBody.\n:::\n\n| a | b |\n|---|--:|\n| 1 | 2 |\n\nNote.[^n]\n\n![S.](../media/x/placeholder-shapes.svg \"Cap.\")\n\n[^n]: Foot.";
  const { files, errors } = run({ "2026-10-03-a.md": post(md) });
  assert.deepEqual(errors, []);
  const html = files.get("blog/a/index.html");
  assert.match(html, /<h2 id="part">Part <a class="heading-anchor" href="#part"/);
  assert.match(html, /<h2 id="part-2">/);
  assert.match(html, /<div class="callout callout-warning" role="note">\n<p class="callout-title">Careful<\/p>/);
  assert.match(html, /<td class="align-right">2<\/td>/);
  assert.doesNotMatch(html, /style=/);
  assert.equal(html.match(/class="footnotes"/g).length, 1);
});

test("YouTube: click-to-load placeholder, and the CSP allows its frame only there", () => {
  const { files, errors } = run({ "2026-10-03-a.md": post("::: youtube aqz-KE-bpKQ\nA video title\n:::") });
  assert.deepEqual(errors, []);
  const html = files.get("blog/a/index.html");
  assert.match(html, /frame-src https:\/\/www.youtube-nocookie.com;/);
  assert.match(html, /<a class="youtube-load" href="https:\/\/www.youtube.com\/watch\?v=aqz-KE-bpKQ" data-youtube="aqz-KE-bpKQ"/);
  assert.doesNotMatch(html, /<iframe/);
  assert.match(files.get("blog/index.html"), /frame-src 'none'/);
});

test("the build is deterministic, and write() removes pages it no longer makes", () => {
  const root = site({ "2026-10-03-a.md": post("x", "tags: [t]\n") });
  try {
    const one = build({ root });
    assert.deepEqual(one.errors, []);
    write(root, one.files);
    assert.ok(existsSync(join(root, "blog/a/index.html")));
    const two = build({ root });
    assert.deepEqual([...two.files], [...one.files]);
    writeFileSync(join(root, "blog/posts/2026-10-03-a.md"), post("x", "draft: true\n"));
    const three = build({ root });
    write(root, three.files);
    assert.ok(!existsSync(join(root, "blog/a")));
    assert.ok(!existsSync(join(root, "blog/tags")));
    assert.equal(readFileSync(join(root, "sitemap.xml"), "utf8").match(/<!-- Blog/g).length, 1);
    // A stray hand-written file in the generated area is reported, not deleted.
    writeFileSync(join(root, "blog/notes.txt"), "mine");
    assert.match(write(root, three.files)[0], /blog\/notes.txt: not generated/);
    assert.ok(existsSync(join(root, "blog/notes.txt")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("front matter: quotes, lists, booleans; unknown syntax is an error", () => {
  const errors = [];
  const { data } = parseFrontMatter('---\ntitle: "A: title"\ntags: [a, b]\ndraft: false\n---\nbody', "f.md", errors);
  assert.deepEqual(errors, []);
  assert.deepEqual(data, { title: "A: title", tags: ["a", "b"], draft: false });
  parseFrontMatter("---\ntitle: x\n  continued\n---\n", "f.md", errors);
  assert.match(errors[0], /expected "key: value"/);
});

test("image sizes from PNG and SVG headers", () => {
  assert.deepEqual(imageSize(readFileSync(join(MEDIA, "placeholder-clip.png")), ".png"), [640, 360]);
  assert.deepEqual(imageSize(Buffer.from('<svg viewBox="0 0 30 20">'), ".svg"), [30, 20]);
});

test("the OpenSCAD grammar", () => {
  hljs.registerLanguage("openscad", openscad);
  const h = (s) => hljs.highlight(s, { language: "openscad" }).value;
  // highlight.js's own grammar turns the rest of this line into a directive.
  assert.equal(h("included = 1;"), 'included = <span class="hljs-number">1</span>;');
  assert.equal(h("use <MCAD/gears.scad>"), '<span class="hljs-keyword">use</span> <span class="hljs-string">&lt;MCAD/gears.scad&gt;</span>');
  assert.equal(h("x = .5e-3;"), 'x = <span class="hljs-number">.5e-3</span>;');
  assert.match(h("v = [each a]; assert(is_undef(q));"), /hljs-keyword">each<.*hljs-keyword">assert<.*hljs-built_in">is_undef</);
  assert.match(h("module gear($fn = 8) { gear2(); }"), /hljs-title function_">gear<.*hljs-variable language_">\$fn<.*hljs-title function_ invoke__">gear2</);
});
