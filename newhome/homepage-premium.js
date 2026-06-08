/**
 * Premium homepage animations — GSAP + ScrollTrigger
 */
(function () {
  'use strict';

  window.__homepagePremiumAnimations = true;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function parseCountValue(el) {
    const dataCount = el.getAttribute('data-count');
    const raw = dataCount != null ? String(dataCount) : (el.textContent || '').trim();
    const ascii = raw
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776));
    const match = ascii.match(/[\d][\d,٬.]*/);
    if (!match) return null;
    const token = match[0];
    const prefix = dataCount != null ? '' : raw.slice(0, match.index);
    const suffix = dataCount != null ? '' : raw.slice((match.index || 0) + token.length);
    const target = Number(ascii.replace(/[^\d]/g, ''));
    if (!Number.isFinite(target)) return null;
    return { target, token, prefix, suffix };
  }

  function formatCount(value, token) {
    const useComma = token.includes(',') || token.includes('٬');
    let formatted = useComma ? value.toLocaleString('en-US') : String(value);
    if (token.includes('٬')) formatted = formatted.replace(/,/g, '٬');
    if (/[٠-٩]/.test(token)) {
      formatted = formatted.replace(/\d/g, (d) => String.fromCharCode(1632 + Number(d)));
    } else if (/[۰-۹]/.test(token)) {
      formatted = formatted.replace(/\d/g, (d) => String.fromCharCode(1776 + Number(d)));
    }
    return formatted;
  }

  function initParticles(container, count) {
    if (!container || reduceMotion) return;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i += 1) {
      const p = document.createElement('span');
      p.className = 'hero-particle';
      const size = 2 + Math.random() * 3;
      p.style.cssText = [
        `width:${size}px`,
        `height:${size}px`,
        `left:${Math.random() * 100}%`,
        `top:${Math.random() * 100}%`,
        `opacity:${0.25 + Math.random() * 0.45}`,
      ].join(';');
      fragment.appendChild(p);
      if (typeof gsap !== 'undefined') {
        gsap.to(p, {
          y: `random(-30, 30)`,
          x: `random(-20, 20)`,
          duration: `random(4, 9)`,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: Math.random() * 2,
        });
      }
    }
    container.appendChild(fragment);
  }

  function initNavIndicator() {
    const nav = document.querySelector('body.homepage .nav-links');
    const indicator = document.getElementById('nav-active-indicator');
    if (!nav || !indicator) return;

    const links = [...nav.querySelectorAll('a')];
    const active = nav.querySelector('a.active') || links[0];
    if (!active) return;

    const move = (link) => {
      if (!link) return;
      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      const x = linkRect.left - navRect.left;
      indicator.style.width = `${linkRect.width}px`;
      indicator.style.transform = `translateX(${x}px)`;
      indicator.style.opacity = '1';
    };

    move(active);

    links.forEach((link) => {
      link.addEventListener('mouseenter', () => move(link));
      link.addEventListener('focus', () => move(link));
    });
    nav.addEventListener('mouseleave', () => move(nav.querySelector('a.active') || links[0]));
  }

  function initNavScroll() {
    const nav = document.querySelector('body.homepage .top-nav');
    if (!nav) return;
    const toggle = () => nav.classList.toggle('is-scrolled', window.scrollY > 12);
    toggle();
    window.addEventListener('scroll', toggle, { passive: true });
  }

  function initMagneticButtons() {
    if (reduceMotion) return;
    const selectors = [
      'body.homepage .auth-btn',
      'body.homepage .hero-ctas .btn',
      'body.homepage .magnetic-btn',
    ].join(', ');
    document.querySelectorAll(selectors).forEach((btn) => {
      btn.classList.add('magnetic-btn');
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.18;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.18;
        if (typeof gsap !== 'undefined') {
          gsap.to(btn, { x, y, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
        } else {
          btn.style.transform = `translate(${x}px, ${y}px)`;
        }
      });
      btn.addEventListener('mouseleave', () => {
        if (typeof gsap !== 'undefined') {
          gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
        } else {
          btn.style.transform = '';
        }
      });
    });
  }

  function initVideoHover() {
    const visual = document.querySelector('body.homepage .hero-visual');
    if (!visual) return;
    visual.addEventListener('mouseenter', () => visual.classList.add('is-glow-active'));
    visual.addEventListener('mouseleave', () => visual.classList.remove('is-glow-active'));
  }

  function initGsap() {
    if (typeof gsap === 'undefined') {
      document.body.classList.remove('premium-motion-pending');
      return;
    }

    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    document.body.classList.add('premium-motion-pending');

    const heroTl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => document.body.classList.remove('premium-motion-pending'),
    });

    if (reduceMotion) {
      gsap.set([
        '.hero-content h1',
        '.hero-content p',
        '.hero-ctas .btn',
        '.hero-stats .stat',
        '.hero-media-stack',
        '.hero-sidebar-item',
        '.hero-sidebar-group',
      ], { opacity: 1, clearProps: 'transform' });
      document.body.classList.remove('premium-motion-pending');
    } else {
      heroTl
        .from('.hero-content h1', { y: 52, opacity: 0, duration: 1.05 })
        .from('.hero-content p', { y: 34, opacity: 0, duration: 0.85 }, '-=0.65')
        .from('.hero-ctas .btn', { y: 28, opacity: 0, duration: 0.65, stagger: 0.11 }, '-=0.55')
        .from('.hero-stats .stat', { y: 40, opacity: 0, duration: 0.75, stagger: 0.1 }, '-=0.45')
        .from('.hero-media-stack', { scale: 0.9, opacity: 0, duration: 1.15, ease: 'power2.out' }, '-=0.85')
        .from('.hero-sidebar-item, .hero-sidebar-group', { x: 24, opacity: 0, duration: 0.55, stagger: 0.05 }, '-=0.75');
    }

    /* Counter animation */
    document.querySelectorAll('.hero-stats .stat strong[data-count]').forEach((el) => {
      const parsed = parseCountValue(el);
      if (!parsed) return;
      const { target, token, prefix, suffix } = parsed;
      el.textContent = `${prefix}0${suffix}`;

      if (reduceMotion) {
        el.textContent = `${prefix}${formatCount(target, token)}${suffix}`;
        return;
      }

      const counter = { val: 0 };
      gsap.to(counter, {
        val: target,
        duration: 1.6,
        ease: 'power2.out',
        delay: 0.9,
        onUpdate: () => {
          el.textContent = `${prefix}${formatCount(Math.round(counter.val), token)}${suffix}`;
        },
      });
    });

    /* Parallax */
    if (!reduceMotion && typeof ScrollTrigger !== 'undefined') {
      const hero = document.querySelector('body.homepage .hero');
      if (hero) {
        gsap.to('.hero-ambient', {
          yPercent: 18,
          ease: 'none',
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.6,
          },
        });
        gsap.to('.hero-media-stack', {
          y: -40,
          ease: 'none',
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.8,
          },
        });
        gsap.to('.hero-content', {
          y: -24,
          ease: 'none',
          scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            scrub: 0.5,
          },
        });
      }

      gsap.utils.toArray('body.homepage .reveal-on-scroll').forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 88%',
          onEnter: () => el.classList.add('is-visible'),
          once: true,
        });
      });

      gsap.utils.toArray('body.homepage #modules > section.section-head').forEach((el) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 85%',
          onEnter: () => el.classList.add('is-visible'),
          once: true,
        });
      });
    } else if (!reduceMotion && 'IntersectionObserver' in window) {
      document.querySelectorAll('body.homepage .reveal-on-scroll, body.homepage #modules > section.section-head').forEach((el) => {
        const observer = new IntersectionObserver(
          (entries, obs) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add('is-visible');
              obs.unobserve(entry.target);
            });
          },
          { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
        );
        observer.observe(el);
      });
    } else {
      document.querySelectorAll('body.homepage .reveal-on-scroll, body.homepage #modules > section.section-head').forEach((el) => {
        el.classList.add('is-visible');
      });
    }
  }

  function init() {
    initParticles(document.getElementById('hero-particles'), 28);
    initNavIndicator();
    initNavScroll();
    initMagneticButtons();
    initVideoHover();
    initGsap();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
