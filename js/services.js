/* ============================================================
   AKKOUS — Service Visuals
   - Fades service images in once loaded so the placeholder
     gradients show cleanly until the photo is available.
   - Video & Drone: builds a muted looping YouTube reel that
     autoplays while in view. It plays a fixed segment
     (DRONE_START → DRONE_END) on an endless loop. Honors
     prefers-reduced-motion (static frame, no autoplay) and
     pauses when scrolled out of view.
   ============================================================ */
import { t } from "./i18n.js";

const DRONE_VIDEO_ID = "wk9quCrd-bw";
const DRONE_START = 7; // 00:07
const DRONE_END = 100; // 01:40

export function initServices() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.querySelectorAll(".svc-visual img").forEach((img) => {
    const reveal = () => img.classList.add("in");
    if (reduced || (img.complete && img.naturalWidth > 0)) {
      reveal();
      return;
    }
    img.addEventListener("load", reveal, { once: true });
  });

  initDroneVideo(reduced);
}

/* ============================================================
   Video & Drone — autoplay YouTube reel looping a fixed segment
   ============================================================ */

let drone = null;

function initDroneVideo(reduced) {
  const pane = document.querySelector("#droneVideo");
  if (!pane || drone) return;

  drone = { pane, player: null, frame: null, ready: false, visible: false, reduced };

  /* Observe a STABLE ancestor — the API replaces #droneVideo itself with
     the iframe, which would detach the observed node and flip visible. */
  const observed = pane.closest(".svc-visual") || pane;

  const io = new IntersectionObserver(
    ([entry]) => {
      drone.visible = entry.isIntersecting;
      if (!drone.player) {
        if (drone.visible) loadDronePlayer();
        return;
      }
      if (drone.reduced || !drone.ready) return;
      if (drone.visible) {
        safePlayer("playVideo");
        window.dispatchEvent(new CustomEvent("akkous-drone-play"));
      } else {
        safePlayer("pauseVideo");
        window.dispatchEvent(new CustomEvent("akkous-drone-pause"));
      }
    },
    { rootMargin: "200px" }
  );
  io.observe(observed);

  document.addEventListener("i18n:change", syncDroneTitle);
}

function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  return new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve(window.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
}

async function loadDronePlayer() {
  const YT = await loadYouTubeAPI();
  if (!YT || !drone || drone.player) return;

  try {
    const raw = new YT.Player("droneVideo", {
      videoId: DRONE_VIDEO_ID,
      playerVars: {
        autoplay: 0,
        mute: 1,
        playsinline: 1,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        controls: 0,
        disablekb: 1,
      },
      events: {
        onReady: () => onDroneReady(),
        onStateChange: (e) => onDroneStateChange(e.data),
        onError: () => drone?.frame?.classList.remove("ready"),
      },
    });
    drone.player = raw;
    /* The API replaces the placeholder div with the iframe — re-query it. */
    drone.frame = document.getElementById("droneVideo") || drone.pane;
  } catch (err) {
    drone.player = null;
  }
}

function onDroneReady() {
  drone.ready = true;
  drone.frame.classList.add("ready");
  syncDroneTitle();
  if (drone.reduced) {
    /* Static frame at the start of the segment — no autoplay. */
    seekWhenReady(DRONE_START);
    safePlayer("pauseVideo");
    window.dispatchEvent(new CustomEvent("akkous-drone-pause"));
    return;
  }
  if (drone.visible) playDroneSegmentWhenReady();
}

function onDroneStateChange(state) {
  if (drone.reduced || !drone.ready) return;
  if (state === 0 && drone.visible) playDroneSegmentWhenReady();
}

function safePlayer(method, ...args) {
  if (drone?.player && typeof drone.player[method] === "function") {
    return drone.player[method](...args);
  }
}

function playDroneSegmentWhenReady(attempt = 0) {
  if (!drone || !drone.visible || drone.reduced) return;
  if (typeof drone.player.seekTo === "function" && typeof drone.player.getCurrentTime === "function") {
    beginDroneSegment();
    return;
  }
  if (attempt < 50) setTimeout(() => playDroneSegmentWhenReady(attempt + 1), 200);
}

function seekWhenReady(target, attempt = 0) {
  if (!drone) return;
  if (typeof drone.player.seekTo === "function") {
    drone.player.seekTo(target, true);
    return;
  }
  if (attempt < 50) setTimeout(() => seekWhenReady(target, attempt + 1), 200);
}

let segmentClock = null;

function beginDroneSegment() {
  drone.player.seekTo(DRONE_START, true);
  window.dispatchEvent(new CustomEvent("akkous-drone-segment", { detail: { start: DRONE_START, end: DRONE_END } }));
  drone.player.playVideo();
  /* Loop the segment by snapping back to DRONE_START once DRONE_END
     is reached — getCurrentTime() is a proxy method that hydrates
     shortly after onReady, so this clock is only started from
     beginDroneSegment() once seekTo/getCurrentTime are available. */
  stopSegmentClock();
  segmentClock = setInterval(() => {
    if (!drone || !drone.ready || drone.reduced) return;
    if (typeof drone.player.getCurrentTime !== "function") return;
    if (drone.player.getCurrentTime() >= DRONE_END) {
      drone.player.seekTo(DRONE_START, true);
    }
  }, 250);
}

function stopSegmentClock() {
  if (segmentClock) {
    clearInterval(segmentClock);
    segmentClock = null;
  }
}

function syncDroneTitle() {
  if (drone?.frame) drone.frame.setAttribute("title", t("services.drone.title"));
}