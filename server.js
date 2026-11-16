'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const archiver = require('archiver');

const store = require('./src/store');
const templates = require('./src/templates');
const media = require('./src/media');
const FileSessionStore = require('./src/session-store');

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-change-me-in-production';
const PUBLIC_DIR = path.join(__dirname, 'public');

store.ensureDir();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use((req, res, next) => {
  if (req.path === '/api/admin/restore') {
    return express.json({ limit: '50mb' })(req, res, next);
  }
  return express.json({ limit: '3mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: false }));

app.use(
  session({
    name: 'adpage.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new FileSessionStore({ dir: path.join(store.DATA_DIR, 'sessions') }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    disabled: !!u.disabled,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || null,
  };
}

function isAdminEmail(email) {
  return !!(ADMIN_EMAIL && String(email || '').trim().toLowerCase() === ADMIN_EMAIL);
}

function applyAdminFlag(user) {
  if (user && isAdminEmail(user.email) && user.role !== 'admin') {
    user.role = 'admin';
  }
  return user;
}

async function logActivity(req, type, meta) {
  const entry = {
    id: store.id(),
    type,
    userId: (req.session && req.session.userId) || null,
    email: (req.session && req.session.email) || (meta && meta.email) || null,
    meta: meta || {},
    ip: req.ip || '',
    createdAt: store.nowIso(),
  };
  try {
    await store.appendActivity(entry);
  } catch (err) {
    console.error('activity log failed', err);
  }
}

function findUserById(id) {
  return store.users().find((u) => u.id === id) || null;
}

function findUserByEmail(email) {
  const key = String(email || '').trim().toLowerCase();
  return store.users().find((u) => u.email === key) || null;
}

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ ok: false, error: '請先登入' });
  }
  const user = findUserById(req.session.userId);
  if (!user || user.disabled) {
    req.session.destroy(() => {});
    return res.status(401).json({ ok: false, error: '帳號不存在或已停用' });
  }
  applyAdminFlag(user);
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: '需要管理員權限' });
    }
    next();
  });
}

function validEmail(email) {
  const v = String(email || '').trim(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^[a-zA-Z0-9._-]{3,40}$/.test(v);
}

function sitePayload(body) {
  const normalized = templates.normalize(body || {});
  return {
    name: String((body && (body.name || body.productName || body.brandName)) || normalized.productName || normalized.brandName || '未命名網站').trim().slice(0, 80),
    template: normalized.template,
    style: normalized.style,
    customPrimary: normalized.customPrimary,
    data: normalized,
  };
}

function canAccessSite(user, site) {
  if (!user || !site) return false;
  return user.role === 'admin' || site.userId === user.id;
}

function ownerName(userId) {
  const u = findUserById(userId);
  return u ? { name: u.name, email: u.email, id: u.id } : { name: '（已刪除）', email: '', id: userId };
}

function downloadName(site, ext) {
  const raw = (site && (site.name || (site.data && site.data.brandName))) || 'landing-page';
  const slug = String(raw)
    .replace(/[^\w\u4e00-\u9fff-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'landing-page';
  return slug + ext;
}

function sendHtmlDownload(res, filename, html) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(filename));
  res.send(html);
}

function sendZipDownload(res, filename, html, files) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(filename));
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: '壓縮失敗' });
  });
  archive.pipe(res);
  archive.append(html, { name: 'index.html' });
  (files || []).forEach((f) => archive.append(f.buf, { name: f.name }));
  archive.finalize();
}

const RESERVED_SLUGS = new Set([
  'admin', 'app', 'api', 's', 'p', 'uploads', 'login', 'logout', 'register',
  'static', 'css', 'js', 'favicon', 'assets', 'media', 'public', 'auth',
  'new', 'edit', 'preview', 'index', 'www', 'official', 'robots', 'sitemap',
]);

