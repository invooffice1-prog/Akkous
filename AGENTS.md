# AGENTS.md — AKKOUS website

Pure static marketing site. No build, no framework, no package manager, no tests/lint in-repo. `css/` (15 files) + `js/` (10 ES modules) each own one responsibility; `main.js` is the only entry point.

## i18n (multi-language: en / fr / es)
Lightweight custom system. No library, no build. Rules that are easy to break:
- `js/i18n.js` owns language state, `t('key')`, DOM application, localStorage (`akkous-language`), and the `i18n:change` CustomEvent. `initI18n()` MUST run first in `main.js` (it already does).
- Dictionaries: `js/translations/{en,fr,es}.js`, each `export default`. The three MUST have identical keys (151 each) — verify with a flat-key diff after editing. Missing keys fall back to EN then to the key itself + console.warn.
- HTML text uses `data-i18n`, `data-i18n-content` (trusted markup like `<br/>`/`<em>`), `data-i18n-placeholder`, `data-i18n-title`, `data-i18n-alt`, `data-i18n-aria-label`. Set by `applyTranslations()`.
- All user-visible JS strings use `t('key')`. For widgets that render text at runtime (char counter, validation, WhatsApp link, burger aria-label), re-render on `i18n:change` — see `modal.js`, `whatsapp.js`, `nav.js`.
- `data-i18n` sets `textContent` (wipes child nodes) — if an element contains a child icon (`<i>`), wrap the translatable text in its own span with `data-i18n`.
- Language switcher: `.lang-switch` in nav (visible desktop + mobile), styled with tokens in `nav.css`; the active button gets `.is-active`. Adding a language = new dict file + add to `SUPPORTED_LANGUAGES` in `i18n.js` + a `.lang-switch__btn`.
- HTML has a small inline `<script>` that sets `<html lang>` from localStorage before render (FOUC mitigation) — keep in sync with the storage key `akkous-language`.

## Serve it
ES modules fail on `file://`. Always serve: `python -m http.server <port>` from `D:\DIGITAL STUDIO AKKOUS`, then browse that URL.

## Config (js/config.js) — single source of truth
- `GOOGLE_SCRIPT_API_URL`, `MAX_DESCRIPTION_LENGTH`, `WHATSAPP_NUMBER`.
- The description limit MUST be edited only here. `modal.js` sets `textarea.maxLength` from it and renders the counter from it. Never re-add a hardcoded `maxlength`/counter in `index.html` — it was deliberately removed.
- If `WHATSAPP_NUMBER` changes, also update the no-JS fallback `href` on the `[data-wa-cta]` anchor in `index.html` (it hardcodes the number; `whatsapp.js` overwrites it from config).

## Wiring facts not obvious from filenames
- `.js-open-modal` opens the project modal (nav, mobile menu, hero, CTA); `modal.js` handles `preventDefault`.
- `[data-wa-cta]` = "Talk to Akkous" button → WhatsApp link built from config, `target=_blank` + `rel=noopener noreferrer`.
- z-index map: modal `1000` > nav `200` > mobile-menu `110`. Hero layers: video `0` → veil `1` → grid `2` → glows `3` → particles `4` → content `5`. Keep ordering when editing hero.
- Mobile-menu breakpoint is `720px`, re-used in BOTH `responsive.css` and `nav.js` (`innerWidth > 720` auto-closes menu). Change both or they desync.
- Modal reset semantics: user input is preserved on close and reopen — `form.reset()` happens ONLY inside `showSuccess()`. Do not "fix" this back to reset-on-close; it's spec'd.

## Backend (google-apps-script.gs)
- Deployed externally by the user (Apps Script → Deploy → Web app, "Execute as Me / Anyone"). Editing the file does NOT deploy; the user must redeploy a new version manually.
- `SPREADSHEET_ID` and `ADMIN_EMAIL` are user placeholders — do not fill them in.
- `writeHeaders()` is idempotent: row-1 headers only, never overwrites existing data rows, never duplicates. Preserve that contract.
- POST contract: `Content-Type: text/plain`, JSON body `{ name, email, whatsapp, projectDescription }`, JSON response `{ success, message }`.

## Live endpoint warning
`GOOGLE_SCRIPT_API_URL` points to a REAL live Web App. Any form submission writes a row to the user's Google Sheet AND sends two real emails (admin + visitor). Do not fire casual end-to-end submit tests.

## QA (only way to verify — there is no in-repo test harness)
Playwright v1.60 already installed at `C:\Users\onouari\AppData\Local\Temp\opencode\akkous-qa\node_modules\playwright`; run `node <script>.js` from that directory. Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`. Use a fresh port (e.g. 8091) to avoid clashes. Validate: 0 console/page errors, no horizontal overflow, modal open/close + validation, menu, WhatsApp href, `prefers-reduced-motion`.

## SEO (single production URL — www.akkous.com)
- Official/only domain: `https://www.akkous.com/`. Use it for ALL external URLs: canonical, sitemap, robots Sitemap, OG/Twitter URLs, JSON-LD. Never localhost/file:// in prod metadata.
- The site is ONE URL with client-side i18n (Option B) — there are NO `/en /fr /es` pages. Therefore **hreflang does NOT apply** (no separate language URLs to reference). Do not add fake hreflang links.
- Canonical is single + self-referencing: `https://www.akkous.com/`. Language switch must NOT change it (verified). Localized SEO lives in the `meta` block of each dict (`title`, `description`, `ogTitle`, `ogDescription`, `locale`, `ogLocale`, `siteName`) and is applied by `i18n.js` on load + `i18n:change`. The indexable baseline HTML stays EN (the default) — documented, accepted limitation.
- Structured data: one `script[type="application/ld+json"][data-seo]` in `<head>` with an `@graph` of `Organization` + `WebSite` + `WebPage`. `i18n.js` localizes its name/description. NEVER invent business info (address, phone, reviews, ratings, social links) — `sameAs` is intentionally `[]`. Logo = og-image.
- Social image: `assets/og-image.png` (1200×630, real PNG generated via headless Chrome from `og-card.html`). Refresh by re-running the gen script in the QA dir if the brand changes.
- Files you must keep in sync if the URL ever changes: `index.html` (canonical, OG, twitter, JSON-LD), `robots.txt`, `sitemap.xml`.

## Conventions
- `prefers-reduced-motion` is handled in `responsive.css` AND in `reveal.js`, `particles.js`, `magnetic.js` — new interactive features must honor it too.
- Canvas particles (`particles.js`) pause via `IntersectionObserver` when off-screen; keep that pattern for any new canvases.
- Reuse design tokens from `css/tokens.css` (colors/gradients/spacing/radius/shadows); don't hardcode brand values in components.
- The user works in French (technical terms in English) — reply in French.