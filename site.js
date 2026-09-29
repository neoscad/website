// The site's only script; the pages work without it.
//
// Mobile navigation toggle: styles.css collapses the menu only under the
// `js` class added here, so with scripts off the links stay visible and
// simply wrap.
(function () {
  document.documentElement.classList.add("js");
  document.addEventListener("DOMContentLoaded", function () {
    var button = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!button || !nav) return;
    button.addEventListener("click", function () {
      var open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("open", !open);
    });
  });
})();

// The home page's hero video autoplays, muted and looping. Motion that
// starts on its own and runs past five seconds needs a way to stop it
// (WCAG 2.2.2), so a Pause/Play button goes over it. For readers who ask
// for reduced motion it never plays on its own: autoplay is removed and
// the video reloaded, which brings back its poster, the still image; the
// button can still start it. Without scripts the video simply plays (and
// the reduced-motion case with scripts off is the one this can't cover).
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var video = document.querySelector(".hero-media video");
    if (!video) return;
    var button = document.createElement("button");
    button.type = "button";
    button.className = "hero-motion";
    // Whether the video should be playing. Not `video.paused`: before
    // autoplay kicks in (a phone holds it until the video is scrolled
    // into view) the video is paused but about to play, and the button
    // must offer "Pause" then; pause() also cancels the pending autoplay.
    var playing;
    function set(p) {
      playing = p;
      button.textContent = p ? "Pause" : "Play";
      button.setAttribute("aria-label", (p ? "Pause" : "Play") + " the gearbox animation");
    }
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      // preload="none" too, so a video that won't play isn't downloaded.
      video.removeAttribute("autoplay");
      video.preload = "none";
      video.pause();
      video.load();
    }
    set(!reduce);
    video.addEventListener("play", function () { set(true); });
    button.addEventListener("click", function () {
      if (playing) {
        video.pause();
        set(false);
      } else {
        set(true);
        var started = video.play();
        // A browser that refuses to play (a power-saving mode, say) leaves
        // the video paused; say so rather than offering "Pause".
        if (started && started.catch) started.catch(function () { set(false); });
      }
    });
    video.insertAdjacentElement("afterend", button);
  });
})();
