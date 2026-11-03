// public/assets/js/warning-detail.js
// Client hydration for warning detail URLs that were not prerendered at
// build time (/navarea/<RN>/warning/<num>-<year>, served through the
// /warning-shell rewrite). Prerendered pages are static HTML and never load
// this script. The shell page is noindex; search engines index the detail
// URL once the next deploy prerenders it. Uses the same public anon
// Supabase access as the map (assets/js/supabase.js) — no privileged data.
(function () {
  var REGION_RE = /^\/navarea\/(XXI|XX|XIX|XVIII|XVII|XVI|XV|XIV|XIII|XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\/warning\/(\d+)-(\d{2,4})\/?$/;
  var detailEl = document.getElementById('warningDetail');
  var emptyEl = document.getElementById('emptyState');
  var errorEl = document.getElementById('errorState');
  var titleEl = document.getElementById('warningTitle');
  if (!detailEl) return;

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

  function fail() { if (errorEl) errorEl.hidden = false; }
  function notFound() { if (emptyEl) emptyEl.hidden = false; }

  var m = REGION_RE.exec(window.location.pathname);
  if (!m) { notFound(); return; }
  var rn = m[1], num = m[2], yy = m[3];
  if (!window.hwSupabase) { fail(); return; }

  // Match on canonical_id's '<num>/<year>' tail (tolerates both 'NA IV' and
  // 'NAVAREA IV' prefixes), then disambiguate by the region token.
  window.hwSupabase
    .from('nav_warnings')
    .select('id, canonical_id, navarea, title, area_text, categories, status, triage_tier, data_quality, valid_from, valid_to, issued_at, raw_text, created_at, updated_at')
    .ilike('canonical_id', '%/' + num + '/' + yy)
    .limit(20)
    .then(function (res) {
      if (res.error) throw res.error;
      var rows = res.data || [];
      var wanted = ' ' + rn + ' ';
      var row = null;
      for (var i = 0; i < rows.length; i++) {
        var cid = String(rows[i].canonical_id || '').toUpperCase();
        if (cid.indexOf(wanted) === -1) continue;
        if (!row || rows[i].status === 'active') row = rows[i];
      }
      if (!row) { notFound(); return; }
      render(row, rn);
    })
    .catch(fail);

  function metaRow(label, value) {
    return value ? '<span class="meta-row"><span class="meta-label">' + label + '</span><span class="meta-value">' + value + '</span></span>' : '';
  }

  function render(w, rn) {
    var id = w.canonical_id || 'Warning';
    if (titleEl) titleEl.textContent = id;
    document.title = id + ' | Helm.Warning';
    var regionHref = '/navarea/' + rn;
    var mapHref = '/?navarea=' + encodeURIComponent('NA ' + rn);
    var issued = fmtDate(w.issued_at);
    var validFrom = fmtDate(w.valid_from);
    var validTo = fmtDate(w.valid_to);
    var validText = (validFrom || validTo) ? ((validFrom || 'unknown') + ' to ' + (validTo || 'until cancelled')) : '';
    var cats = Array.isArray(w.categories) ? w.categories.join(', ') : '';
    var html = '<p class="lead">' + esc(w.title || id) + (w.area_text ? ' &mdash; ' + esc(w.area_text) : '') + '</p>';
    html += '<div class="meta-rows">';
    html += metaRow('Region:', '<a href="' + regionHref + '">NAVAREA ' + rn + '</a>');
    html += metaRow('Status:', esc(w.status || 'active'));
    if (issued) html += metaRow('Issued:', esc(issued));
    if (validText) html += metaRow('Valid:', esc(validText));
    if (cats) html += metaRow('Categories:', esc(cats));
    if (w.triage_tier) html += metaRow('Geometry tier:', esc(w.triage_tier) + (w.data_quality ? ' &middot; ' + esc(w.data_quality) : ''));
    html += '</div>';
    html += '<section><h2>Original bulletin text</h2><pre class="warn-text">' + esc(w.raw_text || 'Original bulletin text is not available for this record.') + '</pre></section>';
    html += '<p class="backlinks"><a href="' + regionHref + '">All NAVAREA ' + rn + ' warnings</a><a href="' + mapHref + '">View on the live map</a><a href="/about#source-registry">Source registry</a></p>';
    detailEl.innerHTML = html;
  }
})();