function publicOrigin(req) {
  const env = String(process.env.PUBLIC_BASE_URL || process.env.PUBLIC_ORIGIN || '').trim().replace(/\/$/, '');
  if (env) return env;
  const host = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  return 'https://' + host;
}

function googleSiteVerification() {
  const v = String(process.env.GOOGLE_SITE_VERIFICATION || '').trim();
  if (!v || !/^[A-Za-z0-9_-]{1,200}$/.test(v)) return '';
  return v;
}

function publicUrl(req, slug) {
  return publicOrigin(req) + '/s/' + slug;
}

function validSlug(s) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(s || '')) && String(s).length >= 2 && String(s).length <= 48;
}

function slugTaken(slug, exceptId) {
  return store.sites().some((s) => s.published && s.slug === slug && s.id !== exceptId);
}

function suggestSlug(site) {
  const raw = [site.data && site.data.brandName, site.data && site.data.productName, site.name]
    .filter(Boolean)
    .join('-');
  let base = String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  if (base.length < 2) base = 'page-' + store.id().slice(0, 8);
  let s = base;
  let n = 2;
  while (RESERVED_SLUGS.has(s) || slugTaken(s, site.id)) {
    s = base.slice(0, 36) + '-' + n;
    n += 1;
    if (n > 99) {
      s = 'page-' + store.id().slice(0, 8);
      break;
    }
  }
  return s;
}

function publicFields(site, req) {
  const published = !!site.published && !!site.slug;
  return {
    published,
    slug: site.slug || null,
    publishedAt: site.publishedAt || null,
    publicUrl: published ? publicUrl(req, site.slug) : null,
  };
}

