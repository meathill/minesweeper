import { createI18n } from 'vue-i18n'
import zh from './locales/zh.json'
import en from './locales/en.json'
import es from './locales/es.json'
import ru from './locales/ru.json'
import vi from './locales/vi.json'
import de from './locales/de.json'

export const SUPPORTED_LOCALES = ['zh', 'en', 'es', 'ru', 'vi', 'de']

const HTML_LANG = {
  zh: 'zh-CN',
  en: 'en',
  es: 'es',
  ru: 'ru',
  vi: 'vi',
  de: 'de',
}

function getInitialLocale() {
  if (typeof window !== 'undefined') {
    const prefixed = SUPPORTED_LOCALES.find((l) => l !== 'zh' && location.pathname.startsWith(`/${l}`))
    if (prefixed) return prefixed
    const saved = localStorage.getItem('locale')
    if (SUPPORTED_LOCALES.includes(saved)) return saved
    // fallback to browser language
    const navLang = navigator.language?.toLowerCase() || ''
    const matched = SUPPORTED_LOCALES.find((l) => l !== 'zh' && navLang.startsWith(l))
    if (matched) return matched
  }
  return 'zh'
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'zh',
  messages: { zh, en, es, ru, vi, de }
})

export function setLocale(locale) {
  i18n.global.locale.value = locale
  localStorage.setItem('locale', locale)
  document.documentElement.lang = HTML_LANG[locale] ?? 'zh-CN'
  // update <link rel="canonical"> and hreflang handled in App watcher
}
