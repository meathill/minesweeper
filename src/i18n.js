import { createI18n } from 'vue-i18n'
import zh from './locales/zh.json'
import en from './locales/en.json'

function getInitialLocale() {
  if (typeof window !== 'undefined') {
    if (location.pathname.startsWith('/en')) return 'en'
    const saved = localStorage.getItem('locale')
    if (saved === 'en' || saved === 'zh') return saved
    // fallback to browser language
    const navLang = navigator.language?.toLowerCase() || ''
    if (navLang.startsWith('en')) return 'en'
  }
  return 'zh'
}

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'zh',
  messages: { zh, en }
})

export function setLocale(locale) {
  i18n.global.locale.value = locale
  localStorage.setItem('locale', locale)
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN'
  // update <link rel="canonical"> and hreflang handled in App watcher
}