function assertSiteImages(user, images) {
  if ((images || []).length > media.MAX_IMAGES) {
    const err = new Error('最多可加入 10 張圖片');
    err.status = 400;
    throw err;
  }
  (images || []).forEach((im) => {
    const src = im && im.src;
    if (!src) return;
    if (/^data:/i.test(src) || /^blob:/i.test(src)) {
      const err = new Error('請先上傳圖片再儲存');
      err.status = 400;
      throw err;
    }
    if (media.isUploadSrc(src)) {
      const rec = media.findUpload(media.uploadIdFromSrc(src));
      if (!rec || (rec.userId !== user.id && user.role !== 'admin')) {
        const err = new Error('有圖片不存在或沒有權限');
        err.status = 400;
        throw err;
      }
      return;
    }
    if (/^https?:\/\//i.test(src)) return;
    if (src.charAt(0) === '/' && src.charAt(1) !== '/') return;
    const err = new Error('圖片網址需為 http、https，或已上傳的圖片');
    err.status = 400;
    throw err;
  });
}

function assertSiteData(user, data) {
  assertSiteImages(user, data.images);
  (data.products || []).forEach((p) => {
    assertSiteImages(user, (p.images || []).map((src) => (typeof src === 'string' ? { src: src } : src)));
  });
}


function renderExportHtml(data, mode, req) {
  const pack = media.collectExportImages(templates.allImageRefs(data));
  const opts = {};
  if (mode === 'html') opts.embedImages = pack.embed;
  if (mode === 'zip') opts.rewriteImages = pack.rewrite;
  if (req) opts.baseUrl = publicOrigin(req);
  return { html: templates.render(data, opts), files: pack.files };
}

function renderPublicHtml(site, req) {
  const origin = publicOrigin(req);
  const pageUrl = site.slug ? publicUrl(req, site.slug) : origin;
  return templates.render(site.data, {
    baseUrl: origin,
    pageUrl: pageUrl,
    googleSiteVerification: googleSiteVerification(),
  });
}

function notFoundPage(res, message) {
  res.status(404).type('html').send(
    '<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>找不到網頁</title></head><body style="font-family:sans-serif;padding:48px;text-align:center"><h1>找不到此網站</h1><p>' +
      String(message || '此頁面不存在，或尚未公開。') +
      '</p></body></html>'
  );
}

// ---------- Auth ----------
app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String((req.body && req.body.name) || '').trim();
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const password = String((req.body && req.body.password) || '');

    if (name.length < 1 || name.length > 40) {
      return res.status(400).json({ ok: false, error: '請輸入 1–40 字的名稱' });
    }
    if (!validEmail(email)) {
      return res.status(400).json({ ok: false, error: '帳號需為 3–40 字英數字，或有效的電子郵件' });
    }
    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: '密碼至少 8 個字元' });
    }
    if (findUserByEmail(email)) {
      return res.status(409).json({ ok: false, error: '此電子郵件已被註冊' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const created = await store.updateUsers((users) => {
      const isFirst = users.length === 0;
      const user = {
        id: store.id(),
        name,
        email,
        passwordHash,
        role: isAdminEmail(email) || (isFirst && !ADMIN_EMAIL) ? 'admin' : 'user',
        disabled: false,
        createdAt: store.nowIso(),
        lastLoginAt: store.nowIso(),
      };
      users.push(user);
      return { __return: user };
    });

    req.session.userId = created.id;
    req.session.email = created.email;
    await logActivity(req, 'register', { email: created.email, role: created.role });
    res.status(201).json({ ok: true, user: publicUser(created) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: '註冊失敗，請稍後再試' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const password = String((req.body && req.body.password) || '');
    const user = findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ ok: false, error: '帳號或密碼不正確' });
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ ok: false, error: '帳號或密碼不正確' });
    }
    if (user.disabled) {
      return res.status(403).json({ ok: false, error: '此帳號已停用，請聯絡管理員' });
    }

    applyAdminFlag(user);
    if (isAdminEmail(user.email) && user.role === 'admin') {
      await store.updateUsers((users) => {
        const found = users.find((u) => u.id === user.id);
        if (found) {
          found.role = 'admin';
          found.lastLoginAt = store.nowIso();
        }
      });
    } else {
      await store.updateUsers((users) => {
        const found = users.find((u) => u.id === user.id);
        if (found) found.lastLoginAt = store.nowIso();
      });
    }
    user.lastLoginAt = store.nowIso();

    req.session.userId = user.id;
    req.session.email = user.email;
    await logActivity(req, 'login', { email: user.email });
    res.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: '登入失敗，請稍後再試' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('adpage.sid');
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ ok: true, user: null });
  }
  const user = findUserById(req.session.userId);
  if (!user || user.disabled) {
    return res.json({ ok: true, user: null });
  }
  applyAdminFlag(user);
  res.json({ ok: true, user: publicUser(user) });
});

// ---------- Sites ----------
app.get('/api/sites', requireAuth, (req, res) => {
  const list = store
    .sites()
    .filter((s) => s.userId === req.user.id)
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .map((s) => ({
      id: s.id,
      name: s.name,
      template: s.template,
      style: s.style,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      ...publicFields(s, req),
    }));
  res.json({ ok: true, sites: list });
});

app.get('/api/sites/:id', requireAuth, (req, res) => {
  const site = store.sites().find((s) => s.id === req.params.id);
  if (!site || !canAccessSite(req.user, site)) {
    return res.status(404).json({ ok: false, error: '找不到此網站' });
  }
  res.json({ ok: true, site: { ...site, ...publicFields(site, req) } });
});

app.post('/api/sites', requireAuth, async (req, res) => {
  try {
    const payload = sitePayload(req.body);
    assertSiteData(req.user, payload.data);
    const site = {
      id: store.id(),
      userId: req.user.id,
      name: payload.name,
      template: payload.template,
      style: payload.style,
      customPrimary: payload.customPrimary,
      data: payload.data,
      published: false,
      slug: null,
      publishedAt: null,
      createdAt: store.nowIso(),
      updatedAt: store.nowIso(),
    };
    await store.updateSites((sites) => {
      sites.push(site);
    });
    await media.syncSiteUploads(req.user.id, site.id, templates.allImageRefs(payload.data));
    await logActivity(req, 'generate', { siteId: site.id, name: site.name, template: site.template });
    res.status(201).json({ ok: true, site });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ ok: false, error: err.status ? err.message : '儲存失敗' });
  }
});

