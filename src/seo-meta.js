// locale -> URL + SEO 元信息：全站语言定义的唯一来源（App.vue 只消费）。
export const LOCALES = [
  { code: 'zh', label: '中文', path: '/' },
  { code: 'en', label: 'English', path: '/en/' },
  { code: 'es', label: 'Español', path: '/es/' },
  { code: 'ru', label: 'Русский', path: '/ru/' },
  { code: 'vi', label: 'Tiếng Việt', path: '/vi/' },
  { code: 'de', label: 'Deutsch', path: '/de/' },
];

export const HTML_LANG = {
  zh: 'zh-CN',
  en: 'en',
  es: 'es',
  ru: 'ru',
  vi: 'vi',
  de: 'de',
};

export function updateSeoMeta(loc, t) {
  const homePath = LOCALES.find((item) => item.code === loc)?.path ?? '/';
  const homeUrl = `https://minesweeper.meathill.com${homePath}`;
  document.title = t('meta.title');
  const desc = t('meta.description');
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', desc);
  document
    .querySelector('link[rel="canonical"]')
    ?.setAttribute('href', homeUrl);
  document
    .querySelector('meta[property="og:url"]')
    ?.setAttribute('content', homeUrl);
  document
    .querySelector('meta[property="og:title"]')
    ?.setAttribute('content', t('meta.ogTitle'));
  document
    .querySelector('meta[property="og:description"]')
    ?.setAttribute('content', t('meta.ogDescription'));
  document
    .querySelector('meta[name="twitter:title"]')
    ?.setAttribute('content', t('meta.ogTitle'));
  document
    .querySelector('meta[name="twitter:description"]')
    ?.setAttribute('content', t('meta.twitterDescription'));
  document.documentElement.lang = HTML_LANG[loc] ?? 'zh-CN';
  // hreflang 全语言互指
  for (const { code, path } of LOCALES) {
    let link = document.querySelector(`link[hreflang="${code}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = code;
      document.head.appendChild(link);
    }
    link.href = `https://minesweeper.meathill.com${path}`;
  }
  let linkX = document.querySelector('link[hreflang="x-default"]');
  if (!linkX) {
    linkX = document.createElement('link');
    linkX.rel = 'alternate';
    linkX.hreflang = 'x-default';
    document.head.appendChild(linkX);
  }
  linkX.href = 'https://minesweeper.meathill.com/';
}
