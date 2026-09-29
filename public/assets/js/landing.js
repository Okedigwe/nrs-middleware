/* Landing page interactions: sticky nav, mobile menu, reveal-on-scroll */
(function () {
  "use strict";
  const nav = document.getElementById("siteNav");
  const burger = document.getElementById("burger");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
    burger.innerHTML = `<i class="bi ${open ? "bi-x-lg" : "bi-list"}" aria-hidden="true"></i>`;
  });
  nav.querySelectorAll(".links a, .cta a").forEach((a) => a.addEventListener("click", () => {
    nav.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
    burger.innerHTML = '<i class="bi bi-list" aria-hidden="true"></i>';
  }));

  const els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach((el) => io.observe(el));
  } else els.forEach((el) => el.classList.add("in"));

  document.querySelectorAll("[data-year]").forEach((e) => (e.textContent = new Date().getFullYear()));
})();