app.put('/api/sites/:id', requireAuth, async (req, res) => {
  try {
    const existing = store.sites().find((s) => s.id === req.params.id);
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ ok: false, error: '找不到此網站' });
    }
    const payload = sitePayload(req.body);
    assertSiteData(req.user, payload.data);
    const updated = await store.updateSites((sites) => {
      const found = sites.find((s) => s.id === req.params.id);
      if (!found) return { __changed: false, __return: null };
      found.name = payload.name;
      found.template = payload.template;
      found.style = payload.style;
      found.customPrimary = payload.customPrimary;
      found.data = payload.data;
      found.updatedAt = store.nowIso();
      return { __return: found };
    });
    if (updated) await media.syncSiteUploads(req.user.id, updated.id, templates.allImageRefs(payload.data));
    if (!updated) return res.status(404).json({ ok: false, error: '找不到此網站' });
    await logActivity(req, 'generate', { siteId: updated.id, name: updated.name, template: updated.template, updated: true });
    res.json({ ok: true, site: updated });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ ok: false, error: err.status ? err.message : '儲存失敗' });
  }
});

app.delete('/api/sites/:id', requireAuth, async (req, res) => {
  const existing = store.sites().find((s) => s.id === req.params.id);
  if (!existing) return res.status(404).json({ ok: false, error: '找不到此網站' });
  if (existing.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: '沒有權限刪除此網站' });
  }
  await store.updateSites((sites) => {
    const idx = sites.findIndex((s) => s.id === req.params.id);
    if (idx >= 0) sites.splice(idx, 1);
  });
  await media.deleteUploadsForSite(existing.id);
  await logActivity(req, 'delete_site', { siteId: existing.id, name: existing.name });
  res.json({ ok: true });
});

app.post('/api/preview', requireAuth, (req, res) => {
  const html = templates.render(sitePayload(req.body).data, { baseUrl: publicOrigin(req) });
  res.type('html').send(html);
});

app.get('/api/sites/:id/preview', requireAuth, (req, res) => {
  const site = store.sites().find((s) => s.id === req.params.id);
  if (!site || !canAccessSite(req.user, site)) {
    return res.status(404).type('html').send('<!DOCTYPE html><p>找不到此網站</p>');
  }
  res.type('html').send(templates.render(site.data, { baseUrl: publicOrigin(req) }));
});

function exportFromBody(req) {
  return sitePayload(req.body);
}

app.post('/api/export/html', requireAuth, async (req, res) => {
  const payload = exportFromBody(req);
  const out = renderExportHtml(payload.data, 'html', req);
  await logActivity(req, 'export', { format: 'html', name: payload.name, template: payload.template });
  sendHtmlDownload(res, 'index.html', out.html);
});

app.post('/api/export/zip', requireAuth, async (req, res) => {
  const payload = exportFromBody(req);
  const out = renderExportHtml(payload.data, 'zip', req);
  await logActivity(req, 'export', { format: 'zip', name: payload.name, template: payload.template });
  sendZipDownload(res, downloadName({ name: payload.name }, '.zip'), out.html, out.files);
});

app.get('/api/sites/:id/export.html', requireAuth, async (req, res) => {
  const site = store.sites().find((s) => s.id === req.params.id);
  if (!site || !canAccessSite(req.user, site)) {
    return res.status(404).json({ ok: false, error: '找不到此網站' });
  }
  const out = renderExportHtml(site.data, 'html', req);
  await logActivity(req, 'export', { format: 'html', siteId: site.id, name: site.name });
  sendHtmlDownload(res, 'index.html', out.html);
});

