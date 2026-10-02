---
title: An example post
date: 2026-10-02
summary: Placeholder text that shows every feature a post can use. It stays a draft, so it is never published.
author: The NeoSCAD project
tags: [example, docs]
cover: ../media/example-post/placeholder-clip.png
cover_alt: A diagonal gradient from teal through violet to magenta.
draft: true
---

This post is a placeholder. It exists so that the blog's renderer has
something to show when you build with `--drafts`, and so that a new author
can copy the syntax for each feature. Its words mean nothing in particular.

## Code

A fenced block whose language is `openscad` is highlighted when the site is
built, so the page needs no script to show it:

```openscad
// A rounded plate with a hole in each corner.
size = [60, 40, 4];
r = 3;

module plate(s = size) {
  difference() {
    hull() for (x = [r, s.x - r], y = [r, s.y - r])
      translate([x, y, 0]) cylinder(h = s.z, r = r, $fn = 32);
    for (x = [8, s.x - 8], y = [8, s.y - 8])
      translate([x, y, -1]) cylinder(h = s.z + 2, d = 3.2, $fn = 24);
  }
}

plate();
echo(str("plate: ", size));
```

When a block is one of the examples bundled with the in-browser demo, the
fence can name it, and the block gets an "Open in NeoSCAD" link:

```openscad try=csg
translate([-24,0,0]) {
    union() {
        cube(15, center=true);
        sphere(10);
    }
}

intersection() {
    cube(15, center=true);
    sphere(10);
}

translate([24,0,0]) {
    difference() {
        cube(15, center=true);
        sphere(10);
    }
}
```

Other languages work too:

```bash
neoscad -o model.stl model.scad
```

## Pictures and video

An image on a line of its own becomes a figure, and its title becomes the
caption.

![A teal square, a violet circle and a magenta triangle on a dark background.](../media/example-post/placeholder-shapes.svg "Three placeholder shapes. Captions can have *emphasis* and [links](/download.html).")

A video goes on a line of its own too. `{autoplay}` makes it play muted and
looping, except for readers who ask for reduced motion.

![A gradient that drifts slowly from teal to magenta.](../media/example-post/placeholder-clip.mp4 "A four-second placeholder clip."){autoplay}

## Notes, tables and footnotes

::: note
A note: something worth knowing on the way.
:::

::: tip A tip with its own title
Callouts hold any Markdown, including `code` and lists:

- one item;
- another.
:::

::: warning
A warning: something that can go wrong.
:::

| Column | Left | Right |
|---|:---|---:|
| First | text | 1 |
| Second | more text | 22 |
| Third | the most text | 333 |

A sentence can carry a footnote.[^1] Links to other pages on the site, such
as the [downloads](/download.html), are checked when the blog is built.

[^1]: The footnote's text, which ends up at the bottom of the post.
