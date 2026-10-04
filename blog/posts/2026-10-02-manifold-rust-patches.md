---
title: "Faster, cancellable booleans: NeoSCAD's patches for manifold-rust"
date: 2026-10-02
summary: NeoSCAD builds its geometry on manifold-rust, a pure-Rust port of the Manifold library. Along the way we patched it in a few places. Here is what each change does, what it is worth, and the pull requests that offer it back upstream.
description: What NeoSCAD changed in manifold-rust (faster text and many-hole polygons, parallel booleans, cancellation) and the pull requests offering it upstream.
author: The NeoSCAD project
tags: [manifold, performance, open-source]
cover: ../media/manifold-rust-patches/text-cover.png
cover_alt: Rows of extruded 3D text rendered by NeoSCAD, the kind of model whose many letter outlines the ear-clipper changes speed up.
---

> **Update, 3 October:** all six pull requests have landed. They're in
> [manifold-rust 0.16.0](https://crates.io/crates/manifold-rust/0.16.0),
> and in its C# twin manifold-sharp 0.5.0. Lars Brubaker reviewed each one
> against Manifold's C++ library, and fixed or tightened what the review
> found:
> - a C++-style fix for mesh IDs in disjoint unions, which made our
>   renumbering unnecessary;
> - a narrower safe window for the bounding-box cull;
> - CI that also tests the `parallel` feature.
>
> The commits are in the table at the end.

NeoSCAD's geometry runs on [manifold-rust](https://github.com/larsbrubaker/manifold-rust),
a pure-Rust port of [Manifold](https://github.com/elalish/manifold), the
C++ geometry kernel the OpenSCAD nightly uses with `--backend=manifold`. The
port follows the same Manifold release, 3.5.2.
A pure-Rust kernel is what lets NeoSCAD build one engine for the command
line, the desktop apps and [your browser](/try/).

While building NeoSCAD we changed manifold-rust in a few places. NeoSCAD
carries those changes as patches in its repository
([`vendor/patches/manifold-rust/`](https://github.com/neoscad/neoscad/tree/main/vendor/patches/manifold-rust),
explained in
[`vendor/README.md`](https://github.com/neoscad/neoscad/blob/main/vendor/README.md)).
A patch you carry is a patch you maintain, and the changes are useful to
anyone using the library, so we have ported them to manifold-rust's current
`main` and offered them back as pull requests. NeoSCAD 0.3.1 moves to
manifold-rust 0.15.0 and vendors exactly the code in those pull requests.
This post explains what each one does.

NeoSCAD has shipped these speedups since 0.1, so 0.3.1 isn't faster than
0.3.0; it runs the same changes in the form offered upstream. The "before"
numbers below are manifold-rust's own `main`.

Each of these changes leaves manifold-rust's output exactly as it was: the same triangles, in the
same order, at any thread count. NeoSCAD depends on that, because its exports
must be byte-identical however many cores the machine has.

## Triangulating text and many-hole polygons: up to 9× faster

When a 2D shape is turned into triangles, each hole is first joined to an
outer outline by a "keyhole" cut. The code that finds where to cut walked
every outer outline for every hole, so its cost grew with the square of the
number of outlines. A page of extruded text is exactly that worst case:
thousands of letter outlines, many with a hole or two.

Two changes fix it:

- the search visits an outline's points in place instead of rebuilding a
  list of them for every hole;
- each outline keeps a bounding box, and the search skips outlines that can't
  possibly hold the cut. The box test is derived from the search's own
  conditions, so it never skips one the search would have used.

| Polygon set | Before | After |
|---|--:|--:|
| 6,250 letter-like outlines | 1.34 s | 0.157 s |
| 25,000 letter-like outlines | 21.6 s | 2.30 s |
| one outline with 5,041 holes | 2.65 s | 2.24 s |

Triangulation time alone, best of three runs (one for 25,000), manifold-rust's `main` against the two pull requests on an Apple M4 Pro with other work running; the triangles are
identical before and after, and a randomised comparison of 9,000
triangulations found no difference. One outline with many holes gains less,
because there is only one outline to search.

Try a text-heavy model in your browser: [40 lines of extruded text](https://neoscad.org/try/#code=z:TY6xTsNAEER7f8XIlYMc7BgDwVE6Skq6CKHD3uQOLrdhbx2bfD2yQ8FUK72nnSkK1CW8CxTBe9Co0nfUQWnUBhwI1TOiNSeacKQzifFQy300oQP3SgJx4RDzpChw5KgYnFoYWPYEFujAOVScCYfeG6UOLsyfW-M99iwg01q05nSbXIdsUZeb-Tby_jcpqxYJgNnPHLbYlc1sL1dvVzJFxYQ4lWS7MsdyVeEG7h-fHRo1iypZ-uICIc3hcqQNXi3hu3ftFz6Eh4A9j_jsj6cIPpNALcGbyw86PqBcVXf1_cPj-ild5IjuQthivdgkvw),
or [a plate with 5,041 holes](https://neoscad.org/try/#code=z:RU5BbsIwELznFXPowS6mwUCFBMob-gCEKhNvyKaRLTZOS1T175VTROewmp0dzU5Z4i0QhuvohPDFqcXO4pZHhVez2lpIHINHG3saDOiWZPTk96BPkmmWwUNRlugiB_JIEaklxDGRQDhccJ7g8EHT7D0L-wu9FAEVdvZQ9BzIyfs9V1ldAIDnpiGhUJPS-J6ljL-aaoNnBCxg9eFxaqJAMSocV_uwtCeD7n_RD1tGEheG3iVSx5zEWGBtkGmX6UmjZql7UtbgqclFN-v7p5_iFw).

## Parallel booleans: Menger sponge in about half the time

With its `parallel` feature on, manifold-rust already used several cores in
places, but much of a large boolean still ran on one: cleaning up the mesh's
edges, assembling the result, and sorting the geometry. (C++ Manifold runs
these steps in parallel; the port hadn't yet.) These now run in parallel,
built so that each step produces exactly what the one-core version does.

| Model | Before | After |
|---|--:|--:|
| Menger sponge, depth 4: the three difference() steps | 2.64–2.66 s | 1.38–1.41 s |
| Menger sponge, depth 4: peak memory | 2.1–2.3 GB | 1.8 GB |

Both columns have the library's `parallel` feature on: an Apple M4 Pro with
14 cores, with other work running (load average 4 to 7), three interleaved
runs each. The result is the same mesh, byte for byte, at 1, 3, 8 and 14
threads. A second change lets a union() of many children merge up to four
pairs at once, at some cost in peak memory.

One caveat: in the same model, uniting the 585 small blocks it cuts away
into one solid is a little slower with this change (0.54 s to 0.61 s). Splitting small
jobs across cores costs more than it saves, so two of the new parallel steps
start only on meshes ten times larger than C++ Manifold's threshold (100,000
half-edges rather than 10,000); at C++'s threshold that step took 0.92 s.

## Cancelling a long boolean

NeoSCAD lets you cancel a render, and stops a model that passes its time or
memory limit, even in the middle of one huge boolean. Manifold's C++ library
checks for cancellation inside its edge-intersection loop; the Rust port
didn't, so a cancel could wait for the whole step to finish. The port now
checks there too, as C++ does.

## A bug that was already fixed

NeoSCAD's first patch fixed an edge-collapse bug that could fill in a concave
corner after a union, changing the solid's volume. In BOSL2's `cubetruss`, a
notch of 7.3 mm³ disappeared. When we ported it, we found that Lars Brubaker
had already fixed it upstream with a different change (4a99dc4), and C++
Manifold's `master` gets it right too, so NeoSCAD 0.3.1 drops its patch. We are offering our regression test instead, so
the fix stays fixed. [Open the cubetruss model](https://neoscad.org/try/#code=z:fY9BS8NAEIXv-RXv2EBM2jRWa62HngUPehOV6e4kWdzuhsysCNL_Li1a0EPn9uZ9vMerKjz1IzM2D4_3NUzaso5JBAONKtCeFBqT6UE-hg4tGZYSG27jyNhRcG309mJMollVoaHl0poGE8s2DfzGtmOBvLtBIEqeYdPgnSFlyQtoz3Ah8IgUXAxonfdsQYcoE4OhD0aIavobXF9O66acYrd7ncMFUSaL2B7-s0W5uCozF4xPlnF7nFKJ2lIM2bv_xmnjj32snuT4ygDgrzrciZ_wp3JQWT_XxfwlX50jZkVT1L_MPjtLFdiOZFzo1i154XyV7bNv)
to see it render with the right volume, about 85,017 mm³ (85,024 with the bug).

## The pull requests

| Change | Pull request | Landed in 0.16.0 |
|---|---|---|
| Ear clipper: visit loops in place | [#6](https://github.com/larsbrubaker/manifold-rust/pull/6) | [`c15d4ad`](https://github.com/larsbrubaker/manifold-rust/commit/c15d4ad) |
| Ear clipper: skip outlines by bounding box | [#9](https://github.com/larsbrubaker/manifold-rust/pull/9) | [`bc0a64d`](https://github.com/larsbrubaker/manifold-rust/commit/bc0a64d) |
| Parallel boolean kernels | [#8](https://github.com/larsbrubaker/manifold-rust/pull/8) | [`6e127b5`](https://github.com/larsbrubaker/manifold-rust/commit/6e127b5) |
| Parallel batch-union rounds | [#7](https://github.com/larsbrubaker/manifold-rust/pull/7) | [`fb1a52e`](https://github.com/larsbrubaker/manifold-rust/commit/fb1a52e) |
| Cancellation during the edge-intersection step (AddNewEdgeVerts) | [#10](https://github.com/larsbrubaker/manifold-rust/pull/10) | [`e81b00f`](https://github.com/larsbrubaker/manifold-rust/commit/e81b00f) |
| Regression test for the concave-corner fix | [#5](https://github.com/larsbrubaker/manifold-rust/pull/5) | [`9989b92`](https://github.com/larsbrubaker/manifold-rust/commit/9989b92) |

Two NeoSCAD patches aren't on the list: a size threshold tuned to NeoSCAD's
own workloads, and the exact shape of its cancellation API. They are
NeoSCAD's choices rather than general fixes, so they stay in NeoSCAD.

Thanks to Lars Brubaker for manifold-rust, and to Emmett Lalish and the
Manifold contributors for the library it ports. NeoSCAD is open source, under
GPL-2.0-or-later, at [github.com/neoscad/neoscad](https://github.com/neoscad/neoscad).
