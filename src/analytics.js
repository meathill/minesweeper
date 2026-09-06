//  analytics 打点：GA4 gtag 包一层 try/catch，无痕/屏蔽插件下不抛错。
export function trackEvent(name, params = {}) {
  try {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', name, params);
    }
  } catch (e) {}
}