app.get('/api/sites/:id/export.zip', requireAuth, async (req, res) => {
  const site = store.sites().find((s) => s.id === req.params.id);
  if (!site || !canAccessSite(req.user, site)) {
    return res.status(404).json({ ok: false, error: '找不到此網站' });
  }
  const out = renderExportHtml(site.data, 'zip', req);
  await logActivity(req, 'export', { format: 'zip', siteId: site.id, name: site.name });
  sendZipDownload(res, downloadName(site, '.zip'), out.html, out.files);
});

// ---------- Uploads ----------
app.post('/api/uploads', requireAuth, async (req, res) => {
  try {
    const parsed = media.parseDataUrl(req.body && req.body.dataUrl);
    if (!parsed) {
      return res.status(400).json({ ok: false, error: '請上傳 JPEG、PNG 或 WebP 圖片，壓縮後需小於約 1.5 MB' });
    }
    const count = store.uploads().filter((u) => u.userId === req.user.id).length;
    if (count >= 80) {
      return res.status(400).json({ ok: false, error: '上傳數量已達上限，請先刪除不用的圖片' });
    }
    const siteId = req.body && req.body.siteId ? String(req.body.siteId) : null;
    if (siteId) {
      const site = store.sites().find((s) => s.id === siteId);
      if (!site || site.userId !== req.user.id) {
        return res.status(404).json({ ok: false, error: '找不到此網站' });
      }
    }
    const rec = await media.saveUpload(req.user.id, parsed, siteId);
    res.status(201).json({
      ok: true,
      upload: { id: rec.id, url: '/uploads/' + rec.id, mime: rec.mime, size: rec.size },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: '上傳失敗' });
  }
});

app.delete('/api/uploads/:id', requireAuth, async (req, res) => {
  const ok = await media.deleteUpload(req.params.id, req.user.id, req.user.role === 'admin');
  if (!ok) return res.status(404).json({ ok: false, error: '找不到此圖片' });
  res.json({ ok: true });
});

app.get('/uploads/:id', (req, res) => {
  const id = String(req.params.id || '').replace(/\.[a-zA-Z0-9]+$/, '');
  const rec = media.findUpload(id);
  const data = media.readUploadBuffer(rec);
  if (!data) return res.status(404).end();
  res.setHeader('Content-Type', rec.mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(data.buf);
});

// ---------- Publish ----------
app.get('/api/sites/:id/publish-info', requireAuth, (req, res) => {
  const site = store.sites().find((s) => s.id === req.params.id);
  if (!site || !canAccessSite(req.user, site)) {
    return res.status(404).json({ ok: false, error: '找不到此網站' });
  }
  res.json({
    ok: true,
    ...publicFields(site, req),
    suggestedSlug: site.slug || suggestSlug(site),
  });
});

app.post('/api/sites/:id/publish', requireAuth, async (req, res) => {
  const site = store.sites().find((s) => s.id === req.params.id);
  if (!site || site.userId !== req.user.id) {
    return res.status(404).json({ ok: false, error: '找不到此網站' });
  }
  let slug = String((req.body && req.body.slug) || site.slug || suggestSlug(site)).trim().toLowerCase();
  if (!validSlug(slug)) {
    return res.status(400).json({ ok: false, error: '網址代號需為 2–48 字的小寫英文、數字，可以加連字號（-）' });
  }
  if (RESERVED_SLUGS.has(slug)) {
    return res.status(400).json({ ok: false, error: '此外觀網址已被系統保留，請換一個' });
  }
  if (slugTaken(slug, site.id)) {
    return res.status(409).json({ ok: false, error: '此外觀網址已被使用，請換一個' });
  }
  const updated = await store.updateSites((sites) => {
    const found = sites.find((s) => s.id === req.params.id);
    if (!found) return { __changed: false, __return: null };
    found.published = true;
    found.slug = slug;
    found.publishedAt = store.nowIso();
    return { __return: found };
  });
  await logActivity(req, 'publish', { siteId: site.id, name: site.name, slug: slug });
  res.json({ ok: true, site: updated, ...publicFields(updated, req) });
});

app.post('/api/sites/:id/unpublish', requireAuth, async (req, res) => {
  const site = store.sites().find((s) => s.id === req.params.id);
  if (!site || site.userId !== req.user.id) {
    if (!(site && req.user.role === 'admin')) {
      return res.status(404).json({ ok: false, error: '找不到此網站' });
    }
  }
  const updated = await store.updateSites((sites) => {
    const found = sites.find((s) => s.id === req.params.id);
    if (!found) return { __changed: false, __return: null };
    found.published = false;
    return { __return: found };
  });
  await logActivity(req, 'unpublish', { siteId: site.id, name: site.name, slug: site.slug });
  res.json({ ok: true, site: updated, ...publicFields(updated, req) });
});

app.get('/s/:slug', (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const site = store.sites().find((s) => s.published && s.slug === slug);
  if (!site) return notFoundPage(res);
  res.type('html').send(renderPublicHtml(site, req));
});

// Public-ish preview for owner/admin in a full window
app.get('/p/:id', (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/?next=/p/' + encodeURIComponent(req.params.id));
  }
  const user = findUserById(req.session.userId);
  const site = store.sites().find((s) => s.id === req.params.id);
  if (!user || !site || !canAccessSite(user, site)) {
    return res.status(404).type('html').send('<!DOCTYPE html><meta charset="utf-8"><p>找不到此網站或沒有權限。</p>');
  }
  res.type('html').send(templates.render(site.data, { baseUrl: publicOrigin(req) }));
});

