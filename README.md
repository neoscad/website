# neoscad.org

The NeoSCAD website: hand-written static HTML and CSS, served by GitHub
Pages at the apex domain `neoscad.org`. There is no build step, no
framework and no package manager. The scripts are `site.js`, a mobile
menu toggle and the hero video's Pause button and reduced-motion stop,
which the pages work without; and `community.js`, which
`community.html` needs to show its results.

## Structure

| Path | What |
|---|---|
| `index.html` | Home: hero, numbers, one benchmark chart, three pillars, the printability check, "built in the open" (progress video and AI-authorship disclosure), coming from OpenSCAD, credits, FAQ |
| `download.html` | Downloads by platform (links to the v0.1.1 GitHub release), package managers, source, nightly, with a status on every entry |
| `benchmarks.html` | Method, machine, chart, the full results table, the edit loop and caveats |
| `community.html`, `community.js` | Community benchmark results: fetches `summary.json` from the `neoscad/benchmarks` repository (raw.githubusercontent.com, the only other origin any page contacts; the page's CSP allows only that) and renders it per release, platform and run |
| `try/index.html` | Placeholder for the in-browser demo; the whole `try/` directory is replaced by the demo bundle |
| `404.html` | GitHub Pages' not-found page (root-relative URLs only) |
| `theme.css` | Design tokens (colours, fonts, sizes) as CSS custom properties, light and dark. **A contract with the `/try` bundle**: rename a token only together with the bundle |
| `styles.css` | Layout and components; uses only `theme.css`'s properties |
| `site.js` | Mobile navigation toggle; hero video Pause/Play button, and no autoplay under `prefers-reduced-motion` |
| `site.json` | Site name, home, theme and nav links, read by the `/try` bundle's top bar |
| `favicon.png` | 32×32 icon |
| `assets/` | Images and video, copied unchanged from the NeoSCAD repo (below) |
| `CNAME` | `neoscad.org`, the Pages custom domain |
| `.nojekyll` | Tells Pages to serve the files as they are, without Jekyll |
| `robots.txt` | Disallows everything until launch (with a `noindex` meta tag on every page; the file says how to flip both) |

All internal links are root-relative (`/download.html`, `/try/`), which
works on Pages at the apex domain and under `python3 -m http.server`, but
not from `file://`.

### Where the assets come from

| File | Source in the NeoSCAD repo |
|---|---|
| `assets/icon-512.png`, `icon-128.png`, `favicon.png` | `apple/Icon/build/concept-c/art-512.png`, `art-128.png`, `art-32.png` |
| `assets/hero-gearbox.png` | `apple/Icon/build/hero/hero.png` (2026-09-28; times in `hero/times.txt`); also the hero video's poster |
| `assets/hero-gearbox.mp4`, `hero-share.mp4` | `apple/Icon/build/hero-video/` (`scripts/apple/build-hero-video.sh`; caption times from the same `hero/times.txt`): the page's 120 s loop, and the 4.8 s `og:video` clip for link previews |
| `assets/bench-20260930-7c4ebc0.png` | `progress/bench/20260930T150757Z-7c4ebc0.png`, the chart `conformance bench` wrote with `progress/bench/20260930T150757Z-7c4ebc0.json` |
| `assets/progress.mp4` | `progress/video/progress.mp4` (`conformance video`, default options: no agent-eval interlude, since eval results are not published) |
| `assets/snapshot-adapter.png` | `neoscad snapshot examples/site/hose_adapter.scad --dims --size 1280x1280` |
| `assets/snapshot-issues.png` | `neoscad snapshot examples/site/phone_stand.scad --issues --size 1600x1600` |

The benchmark table in `benchmarks.html` was filled from
`progress/bench/20260930T150757Z-7c4ebc0.json` (NeoSCAD 0.1.1, the tag's
commit; the OpenSCAD times in it are cached from 27 and 28 September), and the
claims follow `docs/audits/final.md`. The quoted means are the file's
`geomean_speedup`; "about 3.6× on heavy models" is the geometric mean with
each binary's `cold_start` time subtracted from both sides. When the
benchmark is re-run, replace the chart, the table and every quoted mean
(on `index.html` too) together, from one run.

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
- [ ] At launch, allow indexing: `robots.txt` to `Allow: /` and remove
      the `noindex` meta tag from each page (the comment in `robots.txt`
      lists them).
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
