(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const TEMPLATE_LABEL = {};
  const STYLE_LABEL = {};
  const MAX_IMAGES = 10;
  const MAX_BYTES = Math.floor(1.5 * 1024 * 1024);

  let currentUser = null;
  let previewTimer = null;
  let dirty = false;
  let imageState = [];
  let publishedInfo = { published: false, slug: null, publicUrl: null };

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
      images: imageState.map(function (im, i) {
        return {
          id: im.id || '',
          src: im.src,
          alt: im.alt || '',
          hero: !!im.hero || (i === 0 && !imageState.some(function (x) { return x.hero; })),
          kind: im.kind || 'url'
        };
      })
    };
  }

  function setImages(list) {
    imageState = AdPageTemplates.asImages(list || []);
    renderImageList();
  }

  function renderImageList() {
    const box = $('image-list');
    if (!box) return;
    box.innerHTML = '';
    if (!imageState.length) {
      box.innerHTML = '<p class="muted">尚未加入圖片。未提供圖片時，會顯示內建示意圖。</p>';
      return;
    }
    imageState.forEach(function (im, index) {
      const row = document.createElement('div');
      row.className = 'image-item';
      const thumb = (im.src && /^(https?:|data:|blob:|\/)/i.test(im.src))
        ? '<img src="' + AdPageTemplates.escapeHtml(im.src) + '" alt="">'
        : '<div class="ph"></div>';
      const label = im.kind === 'upload' ? '已上傳' : '網址';
      row.innerHTML =
        thumb +
        '<div><div class="meta">' + AdPageTemplates.escapeHtml(label + '　' + (im.src || '').replace(/^data:.+/, '（已壓縮的上傳檔）')) + '</div>' +
        (im.hero ? '<span class="badge hero-tag">主圖</span>' : '') +
        '</div><div class="ops"></div>';
      const ops = row.querySelector('.ops');
      function addBtn(text, fn, cls) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-sm ' + (cls || 'btn-secondary');
        b.textContent = text;
        b.addEventListener('click', fn);
        ops.appendChild(b);
      }
      if (!im.hero) addBtn('設為主圖', function () {
        imageState.forEach(function (x, i) { x.hero = i === index; });
        setDirty(true); renderImageList(); schedulePreview();
      });
      if (index > 0) addBtn('上移', function () {
        var t = imageState[index - 1]; imageState[index - 1] = imageState[index]; imageState[index] = t;
        setDirty(true); renderImageList(); schedulePreview();
      });
      if (index < imageState.length - 1) addBtn('下移', function () {
        var t = imageState[index + 1]; imageState[index + 1] = imageState[index]; imageState[index] = t;
        setDirty(true); renderImageList(); schedulePreview();
      });
      addBtn('移除', function () {
        imageState.splice(index, 1);
        if (imageState.length && !imageState.some(function (x) { return x.hero; })) imageState[0].hero = true;
        setDirty(true); renderImageList(); schedulePreview();
      }, 'btn-danger');
      box.appendChild(row);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        const max = 1600;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        const scale = Math.min(1, max / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        function tryBlob(type, quality, shrink) {
          if (shrink) {
            canvas.width = Math.max(1, Math.round(canvas.width * 0.85));
            canvas.height = Math.max(1, Math.round(canvas.height * 0.85));
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          canvas.toBlob(function (blob) {
            if (!blob) {
              if (type !== 'image/jpeg') return tryBlob('image/jpeg', 0.8, false);
              return reject(new Error('無法壓縮這張圖片'));
            }
            if (blob.size > MAX_BYTES) {
              if (quality > 0.5) return tryBlob('image/jpeg', quality - 0.15, false);
              if (canvas.width > 640) return tryBlob('image/jpeg', 0.7, true);
              return reject(new Error('壓縮後仍超過 1.5 MB，請選較小的圖片'));
            }
            resolve(blob);
          }, type, quality);
        }
        const preferWebp = typeof canvas.toBlob === 'function';
        tryBlob(preferWebp ? 'image/webp' : 'image/jpeg', 0.8, false);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('無法讀取這張圖片'));
      };
      img.src = url;
    });
  }

  async function addFiles(fileList) {
    const files = [].slice.call(fileList || []);
    for (const file of files) {
      if (imageState.length >= MAX_IMAGES) {
        AdPage.toast('最多可加入 10 張圖片');
        break;
      }
      if (!file.type || file.type.indexOf('image/') !== 0) {
        AdPage.toast('請選擇圖片檔');
        continue;
      }
      try {
        const blob = await compressImage(file);
        const dataUrl = await blobToDataUrl(blob);
        const res = await AdPage.api('/api/uploads', {
          method: 'POST',
          body: { dataUrl: dataUrl, siteId: $('site-id').value || undefined }
        });
        imageState.push({
          id: res.upload.id,
          src: res.upload.url,
          alt: '',
          hero: imageState.length === 0,
          kind: 'upload'
        });
        setDirty(true);
        renderImageList();
        schedulePreview();
      } catch (e) {
        AdPage.toast(e.message || '上傳失敗');
      }
    }
    $('f-image-file').value = '';
  }

  function addUrl() {
    if (imageState.length >= MAX_IMAGES) {
      AdPage.toast('最多可加入 10 張圖片');
      return;
    }
    const src = $('f-image-url').value.trim();
    if (!/^https?:\/\//i.test(src)) {
      AdPage.toast('請輸入有效的 http 或 https 圖片網址');
      return;
    }
    imageState.push({ src: src, alt: '', hero: imageState.length === 0, kind: 'url' });
    $('f-image-url').value = '';
    setDirty(true);
    renderImageList();
    schedulePreview();
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
    setImages(data.images || []);
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
    publishedInfo = { published: false, slug: null, publicUrl: null };
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
    publishedInfo = {
      published: !!site.published,
      slug: site.slug || null,
      publicUrl: site.publicUrl || (site.published && site.slug ? (location.origin + '/s/' + site.slug) : null)
    };
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

  function renderQr(url) {
    const box = $('publish-qr');
    box.innerHTML = '';
    if (!url || typeof qrcode !== 'function') return;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      box.innerHTML = qr.createSvgTag(4, 0);
    } catch (e) {
      box.textContent = '無法產生 QR code';
    }
  }

  function showPublishResult(info) {
    publishedInfo = info || publishedInfo;
    const has = !!(publishedInfo.published && publishedInfo.publicUrl);
    $('publish-result').classList.toggle('hidden', !has);
    $('btn-unpublish').classList.toggle('hidden', !has);
    if (publishedInfo.slug) $('publish-slug').value = publishedInfo.slug;
    if (has) {
      $('publish-url').value = publishedInfo.publicUrl;
      $('btn-open-url').href = publishedInfo.publicUrl;
      renderQr(publishedInfo.publicUrl);
    }
  }

  async function openPublishModal() {
    $('publish-error').textContent = '';
    $('publish-prefix').textContent = location.origin + '/s/';
    $('publish-modal').classList.remove('hidden');
    let id = $('site-id').value;
    try {
      if (!id || dirty) {
        const site = await saveSite();
        id = site.id;
      }
      const info = await AdPage.api('/api/sites/' + encodeURIComponent(id) + '/publish-info');
      $('publish-slug').value = info.suggestedSlug || info.slug || '';
      showPublishResult(info);
    } catch (e) {
      $('publish-error').textContent = e.message;
    }
  }

  async function confirmPublish() {
    $('publish-error').textContent = '';
    try {
      if (!$('site-id').value || dirty) await saveSite();
      const id = $('site-id').value;
      const data = await AdPage.api('/api/sites/' + encodeURIComponent(id) + '/publish', {
        method: 'POST',
        body: { slug: $('publish-slug').value.trim().toLowerCase() }
      });
      showPublishResult(data);
      AdPage.toast('已發佈官網連結');
    } catch (e) {
      $('publish-error').textContent = e.message;
    }
  }

  async function confirmUnpublish() {
    if (!confirm('確定取消發佈？公開網址將暫時無法開啟。')) return;
    $('publish-error').textContent = '';
    try {
      const id = $('site-id').value;
      const data = await AdPage.api('/api/sites/' + encodeURIComponent(id) + '/unpublish', { method: 'POST', body: {} });
      showPublishResult(data);
      AdPage.toast('已取消發佈');
    } catch (e) {
      $('publish-error').textContent = e.message;
    }
  }

  async function copyPublicUrl() {
    const url = $('publish-url').value;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      AdPage.toast('已複製網址');
    } catch (e) {
      $('publish-url').select();
      document.execCommand('copy');
      AdPage.toast('已複製網址');
    }
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
        const pub = site.published
          ? '<span class="badge publish-badge">已發佈</span>'
          : '<span class="badge neutral">未發佈</span>';
        el.innerHTML =
          '<div class="badges"><span class="badge">' + AdPageTemplates.escapeHtml(templateName(site.template)) +
          '</span><span class="badge neutral">' + AdPageTemplates.escapeHtml(styleName(site.style)) + '</span>' + pub + '</div>' +
          '<h3></h3>' +
          '<p class="muted">更新：' + AdPage.formatTime(site.updatedAt || site.createdAt) + '（台灣時間）</p>' +
          (site.publicUrl ? '<p class="muted"><a href="' + AdPageTemplates.escapeHtml(site.publicUrl) + '" target="_blank" rel="noopener">官網連結</a></p>' : '') +
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
        viewBtn.textContent = site.published ? '官網' : '開啟';
        viewBtn.href = site.publicUrl || ('/p/' + encodeURIComponent(site.id));
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
    $('btn-publish').addEventListener('click', () => openPublishModal().catch((e) => AdPage.toast(e.message)));
    $('btn-publish-confirm').addEventListener('click', () => confirmPublish());
    $('btn-unpublish').addEventListener('click', () => confirmUnpublish());
    $('btn-publish-close').addEventListener('click', () => $('publish-modal').classList.add('hidden'));
    $('publish-modal').addEventListener('click', (e) => {
      if (e.target === $('publish-modal')) $('publish-modal').classList.add('hidden');
    });
    $('btn-copy-url').addEventListener('click', () => copyPublicUrl());
    $('f-image-file').addEventListener('change', (e) => addFiles(e.target.files));
    $('btn-add-url').addEventListener('click', addUrl);
    $('f-image-url').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); addUrl(); }
    });
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
