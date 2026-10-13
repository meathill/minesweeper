// 构建期注入 GA4。Measurement ID 只来自环境变量，不写进仓库，也不打进日志。

const MEASUREMENT_ID = /^G-[A-Z0-9]+$/;
const GA_BLOCK = /[ \t]*<!-- ga:start -->[\s\S]*?<!-- ga:end -->\n?/;

export function readGoogleAnalyticsId(env = process.env) {
  const raw = env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
  if (raw == null || raw.trim() === '') return '';
  const id = raw.trim();
  if (!MEASUREMENT_ID.test(id)) {
    throw new Error(
      'NEXT_PUBLIC_GOOGLE_ANALYTICS_ID 格式应为 G- 后接字母数字，已拒绝注入',
    );
  }
  return id;
}

export function applyGoogleAnalytics(html, measurementId) {
  if (!html.includes('<!-- ga:start -->')) return html;
  if (!measurementId) return html.replace(GA_BLOCK, '');
  return html.replaceAll('__GA_ID__', measurementId);
}
