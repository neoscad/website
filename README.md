# neoscad.org

The NeoSCAD website: hand-written static HTML and CSS, served by GitHub
Pages at the apex domain `neoscad.org`. There is no build step, no
framework and no package manager. The only script is `site.js`, a mobile
menu toggle; the pages work without it.

## Structure

| Path | What |
|---|---|
| `index.html` | Home: hero, numbers, one benchmark chart, three pillars, the printability check, "built in the open" (progress video and AI-authorship disclosure), coming from OpenSCAD, credits, FAQ |
| `download.html` | Downloads by platform, package managers, source, nightly, with a status on every entry (all placeholders for now) |
| `benchmarks.html` | Method, machine, chart, the full results table, the edit loop and caveats |
| `try/index.html` | Placeholder for the in-browser demo; the whole `try/` directory is replaced by the demo bundle |
| `404.html` | GitHub Pages' not-found page (root-relative URLs only) |
| `theme.css` | Design tokens (colours, fonts, sizes) as CSS custom properties, light and dark. **A contract with the `/try` bundle**: rename a token only together with the bundle |
| `styles.css` | Layout and components; uses only `theme.css`'s properties |
| `site.js` | Mobile navigation toggle |
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
| `assets/hero-gearbox.png` | `apple/Icon/build/hero/hero.png` (2026-09-28; times in `hero/times.txt`) |
| `assets/bench-20260928-98f90d8.png` | `conformance bench-chart` of `progress/bench/20260928T130500Z-dca0882.json` (the run log's file names keep the commit ids from before history was rewritten; its `short_sha` and `subject` were set to commit `98f90d8`) |
| `assets/progress.mp4` | `progress/video/progress.mp4` (`conformance video`, default options: no agent-eval interlude, since eval results are not published) |
| `assets/snapshot-adapter.png` | A `neoscad snapshot` of a hose-barb adapter model (not tracked in the repo); regenerate it from a tracked model before launch |

The benchmark table in `benchmarks.html` was filled from
`progress/bench/20260928T130500Z-dca0882.json` (commit `98f90d8` after the
history rewrite), and the claims follow
`docs/audits/final.md`. When the benchmark is re-run, replace the chart,
the table and every quoted mean together, from one run.

The home page still has one labelled placeholder: a `snapshot --issues`
sheet for the printability section (search for `PLACEHOLDER`).

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

To update it (once the bundle exists):

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

- [ ] Decide the GitHub account or organisation (`packaging.md` suggests
      reserving the `neoscad` org) and create the repository.
- [ ] Verify `neoscad.org` for that account (TXT record).
- [ ] Add the A, AAAA and `www` CNAME records at Namecheap; remove the
      parking records.
- [ ] Settings → Pages: deploy from `main` / root; custom domain
      `neoscad.org`; Enforce HTTPS once available.
- [ ] At launch, allow indexing: `robots.txt` to `Allow: /` and remove
      the `noindex` meta tag from each page (the comment in `robots.txt`
      lists them).
- [x] The AI-authorship paragraph and the footers name the builder:
      "Built by The Ned Workshop (Matt Robinson); built with Claude".
- [ ] Decide the name question with OpenSCAD's maintainers before
      publicising the site.
- [ ] Confirm the Homebrew tap name (`neoscad/tap/neoscad` is shown struck
      through as "coming soon") and the `cargo binstall` crate name.
- [ ] Replace the placeholder links on `download.html` as artifacts are
      published. The "Source" links point at
      `https://github.com/neoscad/neoscad`; make sure it is public first.
- [ ] Replace the printability placeholder with a `snapshot --issues`
      sheet, and regenerate `assets/snapshot-adapter.png` from a tracked model.
- [ ] Drop in the `/try` bundle when it exists.
- [ ] Check the pages yourself in light and dark mode, and at phone width.
