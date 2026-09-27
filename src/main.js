import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import './style/index.css';
import 'colors.css/src/_variables.css';
import { i18n, setLocale } from './i18n.js';

// set initial html lang
const HTML_LANG_MAP = {
  zh: 'zh-CN',
  en: 'en',
  es: 'es',
  ru: 'ru',
  vi: 'vi',
  de: 'de',
};
document.documentElement.lang =
  HTML_LANG_MAP[i18n.global.locale.value] ?? 'zh-CN';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(i18n);
app.mount('#app');

// expose for debugging
if (typeof window !== 'undefined') window.__setLocale = setLocale;
