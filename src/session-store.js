'use strict';

const fs = require('fs');
const path = require('path');
const session = require('express-session');

class FileSessionStore extends session.Store {
  constructor(options) {
    super(options);
    this.dir = options.dir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  _file(sid) {
    const safe = String(sid).replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.dir, safe + '.json');
  }

  get(sid, cb) {
    fs.readFile(this._file(sid), 'utf8', (err, raw) => {
      if (err) return cb(err.code === 'ENOENT' ? null : err);
      try {
        const data = JSON.parse(raw);
        if (data.cookie && data.cookie.expires && new Date(data.cookie.expires) < new Date()) {
          return this.destroy(sid, () => cb(null, null));
        }
        cb(null, data);
      } catch (e) {
        cb(e);
      }
    });
  }

  set(sid, sess, cb) {
    try {
      fs.writeFile(this._file(sid), JSON.stringify(sess), 'utf8', (err) => cb(err || null));
    } catch (e) {
      cb(e);
    }
  }

  destroy(sid, cb) {
    fs.unlink(this._file(sid), (err) => {
      if (err && err.code !== 'ENOENT') return cb(err);
      cb(null);
    });
  }
}

module.exports = FileSessionStore;
