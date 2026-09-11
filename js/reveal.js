/* ============================================================
   AKKOUS — Reveal on Scroll
   ============================================================ */
export function initReveal() {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) {
    document.querySelectorAll(".reveal, .pipeline-mini, .eco").forEach((el) => {
      el.classList.add("in");
    });
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
  );

  document.querySelectorAll(".reveal, .eco, .pipeline-mini").forEach((el) =>
    io.observe(el)
  );
}
