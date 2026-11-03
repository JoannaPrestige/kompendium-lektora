/* Kompendium Lektora: wyszukiwarka, bieżący rozdział w spisie, przyciski na telefonie, klikalne telefony. */
(function () {
  "use strict";
  var PAGES = [["vademecum.html", "Vademecum"], ["manual.html", "Manual"], ["skill-sety.html", "Skill Sety"]];

  function norm(s) {
    return s.toLowerCase().replace(/ł/g, "l").normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function slug(s) {
    return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sekcja";
  }
  function esc(s) {
    return s.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  // Każdy nagłówek dostaje niepowtarzalną kotwicę. Ta sama funkcja działa na stronie i na stronie pobranej do wyszukiwania.
  function anchor(root) {
    var seen = {};
    root.querySelectorAll("h1,h2,h3").forEach(function (h) {
      var id = h.id || slug(h.textContent);
      if (seen[id]) { var n = 2; while (seen[id + "-" + n]) n++; id = id + "-" + n; }
      seen[id] = 1;
      h.id = id;
    });
  }

  // Dzieli treść na sekcje: nagłówek i tekst do następnego nagłówka.
  function sections(main, href, page) {
    var out = [], cur = null, chap = "";
    main.querySelectorAll("h1,h2,h3,p,li,td,th").forEach(function (el) {
      if (/^H[123]$/.test(el.tagName)) {
        if (el.tagName === "H1") chap = el.textContent.trim();
        cur = { href: href + "#" + el.id, title: el.textContent.trim(), chap: chap, page: page, text: "" };
        out.push(cur);
      } else if (cur && !el.closest("td,th") || el.matches("td,th")) {
        if (cur) cur.text += " " + el.textContent.replace(/\s+/g, " ").trim();
      }
    });
    // spis treści na początku dokumentu powtarza wszystko, więc nie pokazujemy go w wynikach
    out = out.filter(function (s) { return !/^(co jest w|spis tresci)/.test(norm(s.title)); });
    out.forEach(function (s) { s.n = norm(s.title + " " + s.text); s.nt = norm(s.text); });
    return out;
  }

  function snippet(text, q) {
    var i = norm(text).indexOf(q);
    if (i < 0) return esc(text.slice(0, 110)) + (text.length > 110 ? "…" : "");
    var j = i + q.length;
    while (j < text.length && /[a-ząćęłńóśźż]/i.test(text.charAt(j))) j++;
    var a = Math.max(0, i - 45), b = Math.min(text.length, j + 70);
    return (a ? "…" : "") + esc(text.slice(a, i)) + "<mark>" + esc(text.slice(i, j)) + "</mark>" +
      esc(text.slice(j, b)) + (b < text.length ? "…" : "");
  }

  function searchBox(host, getIndex, placeholder) {
    var box = document.createElement("div");
    box.className = "ksearch";
    box.setAttribute("role", "search");
    box.innerHTML = '<input type="search" aria-label="Szukaj w Kompendium" placeholder="' + placeholder + '"><div class="res" aria-live="polite"></div>';
    host.parentNode.insertBefore(box, host);
    var input = box.querySelector("input"), res = box.querySelector(".res"), t;
    input.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(function () {
        var raw = norm(input.value.trim());
        if (raw.length < 2) { res.innerHTML = ""; return; }
        // polska odmiana: przy dłuższych słowach szukamy bez końcówki (zastępstwo znajdzie też zastępstwa)
        var words = raw.split(/\s+/).map(function (w) { return w.length > 5 ? w.slice(0, -2) : w; });
        var q = words[0];
        getIndex(function (idx) {
          var hits = idx.filter(function (s) { return words.every(function (w) { return s.n.indexOf(w) >= 0; }); }).slice(0, 25);
          res.innerHTML = hits.length ? hits.map(function (s) {
            var where = s.page ? s.page + (s.chap && s.chap !== s.title ? ", " + s.chap : "") : (s.chap !== s.title ? s.chap : "");
            return '<a href="' + s.href + '"><b>' + esc(s.title) + "</b>" + (where ? "<small>" + esc(where) + "</small>" : "") +
              (s.nt.indexOf(q) >= 0 ? snippet(s.text.trim(), q) : "") + "</a>";
          }).join("") : '<div class="none">Nic nie znalazłam. Spróbuj innego słowa.</div>';
        });
      }, 150);
    });
    res.addEventListener("click", function (e) {
      var a = e.target.closest("a");
      if (!a) return;
      document.documentElement.classList.remove("toc-open");
      var hash = a.getAttribute("href").split("#")[1];
      var tgt = hash && a.getAttribute("href").charAt(0) === "#" && document.getElementById(hash);
      if (tgt) setTimeout(function () { tgt.classList.remove("flash"); void tgt.offsetWidth; tgt.classList.add("flash"); }, 50);
    });
    return box;
  }

  function phones(root) {
    var re = /(\+48 ?)?\b(\d{3}) (\d{3}) (\d{3})\b/g;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return n.parentNode.closest("a,script,style,input,textarea") || !/\d{3} \d{3} \d{3}/.test(n.nodeValue) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var span = document.createElement("span");
      span.innerHTML = esc(n.nodeValue).replace(re, function (m, p, a, b, c) { return '<a href="tel:+48' + a + b + c + '">' + m + "</a>"; });
      n.parentNode.replaceChild(span, n);
      while (span.firstChild) span.parentNode.insertBefore(span.firstChild, span);
      span.parentNode.removeChild(span);
    });
  }

  function run() {
    var html = document.documentElement, main = document.querySelector("main.page") || document.querySelector("main");
    var toc = document.querySelector("aside.toc");
    if (main) { anchor(main); phones(main); }
    // wejście z wyników wyszukiwania na innej stronie: kotwica mogła powstać dopiero teraz
    if (location.hash.length > 1) {
      var t0 = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (t0) { t0.scrollIntoView(); t0.classList.add("flash"); }
    }

    // bieżąca strona w menu widoczna także na wąskim ekranie
    var cur = document.querySelector('.top nav a[aria-current="page"]');
    if (cur && cur.scrollIntoView) { var nav = cur.parentNode; nav.scrollLeft = cur.offsetLeft - 16; }

    // wyszukiwarka: w spisie rozdziałów (Vademecum, Manual, Skill Sety) albo na stronie startowej po wszystkich trzech
    if (toc && main) {
      var local = null;
      searchBox(toc.querySelector(".label") || toc.firstChild, function (cb) {
        local = local || sections(main, "", "");
        cb(local);
      }, "Szukaj w tym dokumencie");
    }
    var hostAll = document.querySelector("[data-ksearch]");
    if (hostAll && window.fetch && location.protocol !== "file:") {
      var all = null, waiting = [];
      var box = searchBox(hostAll, function (cb) {
        if (all) return cb(all);
        waiting.push(cb);
        if (waiting.length > 1) return;
        Promise.all(PAGES.map(function (p) {
          return fetch(p[0]).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (t) {
            var d = new DOMParser().parseFromString(t, "text/html"), m = d.querySelector("main.page");
            if (!m) return [];
            anchor(m);
            return sections(m, p[0], p[1]);
          }).catch(function () { return []; });
        })).then(function (lists) {
          all = [].concat.apply([], lists);
          waiting.forEach(function (f) { f(all); });
        });
      }, "Szukaj w Vademecum, Manualu i Skill Setach, np. premia, zastępstwo");
      hostAll.parentNode.removeChild(hostAll);
      box.style.maxWidth = "560px";
    } else if (hostAll) {
      hostAll.parentNode.removeChild(hostAll);
    }

    // podświetlenie bieżącego rozdziału w spisie
    if (toc && main) {
      var links = {}, heads = [];
      toc.querySelectorAll('a[href^="#"]').forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
      main.querySelectorAll("h1[id]").forEach(function (h) { if (links[h.id]) heads.push(h); });
      var active = null, ticking = false;
      var spy = function () {
        ticking = false;
        var pick = null;
        for (var i = 0; i < heads.length; i++) { if (heads[i].getBoundingClientRect().top < 140) pick = heads[i]; else break; }
        var a = pick ? links[pick.id] : null;
        if (a === active) return;
        if (active) active.classList.remove("active");
        active = a;
        if (a) { a.classList.add("active"); if (!html.classList.contains("toc-open") && a.scrollIntoView && toc.scrollHeight > toc.clientHeight) { var r = a.offsetTop - toc.clientHeight / 2; toc.scrollTop = r; } }
      };
      addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
      spy();
      toc.addEventListener("click", function (e) { if (e.target.closest('a[href^="#"]')) html.classList.remove("toc-open"); });
    }

    // przyciski na dole ekranu: Rozdziały (telefon) i do góry
    var fab = document.createElement("div");
    fab.className = "fab";
    fab.innerHTML = (toc ? '<button type="button" class="chapters" aria-expanded="false">Rozdziały</button>' : "") +
      '<button type="button" class="up" aria-label="Do góry">↑</button>';
    document.body.appendChild(fab);
    var up = fab.querySelector(".up"), ch = fab.querySelector(".chapters");
    up.addEventListener("click", function () { scrollTo({ top: 0, behavior: "smooth" }); });
    addEventListener("scroll", function () { up.classList.toggle("show", scrollY > 700); }, { passive: true });
    if (ch) ch.addEventListener("click", function () {
      var open = html.classList.toggle("toc-open");
      ch.textContent = open ? "Zamknij" : "Rozdziały";
      ch.setAttribute("aria-expanded", open);
      if (open && active) active.scrollIntoView({ block: "center" });
    });
    addEventListener("keydown", function (e) { if (e.key === "Escape" && html.classList.contains("toc-open")) ch && ch.click(); });
    var obs = new MutationObserver(function () { if (ch && !html.classList.contains("toc-open")) { ch.textContent = "Rozdziały"; ch.setAttribute("aria-expanded", "false"); } });
    obs.observe(html, { attributes: true, attributeFilter: ["class"] });
  }

  // ---- aplikacja na telefon i komputer ----
  var installEvt = null;
  addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; showInstall(); });

  function standalone() {
    return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  }

  // przycisk instalacji na stronie startowej: Chrome i Edge na komputerze, Android; na iPhonie krótka instrukcja
  function showInstall() {
    var hero = document.querySelector(".hero");
    if (!hero || standalone() || document.querySelector(".kinstall")) return;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (!installEvt && !ios) return;
    var box = document.createElement("p");
    box.className = "kinstall";
    if (installEvt) {
      box.innerHTML = '<button type="button">Zainstaluj Kompendium jako aplikację</button>';
      box.querySelector("button").addEventListener("click", function () {
        installEvt.prompt();
        installEvt.userChoice.then(function () { installEvt = null; box.remove(); });
      });
    } else {
      box.textContent = "Na iPhonie dodasz Kompendium jako aplikację: w Safari stuknij Udostępnij, potem Do ekranu początkowego.";
    }
    hero.appendChild(box);
  }

  function app() {
    var man = document.querySelector('link[rel="manifest"]');
    if (man && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
      try { navigator.serviceWorker.register(new URL("sw.js", man.href).href).catch(function () {}); } catch (e) {}
    }
    showInstall();
    // w trybie aplikacji strony bez menu Kompendium (ewaluatory, biblioteki, TOEFL) otwieramy w osobnym oknie, żeby był powrót
    if (standalone()) {
      document.querySelectorAll('a[href]').forEach(function (a) {
        if (/(^|\/)(ewaluator-|biblioteka-|toefl-)[^\/]*\.html/.test(a.getAttribute("href"))) { a.target = "_blank"; a.rel = "noopener"; }
      });
    }
  }

  function start() { run(); app(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
