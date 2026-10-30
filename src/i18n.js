import { createI18n } from 'vue-i18n';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import vi from './locales/vi.json';
import zh from './locales/zh.json';
import { HTML_LANG, LOCALES, localeFromPath } from './seo-meta.js';

export const SUPPORTED_LOCALES = LOCALES.map((l) => l.code);
export { HTML_LANG };

function getInitialLocale() {
  if (typeof window === 'undefined') return 'zh';
  return localeFromPath(window.location.pathname);
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'zh',
  messages: { zh, en, es, ru, vi, de, pt, fr },
});

export function setLocale(locale) {
  i18n.global.locale.value = locale;
  localStorage.setItem('locale', locale);
  document.documentElement.lang = HTML_LANG[locale] ?? 'zh-CN';
  // update <link rel="canonical"> and hreflang handled in App watcher
}
