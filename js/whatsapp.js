/* ============================================================
   AKKOUS — WhatsApp "Talk to Akkous" button
   ============================================================ */
import { WHATSAPP_NUMBER } from "./config.js";
import { t } from "./i18n.js";

/** Builds the wa.me link from the active language's prefilled message. */
function buildWhatsAppUrl() {
  const baseUrl = `https://wa.me/${WHATSAPP_NUMBER}`;
  const text = encodeURIComponent(t("whatsapp.message"));
  return `${baseUrl}?text=${text}`;
}

export function initWhatsApp() {
  const cta = document.querySelector("[data-wa-cta]");
  if (!cta) return;

  const apply = () => {
    cta.setAttribute("href", buildWhatsAppUrl());
    cta.setAttribute("target", "_blank");
    cta.setAttribute("rel", "noopener noreferrer");
  };

  apply();

  /* Rebuild the link when the language changes (message is translated) */
  document.addEventListener("i18n:change", apply);
}