// ---------- Admin ----------
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const users = store.users();
  const sites = store.sites();
  const activity = store.activity();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const loginsToday = activity.filter((a) => a.type === 'login' && new Date(a.createdAt).getTime() >= dayAgo).length;
  const exportsWeek = activity.filter((a) => a.type === 'export' && new Date(a.createdAt).getTime() >= weekAgo).length;
  const generationsWeek = activity.filter((a) => a.type === 'generate' && new Date(a.createdAt).getTime() >= weekAgo).length;
  res.json({
    ok: true,
    stats: {
      users: users.length,
      activeUsers: users.filter((u) => !u.disabled).length,
      disabledUsers: users.filter((u) => u.disabled).length,
      admins: users.filter((u) => u.role === 'admin' || isAdminEmail(u.email)).length,
      sites: sites.length,
      publishedSites: sites.filter((s) => s.published).length,
      loginsToday,
      exportsWeek,
      generationsWeek,
    },
  });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const sites = store.sites();
  const users = store.users().map((u) => {
    applyAdminFlag(u);
    return {
      ...publicUser(u),
      siteCount: sites.filter((s) => s.userId === u.id).length,
    };
  });
  users.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  res.json({ ok: true, users });
});

app.patch('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id && req.body && req.body.disabled === true) {
    return res.status(400).json({ ok: false, error: '不能停用自己的帳號' });
  }
  if (targetId === req.user.id && req.body && req.body.role && req.body.role !== 'admin') {
    return res.status(400).json({ ok: false, error: '不能取消自己的管理員權限' });
  }

  const updated = await store.updateUsers((users) => {
    const found = users.find((u) => u.id === targetId);
    if (!found) return { __changed: false, __return: null };
    if (req.body && typeof req.body.disabled === 'boolean') {
      found.disabled = req.body.disabled;
    }
    if (req.body && (req.body.role === 'admin' || req.body.role === 'user')) {
      if (isAdminEmail(found.email) && req.body.role !== 'admin') {
        return { __changed: false, __return: { __error: '此信箱由 ADMIN_EMAIL 指定，無法取消管理員' } };
      }
      found.role = req.body.role;
    }
    return { __return: found };
  });

  if (!updated) return res.status(404).json({ ok: false, error: '找不到此使用者' });
  if (updated.__error) return res.status(400).json({ ok: false, error: updated.__error });

  await logActivity(req, 'admin_update_user', {
    targetId,
    disabled: updated.disabled,
    role: updated.role,
  });
  res.json({ ok: true, user: publicUser(updated) });
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
  const targetId = req.params.id;
  if (targetId === req.user.id) {
    return res.status(400).json({ ok: false, error: '不能刪除自己的帳號' });
  }
  const existing = findUserById(targetId);
  if (!existing) return res.status(404).json({ ok: false, error: '找不到此使用者' });
  if (isAdminEmail(existing.email)) {
    return res.status(400).json({ ok: false, error: '此信箱由 ADMIN_EMAIL 指定，無法刪除' });
  }

  await store.updateUsers((users) => {
    const idx = users.findIndex((u) => u.id === targetId);
    if (idx >= 0) users.splice(idx, 1);
  });
  await store.updateSites((sites) => {
    for (let i = sites.length - 1; i >= 0; i--) {
      if (sites[i].userId === targetId) sites.splice(i, 1);
    }
  });
  await media.deleteUploadsForUser(targetId);
  await logActivity(req, 'admin_delete_user', { targetId, email: existing.email });
  res.json({ ok: true });
});

