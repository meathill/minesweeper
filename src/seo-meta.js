// locale -> URL + SEO 元信息：全站语言定义的唯一来源（App.vue 只消费）。
export const LOCALES = [
  { code: 'zh', label: '中文', path: '/' },
  { code: 'en', label: 'English', path: '/en/' },
  { code: 'es', label: 'Español', path: '/es/' },
  { code: 'ru', label: 'Русский', path: '/ru/' },
  { code: 'vi', label: 'Tiếng Việt', path: '/vi/' },
  { code: 'de', label: 'Deutsch', path: '/de/' },
  { code: 'pt', label: 'Português', path: '/pt/' },
  { code: 'fr', label: 'Français', path: '/fr/' },
];

export const HTML_LANG = {
  zh: 'zh-CN',
  en: 'en',
  es: 'es',
  ru: 'ru',
  vi: 'vi',
  de: 'de',
  pt: 'pt-BR',
  fr: 'fr',
};

/** 游戏壳的语言只看路径。浏览器语言和 localStorage 不能改 canonical。 */
export function localeFromPath(pathname) {
  const path = pathname || '/';
  const prefixed = LOCALES.find((item) => {
    if (item.code === 'zh') return false;
    const prefix = `/${item.code}`;
    return path === prefix || path.startsWith(`${prefix}/`);
  });
  return prefixed?.code ?? 'zh';
}

export function updateSeoMeta(loc, t) {
  const isUnblocked =
    typeof window !== 'undefined' &&
    window.location.pathname.includes('/unblocked');
  const homePath = LOCALES.find((item) => item.code === loc)?.path ?? '/';
  const pagePath = isUnblocked
    ? loc === 'zh'
      ? '/unblocked/'
      : `/${loc}/unblocked/`
    : homePath;
  const pageUrl = `https://minesweeper.meathill.com${pagePath}`;
  const title = isUnblocked ? t('unblocked.title') : t('meta.title');
  const desc = isUnblocked ? t('unblocked.description') : t('meta.description');
  const ogTitle = isUnblocked ? t('unblocked.ogTitle') : t('meta.ogTitle');
  const ogDesc = isUnblocked
    ? t('unblocked.ogDescription')
    : t('meta.ogDescription');

  document.title = title;
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute('content', desc);
  document
    .querySelector('link[rel="canonical"]')
    ?.setAttribute('href', pageUrl);
  document
    .querySelector('meta[property="og:url"]')
    ?.setAttribute('content', pageUrl);
  document
    .querySelector('meta[property="og:title"]')
    ?.setAttribute('content', ogTitle);
  document
    .querySelector('meta[property="og:description"]')
    ?.setAttribute('content', ogDesc);
  document
    .querySelector('meta[name="twitter:title"]')
    ?.setAttribute('content', ogTitle);
  document
    .querySelector('meta[name="twitter:description"]')
    ?.setAttribute('content', ogDesc);
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
    const targetPath = isUnblocked
      ? code === 'zh'
        ? '/unblocked/'
        : `/${code}/unblocked/`
      : path;
    link.href = `https://minesweeper.meathill.com${targetPath}`;
  }
  let linkX = document.querySelector('link[hreflang="x-default"]');
  if (!linkX) {
    linkX = document.createElement('link');
    linkX.rel = 'alternate';
    linkX.hreflang = 'x-default';
    document.head.appendChild(linkX);
  }
  linkX.href = isUnblocked
    ? 'https://minesweeper.meathill.com/unblocked/'
    : 'https://minesweeper.meathill.com/';
}
