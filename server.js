'use strict';

const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const archiver = require('archiver');

const store = require('./src/store');
const templates = require('./src/templates');
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

app.use(express.json({ limit: '1mb' }));
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

function sendZipDownload(res, filename, html) {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(filename));
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: '壓縮失敗' });
  });
  archive.pipe(res);
  archive.append(html, { name: 'index.html' });
  archive.finalize();
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
      return res.status(401).json({ ok: false, error: '電子郵件或密碼不正確' });
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ ok: false, error: '電子郵件或密碼不正確' });
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
    }));
  res.json({ ok: true, sites: list });
});

app.get('/api/sites/:id', requireAuth, (req, res) => {
  const site = store.sites().find((s) => s.id === req.params.id);
  if (!site || !canAccessSite(req.user, site)) {
    return res.status(404).json({ ok: false, error: '找不到此網站' });
  }
  res.json({ ok: true, site });
});

app.post('/api/sites', requireAuth, async (req, res) => {
  try {
    const payload = sitePayload(req.body);
    const site = {
      id: store.id(),
      userId: req.user.id,
      name: payload.name,
      template: payload.template,
      style: payload.style,
      customPrimary: payload.customPrimary,
      data: payload.data,
      createdAt: store.nowIso(),
      updatedAt: store.nowIso(),
    };
    await store.updateSites((sites) => {
      sites.push(site);
    });
    await logActivity(req, 'generate', { siteId: site.id, name: site.name, template: site.template });
    res.status(201).json({ ok: true, site });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: '儲存失敗' });
  }
});

app.put('/api/sites/:id', requireAuth, async (req, res) => {
  try {
    const existing = store.sites().find((s) => s.id === req.params.id);
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ ok: false, error: '找不到此網站' });
    }
    const payload = sitePayload(req.body);
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
    if (!updated) return res.status(404).json({ ok: false, error: '找不到此網站' });
    await logActivity(req, 'generate', { siteId: updated.id, name: updated.name, template: updated.template, updated: true });
    res.json({ ok: true, site: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: '儲存失敗' });
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
  await logActivity(req, 'delete_site', { siteId: existing.id, name: existing.name });
  res.json({ ok: true });
});

app.post('/api/preview', requireAuth, (req, res) => {
  const html = templates.render(sitePayload(req.body).data);
  res.type('html').send(html);
});

app.get('/api/sites/:id/preview', requireAuth, (req, res) => {
  const site = store.sites().find((s) => s.id === req.params.id);
  if (!site || !canAccessSite(req.user, site)) {
    return res.status(404).type('html').send('<!DOCTYPE html><p>找不到此網站</p>');
  }
  res.type('html').send(templates.render(site.data));
});

function exportFromBody(req) {
  return sitePayload(req.body);
}

app.post('/api/export/html', requireAuth, async (req, res) => {
  const payload = exportFromBody(req);
  const html = templates.render(payload.data);
  await logActivity(req, 'export', { format: 'html', name: payload.name, template: payload.template });
  sendHtmlDownload(res, 'index.html', html);
});

app.post('/api/export/zip', requireAuth, async (req, res) => {
  const payload = exportFromBody(req);
  const html = templates.render(payload.data);
  await logActivity(req, 'export', { format: 'zip', name: payload.name, template: payload.template });
  sendZipDownload(res, downloadName({ name: payload.name }, '.zip'), html);
});

app.get('/api/sites/:id/export.html', requireAuth, async (req, res) => {
  const site = store.sites().find((s) => s.id === req.params.id);
  if (!site || !canAccessSite(req.user, site)) {
    return res.status(404).json({ ok: false, error: '找不到此網站' });
  }
  const html = templates.render(site.data);
  await logActivity(req, 'export', { format: 'html', siteId: site.id, name: site.name });
  sendHtmlDownload(res, 'index.html', html);
});

app.get('/api/sites/:id/export.zip', requireAuth, async (req, res) => {
  const site = store.sites().find((s) => s.id === req.params.id);
  if (!site || !canAccessSite(req.user, site)) {
    return res.status(404).json({ ok: false, error: '找不到此網站' });
  }
  const html = templates.render(site.data);
  await logActivity(req, 'export', { format: 'zip', siteId: site.id, name: site.name });
  sendZipDownload(res, downloadName(site, '.zip'), html);
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
  res.type('html').send(templates.render(site.data));
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

app.get('/api/meta', (req, res) => {
  res.json({
    ok: true,
    templates: templates.TEMPLATES,
    styles: templates.STYLES.map((s) => ({ id: s.id, name: s.name, primary: s.primary })),
  });
});

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
