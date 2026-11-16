(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const TEMPLATE_LABEL = {};
  const STYLE_LABEL = {};

  let currentUser = null;
  let previewTimer = null;
  let dirty = false;

  function collectForm() {
    return {
      name: $('f-name').value.trim(),
      template: $('f-template').value,
      style: $('f-style').value,
      customPrimary: $('f-primary-text').value.trim() || $('f-primary').value,
      brandName: $('f-brand').value,
      productName: $('f-product').value,
      tagline: $('f-tagline').value,
      description: $('f-desc').value,
      features: $('f-features').value,
      price: $('f-price').value,
      originalPrice: $('f-original').value,
      offer: $('f-offer').value,
      ctaText: $('f-cta').value,
      ctaLink: $('f-cta-link').value,
      phone: $('f-phone').value,
      email: $('f-email').value,
      address: $('f-address').value,
      contact: $('f-contact').value,
      eventDate: $('f-event-date').value,
      eventLocation: $('f-event-loc').value,
      images: $('f-images').value
    };
  }

  function fillForm(data, name) {
    data = data || {};
    if (name != null) $('f-name').value = name;
    else if (data.name) $('f-name').value = data.name;
    $('f-template').value = data.template || AdPageSamples.DEFAULT_TEMPLATE;
    $('f-style').value = data.style || AdPageSamples.DEFAULT_STYLE;
    const color = data.customPrimary || AdPageSamples.DEFAULT_PRIMARY;
    $('f-primary').value = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? color : '#1d4ed8';
    $('f-primary-text').value = $('f-primary').value;
    $('f-brand').value = data.brandName || '';
    $('f-product').value = data.productName || '';
    $('f-tagline').value = data.tagline || '';
    $('f-desc').value = data.description || '';
    $('f-features').value = Array.isArray(data.features) ? data.features.join('\n') : (data.features || '');
    $('f-price').value = data.price || '';
    $('f-original').value = data.originalPrice || '';
    $('f-offer').value = data.offer || '';
    $('f-cta').value = data.ctaText || '';
    $('f-cta-link').value = data.ctaLink || '#contact';
    $('f-phone').value = data.phone || '';
    $('f-email').value = data.email || '';
    $('f-address').value = data.address || '';
    $('f-contact').value = data.contact || '';
    $('f-event-date').value = data.eventDate || '';
    $('f-event-loc').value = data.eventLocation || '';
    $('f-images').value = Array.isArray(data.images) ? data.images.join('\n') : (data.images || '');
  }

  function setDirty(v) {
    dirty = v;
    $('save-status').textContent = v ? '有尚未儲存的變更' : ($('site-id').value ? '已儲存' : '尚未儲存');
  }

  function refreshPreview() {
    const html = AdPageTemplates.render(collectForm());
    const iframe = $('preview');
    iframe.srcdoc = html;
  }

  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 180);
  }

  function showDashboard() {
    $('view-dashboard').classList.remove('hidden');
    $('view-builder').classList.add('hidden');
    loadSites();
  }

  function showBuilder() {
    $('view-dashboard').classList.add('hidden');
    $('view-builder').classList.remove('hidden');
    refreshPreview();
  }

  function defaultName(data) {
    return (data.productName || data.brandName || '未命名網站').slice(0, 80);
  }

  function loadSample(templateId) {
    const sample = AdPageSamples.forTemplate(templateId || $('f-template').value);
    const keepName = $('f-name').value.trim();
    fillForm(sample, keepName || defaultName(sample));
    setDirty(true);
    refreshPreview();
  }

  function startNew() {
    $('site-id').value = '';
    $('builder-title').textContent = '新增網站';
    loadSample(AdPageSamples.DEFAULT_TEMPLATE);
    $('f-name').value = defaultName(collectForm());
    setDirty(true);
    showBuilder();
  }

  async function openSite(id) {
    const data = await AdPage.api('/api/sites/' + encodeURIComponent(id));
    const site = data.site;
    $('site-id').value = site.id;
    $('builder-title').textContent = '編輯網站';
    fillForm(Object.assign({}, site.data, {
      template: site.template,
      style: site.style,
      customPrimary: site.customPrimary || (site.data && site.data.customPrimary)
    }), site.name);
    setDirty(false);
    showBuilder();
  }

  async function saveSite() {
    const body = collectForm();
    if (!body.name) body.name = defaultName(body);
    $('f-name').value = body.name;
    const id = $('site-id').value;
    const data = id
      ? await AdPage.api('/api/sites/' + encodeURIComponent(id), { method: 'PUT', body: body })
      : await AdPage.api('/api/sites', { method: 'POST', body: body });
    $('site-id').value = data.site.id;
    $('builder-title').textContent = '編輯網站';
    setDirty(false);
    AdPage.toast('已儲存');
    return data.site;
  }

  async function exportFile(kind) {
    const body = collectForm();
    if (!body.name) body.name = defaultName(body);
    const filename = kind === 'zip' ? 'index.zip' : 'index.html';
    await AdPage.downloadPost('/api/export/' + kind, body, filename);
    AdPage.toast(kind === 'zip' ? '已匯出 ZIP' : '已匯出 HTML');
  }

  function templateName(id) {
    return TEMPLATE_LABEL[id] || id;
  }
  function styleName(id) {
    return STYLE_LABEL[id] || id;
  }

  async function loadSites() {
    const box = $('site-list');
    box.innerHTML = '<p class="muted">載入中…</p>';
    try {
      const data = await AdPage.api('/api/sites');
      if (!data.sites.length) {
        box.innerHTML = '<div class="card empty-state"><p>還沒有網站。點右上角「新增網站」開始，也可先載入益芳封口機的示例內容。</p></div>';
        return;
      }
      box.innerHTML = '';
      data.sites.forEach((site) => {
        const el = document.createElement('article');
        el.className = 'card site-card';
        el.innerHTML =
          '<div class="badges"><span class="badge">' + AdPageTemplates.escapeHtml(templateName(site.template)) +
          '</span><span class="badge neutral">' + AdPageTemplates.escapeHtml(styleName(site.style)) + '</span></div>' +
          '<h3></h3>' +
          '<p class="muted">更新：' + AdPage.formatTime(site.updatedAt || site.createdAt) + '（台灣時間）</p>' +
          '<div class="card-actions"></div>';
        el.querySelector('h3').textContent = site.name;
        const actions = el.querySelector('.card-actions');
        const edit = document.createElement('button');
        edit.className = 'btn btn-sm';
        edit.textContent = '編輯';
        edit.addEventListener('click', () => openSite(site.id).catch((e) => AdPage.toast(e.message)));
        const htmlBtn = document.createElement('a');
        htmlBtn.className = 'btn btn-sm btn-secondary';
        htmlBtn.textContent = 'HTML';
        htmlBtn.href = '/api/sites/' + encodeURIComponent(site.id) + '/export.html';
        const zipBtn = document.createElement('a');
        zipBtn.className = 'btn btn-sm btn-secondary';
        zipBtn.textContent = 'ZIP';
        zipBtn.href = '/api/sites/' + encodeURIComponent(site.id) + '/export.zip';
        const viewBtn = document.createElement('a');
        viewBtn.className = 'btn btn-sm btn-secondary';
        viewBtn.textContent = '開啟';
        viewBtn.href = '/p/' + encodeURIComponent(site.id);
        viewBtn.target = '_blank';
        const del = document.createElement('button');
        del.className = 'btn btn-sm btn-danger';
        del.textContent = '刪除';
        del.addEventListener('click', async () => {
          if (!confirm('確定刪除「' + site.name + '」？此動作無法復原。')) return;
          try {
            await AdPage.api('/api/sites/' + encodeURIComponent(site.id), { method: 'DELETE' });
            AdPage.toast('已刪除');
            loadSites();
          } catch (e) { AdPage.toast(e.message); }
        });
        actions.append(edit, viewBtn, htmlBtn, zipBtn, del);
        box.appendChild(el);
      });
    } catch (e) {
      box.innerHTML = '<p class="form-error">' + AdPageTemplates.escapeHtml(e.message) + '</p>';
    }
  }

  function populateSelects() {
    const tSel = $('f-template');
    const sSel = $('f-style');
    tSel.innerHTML = '';
    sSel.innerHTML = '';
    AdPageTemplates.TEMPLATES.forEach((t) => {
      TEMPLATE_LABEL[t.id] = t.name;
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name + ' — ' + t.desc;
      tSel.appendChild(opt);
    });
    AdPageTemplates.STYLES.forEach((s) => {
      STYLE_LABEL[s.id] = s.name;
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      sSel.appendChild(opt);
    });
  }

  async function init() {
    populateSelects();
    currentUser = await AdPage.requireUser();
    if (!currentUser) return;
    $('user-chip').textContent = currentUser.name + '（' + currentUser.email + '）';
    if (currentUser.role === 'admin') $('admin-link').classList.remove('hidden');
    $('btn-logout').addEventListener('click', () => AdPage.logout());
    $('btn-new').addEventListener('click', startNew);
    $('btn-back').addEventListener('click', () => {
      if (dirty && !confirm('有尚未儲存的變更，確定返回列表？')) return;
      showDashboard();
    });
    $('btn-sample').addEventListener('click', () => loadSample($('f-template').value));
    $('btn-save').addEventListener('click', () => saveSite().catch((e) => AdPage.toast(e.message)));
    $('btn-export-html').addEventListener('click', () => exportFile('html').catch((e) => AdPage.toast(e.message)));
    $('btn-export-zip').addEventListener('click', () => exportFile('zip').catch((e) => AdPage.toast(e.message)));
    $('prev-desktop').addEventListener('click', () => {
      $('prev-desktop').classList.add('active');
      $('prev-mobile').classList.remove('active');
      $('preview-wrap').classList.remove('mobile');
    });
    $('prev-mobile').addEventListener('click', () => {
      $('prev-mobile').classList.add('active');
      $('prev-desktop').classList.remove('active');
      $('preview-wrap').classList.add('mobile');
    });
    $('f-primary').addEventListener('input', () => { $('f-primary-text').value = $('f-primary').value; });
    $('f-primary-text').addEventListener('input', () => {
      if (/^#([0-9a-fA-F]{6})$/.test($('f-primary-text').value.trim())) {
        $('f-primary').value = $('f-primary-text').value.trim();
      }
    });
    $('builder-form').addEventListener('input', () => { setDirty(true); schedulePreview(); });
    $('builder-form').addEventListener('change', () => { setDirty(true); schedulePreview(); });
    showDashboard();
  }

  init().catch((e) => AdPage.toast(e.message || '載入失敗'));
})();
