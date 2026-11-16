'use strict';

const fs = require('fs');
const path = require('path');
const store = require('./store');

const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = Math.floor(1.5 * 1024 * 1024);
const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function uploadsDir() {
  const dir = path.join(store.DATA_DIR, 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function filePath(id, ext) {
  const safeId = String(id).replace(/[^a-zA-Z0-9]/g, '');
  const safeExt = String(ext || 'jpg').replace(/[^a-z0-9]/g, '');
  return path.join(uploadsDir(), safeId + '.' + safeExt);
}

function detectMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function parseDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!m) return null;
  let mime = m[1].toLowerCase();
  if (mime === 'image/jpg') mime = 'image/jpeg';
  let buf;
  try {
    buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  } catch (e) {
    return null;
  }
  if (!buf.length || buf.length > MAX_IMAGE_BYTES) return null;
  const detected = detectMime(buf);
  if (!detected) return null;
  // Trust magic bytes over the declared type
  mime = detected;
  return { mime, buf, ext: MIME_EXT[mime], size: buf.length };
}

function isUploadSrc(src) {
  return /^\/uploads\/[a-zA-Z0-9]+(?:\.[a-z0-9]+)?$/.test(String(src || '').trim());
}

function uploadIdFromSrc(src) {
  const m = String(src || '').trim().match(/^\/uploads\/([a-zA-Z0-9]+)/);
  return m ? m[1] : null;
}

function findUpload(id) {
  const safe = String(id || '').replace(/[^a-zA-Z0-9]/g, '');
  return store.uploads().find((u) => u.id === safe) || null;
}

function readUploadBuffer(record) {
  if (!record) return null;
  const fp = filePath(record.id, record.ext);
  try {
    const buf = fs.readFileSync(fp);
    return { buf, mime: record.mime, ext: record.ext, size: buf.length };
  } catch (e) {
    return null;
  }
}

async function saveUpload(userId, parsed, siteId) {
  const id = store.id();
  const rec = {
    id,
    userId,
    siteId: siteId || null,
    mime: parsed.mime,
    ext: parsed.ext,
    size: parsed.size,
    createdAt: store.nowIso(),
  };
  fs.writeFileSync(filePath(id, rec.ext), parsed.buf);
  await store.updateUploads((list) => {
    list.push(rec);
  });
  return rec;
}

function removeFile(record) {
  try {
    fs.unlinkSync(filePath(record.id, record.ext));
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('unlink upload failed', e);
  }
}

async function deleteUpload(id, userId, asAdmin) {
  const existing = findUpload(id);
  if (!existing) return false;
  if (!asAdmin && existing.userId !== userId) return false;
  await store.updateUploads((list) => {
    const idx = list.findIndex((u) => u.id === id);
    if (idx >= 0) list.splice(idx, 1);
  });
  removeFile(existing);
  return true;
}

async function deleteUploadsForSite(siteId) {
  const doomed = store.uploads().filter((u) => u.siteId === siteId);
  if (!doomed.length) return;
  await store.updateUploads((list) => {
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].siteId === siteId) list.splice(i, 1);
    }
  });
  doomed.forEach(removeFile);
}

async function deleteUploadsForUser(userId) {
  const doomed = store.uploads().filter((u) => u.userId === userId);
  if (!doomed.length) return;
  await store.updateUploads((list) => {
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].userId === userId) list.splice(i, 1);
    }
  });
  doomed.forEach(removeFile);
}

async function syncSiteUploads(userId, siteId, images) {
  const ids = [];
  (images || []).forEach((im) => {
    const id = uploadIdFromSrc(im && (im.src || im));
    if (id) ids.push(id);
  });
  const unique = new Set(ids);
  const mine = store.uploads().filter((u) => u.userId === userId);
  const toDelete = mine.filter((u) => u.siteId === siteId && !unique.has(u.id));
  await store.updateUploads((list) => {
    list.forEach((u) => {
      if (unique.has(u.id) && u.userId === userId) u.siteId = siteId;
    });
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].userId === userId && list[i].siteId === siteId && !unique.has(list[i].id)) {
        list.splice(i, 1);
      }
    }
  });
  toDelete.forEach(removeFile);
}

function collectExportImages(images) {
  const files = [];
  const rewrite = {};
  const embed = {};
  let n = 0;
  (images || []).forEach((im) => {
    const src = typeof im === 'string' ? im : (im && im.src) || '';
    const id = uploadIdFromSrc(src);
    if (!id) return;
    const rec = findUpload(id);
    const data = readUploadBuffer(rec);
    if (!data) return;
    n += 1;
    const rel = 'images/' + String(n).padStart(2, '0') + '.' + data.ext;
    rewrite[src] = rel;
    embed[src] = 'data:' + data.mime + ';base64,' + data.buf.toString('base64');
    files.push({ name: rel, buf: data.buf });
  });
  return { files, rewrite, embed };
}

module.exports = {
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  MIME_EXT,
  uploadsDir,
  filePath,
  parseDataUrl,
  detectMime,
  isUploadSrc,
  uploadIdFromSrc,
  findUpload,
  readUploadBuffer,
  saveUpload,
  deleteUpload,
  deleteUploadsForSite,
  deleteUploadsForUser,
  syncSiteUploads,
  collectExportImages,
};
