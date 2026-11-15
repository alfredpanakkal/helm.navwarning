// public/assets/js/navarea-page.js
// Snapshot-first hydration for the 21 prerendered NAVAREA regional pages.
// Static JSON is served from Vercel's CDN; Supabase remains authoritative.
(function () {
  var cfgEl = document.getElementById('navareaPageConfig');
  if (!cfgEl) return;
  var cfg;
  try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }
  var listEl = document.getElementById('warningList');
  var emptyEl = document.getElementById('emptyState');
  var errorEl = document.getElementById('errorState');
  var statusEl = document.getElementById('dataStatus');
  var loadMoreBtn = document.getElementById('loadMore');
  var countEl = document.getElementById('statCount');
  var updatedEl = document.getElementById('statUpdated');
  var PAGE_SIZE = 25;
  var offset = 0;
  var seen = {};
  var busy = false;
  var hasSnapshot = false;
  var snapshotRows = [];
  var liveAvailable = false;

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .split('&').join('&amp;')
      .split('<').join('&lt;')
      .split('>').join('&gt;')
      .split('"').join('&quot;');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getUTCDate() + ' ' + months[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  function warningRow(w) {
    var id = w.canonical_id || w.id || 'Unknown';
    var tail = String(id).split(' ').pop();
    var detailHref = /^\d+\/\d+$/.test(tail) ? ('/navarea/' + cfg.id + '/warning/' + tail.replace(/\//g, '-')) : '';
    if (seen[id]) return null;
    seen[id] = true;
    var title = w.title || id;
    var issued = fmtDate(w.issued_at);
    var tier = w.triage_tier ? ('Tier ' + w.triage_tier) : '';
    var mapHref = '/?navarea=' + encodeURIComponent(cfg.code);
    return '<details class="warn-item">' +
      '<summary>' +
        '<span class="warn-id">' + esc(id) + '</span>' +
        '<span class="warn-title">' + esc(title) + '</span>' +
        (issued ? '<span class="warn-date">Issued ' + esc(issued) + '</span>' : '') +
      '</summary>' +
      '<div class="warn-body">' +
        '<pre class="warn-text">' + esc(w.raw_text || w.area_text || 'Original bulletin text is not available for this record.') + '</pre>' +
        (tier ? '<p class="warn-meta">Geometry tier: ' + esc(tier) + (w.data_quality ? ' &middot; ' + esc(w.data_quality) : '') + '</p>' : '') +
        '<a class="warn-maplink" href="' + mapHref + '">View ' + esc(cfg.code) + ' region on the live map</a>' +
        (detailHref ? '<a class="warn-maplink" href="' + detailHref + '">Warning detail page</a>' : '') +
      '</div>' +
    '</details>';
  }

  function renderRows(rows, append) {
    if (!append) {
      seen = {};
      listEl.innerHTML = '';
    }
    var html = [];
    for (var i = 0; i < rows.length; i++) {
      var piece = warningRow(rows[i]);
      if (piece) html.push(piece);
    }
    if (html.length) listEl.insertAdjacentHTML('beforeend', html.join(''));
  }

  function setStatus(message) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.hidden = !message;
  }

  function setCount(count) {
    countEl.textContent = count + (count === 1 ? ' in-force warning' : ' in-force warnings');
  }

  function applySnapshot(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.navarea !== cfg.code ||
        !Array.isArray(snapshot.warnings)) return false;
    var rows = snapshot.warnings.filter(function (w) {
      return w && w.status === 'active';
    });
    hasSnapshot = true;
    snapshotRows = rows;
    renderRows(rows.slice(0, PAGE_SIZE), false);
    offset = Math.min(rows.length, PAGE_SIZE);
    loadMoreBtn.hidden = rows.length <= PAGE_SIZE;
    emptyEl.hidden = true; // A zero snapshot is not proof that the live database is empty.
    if (rows.length) {
      setCount(rows.length);
      setStatus('Showing saved warning snapshot from ' + (fmtDate(snapshot.generatedAt) || 'an earlier build') + '. Checking live data…');
    } else {
      countEl.textContent = 'Checking live data…';
      setStatus('No warnings in the saved snapshot. Checking the live database…');
    }
    if (snapshot.generatedAt) updatedEl.textContent = fmtDate(snapshot.generatedAt);
    return true;
  }

  function loadSnapshot() {
    return fetch('/navarea/' + encodeURIComponent(cfg.id) + '/warnings.json', { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (snapshot) {
        return applySnapshot(snapshot);
      })
      .catch(function () { return false; });
  }

  function fetchPage(start, end) {
    return window.hwSupabase
      .from('nav_warnings')
      .select('id, canonical_id, navarea, title, area_text, categories, status, triage_tier, data_quality, valid_from, valid_to, issued_at, raw_text, created_at, updated_at', { count: 'exact' })
      .in('navarea', [cfg.id, cfg.code, 'NAVAREA ' + cfg.id])
      .eq('status', 'active')
      .order('issued_at', { ascending: false, nullsFirst: false })
      .range(start, end);
  }

  function showRefreshError() {
    errorEl.textContent = hasSnapshot
      ? 'Live data could not be refreshed. Showing the saved snapshot from ' + (updatedEl.textContent || 'the last successful build') + '. Verify current broadcasts with the official coordinator.'
      : 'The saved warning snapshot is unavailable and the live warning list could not be loaded. Retry later or check the official coordinator broadcasts.';
    errorEl.hidden = false;
    setStatus(hasSnapshot ? 'Offline copy shown · live refresh failed' : 'Warning data is temporarily unavailable');
    if (loadMoreBtn) loadMoreBtn.hidden = !(hasSnapshot && snapshotRows.length > offset);
    if (!hasSnapshot) countEl.textContent = 'Unavailable';
  }

  function refreshLive() {
    if (!window.hwSupabase) {
      showRefreshError();
      return Promise.resolve();
    }
    return fetchPage(0, PAGE_SIZE - 1).then(function (res) {
      if (res.error) throw res.error;
      var rows = res.data || [];
      liveAvailable = true;
      renderRows(rows, false);
      offset = rows.length;
      var total = typeof res.count === 'number' ? res.count : rows.length;
      setCount(total);
      emptyEl.hidden = total !== 0;
      errorEl.hidden = true;
      loadMoreBtn.hidden = rows.length < PAGE_SIZE || rows.length >= total;
      setStatus('Live warning data refreshed successfully.');
      return window.hwSupabase
        .from('nav_warnings')
        .select('updated_at')
        .in('navarea', [cfg.id, cfg.code, 'NAVAREA ' + cfg.id])
        .order('updated_at', { ascending: false })
        .limit(1)
        .then(function (u) {
          var ts = u.data && u.data[0] && u.data[0].updated_at;
          if (ts) updatedEl.textContent = fmtDate(ts);
        })
        .catch(function () { /* keep the snapshot or previous timestamp */ });
    }).catch(function () {
      showRefreshError();
    });
  }

  function loadMore() {
    if (busy) return;
    if (!liveAvailable && hasSnapshot) {
      var cachedRows = snapshotRows.slice(offset, offset + PAGE_SIZE);
      renderRows(cachedRows, true);
      offset += cachedRows.length;
      loadMoreBtn.hidden = offset >= snapshotRows.length;
      return;
    }
    if (!window.hwSupabase) return;
    busy = true;
    fetchPage(offset, offset + PAGE_SIZE - 1).then(function (res) {
      if (res.error) throw res.error;
      var rows = res.data || [];
      renderRows(rows, true);
      offset += rows.length;
      var total = typeof res.count === 'number' ? res.count : offset;
      loadMoreBtn.hidden = rows.length < PAGE_SIZE || offset >= total;
    }).catch(function () {
      errorEl.textContent = 'More warnings could not be loaded. The warnings already displayed are still available.';
      errorEl.hidden = false;
    }).finally(function () {
      busy = false;
    });
  }

  function hydrate() {
    setStatus('Loading saved warning snapshot…');
    loadSnapshot().then(function () {
      refreshLive();
    });
  }

  if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMore);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();
