(function () {
  var header = document.querySelector(".site-header");
  var btn = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  var label = btn && btn.querySelector(".nav-toggle-text");
  if (!header || !btn || !nav) return;

  function setOpen(open) {
    header.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? "Close menu" : "Menu");
    if (label) label.textContent = open ? "Close" : "Menu";
  }

  btn.addEventListener("click", function () {
    setOpen(btn.getAttribute("aria-expanded") !== "true");
  });

  nav.addEventListener("click", function (e) {
    if (e.target.closest("a")) setOpen(false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setOpen(false);
  });

  window.addEventListener("resize", function () {
    if (window.matchMedia("(min-width: 900px)").matches) setOpen(false);
  });
})();
