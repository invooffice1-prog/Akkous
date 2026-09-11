/* ============================================================
   AKKOUS — Project Request Modal
   ============================================================ */
import { GOOGLE_SCRIPT_API_URL, MAX_DESCRIPTION_LENGTH } from "./config.js";
import { t } from "./i18n.js";

let modal, backdrop, closeBtn, form, submitBtn, successEl, headerEl, charCounter;
let lastFocused = null;

/** Abort the form fetch after this long (prevents an endless loading state). */
const FETCH_TIMEOUT_MS = 15000;

/* ---------- DOM References ---------- */

function cacheDom() {
  modal       = document.getElementById("projectModal");
  backdrop    = document.getElementById("modalBackdrop");
  closeBtn    = document.getElementById("modalClose");
  form        = document.getElementById("projectForm");
  submitBtn   = document.getElementById("submitBtn");
  successEl   = document.getElementById("successMessage");
  headerEl    = document.getElementById("modalHeader");
  charCounter = document.getElementById("charCounter");
}

/* ---------- Open / Close ---------- */

function openModal() {
  lastFocused = document.activeElement;

  /* Restore the form view (values kept so a user can resume after an error) */
  form.classList.remove("hidden");
  headerEl.classList.remove("hidden");
  successEl.classList.remove("show");
  submitBtn.disabled = false;
  submitBtn.classList.remove("loading");
  charCounter.textContent = t("form.counter", { count: form.projectDescription.value.length, max: MAX_DESCRIPTION_LENGTH });
  clearErrors();

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  const nameField = document.getElementById("formName");
  setTimeout(() => {
    if (modal.classList.contains("open")) nameField.focus();
  }, 350);
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (lastFocused) lastFocused.focus();
}

/* ---------- Validation ---------- */

function clearErrors() {
  form.querySelectorAll(".form-group").forEach(g => g.classList.remove("error"));
  form.querySelectorAll(".form-error").forEach(e => (e.textContent = ""));
}

function showError(fieldId, message) {
  const group = document.getElementById(fieldId).closest(".form-group");
  group.classList.add("error");
  group.querySelector(".form-error").textContent = message;
}

function validate() {
  clearErrors();
  let valid = true;

  const name = form.name.value.trim();
  if (!name) {
    showError("formName", t("form.err.nameRequired"));
    valid = false;
  }

  const email = form.email.value.trim();
  if (!email) {
    showError("formEmail", t("form.err.emailRequired"));
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError("formEmail", t("form.err.emailInvalid"));
    valid = false;
  }

  const whatsapp = form.whatsapp.value.trim();
  if (!whatsapp) {
    showError("formWhatsApp", t("form.err.whatsappRequired"));
    valid = false;
  }

  const desc = form.projectDescription.value.trim();
  if (!desc) {
    showError("formDesc", t("form.err.descRequired"));
    valid = false;
  } else if (desc.length > MAX_DESCRIPTION_LENGTH) {
    showError("formDesc", t("form.err.descTooLong", { max: MAX_DESCRIPTION_LENGTH }));
    valid = false;
  }

  return valid;
}

/* ---------- Submit ---------- */

async function handleSubmit(e) {
  e.preventDefault();
  if (!validate()) return;

  submitBtn.disabled = true;
  submitBtn.classList.add("loading");

  const payload = {
    name:               form.name.value.trim(),
    email:              form.email.value.trim(),
    whatsapp:           form.whatsapp.value.trim(),
    projectDescription: form.projectDescription.value.trim(),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(GOOGLE_SCRIPT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const result = await response.json();

    if (result.success) {
      showSuccess();
    } else {
      setSubmitError(result.message || t("form.err.sendFailed"));
    }
  } catch {
    setSubmitError(t("form.err.sendFailed"));
  } finally {
    clearTimeout(timeoutId);
  }
}

function setSubmitError(msg) {
  const errEl = document.getElementById("descError");
  const group = document.getElementById("formDesc").closest(".form-group");
  group.classList.add("error");
  errEl.textContent = msg;
  submitBtn.disabled = false;
  submitBtn.classList.remove("loading");
}

function showSuccess() {
  /* Fields are reset only after a confirmed success */
  form.reset();
  charCounter.textContent = t("form.counter", { count: 0, max: MAX_DESCRIPTION_LENGTH });
  submitBtn.disabled = false;
  submitBtn.classList.remove("loading");
  form.classList.add("hidden");
  headerEl.classList.add("hidden");
  successEl.classList.add("show");
  successEl.setAttribute("tabindex", "-1");
  successEl.focus();
}

/* ---------- Focus Trap ---------- */

function trapFocus(e) {
  if (!modal.classList.contains("open")) return;
  if (e.key !== "Tab") return;

  const focusable = modal.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;

  const first = focusable[0];
  const last  = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ---------- Init ---------- */

export function initModal() {
  cacheDom();

  /* Wire up all "Start a Project" triggers */
  document.querySelectorAll(".js-open-modal").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      openModal();
    });
  });

  /* Close handlers */
  backdrop.addEventListener("click", closeModal);
  closeBtn.addEventListener("click", closeModal);
  document.getElementById("successClose").addEventListener("click", closeModal);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && modal.classList.contains("open")) closeModal();
    trapFocus(e);
  });

  /* Character counter — derive the limit from config (single source of truth) */
  const desc = document.getElementById("formDesc");
  desc.maxLength = MAX_DESCRIPTION_LENGTH;
  charCounter.textContent = t("form.counter", { count: 0, max: MAX_DESCRIPTION_LENGTH });
  desc.addEventListener("input", () => {
    charCounter.textContent = t("form.counter", { count: desc.value.length, max: MAX_DESCRIPTION_LENGTH });
  });

  /* Re-translate the counter when the language changes */
  document.addEventListener("i18n:change", () => {
    charCounter.textContent = t("form.counter", { count: desc.value.length, max: MAX_DESCRIPTION_LENGTH });
  });

  /* Form submission */
  form.addEventListener("submit", handleSubmit);

  /* Warn if API URL not configured */
  if (GOOGLE_SCRIPT_API_URL === "URL_DU_WEB_APP") {
    console.warn("[AKKOUS] Set GOOGLE_SCRIPT_API_URL in js/config.js before deploying.");
  }
}
