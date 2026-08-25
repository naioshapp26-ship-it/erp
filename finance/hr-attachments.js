(function () {
  const ACCEPT =
    '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.mp4,.mov,.avi,.mkv,.webm,.zip,.rar,.7z,.txt,.csv,image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed,*/*';

  const MAIN_TEXT = 'انقر لاختيار ملفات أو اسحب وأفلت هنا';
  const HINT_TEXT = 'مدعوم: PDF, Word, Excel, PowerPoint, صور، فيديو، ZIP وأي نوع';
  const TITLE_TEXT = 'المرفقات';
  // Large HR videos / RAR archives (2GB)
  const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;

  function apiHeaders() {
    return {
      'x-entity-type': 'HQ',
      'x-entity-id': 'HQ001'
    };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  function fileIcon(fileName = '') {
    const name = String(fileName).toLowerCase();
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return 'fa-image';
    if (/\.(mp4|mov|avi|mkv|webm)$/.test(name)) return 'fa-video';
    if (/\.(zip|rar|7z)$/.test(name)) return 'fa-file-zipper';
    if (/\.(pdf)$/.test(name)) return 'fa-file-pdf';
    if (/\.(docx?)$/.test(name)) return 'fa-file-word';
    if (/\.(xlsx?|csv)$/.test(name)) return 'fa-file-excel';
    if (/\.(pptx?)$/.test(name)) return 'fa-file-powerpoint';
    return 'fa-paperclip';
  }

  function createSectionMarkup(uid) {
    return `
      <div class="hr-attachments-section" data-hr-attachments-mounted="1" data-att-uid="${uid}">
        <label class="hr-att-title">${TITLE_TEXT}</label>
        <div class="hr-attachments-dropzone" data-dropzone>
          <div class="hr-attachments-icon" aria-hidden="true"><i class="fas fa-cloud-arrow-up"></i></div>
          <p class="hr-attachments-main">${MAIN_TEXT}</p>
          <p class="hr-attachments-hint">${HINT_TEXT}</p>
          <input class="hr-attachments-input" type="file" multiple accept="${ACCEPT}" data-file-input aria-label="${TITLE_TEXT}">
        </div>
        <ul class="hr-attachments-list" data-file-list></ul>
        <div class="hr-attachments-status" data-status hidden></div>
        <input type="hidden" name="hr_attachments_json" data-hidden-json value="[]">
      </div>`;
  }

  function countFields(el) {
    return el.querySelectorAll('input:not([type="hidden"]):not([type="search"]), select, textarea').length;
  }

  function looksLikeSearchOnly(el) {
    const id = String(el.id || '').toLowerCase();
    const cls = String(el.className || '').toLowerCase();
    if (id.includes('search') || id.includes('filter') || id.includes('login')) return true;
    if (cls.includes('search') && !cls.includes('modal')) return true;
    if (cls.includes('filter') && countFields(el) <= 2) return true;
    return false;
  }

  function shouldSkipHost(host) {
    if (!host || host.nodeType !== 1) return true;
    if (host.dataset.hrAttachments === 'off') return true;
    if (host.closest('[data-hr-attachments="off"]')) return true;
    if (host.querySelector('[data-hr-attachments-mounted="1"]')) return true;
    if (looksLikeSearchOnly(host)) return true;
    return false;
  }

  function shouldSkipForm(form) {
    if (!form || form.tagName !== 'FORM') return true;
    if (shouldSkipHost(form)) return true;
    const controls = countFields(form);
    if (controls <= 1 && !form.querySelector('button[type="submit"], input[type="submit"]')) return true;
    return false;
  }

  function isFormLikeHost(el) {
    if (shouldSkipHost(el)) return false;
    if (el.tagName === 'FORM') return !shouldSkipForm(el);
    if (countFields(el) < 2) return false;
    // Prefer modal bodies / explicit hosts
    const cls = String(el.className || '').toLowerCase();
    const id = String(el.id || '').toLowerCase();
    if (el.hasAttribute('data-hr-attachments-host')) return true;
    if (cls.includes('modal-body') || id.includes('modalbody') || id.endsWith('modalbody')) return true;
    if (cls.includes('modal') && countFields(el) >= 3) return true;
    return false;
  }

  function findInsertPoint(host) {
    const explicit = host.querySelector('[data-hr-attachments-slot]');
    if (explicit) return { parent: explicit, before: null, replace: true };

    const submitRow = host.querySelector(
      '.md\\:col-span-2.flex, .flex.justify-end, .flex.gap-2, .flex.gap-3, [class*="justify-end"], .modal-footer'
    );
    if (submitRow && host.contains(submitRow) && submitRow.querySelector('button[type="submit"], input[type="submit"], .btn-primary, button')) {
      // If footer is outside host (sibling), append inside host instead
      if (submitRow.classList.contains('modal-footer') && submitRow.parentElement !== host) {
        return { parent: host, before: null, replace: false };
      }
      return { parent: host, before: submitRow, replace: false };
    }

    const submitBtn = host.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn && host.contains(submitBtn)) {
      const row = submitBtn.closest('div') || submitBtn;
      return { parent: host, before: row, replace: false };
    }
    return { parent: host, before: null, replace: false };
  }

  function setStatus(section, message, type = '') {
    const el = section.querySelector('[data-status]');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      el.className = 'hr-attachments-status';
      return;
    }
    el.hidden = false;
    el.textContent = message;
    el.className = `hr-attachments-status${type ? ` ${type}` : ''}`;
  }

  function getFiles(section) {
    try {
      return JSON.parse(section.querySelector('[data-hidden-json]')?.value || '[]');
    } catch (_) {
      return [];
    }
  }

  function setFiles(section, files) {
    const hidden = section.querySelector('[data-hidden-json]');
    if (hidden) hidden.value = JSON.stringify(files || []);
    renderList(section, files || []);
  }

  function renderList(section, files) {
    const list = section.querySelector('[data-file-list]');
    if (!list) return;
    list.innerHTML = (files || []).map((file, index) => `
      <li class="hr-attachments-item" data-index="${index}">
        <span class="hr-attachments-item-icon"><i class="fas ${fileIcon(file.original_name || file.name)}"></i></span>
        <span class="hr-attachments-item-meta">
          <span class="hr-attachments-item-name">${escapeHtml(file.original_name || file.name || 'ملف')}</span>
          <span class="hr-attachments-item-size">${escapeHtml(formatBytes(file.size))} • ${escapeHtml(file.mime_type || file.type || 'ملف')}</span>
        </span>
        <span class="hr-attachments-item-actions">
          ${file.url ? `<a href="${escapeHtml(file.url)}" target="_blank" rel="noopener" title="فتح"><i class="fas fa-eye"></i></a>` : ''}
          <button type="button" data-remove="${index}" title="حذف"><i class="fas fa-trash"></i></button>
        </span>
      </li>
    `).join('');

    list.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = getFiles(section).filter((_, i) => String(i) !== btn.dataset.remove);
        setFiles(section, next);
        setStatus(section, next.length ? `المرفقات: ${next.length}` : '', next.length ? 'success' : '');
      });
    });
  }

  async function uploadFiles(section, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const dropzone = section.querySelector('[data-dropzone]');
    dropzone?.classList.add('is-uploading');
    setStatus(section, 'جاري رفع الملفات...');

    const uploaded = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        setStatus(section, `الملف أكبر من الحد الأقصى (2GB): ${file.name}`, 'error');
        continue;
      }
      const body = new FormData();
      body.append('file', file);
      body.append('page_path', window.location.pathname || '/hr');
      const host = section.closest('form, .modal-body, [data-hr-attachments-host]');
      body.append('form_id', host?.id || section.closest('[id]')?.id || '');
      try {
        setStatus(section, `جاري رفع: ${file.name} (${formatBytes(file.size)})...`);
        const res = await fetch('/api/hr/form-attachments', {
          method: 'POST',
          headers: apiHeaders(),
          body
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || `فشل رفع ${file.name}`);
        }
        uploaded.push(data.file);
      } catch (error) {
        setStatus(section, error.message || 'تعذر رفع الملف', 'error');
      }
    }

    dropzone?.classList.remove('is-uploading');
    if (!uploaded.length) return;
    const next = [...getFiles(section), ...uploaded];
    setFiles(section, next);
    setStatus(section, `تم رفع ${uploaded.length} ملف — الإجمالي ${next.length}`, 'success');
  }

  function bindSection(section) {
    const dropzone = section.querySelector('[data-dropzone]');
    const input = section.querySelector('[data-file-input]');
    if (!dropzone || !input || dropzone.dataset.bound === '1') return;
    dropzone.dataset.bound = '1';

    dropzone.addEventListener('click', (e) => {
      if (e.target === input) return;
      input.click();
    });
    input.addEventListener('change', () => {
      uploadFiles(section, input.files);
      input.value = '';
    });
    ['dragenter', 'dragover'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('is-dragover');
      });
    });
    ['dragleave', 'drop'].forEach((evt) => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('is-dragover');
      });
    });
    dropzone.addEventListener('drop', (e) => {
      uploadFiles(section, e.dataTransfer?.files);
    });
  }

  function mountOnHost(host) {
    if (shouldSkipHost(host)) return null;
    if (host.tagName === 'FORM' && shouldSkipForm(host)) return null;
    if (host.tagName !== 'FORM' && !isFormLikeHost(host) && !host.querySelector('[data-hr-attachments-slot]')) {
      return null;
    }
    const uid = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = createSectionMarkup(uid);
    const section = wrapper.firstElementChild;
    const point = findInsertPoint(host);
    if (point.replace) {
      point.parent.innerHTML = '';
      point.parent.appendChild(section);
    } else if (point.before && point.before.parentNode === point.parent) {
      point.parent.insertBefore(section, point.before);
    } else {
      point.parent.appendChild(section);
    }
    bindSection(section);
    return section;
  }

  function collectHosts(root = document) {
    const hosts = [];
    const seen = new Set();
    const add = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      hosts.push(el);
    };

    root.querySelectorAll?.('form').forEach(add);
    root.querySelectorAll?.('.modal-body, [class*="modal-body"], [data-hr-attachments-host]').forEach(add);
    root.querySelectorAll?.('.modal-box, .modal-overlay, .modal-backdrop, [id$="Modal"]').forEach((modal) => {
      const body = modal.querySelector('.modal-body, [class*="modal-body"]');
      if (body) add(body);
      else if (countFields(modal) >= 2) add(modal);
    });
    root.querySelectorAll?.('[data-hr-attachments-slot]').forEach((slot) => {
      add(slot.closest('form, .modal-body, [data-hr-attachments-host]') || slot.parentElement);
    });

    if (root instanceof HTMLElement) {
      if (root.matches?.('form, .modal-body, [data-hr-attachments-host]')) add(root);
    }
    return hosts;
  }

  function scan(root = document) {
    collectHosts(root).forEach((host) => mountOnHost(host));
  }

  function ensureFontAwesome() {
    if (!document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
      document.head.appendChild(link);
    }
  }

  function init() {
    if (!/^\/hr(\/|$)/.test(window.location.pathname || '')) return;
    ensureFontAwesome();
    scan(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          scan(node);
        });
        // Re-scan when modals open (class changes to show overlay)
        if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
          const el = mutation.target;
          if (el.classList.contains('open') || el.classList.contains('show') || !el.classList.contains('hidden')) {
            scan(el);
          }
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden']
    });

    // Also scan periodically lightly for late-rendered modals
    let passes = 0;
    const timer = setInterval(() => {
      scan(document);
      passes += 1;
      if (passes >= 8) clearInterval(timer);
    }, 1500);

    window.HRAttachments = {
      scan,
      mountOnHost,
      mountOnForm: mountOnHost,
      MAX_FILE_BYTES,
      getFormAttachments(form) {
        const section = form?.querySelector?.('[data-hr-attachments-mounted="1"]');
        return section ? getFiles(section) : [];
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
