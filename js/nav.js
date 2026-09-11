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

  /* Mobile menu toggle */
  const toggleMenu = (open) => {
    const isOpen = open !== undefined ? open : !menu.classList.contains("open");
    menu.classList.toggle("open", isOpen);
    burger.classList.toggle("open", isOpen);
    burger.setAttribute("aria-expanded", String(isOpen));
    menu.setAttribute("aria-hidden", String(!isOpen));
    applyBurgerLabel(isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
  };

  applyBurgerLabel(false);

  burger.addEventListener("click", () => toggleMenu());

  /* Close menu on link click */
  menu.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => toggleMenu(false))
  );

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
