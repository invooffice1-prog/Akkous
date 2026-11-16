/* ============================================================
   AKKOUS — Lightweight i18n System
   Single source of truth for language state, translations,
   DOM re-translation and localStorage persistence.

   Data attributes handled by applyTranslations():
     data-i18n              -> textContent  (plain text)
     data-i18n-content      -> innerHTML    (trusted markup: <br/>, <em>)
     data-i18n-placeholder  -> placeholder
     data-i18n-title        -> title
     data-i18n-alt          -> alt
     data-i18n-aria-label   -> aria-label
   ============================================================ */
import en from "./translations/en.js";
import fr from "./translations/fr.js";
import es from "./translations/es.js";

const DICTIONARIES = { en, fr, es };

export const SUPPORTED_LANGUAGES = ["en", "fr", "es"];
export const DEFAULT_LANGUAGE = "en";
export const LANGUAGE_STORAGE_KEY = "akkous-language";

let currentLang = DEFAULT_LANGUAGE;

/* ---------- Lookup helpers ---------- */

function lookup(path, dict) {
  return path
    .split(".")
    .reduce((node, part) => (node == null ? null : node[part]), dict);
}

function warnMissing(key, lang) {
  if (typeof console !== "undefined") {
    console.warn(`[i18n] Missing translation "${key}" in "${lang}".`);
  }
}

/* ---------- Core API ---------- */

/**
 * Central translation function. Resolves a nested key in the active
 * language, falls back to English, then to the key itself.
 * Optional {params} interpolated into "{name}" placeholders.
 * Never throws.
 */
export function t(key, params) {
  if (typeof key !== "string" || key === "") return "";

  let value = lookup(key, DICTIONARIES[currentLang]);

  if (value == null && currentLang !== DEFAULT_LANGUAGE) {
    warnMissing(key, currentLang);
    value = lookup(key, DICTIONARIES[DEFAULT_LANGUAGE]);
  }

  if (value == null) {
    warnMissing(key, DEFAULT_LANGUAGE);
    return key;
  }

  if (params) {
    value = String(value).replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(params, name) ? params[name] : match
    );
  }

  return value;
}

export function getLanguage() {
  return currentLang;
}

/* ---------- DOM application ---------- */

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });

  document.querySelectorAll("[data-i18n-content]").forEach((el) => {
    el.innerHTML = t(el.getAttribute("data-i18n-content"));
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.setAttribute("title", t(el.getAttribute("data-i18n-title")));
  });

  document.querySelectorAll("[data-i18n-alt]").forEach((el) => {
    el.setAttribute("alt", t(el.getAttribute("data-i18n-alt")));
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria-label")));
  });

  /* Head — page-aware title + meta description */
  const metaKey = document.body.dataset.page
    ? `${document.body.dataset.page}.meta`
    : "meta";
  const metaTitle = t(`${metaKey}.title`);
  const metaDescription = t(`${metaKey}.description`);

  document.title = metaTitle;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute("content", metaDescription);

  /* SEO metadata localized on language switch */
  metaContent('meta[property="og:title"]', t(`${metaKey}.ogTitle`));
  metaContent('meta[property="og:description"]', t(`${metaKey}.ogDescription`));
  metaContent('meta[property="og:locale"]', t(`${metaKey}.ogLocale`));
  metaContent('meta[property="og:site_name"]', t(`${metaKey}.siteName`));
  metaContent('meta[name="twitter:title"]', t(`${metaKey}.ogTitle`));
  metaContent('meta[name="twitter:description"]', t(`${metaKey}.ogDescription`));

  /* Localized JSON-LD (name + description) */
  const seoLd = document.querySelector('script[type="application/ld+json"][data-seo]');
  if (seoLd) {
    try {
      const graph = JSON.parse(seoLd.textContent);
      const apply = (node) => {
        if (!node || typeof node !== "object") return;
        if (node["@type"] === "Organization") {
          node.name = "AKKOUS";
          node.description = metaDescription;
        }
        if (node["@type"] === "WebSite" || node["@type"] === "WebPage") {
          node.description = metaDescription;
          node.name = metaTitle;
        }
        if (Array.isArray(node)) node.forEach(apply);
      };
      (Array.isArray(graph["@graph"]) ? graph["@graph"] : [graph]).forEach(apply);
      seoLd.textContent = JSON.stringify(graph);
    } catch (e) {
      /* leave JSON-LD untouched on parse error */
    }
  }
}

function metaContent(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute("content", value);
}

function syncSwitcherButtons() {
  document.querySelectorAll(".lang-switch__btn").forEach((btn) => {
    const active = btn.getAttribute("data-lang") === currentLang;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", String(active));
  });
}

/* ---------- Language switching ---------- */

/**
 * Switch language: persist, update <html lang>, re-translate the DOM,
 * then notify dynamic modules through a "i18n:change" CustomEvent.
 * No page reload — current page state is preserved.
 */
export function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) lang = DEFAULT_LANGUAGE;
  if (lang === currentLang) return;

  currentLang = lang;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (e) {
    /* storage unavailable (private mode / blocked) — UI still works */
  }

  document.documentElement.lang = lang;
  applyTranslations();
  syncSwitcherButtons();

  document.dispatchEvent(
    new CustomEvent("i18n:change", { detail: { lang } })
  );
}

function onSwitcherClick(btn) {
  setLanguage(btn.getAttribute("data-lang"));
}

/* ---------- Init ---------- */

function readStoredLanguage() {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : null;
  } catch (e) {
    return null;
  }
}

export function initI18n() {
  const stored = readStoredLanguage();
  currentLang = stored || DEFAULT_LANGUAGE;
  document.documentElement.lang = currentLang;
  applyTranslations();
  syncSwitcherButtons();

  document.querySelectorAll(".lang-switch__btn").forEach((btn) => {
    btn.addEventListener("click", () => onSwitcherClick(btn));
  });

  return currentLang;
}