(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const TYPE_LABEL = {
    register: '註冊',
    login: '登入',
    generate: '生成／儲存網站',
    export: '匯出',
    delete_site: '刪除網站',
    admin_update_user: '調整使用者',
    admin_delete_user: '刪除使用者'
  };

  function escapeHtml(s) {
    return (window.AdPageTemplates && AdPageTemplates.escapeHtml)
      ? AdPageTemplates.escapeHtml(s)
      : String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
  }

  function templateLabel(id) {
    const t = (window.AdPageTemplates && AdPageTemplates.TEMPLATES || []).find((x) => x.id === id);
    return t ? t.name : id;
  }
  function styleLabel(id) {
    const t = (window.AdPageTemplates && AdPageTemplates.STYLES || []).find((x) => x.id === id);
    return t ? t.name : id;
  }

  function metaText(entry) {
    const m = entry.meta || {};
    const bits = [];
    if (m.name) bits.push(m.name);
    if (m.template) bits.push(templateLabel(m.template));
    if (m.format) bits.push(String(m.format).toUpperCase());
    if (m.updated) bits.push('更新');
    if (m.role) bits.push('角色：' + m.role);
    if (typeof m.disabled === 'boolean') bits.push(m.disabled ? '已停用' : '已啟用');
    if (m.email && entry.type === 'admin_delete_user') bits.push(m.email);
    return bits.join('　') || '—';
  }

  function renderStats(stats) {
    const items = [
      { n: stats.users, l: '註冊使用者' },
      { n: stats.activeUsers, l: '啟用中帳號' },
      { n: stats.sites, l: '已生成網站' },
      { n: stats.loginsToday, l: '近 24 小時登入' },
      { n: stats.generationsWeek, l: '近 7 日生成／儲存' },
      { n: stats.exportsWeek, l: '近 7 日匯出' }
    ];
    $('stats').innerHTML = items.map((it) =>
      '<article class="card stat"><div class="n">' + escapeHtml(String(it.n)) + '</div><div class="l">' + escapeHtml(it.l) + '</div></article>'
    ).join('');
  }

  function userRow(u, me) {
    const isMe = u.id === me.id;
    const roleBadge = u.role === 'admin' ? '<span class="badge tag-admin">管理員</span>' : '<span class="badge neutral">一般</span>';
    const status = u.disabled
      ? '<span class="badge tag-disabled">已停用</span>'
      : '<span class="badge">啟用</span>';
    const actions = [];
    if (!isMe && u.role !== 'admin') {
      actions.push('<button class="btn btn-sm" data-act="promote" data-id="' + escapeHtml(u.id) + '">設為管理員</button>');
    }
    if (!isMe && u.role === 'admin') {
      actions.push('<button class="btn btn-sm btn-secondary" data-act="demote" data-id="' + escapeHtml(u.id) + '">取消管理員</button>');
    }
    if (!isMe) {
      actions.push(u.disabled
        ? '<button class="btn btn-sm btn-secondary" data-act="enable" data-id="' + escapeHtml(u.id) + '">啟用</button>'
        : '<button class="btn btn-sm btn-secondary" data-act="disable" data-id="' + escapeHtml(u.id) + '">停用</button>');
      actions.push('<button class="btn btn-sm btn-danger" data-act="delete" data-id="' + escapeHtml(u.id) + '" data-email="' + escapeHtml(u.email) + '">刪除</button>');
    }
    return '<tr>' +
      '<td><strong>' + escapeHtml(u.name) + '</strong><br><span class="muted">' + escapeHtml(u.email) + '</span><div style="margin-top:6px">' + roleBadge + '</div></td>' +
      '<td>' + escapeHtml(AdPage.formatTime(u.createdAt)) + '</td>' +
      '<td>' + escapeHtml(AdPage.formatTime(u.lastLoginAt)) + '</td>' +
      '<td>' + escapeHtml(String(u.siteCount || 0)) + '</td>' +
      '<td>' + status + '</td>' +
      '<td>' + (actions.join(' ') || '—') + '</td>' +
      '</tr>';
  }

  async function loadAll(me) {
    const [stats, users, sites, activity] = await Promise.all([
      AdPage.api('/api/admin/stats'),
      AdPage.api('/api/admin/users'),
      AdPage.api('/api/admin/sites'),
      AdPage.api('/api/admin/activity')
    ]);
    renderStats(stats.stats);
    $('users-body').innerHTML = users.users.length
      ? users.users.map((u) => userRow(u, me)).join('')
      : '<tr><td colspan="6" class="muted">尚無使用者</td></tr>';
    $('sites-body').innerHTML = sites.sites.length
      ? sites.sites.map((s) =>
        '<tr>' +
          '<td>' + escapeHtml(s.name) + '</td>' +
          '<td>' + escapeHtml(s.owner.name) + '<br><span class="muted">' + escapeHtml(s.owner.email) + '</span></td>' +
          '<td>' + escapeHtml(templateLabel(s.template)) + '／' + escapeHtml(styleLabel(s.style)) + '</td>' +
          '<td>' + escapeHtml(AdPage.formatTime(s.createdAt)) + '</td>' +
          '<td><a href="/p/' + encodeURIComponent(s.id) + '" target="_blank">開啟</a></td>' +
        '</tr>'
      ).join('')
      : '<tr><td colspan="5" class="muted">尚無網站</td></tr>';
    $('activity-body').innerHTML = activity.activity.length
      ? activity.activity.map((a) =>
        '<tr>' +
          '<td>' + escapeHtml(AdPage.formatTime(a.createdAt)) + '</td>' +
          '<td>' + escapeHtml(TYPE_LABEL[a.type] || a.type) + '</td>' +
          '<td>' + escapeHtml(a.email || '—') + '</td>' +
          '<td>' + escapeHtml(metaText(a)) + '</td>' +
        '</tr>'
      ).join('')
      : '<tr><td colspan="4" class="muted">尚無紀錄</td></tr>';
  }

  async function init() {
    const me = await AdPage.requireUser();
    if (!me) return;
    if (me.role !== 'admin') {
      document.body.innerHTML = '<main class="wrap"><div class="card" style="padding:32px"><h1>沒有權限</h1><p>此頁面僅限管理員使用。</p><p><a href="/app">返回工作台</a></p></div></main>';
      return;
    }
    $('user-chip').textContent = me.name + '（管理員）';
    $('btn-logout').addEventListener('click', () => AdPage.logout());
    $('btn-refresh').addEventListener('click', () => loadAll(me).catch((e) => AdPage.toast(e.message)));

    $('users-body').addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act');
      try {
        if (act === 'promote') {
          await AdPage.api('/api/admin/users/' + encodeURIComponent(id), { method: 'PATCH', body: { role: 'admin' } });
          AdPage.toast('已設為管理員');
        } else if (act === 'demote') {
          await AdPage.api('/api/admin/users/' + encodeURIComponent(id), { method: 'PATCH', body: { role: 'user' } });
          AdPage.toast('已取消管理員');
        } else if (act === 'disable') {
          await AdPage.api('/api/admin/users/' + encodeURIComponent(id), { method: 'PATCH', body: { disabled: true } });
          AdPage.toast('已停用帳號');
        } else if (act === 'enable') {
          await AdPage.api('/api/admin/users/' + encodeURIComponent(id), { method: 'PATCH', body: { disabled: false } });
          AdPage.toast('已重新啟用');
        } else if (act === 'delete') {
          const email = btn.getAttribute('data-email') || '';
          if (!confirm('確定刪除使用者「' + email + '」及其所有網站？此動作無法復原。')) return;
          await AdPage.api('/api/admin/users/' + encodeURIComponent(id), { method: 'DELETE' });
          AdPage.toast('已刪除使用者');
        }
        await loadAll(me);
      } catch (ex) {
        AdPage.toast(ex.message);
      }
    });

    await loadAll(me);
  }

  init().catch((e) => {
    if (String(e.message || '').indexOf('管理員') !== -1 || String(e.message || '').indexOf('403') !== -1) {
      document.body.innerHTML = '<main class="wrap"><div class="card" style="padding:32px"><h1>沒有權限</h1><p>此頁面僅限管理員使用。</p><p><a href="/app">返回工作台</a></p></div></main>';
      return;
    }
    AdPage.toast(e.message || '載入失敗');
  });
})();
