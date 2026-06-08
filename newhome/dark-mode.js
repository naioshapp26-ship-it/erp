/* Dark Mode JS — newhome
 * - Reads/saves preference in localStorage under key "theme"
 * - Applies body.dark-mode class
 * - Injects toggle button into every .top-nav found on the page
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'theme';
  var DARK_CLASS  = 'dark-mode';

  /* ── Apply / remove dark class ─────────────────────── */
  function applyTheme(isDark) {
    document.body.classList.toggle(DARK_CLASS, isDark);
    /* Update all toggle buttons on the page */
    document.querySelectorAll('.dark-mode-toggle').forEach(function (btn) {
      btn.setAttribute('aria-label', isDark ? 'تبديل إلى الوضع الفاتح' : 'تبديل إلى الوضع الداكن');
      btn.setAttribute('title',      isDark ? 'الوضع الفاتح' : 'الوضع الداكن');
      btn.textContent = isDark ? '☀️' : '🌙';
    });
  }

  /* ── Toggle ─────────────────────────────────────────── */
  function toggle() {
    var isDark = !document.body.classList.contains(DARK_CLASS);
    applyTheme(isDark);
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch (_) {}
  }

  /* ── Create toggle button ───────────────────────────── */
  function createButton() {
    var isDarkNow = document.body.classList.contains(DARK_CLASS);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dark-mode-toggle';
    btn.textContent = isDarkNow ? '☀️' : '🌙';
    btn.setAttribute('aria-label', isDarkNow ? 'تبديل إلى الوضع الفاتح' : 'تبديل إلى الوضع الداكن');
    btn.setAttribute('title', isDarkNow ? 'الوضع الفاتح' : 'الوضع الداكن');
    btn.addEventListener('click', toggle);
    return btn;
  }

  /* ── Inject into navbars ────────────────────────────── */
  function injectButtons() {
    /* Prefer the auth shell so the toggle stays visible with the dropdown trigger */
    var authShells = document.querySelectorAll('.auth-actions-shell');
    if (authShells.length > 0) {
      authShells.forEach(function (container) {
        if (!container.querySelector('.dark-mode-toggle')) {
          var toggle = container.querySelector('.auth-actions-toggle');
          if (toggle) {
            container.insertBefore(createButton(), toggle);
          } else {
            container.insertBefore(createButton(), container.firstChild);
          }
        }
      });
      return;
    }

    /* Fallback: inject directly into .auth-actions */
    var authContainers = document.querySelectorAll('.auth-actions');
    if (authContainers.length > 0) {
      authContainers.forEach(function (container) {
        if (!container.querySelector('.dark-mode-toggle')) {
          container.insertBefore(createButton(), container.firstChild);
        }
      });
      return;
    }

    /* Fallback: inject into .top-nav .container.inner or .top-nav .container */
    var navContainers = document.querySelectorAll('.top-nav .container.inner, .top-nav .container');
    navContainers.forEach(function (container) {
      if (!container.querySelector('.dark-mode-toggle')) {
        var btn = createButton();
        btn.style.marginInlineStart = 'auto';
        container.appendChild(btn);
      }
    });
  }

  /* ── Initialise on page load ────────────────────────── */
  function init() {
    var saved;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      saved = null;
    }
    var isDark = saved === 'dark';
    applyTheme(isDark);
    injectButtons();
    /* Re-apply after injection so newly created buttons get the right icon */
    applyTheme(isDark);
  }

  /* Run as early as possible but after DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