app.get('/api/admin/sites', requireAdmin, (req, res) => {
  const list = store
    .sites()
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((s) => ({
      id: s.id,
      name: s.name,
      template: s.template,
      style: s.style,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      owner: ownerName(s.userId),
      ...publicFields(s, req),
    }));
  res.json({ ok: true, sites: list });
});

app.get('/api/admin/activity', requireAdmin, (req, res) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const list = store
    .activity()
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
  res.json({ ok: true, activity: list });
});

app.get('/api/admin/backup', requireAdmin, async (req, res) => {
  try {
    const uploads = store.uploads().map((rec) => {
      const data = media.readUploadBuffer(rec);
      return {
        id: rec.id,
        userId: rec.userId,
        siteId: rec.siteId || null,
        mime: rec.mime,
        ext: rec.ext,
        size: rec.size,
        createdAt: rec.createdAt,
        data: data ? data.buf.toString('base64') : null,
      };
    });
    const payload = {
      ok: true,
      exportedAt: store.nowIso(),
      users: store.users(),
      sites: store.sites(),
      uploads,
    };
    await logActivity(req, 'backup', { users: payload.users.length, sites: payload.sites.length, uploads: uploads.length });
    res.setHeader('Content-Disposition', 'attachment; filename="adpage-backup.json"');
    res.json(payload);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: '備份失敗' });
  }
});

app.post('/api/admin/restore', requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    if (body.confirm !== true) {
      return res.status(400).json({ ok: false, error: '請在請求中加上 confirm: true 以確認還原（會覆蓋現有資料）' });
    }
    if (!Array.isArray(body.users) || !Array.isArray(body.sites) || !Array.isArray(body.uploads)) {
      return res.status(400).json({ ok: false, error: '備份格式不正確，需包含 users、sites、uploads 陣列' });
    }
    const users = body.users.filter((u) => u && u.id && u.email && u.passwordHash);
    if (!users.some((u) => u.id === req.user.id || u.email === req.user.email)) {
      users.push(req.user);
    }
    const sites = body.sites.filter((s) => s && s.id);
    const uploadRecords = [];
    media.uploadsDir();
    for (const rec of body.uploads) {
      if (!rec || !rec.id || !rec.ext) continue;
      const item = {
        id: String(rec.id).replace(/[^a-zA-Z0-9]/g, ''),
        userId: rec.userId || null,
        siteId: rec.siteId || null,
        mime: rec.mime || 'image/jpeg',
        ext: String(rec.ext).replace(/[^a-z0-9]/g, '') || 'jpg',
        size: rec.size || 0,
        createdAt: rec.createdAt || store.nowIso(),
      };
      if (rec.data) {
        const buf = Buffer.from(String(rec.data), 'base64');
        fs.writeFileSync(media.filePath(item.id, item.ext), buf);
        item.size = buf.length;
      }
      uploadRecords.push(item);
    }
    await store.updateUsers(() => ({ __data: users }));
    await store.updateSites(() => ({ __data: sites }));
    await store.updateUploads(() => ({ __data: uploadRecords }));
    const sessionDir = path.join(store.DATA_DIR, 'sessions');
    try {
      if (fs.existsSync(sessionDir)) {
        fs.readdirSync(sessionDir).forEach((name) => {
          try { fs.unlinkSync(path.join(sessionDir, name)); } catch (e) {}
        });
      }
    } catch (e) {}
    await logActivity(req, 'restore', { users: users.length, sites: sites.length, uploads: uploadRecords.length });
    res.json({ ok: true, users: users.length, sites: sites.length, uploads: uploadRecords.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: '還原失敗' });
  }
});

