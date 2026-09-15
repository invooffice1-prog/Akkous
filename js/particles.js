/* ============================================================
   AKKOUS — Particle System
   ============================================================ */
export function initParticles() {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReduced) return;

  const finePointer = window.matchMedia("(pointer: fine)").matches;

  /* Brand colors read from tokens.css — single source of truth, no build step */
  const rootStyle = getComputedStyle(document.documentElement);
  const COLORS = ["--blue", "--violet", "--cyan"].map((token) => {
    const hex = rootStyle.getPropertyValue(token).trim();
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  });

  function create(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const reduced = !finePointer;
    let w, h, particles = [];
    let rafId = 0;
    let visible = false;
    const COUNT = reduced ? 26 : 52;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      w = canvas.width = rect.width;
      h = canvas.height = rect.height;
    };

    const make = () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.6,
      vy: -(Math.random() * 0.35 + 0.12),
      vx: (Math.random() - 0.5) * 0.2,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      a: Math.random() * 0.5 + 0.2,
    });

    const rebuild = () => {
      particles = [];
      for (let i = 0; i < COUNT; i++) particles.push(make());
    };

    resize();
    rebuild();
    window.addEventListener("resize", () => { resize(); rebuild(); });

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      /* Connections */
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.4;
            ctx.strokeStyle = `rgba(${COLORS[1]},${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      /* Particles */
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.c},${p.a})`;
        ctx.fill();
      }
    };

    /* Animation loop — paused while the canvas is off-screen */
    const loop = () => {
      if (!visible) { rafId = 0; return; }
      draw();
      rafId = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible && rafId === 0) loop();
    });
    io.observe(canvas);
  }

  create("heroParticles");
  create("ctaParticles");
}
