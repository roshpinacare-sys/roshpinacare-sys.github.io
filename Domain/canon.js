/*! SAOS-CANON/1 · מספר-אחד, מקור-אחד, חי · sovereign-union-forge 2026-11-03T16:01:35.547Z
 * שימוש: <script src="/Domain/canon.js" defer></script>
 * ואז בכל-מקום-בדף: <span data-canon="repos.total">49</span> — הערך-הסטטי-הוא-קנון-הבנייה,
 * ו-canon.js מרים-אותו-חי מ-/Domain/canon.json.
 */
(function () {
  "use strict";
  var SOURCES = ["/Domain/canon.json", "https://roshpinacare-sys.github.io/Domain/canon.json"];
  function fmt(n) { try { return Number(n).toLocaleString("en-US"); } catch (e) { return String(n); } }
  function apply(c) {
    var v = (c && c.values) || {};
    var els = document.querySelectorAll("[data-canon]");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var key = el.getAttribute("data-canon");
      if (key === "generatedAtLabel") { el.textContent = "קנון-חי: " + (c.at || ""); continue; }
      if (!(key in v)) continue;
      el.textContent = fmt(v[key]);
      el.setAttribute("title", (c.at || "") + " · מקור: " + ((c.source && c.source[key]) || "SAOS-CANON"));
    }
    try { window.dispatchEvent(new CustomEvent("saos-canon", { detail: c })); } catch (e) {}
  }
  function tryFetch(i) {
    if (i >= SOURCES.length) return;
    var x = new XMLHttpRequest();
    x.open("GET", SOURCES[i], true);
    x.onload = function () {
      if (x.status === 200) { try { apply(JSON.parse(x.responseText)); } catch (e) { tryFetch(i + 1); } }
      else tryFetch(i + 1);
    };
    x.onerror = function () { tryFetch(i + 1); };
    x.send();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { tryFetch(0); });
  else tryFetch(0);
  // החלה-חוזרת: סקריפטי-הדף-עצמם עלולים-לדרוס-תאים-אחרי-הטעינה —
  // הקנון-מנצח: מיושם-מחדש-בקצב-הולך-ונדיר-עד-15 שניות + ב-load
  [300, 1000, 2500, 5000, 9000, 15000].forEach(function (ms) { setTimeout(function () { tryFetch(0); }, ms); });
  window.addEventListener("load", function () { setTimeout(function () { tryFetch(0); }, 150); });
})();
