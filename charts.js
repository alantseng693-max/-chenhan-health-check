(() => {
  'use strict';
  window.CH = window.CH || {};
  const { Config, Utils } = window.CH;
  function shortDomain(d) { return ({ '法律風險': '法律', '財務風險': '財務', '成長動能': '成長', '智權與政府補助': '智權補助', '資產風險': '資產' })[d] || d; }
  function radarSVG(scores) {
    const cx = 150, cy = 145, r = 100, levels = 4;
    const values = Config.domains.map(d => Utils.clamp(scores[d] ?? 0, 0, 100) / 100);
    const point = (i, ratio) => { const angle = -Math.PI / 2 + i * 2 * Math.PI / 5; return [cx + Math.cos(angle) * r * ratio, cy + Math.sin(angle) * r * ratio]; };
    const polys = []; for (let l = 1; l <= levels; l++) polys.push(Config.domains.map((_, i) => point(i, l / levels).join(',')).join(' '));
    const axes = Config.domains.map((_, i) => { const p = point(i, 1); return `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}"/>`; }).join('');
    const valuePoly = Config.domains.map((_, i) => point(i, values[i]).join(',')).join(' ');
    const labels = Config.domains.map((d, i) => { const p = point(i, 1.24); return `<text class="radar-label" text-anchor="middle" x="${p[0]}" y="${p[1]}">${shortDomain(d)}</text>`; }).join('');
    const textAlt = Config.domains.map(d => `${d}${scores[d] ?? '不適用'}分`).join('、');
    return `<div class="chart-with-alt"><svg class="radar" viewBox="0 0 300 290" role="img" aria-label="五大面向風險雷達圖：${textAlt}">${polys.map(p => `<polygon class="radar-grid" points="${p}"/>`).join('')}${axes}<polygon class="radar-value" points="${valuePoly}"/>${labels}</svg><p class="sr-only">${textAlt}</p></div>`;
  }
  window.CH.Charts = { radarSVG, shortDomain };
})();
