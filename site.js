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

// The home page's hero video autoplays, muted and looping, and so may a
// blog post's (`{autoplay}`, tools/blog/build.mjs). Motion that starts on
// its own and runs past five seconds needs a way to stop it (WCAG 2.2.2),
// so a Pause/Play button goes over the hero, which has no controls; a
// post's video has its own. For readers who ask for reduced motion none
// plays on its own: autoplay is removed and the video reloaded, which
// brings back its poster, the still image; the button or the controls can
// still start it. Without scripts the video simply plays (and the
// reduced-motion case with scripts off is the one this can't cover).
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      document.querySelectorAll(".post-media video[autoplay]").forEach(function (video) {
        video.removeAttribute("autoplay");
        video.preload = "none";
        video.pause();
        video.load();
      });
    }
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

// The home page's install picker (index.html, #install). Without this
// script every platform's commands show, stacked; with it the panels
// become WAI-ARIA tabs (arrow keys, Home and End move between them, and
// selection follows focus) and the visitor's own platform is chosen.
(function () {
  // The visitor's platform: "macos", "linux", "windows" or "browser".
  // Phones and tablets get the browser, since neither iOS nor Android can
  // run the command-line tool or the apps. userAgentData (Chromium) is
  // asked first; the user-agent string covers the other browsers, and
  // navigator.platform is the last resort. An iPad asking for desktop
  // sites says "Macintosh", so a Mac with a touch screen counts as an
  // iPad: no Mac has one. ChromeOS goes to the browser too, since its
  // Linux container is opt-in.
  function detect() {
    var data = navigator.userAgentData;
    var ua = navigator.userAgent || "";
    var hint = (data && data.platform) || "";
    if (data && data.mobile) return "browser";
    if (/Android|iPhone|iPad|iPod|CrOS|Chrome OS/i.test(hint + " " + ua)) return "browser";
    var s = hint || ua || navigator.platform || "";
    if (/Win/i.test(s)) return "windows";
    if (/Mac/i.test(s)) return navigator.maxTouchPoints > 1 ? "browser" : "macos";
    if (/Linux|X11|BSD/i.test(s)) return "linux";
    return "macos";
  }

  // Set now, while the head is loading, not at DOMContentLoaded:
  // styles.css shows the panel and marks the tab this names, so the first
  // paint is already the visitor's platform. Choosing it after the page
  // had been drawn would resize the box and move the hero video under it.
  var root = document.documentElement;
  root.setAttribute("data-install", detect());

  document.addEventListener("DOMContentLoaded", function () {
    var picker = document.getElementById("install");
    if (!picker) return;
    var tabs = Array.prototype.slice.call(picker.querySelectorAll('[role="tab"]'));
    var panels = tabs.map(function (tab) {
      var panel = document.getElementById(tab.getAttribute("aria-controls"));
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      return panel;
    });

    function select(index, focus) {
      root.setAttribute("data-install", panels[index].getAttribute("data-platform"));
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
      });
      if (focus) tabs[index].focus();
    }

    var start = panels.findIndex(function (panel) {
      return panel.getAttribute("data-platform") === root.getAttribute("data-install");
    });
    select(start < 0 ? 0 : start, false);

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(i, false); });
      tab.addEventListener("keydown", function (event) {
        var next;
        if (event.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        select(next, true);
      });
    });

    // Copy buttons. They are in the page (so the rows never change size)
    // and shown under the `js` class. The Clipboard API needs a secure
    // context (https, or localhost); without it, or if writing fails, the
    // button selects the command instead, ready for the keyboard's copy.
    // Feedback goes on the button and, for screen readers, to a polite
    // live region, since a focused button's new text isn't always read.
    var status = document.getElementById("install-status");
    picker.querySelectorAll(".install-copy").forEach(function (button) {
      var code = document.getElementById(button.getAttribute("aria-describedby"));
      if (!code) return;
      var timer;
      function say(text, spoken) {
        button.textContent = text;
        if (status) status.textContent = spoken;
        clearTimeout(timer);
        timer = setTimeout(function () {
          button.textContent = "Copy";
          if (status) status.textContent = "";
        }, 2000);
      }
      function selectText(spoken) {
        var range = document.createRange();
        range.selectNodeContents(code);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        say("Selected", spoken);
      }
      button.addEventListener("click", function () {
        var text = code.textContent;
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(
            function () { say("Copied", "Copied " + text); },
            function () { selectText("Couldn't copy; the command is selected"); }
          );
        } else {
          selectText("The command is selected; copy it with your keyboard");
        }
      });
    });
  });
})();
