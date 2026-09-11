/* ============================================================
   AKKOUS — Magnetic Button Effect
   ============================================================ */
export function initMagnetic() {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  if (!finePointer || prefersReduced) return;

  document.querySelectorAll(".magnetic").forEach((btn) => {
    btn.addEventListener("pointermove", (e) => {
      btn.style.transition = "";
      const r = btn.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.18;
      const y = (e.clientY - r.top - r.height / 2) * 0.28;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener("pointerleave", () => {
      /* Eased glide back to the origin instead of an abrupt snap */
      btn.style.transition = "transform .45s var(--ease)";
      btn.style.transform = "";
    });
  });
}
