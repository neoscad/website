// Mobile navigation toggle. This is the site's only script, and the pages
// work without it: styles.css collapses the menu only under the `js` class
// added here, so with scripts off the links stay visible and simply wrap.
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
