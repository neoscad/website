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

// A blog post's video may autoplay, muted and looping (`{autoplay}`,
// tools/blog/build.mjs), with its own controls to stop it (WCAG 2.2.2).
// For readers who ask for reduced motion none plays on its own: autoplay
// is removed and the video reloaded, which brings back its poster; the
// controls can still start it. (The home page's hero is a live 3D view
// now, with its own Pause button: hero.js.)
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) return;
    document.querySelectorAll(".post-media video[autoplay]").forEach(function (video) {
      video.removeAttribute("autoplay");
      video.preload = "none";
      video.pause();
      video.load();
    });
  });
})();

// Tab groups and Copy buttons: the install boxes (index.html and
// agents.html, #install) and agents.html's per-client setup (#setup).
// The markup and the first-paint rules are in styles.css ("Tabs"). Without
// this script every panel shows, stacked under its label; with it each
// .tabs group becomes WAI-ARIA tabs (arrow keys, Home and End move between
// them, and selection follows focus).
//
//   <div class="tabs" data-tabs="NAME" [data-detect="os"]>
//     <div class="tabs-list" role="tablist" aria-label="...">
//       <button type="button" role="tab" id="T" aria-controls="P"
//               data-tab="VALUE" aria-selected="..." tabindex="...">
//     <div class="tabs-panels">
//       <div class="tabs-panel" id="P" data-tab="VALUE">
//         <h3 class="tabs-label">...</h3> (or a <p>)
//
// The first tab is the default. With data-detect="os" the tabs' values are
// macos, linux, windows and browser, and the visitor's platform is chosen
// instead, or the platform they last chose in any such group during this
// visit (sessionStorage), so a choice on the home page carries over to the
// agents page.
(function () {
  var PLATFORMS = ["macos", "linux", "windows", "browser"];
  var KEY = "neoscad-os";

  // The visitor's platform. Phones and tablets get the browser, since
  // neither iOS nor Android can run the command-line tool or the apps.
  // userAgentData (Chromium) is asked first; the user-agent string covers
  // the other browsers, and navigator.platform is the last resort. An iPad
  // asking for desktop sites says "Macintosh", so a Mac with a touch screen
  // counts as an iPad: no Mac has one. ChromeOS goes to the browser too,
  // since its Linux container is opt-in.
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

  // sessionStorage throws where storage is blocked (some privacy settings,
  // sandboxed frames); the choice is then simply not remembered.
  function remembered() {
    try {
      var value = window.sessionStorage.getItem(KEY);
      return PLATFORMS.indexOf(value) >= 0 ? value : null;
    } catch (e) {
      return null;
    }
  }

  function remember(value) {
    try {
      window.sessionStorage.setItem(KEY, value);
    } catch (e) {
      // Not remembered; nothing else depends on it.
    }
  }

  // Set now, while the head is loading, not at DOMContentLoaded: styles.css
  // shows the panel and marks the tab this names, so the first paint is
  // already the visitor's platform. Choosing it after the page had been
  // drawn would resize the box and move the hero under it.
  var root = document.documentElement;
  root.setAttribute("data-os", remembered() || detect());

  function children(parent, test) {
    return parent ? Array.prototype.filter.call(parent.children, test) : [];
  }

  function setUp(group) {
    var list = children(group, function (el) { return el.classList.contains("tabs-list"); })[0];
    var tabs = children(list, function (el) { return el.getAttribute("role") === "tab"; });
    var panels = tabs.map(function (tab) {
      var panel = document.getElementById(tab.getAttribute("aria-controls"));
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      return panel;
    });
    if (!tabs.length) return;
    var detected = group.getAttribute("data-detect") === "os";

    function select(index, focus) {
      tabs.forEach(function (tab, i) {
        var on = i === index;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        panels[i].hidden = !on;
      });
      if (focus) tabs[index].focus();
    }

    // The same choice the first paint made (styles.css), now as state.
    var start = 0;
    if (detected) {
      var os = root.getAttribute("data-os");
      start = Math.max(0, tabs.findIndex(function (tab) { return tab.getAttribute("data-tab") === os; }));
    }
    select(start, false);
    group.setAttribute("data-ready", "");

    function choose(index, focus) {
      select(index, focus);
      if (detected) remember(tabs[index].getAttribute("data-tab"));
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { choose(i, false); });
      tab.addEventListener("keydown", function (event) {
        var next;
        if (event.key === "ArrowRight") next = (i + 1) % tabs.length;
        else if (event.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = tabs.length - 1;
        else return;
        event.preventDefault();
        choose(next, true);
      });
    });
  }

  // Copy buttons: <button class="copy-button" data-copy="ID"> copies the
  // text of element ID. The Clipboard API needs a secure context (https,
  // or localhost); without it, or if writing fails, the button selects the
  // text instead, ready for the keyboard's copy. Feedback goes on the
  // button and, for screen readers, to a polite live region, since a
  // focused button's new text isn't always read.
  function setUpCopy(button, status) {
    var code = document.getElementById(button.getAttribute("data-copy"));
    if (!code) return;
    var timer;
    function say(text, spoken) {
      button.textContent = text;
      status.textContent = spoken;
      clearTimeout(timer);
      timer = setTimeout(function () {
        button.textContent = "Copy";
        status.textContent = "";
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
      // A one-line command is read back; a configuration file isn't.
      var multiline = text.indexOf("\n") >= 0;
      var what = multiline ? "text" : "command";
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(
          function () { say("Copied", multiline ? "Copied" : "Copied " + text); },
          function () { selectText("Couldn't copy; the " + what + " is selected"); }
        );
      } else {
        selectText("The " + what + " is selected; copy it with your keyboard");
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".tabs").forEach(setUp);
    var buttons = document.querySelectorAll("button.copy-button[data-copy]");
    if (!buttons.length) return;
    // One live region for the page's Copy buttons. Visually hidden and
    // absolutely positioned, so adding it moves nothing.
    var status = document.createElement("p");
    status.className = "visually-hidden";
    status.setAttribute("aria-live", "polite");
    document.body.appendChild(status);
    buttons.forEach(function (button) { setUpCopy(button, status); });
  });
})();
