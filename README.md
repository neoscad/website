# neoscad.org

The NeoSCAD website: hand-written static HTML and CSS, served by GitHub
Pages at the apex domain `neoscad.org`. Pages serves the files as they
are: there is no deploy-time build step, no framework and no package
manager for the site. The one generator is the blog's (`tools/blog/`, an
authoring tool with its own lockfile): it turns Markdown posts into
static HTML, which is committed like every other page (see
[Writing a post](#writing-a-post)). The scripts are `site.js`, a mobile
menu toggle, the hero video's Pause button and reduced-motion stop, and
tab groups with Copy buttons (the install boxes on the home and agents pages, and the agents page's setup per client), which the pages work without; `blog.js`, the blog's Copy buttons and
click-to-load YouTube, which the posts work without; and `community.js`,
which `community.html` needs to show its results.

## Structure

| Path | What |
|---|---|
| `index.html` | Home: hero, numbers, one benchmark chart, three pillars, the printability check, "built in the open" (progress video and AI-authorship disclosure), coming from OpenSCAD, credits, FAQ |
| `download.html` | Downloads by platform (links to the latest GitHub release), package managers, source, nightly, with a status on every entry |
| `benchmarks.html` | Method, machine, chart, the full results table, the edit loop and caveats |
| `agents.html` | Using NeoSCAD with AI agents: the MCP server's tools, setup per agent, the loop, limits, JSON output, the /try agent bridge, a worked example and a FAQ. Its claims follow the released CLI (`neoscad mcp --help` and its `tools/list`); the comment in its head says how to keep it current |
| `community.html`, `community.js` | Community benchmark results: fetches `summary.json` from the `neoscad/benchmarks` repository (raw.githubusercontent.com, the only other origin any page contacts; the page's CSP allows only that) and renders it per release, platform and run |
| `try/index.html` | Placeholder for the in-browser demo; the whole `try/` directory is replaced by the demo bundle |
| `404.html` | GitHub Pages' not-found page (root-relative URLs only) |
| `blog/posts/` | Blog posts in Markdown, `YYYY-MM-DD-slug.md` (template and rules in `blog/posts/README.md`) |
| `blog/media/<slug>/` | A post's images and video |
| `blog/index.html`, `blog/<slug>/`, `blog/tags/`, `blog/feed.xml` | **Generated** by `tools/blog/build.mjs` and committed; never edit by hand |
| `blog.js` | The blog's Copy button on code blocks and click-to-load YouTube player |
| `tools/blog/` | The blog's renderer (Node 20+, pinned in `package-lock.json`), its OpenSCAD grammar and tests; not part of the served site |
| `.github/workflows/blog.yml` | CI: rebuilds the blog and fails if the committed pages differ |
| `theme.css` | Design tokens (colours, fonts, sizes) as CSS custom properties, light and dark. **A contract with the `/try` bundle**: rename a token only together with the bundle |
| `styles.css` | Layout and components; uses only `theme.css`'s properties. Its "Tabs" section is the tab groups' markup contract and their first-paint rules; `.tabs-box` is the dark install-box skin |
| `site.js` | Mobile navigation toggle; hero video Pause/Play button, and no autoplay under `prefers-reduced-motion` (the hero's and blog posts'); tab groups and Copy buttons. A tab group is a `.tabs` element (markup in `site.js`'s comment) that becomes WAI-ARIA tabs: arrow keys wrap, Home and End, selection follows focus. The first tab is the default, shown by CSS before the script runs; with `data-detect="os"` the visitor's platform is chosen instead, or the one they last chose in this visit (sessionStorage, so a choice on the home page carries to the agents page), set as `data-os` on `<html>` before the first paint, so nothing shifts. A `button.copy-button[data-copy=ID]` copies element ID's text, or selects it where the clipboard isn't available. Without scripts every panel shows, stacked under its label, and the tabs and Copy buttons are hidden. The install boxes' commands (`index.html` and `agents.html`, `#install`) are the ones `download.html` marks Available; keep the three in step |
| `site.json` | Site name, home, theme and nav links, read by the `/try` bundle's top bar |
| `favicon.png` | 32×32 icon |
| `site.webmanifest` | Name, icons and colours for "Add to Home Screen" and browsers' tab colour; every page links it, with `theme-color` metas matching `theme.css`'s `--ns-bg` (light and dark) |
| `assets/` | Images and video from the NeoSCAD repo, some re-encoded to be smaller (below, with the commands) |
| `CNAME` | `neoscad.org`, the Pages custom domain |
| `.nojekyll` | Tells Pages to serve the files as they are, without Jekyll |
| `install.sh` | `curl -LsSf https://neoscad.org/install.sh \| sh`, the install picker's command for macOS and Linux: runs the latest release's `neoscad-cli-installer.sh` from GitHub, passing its arguments on. It holds no version, so releases don't touch it |
| `robots.txt` | Allows every crawler and agent, and points to `sitemap.xml` |
| `sitemap.xml` | The site's pages, for crawlers; add a line for a new page (outside the "Blog" markers: the blog's lines are generated, with a `lastmod` from the posts' dates). The hand-written pages carry no `lastmod`: release jobs edit `download.html` without touching this file, and a stale date is worse than none |
| `donate/` | `neoscad.org/donate`, a redirect to the Givebutter campaign (givebutter.com/neoscad): a stable link for the README, release notes and apps |

### Search engines and link previews

Every page has a `<link rel="canonical">` to its `https://neoscad.org`
address, so `/index.html`, `/download` (which Pages also serves) and
`http://` or `www.` variants count as one page, and Open Graph and
`twitter:card` tags for link previews; a new page needs the same set
(copy the head of `benchmarks.html`). The home page carries JSON-LD
structured data (`Organization`, `WebSite`, `SoftwareApplication`), whose
facts must stay in step with the page's text; `agents.html` carries `WebPage`, `BreadcrumbList` and a `FAQPage` whose
answers are its FAQ's text; the blog generator writes
`BlogPosting`, `Blog` and `BreadcrumbList` blocks. A JSON-LD block is data,
not script, so the pages' CSP allows it.

All internal links are root-relative (`/download.html`, `/try/`), which
works on Pages at the apex domain and under `python3 -m http.server`, but
not from `file://`.

### Where the assets come from

| File | Source in the NeoSCAD repo |
|---|---|
| `assets/icon-512.png`, `icon-128.png`, `favicon.png` | `apple/Icon/build/concept-c/art-512.png`, `art-128.png`, `art-32.png` (`scripts/apple/build-icon.sh c`): the manifest's and touch icons |
| `assets/icon-64.png` | The header's brand icon, drawn at 30 px (64 for 2x screens): `apple/Icon/build/icon-tool resize apple/Icon/build/concept-c/art-4096.png 64 icon-64.png`, the resize `build-icon.sh` uses for its other sizes (it doesn't make a 64) |
| `assets/hero-gearbox.png` | The poster's PNG source (`apple/Icon/build/hero/hero.png`, 1.38 MB). No page uses it any more; it stays so that links to it from before the WebP (earlier link previews, the blog's first cover) keep working |
| `assets/hero-gearbox.webp` | The hero video's poster, the page's largest paint: `apple/Icon/build/hero/hero.png` (2026-10-01, `NEOSCAD=` the v0.2.0 release binary; times in `hero/times.txt`), 2400×1350, as WebP: `cwebp -q 94 -m 6 -sharp_yuv hero.png -o hero-gearbox.webp` (libwebp 1.6.0; 1.38 MB to 193 KB). At 94 the dark gradient shows no banding; lower qualities flatten its dither into steps. Not AVIF: older Safari releases can't decode it, and `poster` takes one URL, so there is no fallback |
| `assets/hero-gearbox.jpg` | The same PNG as JPEG, for `og:image` and the home page's JSON-LD (link-preview crawlers don't all read WebP): `ffmpeg -i hero.png hero.ppm && cjpeg -quality 90 -optimize -progressive -outfile hero-gearbox.jpg hero.ppm` (libjpeg-turbo 3.1; 239 KB) |
| `assets/hero-gearbox.mp4`, `hero-share.mp4` | `apple/Icon/build/hero-video/` (`scripts/apple/build-hero-video.sh`; caption times from the same `hero/times.txt`): the page's 120 s loop, and the 4.8 s `og:video` clip for link previews |
| `assets/bench-20261003-v0.3.1.png` | `conformance bench-chart` on a copy of `progress/bench/20261003T130440Z-199d5b4.json` whose `short_sha` and `subject` say `v0.3.1` and "NeoSCAD 0.3.1 release binary (PGO build), arm64", since the binary measured is the release's, not a build of the checkout the file name carries |
| `assets/progress.mp4` | `progress/video/progress.mp4` (`conformance video`, default options: no agent-eval interlude, since eval results are not published), re-encoded smaller: `ffmpeg -i progress.mp4 -an -c:v libx264 -profile:v high -level:v 4.0 -preset slow -crf 26 -pix_fmt yuv420p -threads 4 -map_metadata -1 -fflags +bitexact -flags:v +bitexact -movflags +faststart out.mp4` (9.9 MB to 6.5 MB; luma SSIM 0.998 against the CRF 20 original, text unchanged to the eye) |
| `assets/snapshot-adapter.png`, `blog/media/neoscad-and-openscad/snapshot-adapter.png` | `neoscad snapshot examples/site/hose_adapter.scad --dims --size 1280x1280`, as a 256-colour PNG: `ffmpeg -i in.png -vf "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=none" -compression_level 100 out.png` (64 KB to 37 KB; SSIMULACRA2 94, no difference visible at 2x) |
| `assets/snapshot-issues.png` | `neoscad snapshot examples/site/phone_stand.scad --issues --size 1600x1600`, as a palette PNG by the same command (32 KB to 20 KB; it has fewer than 256 colours, so the pixels are identical) |
| `blog/media/neoscad-and-openscad/gearbox.jpg` | The post's cover: a 16:10 crop of `hero/hero.png` above its caption, 960×600, re-encoded with `djpeg -outfile cover.ppm gearbox.jpg && cjpeg -quality 85 -optimize -progressive -outfile gearbox.jpg cover.ppm` (111 KB to 71 KB, no difference visible at 2x) |

The benchmark table in `benchmarks.html` was filled from
`progress/bench/20261003T130440Z-199d5b4.json` (the NeoSCAD 0.3.1 release
binary, the PGO build from the GitHub release; the OpenSCAD times in it are
cached from 27 and 28 September, and `import_stl`'s from 1 October),
and the claims follow `docs/audits/final.md`. The quoted means are the file's
`geomean_speedup`; "about 3.8× on heavy models" is the geometric mean with
each binary's `cold_start` time subtracted from both sides. When the
benchmark is re-run, replace the chart, the table and every quoted mean
(on `index.html` too) together, from one run.

## Writing a post

Posts are Markdown files in `blog/posts/`, named `YYYY-MM-DD-slug.md`;
the slug is the URL, `neoscad.org/blog/<slug>/`. Start from
`blog/posts/README.md`, which has the template and every syntax, and
from the example post `2026-10-02-example-post.md` (a draft, so never
published), which uses each feature once.

Front matter, between `---` lines at the top:

| Key | |
|---|---|
| `title`, `date`, `summary` | Required. `date` is `YYYY-MM-DD` and must match the file name; `summary` is the index's blurb and the feed's summary, and the meta description unless `description` is set. The page's `<title>` is `title` plus " · NeoSCAD" when the two fit in 60 characters (search results cut longer titles), else `title` alone; `og:title` is always `title` alone |
| `description` | Optional, at most about 155 characters: the meta, Open Graph (which X/Twitter cards read) and `BlogPosting` description, for a post whose `summary` is longer than search results show. The summary stays the index's blurb and the feed's summary |
| `author` | Optional; shown under the title and in the feed |
| `tags` | Optional, `[one, two]`: lowercase letters, digits and hyphens; each gets a page at `/blog/tags/<tag>/` |
| `cover`, `cover_alt` | Optional picture at the top of the post and in link previews (`og:image`); use a PNG or JPEG, about 1200×630. `cover_alt` is required with it |
| `updated` | Optional `YYYY-MM-DD`, for the feed and sitemap |
| `draft` | `true` keeps the post out of every output: index, tags, feed and sitemap |

What a post can use:

- **Media** goes in `blog/media/<slug>/` (or beside the post), referenced
  by a path relative to the `.md` file, e.g.
  `![Alt text](../media/<slug>/picture.png "Caption")`, so it previews
  on GitHub too. An image alone on its line becomes a figure, its title
  the caption; it is lazy-loaded and gets its width and height from the
  file. **Alt text is required**: the build fails without it.
- **Video**: the same syntax with a `.mp4` or `.webm`. It needs a poster,
  a `.webp`/`.jpg`/`.png` of the same name beside it or
  `{poster=path}` after the link. It has controls and doesn't play by
  itself; `{autoplay}` makes it autoplay muted and looping, except for
  readers who ask for reduced motion (`site.js`, as for the hero).
- **Code**: fenced blocks are highlighted when the blog is built (no
  script on the page). OpenSCAD (`openscad` or `scad`) has its own
  grammar, `tools/blog/openscad.mjs`. A misspelt language fails the
  build. `openscad try=<id>` adds an "Open in NeoSCAD" link to one of the
  `/try` demo's bundled examples (`try/examples/manifest.json`). `/try`
  also opens any code from a `#code=` link (the engine's
  `web/src/share.js`); the renderer doesn't emit those yet.
- **Callouts**: `::: note`, `::: tip` or `::: warning` (with an optional
  title after it), closed by `:::`.
- **Tables**, **footnotes** (`[^1]`) and **heading anchors** (on every
  `##`; the title is the page's only `#`).
- **YouTube**: `::: youtube VIDEO_ID`, the video's title, `:::`. The page
  shows a placeholder and contacts YouTube (youtube-nocookie.com) only
  when it is clicked; that post's CSP allows that one frame origin.
- No raw HTML: it is escaped. The pages' CSP allows nothing inline.

Links to other pages on the site (`/download.html`, `/try/`) and to
other posts (`2026-10-02-other.md`) are checked when the blog is built,
as are all media paths.

### Build and preview

    cd tools/blog && npm ci && cd ../..      # once: the pinned renderer
    node tools/blog/build.mjs --drafts       # preview, drafts included
    python3 -m http.server 8000              # http://localhost:8000/blog/
    node tools/blog/build.mjs                # before committing: no drafts
    (cd tools/blog && npm test)              # the renderer's own tests

Commit the post, its media and the generated pages together. A
`--drafts` build marks drafts "noindex" and banners them, but must not be
committed: the CI check (`.github/workflows/blog.yml`) rebuilds without
drafts and fails if `blog/` or `sitemap.xml` differ. The pages copy
their header and footer from `index.html`, so after changing the nav
there, rebuild the blog too.

The renderer's dependencies, all exact versions in
`tools/blog/package-lock.json`: `markdown-it` (CommonMark), its
`markdown-it-footnote` plugin, and `highlight.js` (only its core and the
listed grammars; its own OpenSCAD grammar mis-highlights ordinary code,
see `tools/blog/openscad.mjs`). None of them reaches the served pages.

## Preview locally

    cd neoscad-website
    python3 -m http.server 8000

Then open <http://localhost:8000/>. Test the not-found page at
<http://localhost:8000/404.html> (the local server doesn't serve it for
missing paths the way Pages does).

## The /try bundle

The web demo is built in the NeoSCAD repo (`docs/web-demo-plan.md`).
`scripts/web/build.sh` there writes a self-contained
`dist/web/neoscad-web-<version>-<sha>/`, plus a tarball and `SHA256SUMS`.
Every URL in the bundle is relative, so it works under `/try/`. The bundle
ships its own thin top bar, which reads `/site.json` for the nav and links
`/theme.css` for colours.

To update it:

    # in the NeoSCAD repo
    scripts/web/build.sh
    # in this repo
    TARBALL=../NeoSCAD/dist/web/neoscad-web-<version>-<sha>.tar.gz
    shasum -a 256 "$TARBALL"          # compare with SHA256SUMS
    rm -rf try && mkdir try
    tar -xzf "$TARBALL" -C try --strip-components 1
    echo "<version> <sha> <sha256>" > try/BUNDLE.txt   # the pin
    python3 -m http.server 8000       # check /try/ before committing

Commit the unpacked bundle; Pages serves `.wasm` as `application/wasm`.
The bundle's `SOURCE.txt` (the GPL source offer) and
`THIRD-PARTY-LICENSES.txt` must stay in `try/`.

## Deploy on GitHub Pages

1. Create a GitHub repository (for example `neoscad-website`) and push
   this one's `main` branch to it.
2. Verify the domain first (next section). GitHub recommends it "to
   improve security and avoid takeover attacks".
3. In the repository: **Settings → Pages**. Under "Build and deployment",
   choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and
   save.
4. Under **Custom domain**, enter `neoscad.org` and save. (The `CNAME` file
   here already says `neoscad.org`.)
5. Once the DNS check passes, tick **Enforce HTTPS**. GitHub says this can
   take up to 24 hours to become available.

## DNS at Namecheap

In Namecheap: **Domain List → Manage (neoscad.org) → Advanced DNS → Host
Records**. Delete Namecheap's default parking records for `@` and `www`
(a CNAME to the parking page or a URL redirect) first, then add:

| Type | Host | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `<user>.github.io.` (the GitHub account or organisation that owns the repository) |

These values were checked on 2026-09-28 against GitHub's
[Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site),
which also says not to use wildcard DNS records (`*.neoscad.org`), since
they risk a domain takeover. The Namecheap menu names are from memory, not
checked.

Check the records once they propagate:

    dig neoscad.org +noall +answer -t A
    dig neoscad.org +noall +answer -t AAAA
    dig www.neoscad.org +nostats +nocomments +nocmd

## Verify the domain

Verification ties `neoscad.org` to your GitHub account (or organisation),
so no one else can point a Pages site at it. From memory of GitHub's
"Verifying your custom domain for GitHub Pages" page (not fetched for this
README; follow that page if it differs):

1. On GitHub: your profile (or the organisation's) **Settings → Pages →
   Add a domain**, enter `neoscad.org`.
2. GitHub shows a TXT record: a host like
   `_github-pages-challenge-<user>` and a value.
3. In Namecheap's Advanced DNS, add that TXT record (host without the
   `.neoscad.org` suffix).
4. Wait for it to propagate (`dig _github-pages-challenge-<user>.neoscad.org TXT`),
   then click **Verify**. Keep the TXT record afterwards.

## Commits

The site and its history are public, so every commit:

- is signed and authored with the maintainer's own identity;
- has no `Claude-Session:` (or other agent-session) trailers or links;
- adds no absolute local paths (`/Users/…`, `/private/tmp/…`), including
  inside the `/try` bundle (`scripts/web/build.sh` in NeoSCAD strips them);
- adds no agent-eval results, launch strategy or unannounced benchmark
  claims.

## Owner actions

- [x] The `neoscad` organisation; this repository is `neoscad/website`.
- [ ] Verify `neoscad.org` for that account (TXT record).
- [x] Add the A, AAAA and `www` CNAME records at Namecheap; remove the
      parking records. (`dig` shows all of them, 2026-09-30.)
- [x] Settings → Pages: deploy from `main` / root; custom domain
      `neoscad.org`; Enforce HTTPS. (The Pages API reports all three,
      2026-09-30.)
- [x] Allow indexing: `robots.txt` allows every crawler and points to
      `sitemap.xml`; the pages' `noindex` tags are gone (2026-09-30).
- [x] The AI-authorship paragraph and the footers name the builder:
      "Built by Matt Robinson with Claude, supported by The Ned Workshop",
      with the workshop's wordmark in the home page's Supporters section
      (`assets/supporters/ned-workshop.svg`, the workshop site's
      `public/images/brand/wordmark-wide.svg`).
- [ ] Decide the name question with OpenSCAD's maintainers before
      publicising the site.
- [x] Homebrew tap: `neoscad/tap/neoscad` (formula) and
      `neoscad/tap/neoscad-app` (cask), live on the home page and
      `download.html`.
- [x] `download.html` links the v0.1.1 release's files;
      `github.com/neoscad/neoscad` is public.
- [ ] When the notarized DMG is attached to v0.1.1, link it on
      `download.html` (the comment marked "DMG pending v0.1.1" says how; the
      name is `NeoSCAD-0.1.1-<build>.dmg`, with `NeoSCAD-macos-app.sha256`),
      and drop the notes that the cask installs 0.1.0 (the DMG entry and the
      Homebrew entry).
- [ ] As they land, mark winget (microsoft/winget-pkgs#443995), nixpkgs
      and the AUR `neoscad-bin` package "Available" on `download.html`;
      `cargo binstall` waits for crates.io.
- [x] Replace the printability placeholder with a `snapshot --issues`
      sheet, and regenerate `assets/snapshot-adapter.png` from a tracked model.
- [x] Drop in the `/try` bundle (`try/BUNDLE.txt` pins it).
- [ ] Check the pages yourself in light and dark mode, and at phone width.
