---
title: "Faster text unions: NeoSCAD's patches for clipper2-rust"
date: 2026-10-06
summary: NeoSCAD's 2D geometry runs on clipper2-rust, a pure-Rust port of Clipper2. Two small changes to its sweep make a union of 200 lines of text three times faster with identical output. Here is what they do, why they are safe, and how they landed upstream.
description: Two changes to clipper2-rust's sweep, now merged upstream, that make a union of 200 lines of text three times faster with identical output.
author: The NeoSCAD project
tags: [clipper2, performance, open-source]
cover: ../media/clipper2-rust-patches/text-outlines-cover.png
cover_alt: Lines of text drawn as glyph outlines, rendered by NeoSCAD; a union of thousands of outlines like these is what the two changes speed up.
---

NeoSCAD's 2D operations (`union()`, `difference()`, `offset()` and the rest
on flat shapes) run on [clipper2-rust](https://github.com/larsbrubaker/clipper2-rust),
Lars Brubaker's pure-Rust port of Angus Johnson's
[Clipper2](https://github.com/AngusJohnson/Clipper2), the C++ library
OpenSCAD uses for the same work. manifold-rust uses it too. This is a
companion to [our post on manifold-rust](/blog/manifold-rust-patches/): two
changes NeoSCAD made to clipper2-rust, both now merged upstream.

The workload that found both is a page of text: 200 lines,
[open it in NeoSCAD](https://neoscad.org/try/#code=z:Jc27boNAEEbh3k_xhwoiYm-ILMVYrpIiRd7ASrHAAGOvd_BezOXpo5D6k87Z7VAoBcOWPKRF8YlAUyghlvBheBjIFYiWxf6xriQGvKlcKYXOzEOPWmyQ6Px204pDyjjhrMrXw-En2wDBaeuNDpSeVY6XdzyDV8D6SX1wafLNlpDk4BxJidAT7pHrKyono0UrEy7xNnjIg9zKRi8zGumOGHR9xW1GJRNGDj1afhAaWcjC8D2KwyV2fosvGf-rZkaj24CFKqf9Wn5KshyeF8IJ--y4-QU)
and press Render. Its union takes 29,520 glyph outlines, 810,180 points.

## What the sweep does

Clipper computes a union by sweeping a horizontal line down the drawing.
Between two consecutive stops, a "scanbeam", it keeps the edges that cross
the line in order from left to right. At each stop it works out where every
edge has moved to, then merge-sorts the list by that position: two edges
that swap places must have crossed, and each crossing is an intersection
to process.

## Skipping the sort when nothing crossed

When no edges cross, the list is already in order, and the sort makes its
passes to find nothing. In a page of text that is every scanbeam: letters
don't overlap, so in our union the sort runs 130,845 times and never finds
a crossing.

The [first pull request](https://github.com/larsbrubaker/clipper2-rust/pull/11)
checks the order while computing the new positions, in the same loop, and
skips the sort when every edge is at or to the right of its left neighbour.
That is safe because the sort only acts when an edge is strictly left of one
before it; on a list in order it records nothing and moves nothing. The
pull request traces every value the sort would have written and shows that
none of them is read again. When the sort is skipped, the step after it also
keeps the positions just computed instead of computing them again.

## Rounding in one instruction

Every one of those positions is rounded to an integer, half to even.
clipper2-rust did that in software, because the standard library's
`f64::round_ties_even` came after the Rust version the crate supports. The
[second pull request](https://github.com/larsbrubaker/clipper2-rust/pull/10)
calls it, which is one instruction on Apple silicon, in WebAssembly and on
x86-64 with SSE4.1. For every finite number the two give the same bits, the
sign of zero included; for infinity the new code still returns NaN, as the
old one did. It raises the crate's minimum Rust version from 1.70 to
1.77, which the maintainer accepted.

## What it is worth

Both changes leave the output exactly as it was. The pull requests checked
that with tens of thousands of generated cases, every clip type and fill
rule, compared bit for bit with `main`, and so did we for this post: all
four builds below produce the same union.

| clipper2-rust | Union of 200 lines of text | Change |
|---|--:|--:|
| `main` (1.2.0) | 895 ms | |
| with #10, rounding | 678 ms | −24% |
| with #11, sweep shortcut | 369 ms | −59% |
| with both | 305 ms | −66% |

The union alone, one call to `Clipper64::execute` (NonZero), median of 15
interleaved runs per build (every run within 2% of its median); Apple M4
Pro, release builds, Rust 1.98.1, load average 1.5 to 2.1. The outlines
are the model's, from NeoSCAD's SVG export, scaled to integers by 2²⁷ as
NeoSCAD does.

In NeoSCAD itself the gain is smaller in wall time, because NeoSCAD
already splits a union of separate lines into one union per line and runs
them in parallel. Rendering the whole 200-line model to SVG, with and
without the two patches (12 interleaved runs, load average 8 from other
work on the machine): 0.59 s down to 0.42 s, and 3.41 s down to 1.26 s of
CPU time. In the browser those per-line unions run one after another, so
there the CPU time is the one to watch.

## The pull requests

Lars Brubaker merged both on 6 October, with a follow-up that clarifies
the rounding's doc comment ([`517f5d3`](https://github.com/larsbrubaker/clipper2-rust/commit/517f5d3)). They will be in the
next clipper2-rust release; NeoSCAD already carries the same code, and will
move to that release once it is published.

| Change | Pull request | Merged as |
|---|---|---|
| Use `f64::round_ties_even` in `nearbyint_f64` | [#10](https://github.com/larsbrubaker/clipper2-rust/pull/10) | [`dc571d2`](https://github.com/larsbrubaker/clipper2-rust/commit/dc571d2) |
| Skip the scanbeam merge sort when no edges cross | [#11](https://github.com/larsbrubaker/clipper2-rust/pull/11) | [`196ad9c`](https://github.com/larsbrubaker/clipper2-rust/commit/196ad9c) |

NeoSCAD carries a third patch
([`vendor/patches/clipper2-rust/`](https://github.com/neoscad/neoscad/tree/main/vendor/patches/clipper2-rust)):
a counter of the output records Clipper splits off after its sweep. It
changes no output; NeoSCAD's per-line union reads it to know when its
result would differ from one big union's. It serves only that NeoSCAD
code, so it stays in NeoSCAD.

C++ Clipper2 has the same sweep, and the same sort shortcut is already
proposed there: [Clipper2#1106](https://github.com/AngusJohnson/Clipper2/pull/1106),
by avo-uxv, aiming to speed up KiCad's zone fills. In our local port to
C++ it brings the text union from 291 ms to 174 ms (−40%). One more step
would add to it: when the sort is skipped, keep the positions just
computed instead of computing them again, as clipper2-rust now does. With
both, it is 164 ms (−44%), with identical output (clang `-O3`, best of
15 runs on the same machine). We'd like to offer that
second step once #1106 lands.

Thanks to Lars Brubaker for clipper2-rust, and to Angus Johnson for
Clipper2. NeoSCAD is open source, under GPL-2.0-or-later, at
[github.com/neoscad/neoscad](https://github.com/neoscad/neoscad).
