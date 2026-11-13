// The home page's hero: NeoSCAD's gearbox (apple/Icon/hero.scad in the
// NeoSCAD repository, copied to /assets/hero.scad) rendered live in the
// visitor's browser by @neoscad/viewer, self-hosted under /viewer/
// (README.md, "The live hero").
//
// The still (hero-gearbox.webp) is the page's largest paint and stays
// the placeholder: the live view is drawn on a canvas over it, invisible
// until its first frame, then faded in, so nothing moves on the page.
// Whenever the live path is skipped or fails, the still is what remains,
// as it is without scripts.
//
// Re-evaluating the model per frame, as the video's --animate did, is out
// of the question in a browser, so each rigid body is rendered once
// (`body` in hero.scad) and moved by the viewer: the sun turns, the
// carrier (plate and pins) and the four planets orbit, and the ring and
// plinth stay still. That is another mechanism than the video's (whose
// carrier stood still and ring turned): the ring is cut away, and a
// rigid motion cannot turn it inside a fixed window. With S, P and R the
// sun's, a planet's and the ring's tooth counts (the model echoes them),
// a fixed ring makes the carrier turn S / (S + R) as fast as the sun, and
// each planet turn -(sun - carrier) * S / P relative to the carrier. Both
// follow from the teeth rolling on their pitch circles, so the gears stay
// meshed in every frame, and every angle is 0 in the model's own pose.

const VIEWER = "/viewer/index.js";
const MODEL = "/assets/hero.scad";
// One sun turn every 4.8 s, as in the video (25 turns in its 120 s).
const SUN_TURN_MS = 4800;
// The still's backdrop (scripts/apple/build-hero.sh: "#23264a" to
// "#07080f"), so the live view fades in over the same colours.
const BACKGROUND = ["#23264a", "#07080f"];
const LABEL =
  "A live 3D view of a herringbone planetary gearbox, turning: a red sun gear drives four teal planet " +
  "gears around inside a blue ring gear, on a light carrier, over a grey plinth with a gyroid core. " +
  "Drag to turn the view.";

const figure = document.querySelector(".hero-media");
if (figure && shouldTryLive()) startWhenSeen(figure);

/// Whether this visit gets the live view at all. A visitor saving data or
/// on a small device keeps the still: the engine is a 3 MB download and
/// the render takes a few hundred MB for some seconds.
function shouldTryLive() {
  const nav = navigator;
  if (nav.connection?.saveData) return false;
  if (typeof nav.deviceMemory === "number" && nav.deviceMemory < 4) return false;
  // Neither WebGPU nor WebGL 2: the viewer would fall back to a 2D
  // canvas, which cannot move scenes. (Present is not the same as
  // working; a viewer that falls back anyway is caught below.)
  if (!nav.gpu && typeof WebGL2RenderingContext === "undefined") return false;
  if (typeof IntersectionObserver === "undefined") return false;
  return true;
}

/// Start once the page has loaded (after its first paint, so the still
/// stays its largest paint and nothing competes with it) and the hero is
/// on screen.
function startWhenSeen(figure) {
  const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise((r) => addEventListener("load", r, { once: true }));
  const seen = new Promise((resolve) => {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        resolve();
      }
    });
    io.observe(figure);
  });
  Promise.all([loaded, seen])
    .then(() => live(figure))
    .catch((e) => console.warn("NeoSCAD hero: staying with the still:", e));
}

/// `// camera: tx,ty,tz,rx,ry,rz,d` (hero.scad's first lines, which
/// build-hero.sh passes to --camera) as the viewer's file view.
function cameraOf(source) {
  const m = /^\/\/ camera: *([-\d.,\s]+)$/m.exec(source);
  const n = m ? m[1].split(",").map(Number) : [];
  if (n.length !== 7 || n.some((x) => !Number.isFinite(x))) return null;
  return { vpt: n.slice(0, 3), vpr: n.slice(3, 6), vpd: n[6] };
}

