# Blog posts

One Markdown file per post, named `YYYY-MM-DD-slug.md`. The renderer
(`tools/blog/build.mjs`) skips this README. The repository's README,
"Writing a post", has the details; `2026-10-02-example-post.md` uses
every feature (it is a draft, so it is never published).

## Template

Copy this into `blog/posts/2026-11-05-my-post.md` (date and slug yours):

````markdown
---
title: The post's title
date: 2026-11-05
summary: One or two sentences for the blog index, link previews and the feed.
author: Your name
tags: [release, docs]
cover: ../media/my-post/cover.png
cover_alt: What the cover picture shows.
draft: true
---

The first paragraph. Sections start at `##`: the title is the page's
only top-level heading.

## A section

![What the picture shows, for readers who can't see it.](../media/my-post/picture.png "The caption, optional.")

![What the video shows.](../media/my-post/clip.mp4 "The caption."){autoplay}

```openscad
cube(10);
```

```openscad try=csg
// A block that is one of /try's bundled examples gets "Open in NeoSCAD".
```

::: note
A callout: note, tip or warning, with an optional title after the kind.
:::

| Thing | Count |
|---|--:|
| One | 1 |

A footnote.[^1]

[^1]: Its text.
````

Delete `draft: true` (or set it to `false`) to publish. Optional keys you
don't use can go: `author`, `tags`, `cover` with `cover_alt`, `updated`.

## Media

Put a post's pictures and video in `blog/media/<slug>/` and refer to them
relative to the post (`../media/<slug>/...`). Keep them small: they are
committed, and served as they are. A video needs a poster: a
`.webp`/`.jpg`/`.png` with the video's name beside it, or
`{poster=../media/<slug>/still.png}` after the link.

## Build

    node tools/blog/build.mjs --drafts   # preview with drafts
    node tools/blog/build.mjs            # what gets committed
