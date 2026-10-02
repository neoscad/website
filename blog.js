// The blog's script (the pages tools/blog/build.mjs writes). Posts are
// complete without it: code is highlighted at build time, and a YouTube
// placeholder is a plain link to the video. This adds two conveniences.
(function () {
  document.addEventListener("DOMContentLoaded", function () {
    // A Copy button on every code block's bar. The Clipboard API needs a
    // secure context (https, or localhost when previewing); where it is
    // missing the button would do nothing, so it isn't added.
    if (navigator.clipboard && window.isSecureContext) {
      document.querySelectorAll(".code-block").forEach(function (block) {
        var bar = block.querySelector(".code-bar");
        var code = block.querySelector("pre code");
        if (!bar || !code) return;
        var button = document.createElement("button");
        button.type = "button";
        button.className = "code-copy";
        button.textContent = "Copy";
        var timer;
        button.addEventListener("click", function () {
          navigator.clipboard.writeText(code.textContent).then(
            function () { say("Copied"); },
            function () { say("Copy failed"); }
          );
        });
        function say(text) {
          button.textContent = text;
          clearTimeout(timer);
          timer = setTimeout(function () { button.textContent = "Copy"; }, 2000);
        }
        bar.appendChild(button);
      });
    }

    // YouTube, click to load: the page contacts YouTube only once the
    // reader asks for the video, and then through youtube-nocookie.com,
    // the one framed origin the page's CSP allows (and only on posts that
    // embed a video). The id was checked at build time.
    document.querySelectorAll("a.youtube-load[data-youtube]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        var id = link.getAttribute("data-youtube");
        if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
        event.preventDefault();
        var frame = document.createElement("iframe");
        frame.className = "youtube-frame";
        frame.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1";
        frame.title = link.getAttribute("data-title") || "YouTube video";
        frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        frame.allowFullscreen = true;
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        link.replaceWith(frame);
        frame.focus();
      });
    });
  });
})();
