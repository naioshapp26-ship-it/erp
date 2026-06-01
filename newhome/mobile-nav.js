(() => {
  const MOBILE_BREAKPOINT = 740;

  const syncMenuState = (header, isOpen) => {
    header.classList.toggle('is-mobile-nav-open', isOpen);
    const toggle = header.querySelector('.mobile-nav-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.setAttribute('aria-label', isOpen ? 'إغلاق القائمة' : 'فتح القائمة');
    }
  };

  const setupHeader = (header) => {
    if (!header || header.classList.contains('is-mobile-nav-ready')) return;

    const inner = header.querySelector('.inner');
    if (!inner) return;

    const navMain = inner.querySelector('.nav-main');
    const insertionTarget = navMain || inner;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'mobile-nav-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'mobile-nav-links');
    toggle.setAttribute('aria-label', 'فتح القائمة');
    toggle.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i><i class="fas fa-xmark" aria-hidden="true"></i>';

    insertionTarget.appendChild(toggle);
    header.classList.add('is-mobile-nav-ready');

    const closeMenu = () => syncMenuState(header, false);

    toggle.addEventListener('click', () => {
      const nextState = !header.classList.contains('is-mobile-nav-open');
      syncMenuState(header, nextState);
    });

    header.querySelectorAll('.nav-links a, .auth-actions a').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    header.querySelectorAll('.nav-dropdown-menu a').forEach((link) => {
      link.addEventListener('click', closeMenu);
    });

    const mediaQuery = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT + 1}px)`);
    const handleViewportChange = (event) => {
      if (event.matches) {
        closeMenu();
      }
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleViewportChange);
    } else if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleViewportChange);
    }
  };

  document.querySelectorAll('.top-nav').forEach(setupHeader);
})();
