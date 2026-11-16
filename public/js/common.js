(function (root) {
  'use strict';

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  function formatTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  }

  async function api(url, options) {
    options = options || {};
    var opts = {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: Object.assign({ 'Accept': 'application/json' }, options.headers || {})
    };
    if (options.body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
    var res = await fetch(url, opts);
    var data = null;
    var ct = res.headers.get('content-type') || '';
    if (ct.indexOf('application/json') !== -1) {
      data = await res.json();
    } else if (!res.ok) {
      var text = await res.text();
      throw new Error(text || '請求失敗');
    } else {
      return res;
    }
    if (!res.ok || (data && data.ok === false)) {
      throw new Error((data && data.error) || '請求失敗');
    }
    return data;
  }

  async function downloadPost(url, body, filename) {
    var res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'Accept': '*/*' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      var err = '匯出失敗';
      try {
        var data = await res.json();
        if (data && data.error) err = data.error;
      } catch (e) {}
      throw new Error(err);
    }
    var blob = await res.blob();
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  async function requireUser() {
    var data = await api('/api/auth/me');
    if (!data.user) {
      location.replace('/');
      return null;
    }
    return data.user;
  }

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST', body: {} }); } catch (e) {}
    location.replace('/');
  }

  root.AdPage = {
    toast: toast,
    formatTime: formatTime,
    api: api,
    downloadPost: downloadPost,
    requireUser: requireUser,
    logout: logout
  };
})(typeof window !== 'undefined' ? window : this);
