    (function () {
      var btn = document.getElementById("masterActionsDropdownBtn");
      var panel = document.getElementById("masterActionsDropdownPanel");
      if (!btn || !panel) return;
      function close() { panel.classList.add("hidden"); btn.setAttribute("aria-expanded", "false"); }
      function open() { panel.classList.remove("hidden"); btn.setAttribute("aria-expanded", "true"); }
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (panel.classList.contains("hidden")) open(); else close();
      });
      panel.addEventListener("click", function (e) {
        if (e.target.closest("button") || e.target.closest("label")) setTimeout(close, 80);
      });
      document.addEventListener("click", function (e) {
        if (!panel.classList.contains("hidden") && !panel.contains(e.target) && e.target !== btn && !btn.contains(e.target)) close();
      });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    })();

    (function () {
      var KEY = "gst_show_sheet_refs";
      function read() { try { return localStorage.getItem(KEY) === "1"; } catch (e) { return false; } }
      function applyColspans(on) {
        var cells = document.querySelectorAll("[data-sref-colspan-off]");
        for (var i = 0; i < cells.length; i++) {
          var td = cells[i];
          if (!td.getAttribute("data-sref-colspan-on")) {
            td.setAttribute("data-sref-colspan-on", td.getAttribute("colspan") || "1");
          }
          td.setAttribute("colspan", on ? td.getAttribute("data-sref-colspan-on") : td.getAttribute("data-sref-colspan-off"));
        }
      }
      // OPTION element ke andar span nahi chal sakta, isliye text swap karte hain
      var OPT_STRIP = /\s*\((?:Sheet\s+)?(?:Row|Rows|Col|Cols|Cell)\b[^)]{0,30}\)|\s*\([A-N]\d{0,2}\)/g;
      function applyOptions(on) {
        var opts = document.querySelectorAll("[data-sref-opt]");
        for (var i = 0; i < opts.length; i++) {
          var o = opts[i];
          if (!o.getAttribute("data-sref-opt-on")) o.setAttribute("data-sref-opt-on", o.textContent);
          var full = o.getAttribute("data-sref-opt-on");
          o.textContent = on ? full : full.replace(OPT_STRIP, "");
        }
      }
      function apply(on) {
        document.body.classList.toggle("show-srefs", !!on);
        var boxes = document.querySelectorAll(".sref-toggle-input");
        for (var i = 0; i < boxes.length; i++) boxes[i].checked = !!on;
        applyColspans(!!on);
        applyOptions(!!on);
      }
      apply(read());
      var boxes = document.querySelectorAll(".sref-toggle-input");
      for (var i = 0; i < boxes.length; i++) {
        boxes[i].addEventListener("change", function (ev) {
          var on = !!ev.target.checked;
          try { localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) {}
          apply(on);
        });
      }
      // Tables dobara render hone par colspan phir se set karna padta hai
      var pending = false;
      var raf = (typeof requestAnimationFrame === "function") ? requestAnimationFrame : function (fn) { return setTimeout(fn, 16); };
      function schedule() {
        if (pending) return;
        pending = true;
        raf(function () { pending = false; applyColspans(document.body.classList.contains("show-srefs")); });
      }
      if (typeof MutationObserver !== "undefined") {
        var obs = new MutationObserver(schedule);
        ["pageJsonMain", "pageMasterMain"].forEach(function (id) {
          var el = document.getElementById(id);
          if (el) obs.observe(el, { childList: true, subtree: true });
        });
      }
    })();
