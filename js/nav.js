/* ============================================================
   AKKOUS — Navigation Module
   ============================================================ */
import { t } from "./i18n.js";

export function initNav() {
  const nav = document.getElementById("nav");
  const burger = document.getElementById("burger");
  const menu = document.getElementById("mobileMenu");

  const applyBurgerLabel = (open) => {
    burger.setAttribute("aria-label", t(open ? "nav.closeMenu" : "nav.openMenu"));
  };

  /* Scroll state */
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* Background inert when menu open */
  const setBackgroundInert = (on) => {
    [document.querySelector("main"), document.querySelector(".footer")].forEach((el) => {
      if (!el) return;
      if (on) {
        el.setAttribute("inert", "");
        el.setAttribute("aria-hidden", "true");
      } else {
        el.removeAttribute("inert");
        el.removeAttribute("aria-hidden");
      }
    });
  };

  /* Mobile menu toggle */
  const toggleMenu = (open) => {
    const isOpen = open !== undefined ? open : !menu.classList.contains("open");
    menu.classList.toggle("open", isOpen);
    burger.classList.toggle("open", isOpen);
    burger.setAttribute("aria-expanded", String(isOpen));
    menu.setAttribute("aria-hidden", String(!isOpen));
    applyBurgerLabel(isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
    setBackgroundInert(isOpen);
    if (!isOpen && window.getComputedStyle(burger).display !== "none") {
      burger.focus();
    }
  };

  applyBurgerLabel(false);

  burger.addEventListener("click", () => toggleMenu());

  /* Close menu on link click */
  menu.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => toggleMenu(false))
  );

  /* Focus trap: keep Tab cycles inside the open menu */
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Tab" || !menu.classList.contains("open")) return;
    const focusable = [...menu.querySelectorAll("a[href], button:not([disabled])")].filter(
      (el) => getComputedStyle(el).display !== "none"
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  /* Close on Escape */
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("open")) toggleMenu(false);
  });

  /* Close the menu if the viewport grows back to desktop */
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 721 && menu.classList.contains("open")) toggleMenu(false);
  });

  /* Re-translate the burger label when the language changes */
  document.addEventListener("i18n:change", () => applyBurgerLabel(menu.classList.contains("open")));
}