app.get('/api/meta', (req, res) => {
  res.json({
    ok: true,
    templates: templates.TEMPLATES,
    styles: templates.STYLES.map((s) => ({ id: s.id, name: s.name, primary: s.primary })),
    features: { multiImages: true, publish: true, seo: true, products: true, sitemap: true, backup: true },
  });
});

// ---------- Public SEO ----------
app.get('/robots.txt', (req, res) => {
  const origin = publicOrigin(req);
  const body = [
    'User-agent: *',
    'Allow: /s/',
    'Allow: /uploads/',
    'Disallow: /app',
    'Disallow: /admin',
    'Disallow: /api',
    'Disallow: /p',
    'Sitemap: ' + origin + '/sitemap.xml',
    '',
  ].join('\n');
  res.type('text/plain; charset=utf-8').send(body);
});

app.get('/sitemap.xml', (req, res) => {
  const origin = publicOrigin(req);
  const urls = store
    .sites()
    .filter((s) => s.published && s.slug)
    .map((s) => {
      const last = s.updatedAt || s.publishedAt || s.createdAt;
      let lastmod = '';
      try {
        lastmod = new Date(last).toISOString();
      } catch (e) {
        lastmod = store.nowIso();
      }
      return '  <url>\n    <loc>' + templates.escapeHtml(origin + '/s/' + s.slug) + '</loc>\n    <lastmod>' + lastmod + '</lastmod>\n  </url>';
    })
    .join('\n');
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls +
    (urls ? '\n' : '') +
    '</urlset>\n';
  res.type('application/xml; charset=utf-8').send(xml);
});

function sendHomePage(req, res) {
  const filePath = path.join(PUBLIC_DIR, 'index.html');
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace('lang="zh-Hant"', 'lang="zh-Hant-TW"');
  const token = googleSiteVerification();
  if (token && !/google-site-verification/.test(html)) {
    html = html.replace('</head>', '  <meta name="google-site-verification" content="' + templates.escapeHtml(token) + '">\n</head>');
  }
  res.type('html').send(html);
}

app.get(['/', '/index.html'], sendHomePage);

// ---------- Pages ----------
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'app.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: '找不到此 API' });
  }
  next();
});

async function seedAdmin() {
  const hash = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
  if (!ADMIN_EMAIL || !hash) return;
  await store.updateUsers((users) => {
    if (users.some((u) => u.email === ADMIN_EMAIL)) return { __changed: false };
    users.push({ id: store.id(), name: ADMIN_EMAIL, email: ADMIN_EMAIL, passwordHash: hash, role: 'admin', disabled: false, createdAt: store.nowIso(), lastLoginAt: null });
  });
}

if (require.main === module) {
  seedAdmin().catch((e) => console.error('seedAdmin failed', e));
  app.listen(PORT, '0.0.0.0', () => {
    console.log('迅頁 AdPage 已啟動：http://127.0.0.1:' + PORT);
    console.log('資料目錄：' + store.DATA_DIR);
    if (ADMIN_EMAIL) console.log('ADMIN_EMAIL：' + ADMIN_EMAIL);
  });
}

module.exports = app;
