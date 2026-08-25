(function () {
  const ACCEPT =
    '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg,.mp4,.mov,.avi,.mkv,.webm,.zip,.rar,.7z,.txt,.csv,image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed,*/*';

  const MAIN_TEXT = 'انقر لاختيار ملفات أو اسحب وأفلت هنا';
  const HINT_TEXT = 'مدعوم: PDF, Word, Excel, PowerPoint, صور، فيديو، ZIP وأي نوع';
  const TITLE_TEXT = 'المرفقات';
  const MAX_FILE_BYTES = 50 * 1024 * 1024;

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
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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

  function shouldSkipForm(form) {
    if (!form || form.tagName !== 'FORM') return true;
    if (form.dataset.hrAttachments === 'off') return true;
    if (form.querySelector('[data-hr-attachments-mounted="1"]')) return true;
    if (form.closest('[data-hr-attachments="off"]')) return true;
    const id = String(form.id || '').toLowerCase();
    const cls = String(form.className || '').toLowerCase();
    if (id.includes('search') || id.includes('filter') || id.includes('login')) return true;
    if (cls.includes('search') || cls.includes('filter')) return true;
    // Skip tiny filter-only forms without meaningful fields
    const controls = form.querySelectorAll('input,select,textarea').length;
    if (controls <= 1 && !form.querySelector('button[type="submit"], input[type="submit"]')) return true;
    return false;
  }

  function findInsertPoint(form) {
    const explicit = form.querySelector('[data-hr-attachments-slot]');
    if (explicit) return { parent: explicit, before: null, replace: true };

    const submitRow = form.querySelector(
      '.md\\:col-span-2.flex, .flex.justify-end, .flex.gap-2, .flex.gap-3, [class*="justify-end"]'
    );
    if (submitRow && form.contains(submitRow) && submitRow.querySelector('button[type="submit"], input[type="submit"], .btn-primary')) {
      return { parent: form, before: submitRow, replace: false };
    }

    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitBtn) {
      const row = submitBtn.closest('div') || submitBtn;
      return { parent: form, before: row, replace: false };
    }
    return { parent: form, before: null, replace: false };
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
        setStatus(section, `الملف أكبر من 50MB: ${file.name}`, 'error');
        continue;
      }
      const body = new FormData();
      body.append('file', file);
      body.append('page_path', window.location.pathname || '/hr');
      body.append('form_id', section.closest('form')?.id || '');
      try {
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

  function mountOnForm(form) {
    if (shouldSkipForm(form)) return null;
    const uid = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = createSectionMarkup(uid);
    const section = wrapper.firstElementChild;
    const point = findInsertPoint(form);
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

  function scan(root = document) {
    const forms = root.querySelectorAll ? root.querySelectorAll('form') : [];
    forms.forEach((form) => mountOnForm(form));
    root.querySelectorAll?.('[data-hr-attachments-slot]:not(:has([data-hr-attachments-mounted="1"]))').forEach((slot) => {
      const form = slot.closest('form') || slot;
      if (form.tagName === 'FORM') mountOnForm(form);
      else if (!slot.querySelector('[data-hr-attachments-mounted="1"]')) {
        const fake = document.createElement('form');
        fake.appendChild(slot.cloneNode(false));
      }
    });
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
          if (node.matches?.('form')) mountOnForm(node);
          else if (node.querySelectorAll) scan(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.HRAttachments = {
      scan,
      mountOnForm,
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