/// The model's `hero_kinematics` echo: [S, P, R, [[x, y], ...]].
function kinematicsOf(result) {
  const prefix = "ECHO: hero_kinematics = ";
  const line = result.console.find((l) => l.kind === "echo" && l.text.startsWith(prefix));
  if (!line) throw new Error("hero.scad echoed no hero_kinematics");
  const [S, P, R, pins] = JSON.parse(line.text.slice(prefix.length));
  if (![S, P, R].every((x) => x > 0) || !pins?.length) throw new Error("hero_kinematics makes no sense");
  return { S, P, R, pins };
}

/// A rotation by `a` radians about z followed by a move of (tx, ty), into
/// `m` (column-major, as the viewer takes it).
function setRz(m, a, tx = 0, ty = 0) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  m[12] = tx;
  m[13] = ty;
  return m;
}

function identity() {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

async function live(figure) {
  const stage = figure.querySelector(".hero-stage");
  const still = stage?.querySelector("img");
  if (!stage || !still) return;
  const status = document.createElement("p");
  status.className = "hero-status";
  status.setAttribute("role", "status");
  status.textContent = "Starting NeoSCAD in your browser…";
  stage.appendChild(status);

  const canvas = document.createElement("canvas");
  canvas.className = "hero-live";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", LABEL);
  stage.appendChild(canvas);

  const t0 = performance.now();
  let viewer = null;
  let engine = null;
  try {
    const [NS, source] = await Promise.all([
      import(VIEWER),
      fetch(MODEL).then((r) => {
        if (!r.ok) throw new Error(`${MODEL}: ${r.status}`);
        return r.text();
      }),
    ]);
    engine = NS.createEngine();
    viewer = await NS.createViewer(canvas, {
      settings: { axes: false, scheme: "Starnight", background: BACKGROUND },
    });
    if (!viewer.supportsTransforms) throw new Error(`the ${viewer.kind} view cannot move parts`);
    // A finger dragging up or down over the hero scrolls the page; a
    // sideways drag still turns the view. The viewer claims every touch
    // (touch-action: none), which on a phone, where the hero fills the
    // width, would trap the reader's scroll.
    viewer.canvas.style.touchAction = "pan-y";
    guardWheel(stage, viewer.canvas);
    const camera = cameraOf(source);
    if (camera) viewer.setFileView(camera);
    await engine.ready;
    const tReady = performance.now();

    // One render per body, one worker, one after another: the sun first,
    // whose echo says how many planets there are, then the planets and
    // the carrier, so the step count moves quickly, and last the ring and
    // plinth, which is most of the time (the gyroid lattice is script
    // work). Seven bodies for this model.
    const tRender = performance.now();
    const render = async (overrides, step, steps) => {
      status.textContent = `Rendering live in your browser… step ${step}${steps ? `/${steps}` : ""}`;
      const r = await engine.run(source, { mode: "render", overrides, name: "hero.scad" });
      if (!r.ok || !r.scene) throw new Error(`${overrides.body}: ${r.errors[0]?.text ?? r.summary}`);
      return r;
    };
    const first = await render({ body: "sun" }, 1, 0);
    const { S, P, R, pins } = kinematicsOf(first);
    const steps = pins.length + 3;
    const planetScenes = [];
    for (const i of pins.keys()) planetScenes.push((await render({ body: "planet", planet_index: i }, i + 2, steps)).scene);
    const carrierScene = (await render({ body: "carrier" }, steps - 1, steps)).scene;
    const staticScene = (await render({ body: "static" }, steps, steps)).scene;
    const renderMs = performance.now() - tRender;

    viewer.addScene(staticScene);
    const sun = viewer.addScene(first.scene);
    const carrier = viewer.addScene(carrierScene);
    const planets = planetScenes.map((s) => viewer.addScene(s));
    const ms = { sun: identity(), carrier: identity(), planets: planets.map(identity) };
    // Angles in turns, reduced to one turn before they become radians, so
    // they stay exact however long the page is open.
    const rad = (turns) => (turns % 1) * 2 * Math.PI;
    const pose = (t) => {
      const sunTurns = t / SUN_TURN_MS;
      const carrierTurns = (sunTurns * S) / (S + R);
      const relTurns = (-(sunTurns - carrierTurns) * S) / P;
      sun.setMatrix(setRz(ms.sun, rad(sunTurns)));
      const c = rad(carrierTurns);
      carrier.setMatrix(setRz(ms.carrier, c));
      // A planet turns about its pin p by the relative angle, then with
      // the carrier: its rotation is the sum, phi, and the point p stays
      // where the carrier takes it, so x -> R(phi) x + R(c) p - R(phi) p.
      const phi = rad(carrierTurns + relTurns);
      const [cc, sc, cp, sp] = [Math.cos(c), Math.sin(c), Math.cos(phi), Math.sin(phi)];
      planets.forEach((h, i) => {
        const [px, py] = pins[i];
        const tx = cc * px - sc * py - (cp * px - sp * py);
        const ty = sc * px + cc * py - (sp * px + cp * py);
        h.setMatrix(setRz(ms.planets[i], phi, tx, ty));
      });
    };
    pose(0);

    // The first frame: the viewer draws on the next animation frame
    // after the scenes arrive; fade in after it.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const firstFrameMs = performance.now() - t0;
    stage.classList.add("is-live");
    still.setAttribute("aria-hidden", "true");
    status.remove();
    figure.dataset.liveBackend = viewer.kind;
    figure.dataset.liveReadyMs = String(Math.round(tReady - t0));
    figure.dataset.liveRenderMs = String(Math.round(renderMs));
    figure.dataset.liveFirstFrameMs = String(Math.round(firstFrameMs));
    caption(figure, renderMs);

    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loop = viewer.onFrame((t) => pose(t));
    // For readers who ask for reduced motion it stands still until they
    // press Play: the live view, unmoving, is the still they would have had.
    if (reduce) loop.pause();
    motionButton(stage, loop);
  } catch (e) {
    console.warn("NeoSCAD hero: staying with the still:", e);
    // A viewer that fell back drew into a fresh copy of the canvas, so
    // remove whichever is in the page.
    const drawn = viewer?.canvas;
    viewer?.dispose();
    engine?.dispose();
    drawn?.remove();
    stage.querySelectorAll("canvas.hero-live").forEach((c) => c.remove());
    status.remove();
  }
}

/// Wheel zoom only when meant: a mouse wheel over the hero scrolls the
/// page, as over the still, unless the reader has pressed in the view
/// (until the pointer leaves it) or holds Ctrl or Cmd (a trackpad pinch
/// arrives as a Ctrl wheel, so pinching zooms). The viewer itself zooms
/// on every wheel event and stops the page scrolling, which on a home
/// page would trap everyone scrolling past the hero.
function guardWheel(stage, canvas) {
  let engaged = false;
  canvas.addEventListener("pointerdown", () => (engaged = true));
  stage.addEventListener("pointerleave", () => (engaged = false));
  stage.addEventListener(
    "wheel",
    (e) => {
      if (!engaged && !e.ctrlKey && !e.metaKey) e.stopPropagation();
    },
    { capture: true },
  );
}

/// The caption's live sentence, after the existing one.
function caption(figure, renderMs) {
  const cap = figure.querySelector("figcaption");
  if (!cap) return;
  const s = document.createElement("span");
  s.className = "hero-live-time";
  const secs = (renderMs / 1000).toFixed(1);
  s.textContent = ` Rendered live in your browser in ${secs} s by NeoSCAD's WebAssembly engine; drag to turn it.`;
  cap.appendChild(s);
}

/// Pause and Play: motion that starts on its own and runs past five
/// seconds needs a way to stop it (WCAG 2.2.2). The loop also stops by
/// itself while the hero is off screen or the tab is hidden.
function motionButton(stage, loop) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hero-motion";
  const set = () => {
    const playing = !loop.paused;
    button.textContent = playing ? "Pause" : "Play";
    button.setAttribute("aria-label", (playing ? "Pause" : "Play") + " the gearbox animation");
  };
  button.addEventListener("click", () => {
    if (loop.paused) loop.play();
    else loop.pause();
    set();
  });
  set();
  stage.appendChild(button);
}
