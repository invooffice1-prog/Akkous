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
  const ctas = document.querySelectorAll("[data-wa-cta]");
  if (!ctas.length) return;

  const apply = () => {
    const url = buildWhatsAppUrl();
    ctas.forEach((cta) => {
      cta.setAttribute("href", url);
      cta.setAttribute("target", "_blank");
      cta.setAttribute("rel", "noopener noreferrer");
    });
  };

  apply();

  /* Rebuild the links when the language changes (message is translated) */
  document.addEventListener("i18n:change", apply);
}