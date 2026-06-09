(function () {
  'use strict';

  window.renderLandingHub = function renderLandingHub(config) {
    const root = document.getElementById('landing-hub-root');
    if (!root || !config) return;

    const statsHtml = (config.stats || []).map((stat) => (
      `<article class="landing-hub-stat"><strong>${stat.value}</strong><span>${stat.label}</span></article>`
    )).join('');

    const cardsHtml = (config.cards || []).map((card) => (
      `<a class="landing-hub-card" href="${card.href}">
        <span class="landing-hub-card-icon"><i class="fas ${card.icon}" aria-hidden="true"></i></span>
        <h3>${card.title}</h3>
        <p>${card.desc}</p>
        <span class="landing-hub-card-cta">${card.cta || 'فتح الصفحة'}</span>
      </a>`
    )).join('');

    const actionsHtml = (config.actions || []).map((action) => (
      `<a class="btn ${action.tone || 'primary'}" href="${action.href}">${action.label}</a>`
    )).join('');

    root.innerHTML = `
      <section class="landing-hub">
        <header class="landing-hub-head">
          <h1>${config.title}</h1>
          <p>${config.subtitle}</p>
        </header>
        ${statsHtml ? `<div class="landing-hub-stats" aria-label="إحصائيات">${statsHtml}</div>` : ''}
        <div class="landing-hub-grid" aria-label="${config.gridLabel || 'روابط الصفحة'}">${cardsHtml}</div>
        ${actionsHtml ? `<div class="landing-hub-actions">${actionsHtml}</div>` : ''}
      </section>
    `;
  };

  document.getElementById('to-top')?.addEventListener('click', () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });
})();
