export interface LocaleMeta {
  /** hreflang 与 Astro i18n 目录名 */
  code: string;
  /** URL 前缀，默认语言为空 */
  prefix: string;
  /** <html lang> */
  htmlLang: string;
  /** 语言自名称（语言切换菜单用） */
  name: string;
  ogLocale: string;
}

export const LOCALES: LocaleMeta[] = [
  { code: 'zh', prefix: '', htmlLang: 'zh-CN', name: '中文', ogLocale: 'zh_CN' },
  { code: 'en', prefix: '/en', htmlLang: 'en', name: 'English', ogLocale: 'en_US' },
  { code: 'es', prefix: '/es', htmlLang: 'es', name: 'Español', ogLocale: 'es_ES' },
  { code: 'ru', prefix: '/ru', htmlLang: 'ru', name: 'Русский', ogLocale: 'ru_RU' },
  { code: 'vi', prefix: '/vi', htmlLang: 'vi', name: 'Tiếng Việt', ogLocale: 'vi_VN' },
  { code: 'de', prefix: '/de', htmlLang: 'de', name: 'Deutsch', ogLocale: 'de_DE' },
];

export type LocaleCode = (typeof LOCALES)[number]['code'];

export function getLocaleMeta(code: string): LocaleMeta {
  return LOCALES.find((locale) => locale.code === code) ?? LOCALES[0];
}

/** 游戏本体只有 zh/en UI，其它语言页的「开始游戏」统一落到英文版 */
export function gameHomePath(lang: string): string {
  return lang === 'zh' ? '/' : '/en/';
}
