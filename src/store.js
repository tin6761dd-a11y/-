'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function filePath(name) {
  return path.join(DATA_DIR, name);
}

function readJson(name, fallback) {
  ensureDir();
  const fp = filePath(name);
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

function writeJson(name, data) {
  ensureDir();
  const fp = filePath(name);
  const tmp = fp + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, fp);
}

const queues = new Map();

function withFile(name, fallback, fn) {
  const prev = queues.get(name) || Promise.resolve();
  const next = prev.then(async () => {
    const data = readJson(name, fallback);
    const result = await fn(data);
    if (!result || result.__changed !== false) {
      const toWrite = result && result.__data !== undefined ? result.__data : data;
      writeJson(name, toWrite);
    }
    return result && result.__return !== undefined ? result.__return : result;
  }).catch((err) => {
    throw err;
  });
  // Keep the queue moving even if a task fails
  queues.set(name, next.catch(() => {}));
  return next;
}

function id() {
  return crypto.randomBytes(12).toString('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function users() {
  return readJson('users.json', []);
}

function saveUsers(list) {
  writeJson('users.json', list);
}

function sites() {
  return readJson('sites.json', []);
}

function saveSites(list) {
  writeJson('sites.json', list);
}

function activity() {
  return readJson('activity.json', []);
}

function saveActivity(list) {
  writeJson('activity.json', list);
}

const MAX_ACTIVITY = 1000;

async function updateUsers(fn) {
  return withFile('users.json', [], (data) => {
    const ret = fn(data);
    return ret;
  });
}

async function updateSites(fn) {
  return withFile('sites.json', [], (data) => {
    return fn(data);
  });
}

function uploads() {
  return readJson('uploads.json', []);
}

async function updateUploads(fn) {
  return withFile('uploads.json', [], (data) => {
    return fn(data);
  });
}

async function appendActivity(entry) {
  return withFile('activity.json', [], (data) => {
    data.push(entry);
    if (data.length > MAX_ACTIVITY) {
      data.splice(0, data.length - MAX_ACTIVITY);
    }
  });
}

module.exports = {
  DATA_DIR,
  id,
  nowIso,
  users,
  saveUsers,
  sites,
  saveSites,
  activity,
  saveActivity,
  updateUsers,
  updateSites,
  uploads,
  updateUploads,
  appendActivity,
  readJson,
  writeJson,
  ensureDir,
};
