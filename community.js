// community.html: the community benchmark results, from the summary.json
// that neoscad/benchmarks rebuilds on every accepted result
// (scripts/summarize.py there describes the format).
//
// Every string in it came from someone's submission, so text reaches the
// page only through textContent, never innerHTML: a CPU name like
// "<img onerror=...>" is shown as those characters. The page's CSP allows
// fetching from raw.githubusercontent.com and nothing else.
(function () {
  "use strict";

  var SUMMARY = "https://raw.githubusercontent.com/neoscad/benchmarks/main/summary.json";
  var FORMAT = 1;
  var REPO = "https://github.com/neoscad/benchmarks";

  var OS_NAMES = { macos: "macOS", linux: "Linux", windows: "Windows" };
  var ARCH_NAMES = { aarch64: "arm64", x86_64: "x86_64" };
  var BACKENDS = { manifold: "Manifold", cgal: "CGAL" };

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "text") e.textContent = attrs[k];
        else if (k === "className") e.className = attrs[k];
        else e.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c != null) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return e;
  }

  function platformName(os, arch) {
    return (OS_NAMES[os] || os) + ", " + (ARCH_NAMES[arch] || arch);
  }

  function time(s) {
    if (s == null) return "–";
    if (s < 1) return (s * 1000).toFixed(s < 0.01 ? 1 : 0) + " ms";
    return s.toFixed(s < 10 ? 2 : 1) + " s";
  }

  function speedup(x) {
    return x == null ? "–" : x.toFixed(x < 10 ? 2 : 1) + "×";
  }

  // "OpenSCAD version 2026.09.23" -> "2026.09.23".
  function openscadName(o) {
    if (!o) return null;
    var v = String(o.version).replace(/^OpenSCAD version\s*/i, "");
    return "OpenSCAD " + v + " (" + (BACKENDS[o.backend] || o.backend) + ")";
  }

  function setStatus(parts) {
    var status = document.getElementById("status");
    status.textContent = "";
    if (!parts) {
      status.hidden = true;
      return;
    }
    status.hidden = false;
    parts.forEach(function (p) {
      status.appendChild(typeof p === "string" ? document.createTextNode(p) : p);
    });
  }

  // ---- platform cards ------------------------------------------------------

  function card(key, p) {
    var body = [
      el("h3", { text: platformName(p.os, p.arch) }),
      el("p", {}, [
        el("strong", { text: String(p.runs) }),
        p.runs === 1 ? " run: " : " runs: ",
        p.with_openscad + " compared with OpenSCAD, " + p.without_openscad + " without",
      ]),
    ];
    if (p.speedup.length) {
      var dl = el("dl", { className: "speedups" });
      p.speedup.forEach(function (g) {
        dl.appendChild(el("dt", {
          text: "vs OpenSCAD (" + (BACKENDS[g.backend] || g.backend) + "), " +
            (g.runs_kind === "quick" ? "quick runs" : "full runs"),
        }));
        var range = g.n > 1 ? " (" + speedup(g.min) + " to " + speedup(g.max) + ", " + g.n + " runs)" : " (1 run)";
        dl.appendChild(el("dd", {}, [el("strong", { className: "big", text: speedup(g.median) }), " median" + range]));
      });
      body.push(dl);
    } else {
      body.push(el("p", { className: "muted", text: "No comparison with OpenSCAD yet on this platform." }));
    }
    var machines = Object.keys(p.machines).sort();
    body.push(el("p", { className: "small muted", text: machines.length === 1 ? machines[0] : machines.length + " CPUs: " + machines.join(", ") }));
    return el("article", { className: "card", "aria-label": platformName(p.os, p.arch) }, body);
  }

  // ---- run tables ----------------------------------------------------------

  var detailsCount = 0;

  function modelTable(run, withRef) {
    var head = [el("th", { scope: "col", text: "Model" }), el("th", { scope: "col", className: "n", text: "NeoSCAD" })];
    if (withRef) {
      head.push(el("th", { scope: "col", className: "n", text: "OpenSCAD" }));
      head.push(el("th", { scope: "col", className: "n", text: "Speedup" }));
    }
    var rows = [["cold start", run.cold_start.neoscad_s, run.cold_start.openscad_s, null]];
    Object.keys(run.models).sort().forEach(function (id) {
      var m = run.models[id];
      rows.push([id, m.neoscad_s, m.openscad_s, m.speedup]);
    });
    var tbody = el("tbody");
    rows.forEach(function (r, i) {
      var cells = [
        el("th", { scope: "row" }, [i === 0 ? el("span", { text: r[0] }) : el("code", { text: r[0] })]),
        el("td", { className: "n", text: r[1] == null ? "failed" : time(r[1]) }),
      ];
      if (withRef) {
        cells.push(el("td", { className: "n", text: r[2] == null ? "failed" : time(r[2]) }));
        cells.push(el("td", { className: "n", text: i === 0 && r[1] && r[2] ? speedup(r[2] / r[1]) : speedup(r[3]) }));
      }
      tbody.appendChild(el("tr", {}, cells));
    });
    var facts = [];
    if (run.hardware_model) facts.push(run.hardware_model);
    facts.push(run.cores_logical + " logical cores" +
      (run.cores_performance ? " (" + run.cores_performance + " performance + " + run.cores_efficiency + " efficiency)" : ""));
    if (run.memory_bytes) facts.push(Math.round(run.memory_bytes / 1073741824) + " GB");
    facts.push(run.threads + " threads");
    if (run.on_battery === true) facts.push("on battery");
    if (run.translated === true) facts.push("under Rosetta 2");
    facts.push(run.runs_per_model === 1 ? "best of 1 run" : "best of " + run.runs_per_model + " runs");
    facts.push("started " + run.started_at.replace("T", " ").replace("Z", " UTC"));
    var caption = el("caption", {}, [facts.join(", ") + ". ", el("a", { href: REPO + "/blob/main/" + run.path, text: "Raw result" })]);
    if (run.skipped.length) caption.appendChild(document.createTextNode(" Skipped: " + run.skipped.join(", ") + "."));
    return el("div", { className: "table-scroll nested" }, [el("table", {}, [caption, el("thead", {}, [el("tr", {}, head)]), tbody])]);
  }

  function toggleButton(label) {
    var id = "run-details-" + (++detailsCount);
    var button = el("button", {
      type: "button",
      className: "button button-secondary button-small",
      "aria-expanded": "false",
      "aria-controls": id,
      text: "Show",
    });
    button.appendChild(el("span", { className: "visually-hidden", text: " per-model times for " + label }));
    return { id: id, button: button };
  }

  function wire(t, row) {
    t.button.addEventListener("click", function () {
      var open = t.button.getAttribute("aria-expanded") === "true";
      t.button.setAttribute("aria-expanded", String(!open));
      t.button.firstChild.textContent = open ? "Show" : "Hide";
      row.hidden = open;
    });
  }

  function modelsCell(run) {
    return el("td", { className: "n" }, [
      run.neoscad_ok + "/" + run.models_run,
      run.quick ? el("span", { className: "tag", text: "quick" }) : null,
    ]);
  }

  function runRows(tbody, run, columns) {
    var label = (run.cpu || run.arch) + ", " + (run.os_version || run.os);
    var t = toggleButton(label);
    var row = el("tr", {}, columns.concat([el("td", {}, [t.button])]));
    var withRef = run.openscad != null;
    var detail = el("tr", { id: t.id, className: "details", hidden: "" }, [
      el("td", { colspan: String(columns.length + 1) }, [modelTable(run, withRef)]),
    ]);
    wire(t, detail);
    tbody.appendChild(row);
    tbody.appendChild(detail);
  }

  function renderRuns(v) {
    var tbody = document.querySelector("#runs tbody");
    tbody.textContent = "";
    var runs = [];
    Object.keys(v.platforms).forEach(function (p) {
      Object.keys(v.platforms[p].machines).forEach(function (cpu) {
        runs = runs.concat(v.platforms[p].machines[cpu]);
      });
    });
    runs.sort(function (a, b) {
      return (a.neoscad_geomean_s || Infinity) - (b.neoscad_geomean_s || Infinity) || a.id - b.id;
    });
    runs.forEach(function (run) {
      var ref = openscadName(run.openscad);
      runRows(tbody, run, [
        el("th", { scope: "row", text: run.cpu || "Unknown " + run.arch + " CPU" }),
        el("td", { text: run.os_version || OS_NAMES[run.os] || run.os }),
        el("td", { className: ref ? "" : "muted", text: ref || "not compared" }),
        modelsCell(run),
        el("td", { className: "n", text: time(run.neoscad_geomean_s) }),
        el("td", { className: "n" }, [run.geomean_speedup == null ? el("span", { className: "muted", text: "–" }) : el("strong", { text: speedup(run.geomean_speedup) })]),
      ]);
    });
  }

  function renderBaselines(v) {
    var block = document.getElementById("baselines-block");
    var tbody = document.querySelector("#baselines tbody");
    tbody.textContent = "";
    var targets = Object.keys(v.baselines).sort();
    block.hidden = targets.length === 0;
    targets.forEach(function (t) {
      var run = v.baselines[t];
      runRows(tbody, run, [
        el("th", { scope: "row" }, [el("code", { text: t })]),
        el("td", { text: run.cpu || "–" }),
        modelsCell(run),
        el("td", { className: "n", text: time(run.neoscad_geomean_s) }),
        el("td", { className: "n", text: time(run.cold_start.neoscad_s) }),
      ]);
    });
  }

  function emptyState(version) {
    var link = el("a", { href: REPO + "#add-your-result", text: "Add yours" });
    setStatus([
      version ? "No results for NeoSCAD " + version + " yet — be the first. " : "No results yet — be the first. ",
      link,
      " with ",
      el("code", { text: "neoscad bench --submit" }),
      ".",
    ]);
  }

  function render(summary, version) {
    var v = summary.versions[version];
    var results = document.getElementById("results");
    var users = v ? Object.keys(v.platforms).length : 0;
    if (!v || (users === 0 && Object.keys(v.baselines).length === 0)) {
      results.hidden = true;
      emptyState(version);
      return;
    }
    results.hidden = false;
    var cards = document.getElementById("platforms");
    cards.textContent = "";
    Object.keys(v.platforms).sort().forEach(function (k) {
      cards.appendChild(card(k, v.platforms[k]));
    });
    var none = users === 0;
    document.getElementById("platforms-title").hidden = none;
    cards.hidden = none;
    document.getElementById("runs-title").hidden = none;
    document.getElementById("runs").closest(".table-scroll").hidden = none;
    document.getElementById("runs-title").nextElementSibling.hidden = none;
    detailsCount = 0;
    renderRuns(v);
    renderBaselines(v);
    if (none) {
      emptyState(version);
      document.getElementById("status").insertBefore(
        document.createTextNode("Only the release baseline so far. "), document.getElementById("status").firstChild);
    } else {
      setStatus([
        v.runs + (v.runs === 1 ? " result" : " results") + " for NeoSCAD " + version + ", " +
        v.with_openscad + " compared with OpenSCAD.",
      ]);
    }
  }

  function start(summary) {
    if (!summary || summary.format !== FORMAT || typeof summary.versions !== "object") {
      setStatus(["The results summary is in a format this page doesn't read. The results are in ",
        el("a", { href: REPO, text: "neoscad/benchmarks" }), "."]);
      return;
    }
    var order = (summary.version_order || []).filter(function (v) { return summary.versions[v]; });
    if (!order.length) {
      emptyState(null);
      return;
    }
    var select = document.getElementById("version");
    order.forEach(function (v) {
      select.appendChild(el("option", { value: v, text: "NeoSCAD " + v + (v === summary.latest ? " (latest)" : "") }));
    });
    // ?version= links to one release; anything not in the list falls back
    // to the latest.
    var asked = new URLSearchParams(window.location.search).get("version");
    var version = order.indexOf(asked) >= 0 ? asked : (summary.latest && order.indexOf(summary.latest) >= 0 ? summary.latest : order[0]);
    select.value = version;
    document.getElementById("version-picker").hidden = false;
    select.addEventListener("change", function () {
      var url = new URL(window.location.href);
      url.searchParams.set("version", select.value);
      window.history.replaceState(null, "", url);
      render(summary, select.value);
    });
    render(summary, version);
  }

  document.addEventListener("DOMContentLoaded", function () {
    fetch(SUMMARY, { cache: "no-cache", credentials: "omit" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(start)
      .catch(function (e) {
        setStatus(["Couldn't load the results (" + e.message + "). They are all in ",
          el("a", { href: REPO, text: "neoscad/benchmarks" }), "."]);
      });
  });
})();
