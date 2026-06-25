// js/admin-points.js — Full points management page logic
import {
  collection, getDocs, addDoc, updateDoc, doc,
  serverTimestamp, increment, query, orderBy, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { showToast } from "./ui.js";
import { initGroqAssistant } from "./groq-admin.js";

function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

let allMembers = [];
let selectedIds = new Set();
let sortKey = 'points';
let sortDir = -1; // -1 = desc

// ── Load + render members ─────────────────────────────────────────
async function loadMembers() {
  const snap = await getDocs(query(collection(db, 'members'), orderBy('name')));
  allMembers = snap.docs.map(d => ({
    id: d.id,
    name: d.data().name || '(unnamed)',
    points: typeof d.data().pointsTotal === 'number' ? d.data().pointsTotal : 0,
    year: d.data().year || '',
    status: d.data().status || 'active',
    email: d.data().email || '',
  }));
  renderTable();
  updateSummary();
}

function sortedMembers(term = '') {
  let list = allMembers.filter(m => {
    if (!term) return true;
    return (m.name + m.year + m.email).toLowerCase().includes(term.toLowerCase());
  });
  list.sort((a, b) => {
    const av = sortKey === 'points' ? a.points : (a[sortKey] || '').toString().toLowerCase();
    const bv = sortKey === 'points' ? b.points : (b[sortKey] || '').toString().toLowerCase();
    if (av < bv) return sortDir;
    if (av > bv) return -sortDir;
    return 0;
  });
  return list;
}

function renderTable() {
  const tbody = document.getElementById('pts-tbody');
  const term  = document.getElementById('pts-search')?.value || '';
  if (!tbody) return;
  const list = sortedMembers(term);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:var(--space-8);color:var(--ink-300)">No members found.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(m => `
    <tr class="pts-row${selectedIds.has(m.id) ? ' selected' : ''}" data-id="${m.id}">
      <td class="pts-check-cell">
        <input type="checkbox" class="pts-check" data-id="${m.id}" ${selectedIds.has(m.id) ? 'checked' : ''}>
      </td>
      <td class="pts-name">${esc(m.name)}</td>
      <td class="pts-year">${esc(m.year)}</td>
      <td class="pts-status"><span class="status-badge status-${m.status}">${m.status}</span></td>
      <td class="pts-points-cell">
        <span class="pts-num">${m.points}</span>
        <div class="pts-inline-btns">
          <button class="pts-quick-btn pts-plus" data-id="${m.id}" title="+1 point">+1</button>
          <button class="pts-quick-btn pts-minus" data-id="${m.id}" title="-1 point">−1</button>
          <button class="pts-detail-btn" data-id="${m.id}" title="Manage & history">⋯</button>
        </div>
      </td>
    </tr>`).join('');

  // Checkboxes
  tbody.querySelectorAll('.pts-check').forEach(cb => {
    cb.addEventListener('change', e => {
      const id = e.target.dataset.id;
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      updateSelectionUI();
      e.target.closest('tr').classList.toggle('selected', e.target.checked);
    });
  });

  // Quick +1 / -1
  tbody.querySelectorAll('.pts-plus').forEach(btn => {
    btn.addEventListener('click', e => quickPoint(e.currentTarget.dataset.id, 1));
  });
  tbody.querySelectorAll('.pts-minus').forEach(btn => {
    btn.addEventListener('click', e => quickPoint(e.currentTarget.dataset.id, -1));
  });

  // Detail modal
  tbody.querySelectorAll('.pts-detail-btn').forEach(btn => {
    btn.addEventListener('click', e => openDetailModal(e.currentTarget.dataset.id));
  });

  // Row click selects
  tbody.querySelectorAll('.pts-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.type === 'checkbox' || e.target.closest('button')) return;
      const id = row.dataset.id;
      const cb = row.querySelector('.pts-check');
      if (selectedIds.has(id)) { selectedIds.delete(id); cb.checked = false; row.classList.remove('selected'); }
      else { selectedIds.add(id); cb.checked = true; row.classList.add('selected'); }
      updateSelectionUI();
    });
  });
}

function updateSummary() {
  const total = allMembers.reduce((s, m) => s + m.points, 0);
  const avg   = allMembers.length ? Math.round(total / allMembers.length) : 0;
  const top   = allMembers.reduce((best, m) => m.points > (best?.points ?? -Infinity) ? m : best, null);
  document.getElementById('pts-total-members').textContent = allMembers.length;
  document.getElementById('pts-total-points').textContent  = total;
  document.getElementById('pts-avg-points').textContent    = avg;
  document.getElementById('pts-top-member').textContent    = top ? `${top.name} (${top.points})` : '—';
}

function updateSelectionUI() {
  const count = selectedIds.size;
  const label = document.getElementById('sel-label');
  const bulkPanel = document.getElementById('bulk-panel');
  if (label) label.textContent = count ? `${count} selected` : '';
  if (bulkPanel) bulkPanel.classList.toggle('visible', count > 0);
}

// ── Quick single-point change ─────────────────────────────────────
async function quickPoint(id, delta) {
  const m = allMembers.find(x => x.id === id);
  if (!m) return;
  try {
    await addDoc(collection(db, 'members', id, 'points'), {
      delta, reason: delta > 0 ? 'Quick +1' : 'Quick −1',
      timestamp: serverTimestamp(), by: 'admin'
    });
    await updateDoc(doc(db, 'members', id), { pointsTotal: increment(delta) });
    m.points += delta;
    renderTable();
    updateSummary();
    showToast(`${delta > 0 ? '+' : ''}${delta} point — ${m.name}`);
  } catch (err) { console.error(err); showToast('Failed to update points'); }
}

// ── Bulk apply ────────────────────────────────────────────────────
async function applyBulk(ids, delta, reason) {
  const ops = ids.map(id => Promise.all([
    addDoc(collection(db, 'members', id, 'points'), {
      delta, reason: reason || 'Bulk award',
      timestamp: serverTimestamp(), by: 'admin'
    }),
    updateDoc(doc(db, 'members', id), { pointsTotal: increment(delta) }),
  ]));
  await Promise.all(ops);
  ids.forEach(id => { const m = allMembers.find(x => x.id === id); if (m) m.points += delta; });
  selectedIds.clear();
  renderTable();
  updateSummary();
  updateSelectionUI();
}

// ── Detail / history modal ────────────────────────────────────────
async function openDetailModal(id) {
  const m = allMembers.find(x => x.id === id);
  if (!m) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:520px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-5)">
        <div>
          <div style="font-family:var(--font-display);font-size:1.3rem;font-weight:600;color:var(--navy)">${esc(m.name)}</div>
          <div style="font-size:0.85rem;color:var(--ink-400)">${esc(m.year)} ${m.email ? '· ' + esc(m.email) : ''}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:2rem;font-weight:700;color:var(--navy)" id="modal-pts-num">${m.points}</div>
          <div style="font-size:0.75rem;color:var(--ink-300);text-transform:uppercase;letter-spacing:.06em">Points</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-bottom:var(--space-5)">
        <div class="input-group">
          <label class="input-label">Points to Add / Subtract</label>
          <input id="modal-delta" type="number" class="input" placeholder="e.g. 5 or -3" />
        </div>
        <div class="input-group">
          <label class="input-label">Reason</label>
          <input id="modal-reason" type="text" class="input" placeholder="e.g. Meeting attendance" />
        </div>
      </div>
      <div style="display:flex;gap:var(--space-3);margin-bottom:var(--space-6)">
        <button id="modal-apply" class="btn btn-navy" style="flex:1">Apply Points</button>
        <button id="modal-close" class="btn btn-ghost">Cancel</button>
      </div>

      <div style="font-size:0.78rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-300);margin-bottom:var(--space-3)">Transaction History</div>
      <div id="modal-history" style="max-height:240px;overflow-y:auto">
        <p style="color:var(--ink-300);font-size:0.88rem">Loading…</p>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  // Load history
  const histEl = backdrop.querySelector('#modal-history');
  try {
    const snap = await getDocs(query(collection(db, 'members', id, 'points'), orderBy('timestamp', 'desc')));
    if (snap.empty) {
      histEl.innerHTML = `<p style="color:var(--ink-300);font-size:0.88rem">No transactions yet.</p>`;
    } else {
      histEl.innerHTML = snap.docs.map(h => {
        const it = h.data();
        const ts = it.timestamp?.toDate?.()?.toLocaleString() || '';
        const sign = it.delta > 0 ? '+' : '';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:var(--space-2) 0;border-bottom:1px solid var(--ink-100)">
          <div>
            <span style="font-weight:700;color:${it.delta>=0?'var(--emerald)':'var(--ruby)'}">${sign}${it.delta}</span>
            <span style="margin-left:var(--space-2);color:var(--ink-500);font-size:0.88rem">${esc(it.reason||'')}</span>
          </div>
          <div style="font-size:0.78rem;color:var(--ink-300)">${esc(it.by||'admin')} · ${ts}</div>
        </div>`;
      }).join('');
    }
  } catch(e) { histEl.innerHTML = `<p style="color:var(--ruby);font-size:0.88rem">Failed to load history.</p>`; }

  // Apply button
  backdrop.querySelector('#modal-apply').addEventListener('click', async () => {
    const delta  = Number(backdrop.querySelector('#modal-delta').value);
    const reason = backdrop.querySelector('#modal-reason').value.trim() || 'Adjusted by admin';
    if (!delta) { showToast('Enter a non-zero value'); return; }
    try {
      await addDoc(collection(db, 'members', id, 'points'), {
        delta, reason, timestamp: serverTimestamp(), by: 'admin'
      });
      await updateDoc(doc(db, 'members', id), { pointsTotal: increment(delta) });
      m.points += delta;
      backdrop.querySelector('#modal-pts-num').textContent = m.points;
      renderTable();
      updateSummary();
      showToast(`${delta > 0 ? '+' : ''}${delta} points applied`);
      backdrop.remove();
    } catch (err) { console.error(err); showToast('Failed to apply points'); }
  });

  backdrop.querySelector('#modal-close').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', esc); } });
}

// ── Sort headers ──────────────────────────────────────────────────
function initSortHeaders() {
  document.querySelectorAll('[data-sort]').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = key === 'points' ? -1 : 1; }
      document.querySelectorAll('[data-sort]').forEach(h => h.classList.remove('sort-asc','sort-desc'));
      th.classList.add(sortDir === 1 ? 'sort-asc' : 'sort-desc');
      renderTable();
    });
  });
}

// ── DOMContentLoaded ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('pts-tbody')) return;

  if (localStorage.getItem('adminLoggedIn') !== 'true') {
    window.location.href = 'admin.html';
    return;
  }

  await loadMembers();
  initSortHeaders();

  // Search
  document.getElementById('pts-search')?.addEventListener('input', renderTable);

  // Select all checkbox
  document.getElementById('pts-select-all')?.addEventListener('change', e => {
    const term = document.getElementById('pts-search')?.value || '';
    const visible = sortedMembers(term);
    if (e.target.checked) visible.forEach(m => selectedIds.add(m.id));
    else selectedIds.clear();
    renderTable();
    updateSelectionUI();
  });

  // Bulk apply (to selected)
  document.getElementById('bulk-apply-sel')?.addEventListener('click', async () => {
    const delta  = Number(document.getElementById('bulk-delta').value);
    const reason = document.getElementById('bulk-reason').value.trim() || 'Bulk award';
    if (!delta) { showToast('Enter a point value'); return; }
    if (!selectedIds.size) { showToast('Select at least one member'); return; }
    if (!confirm(`${delta > 0 ? 'Add' : 'Remove'} ${Math.abs(delta)} point(s) ${delta > 0 ? 'to' : 'from'} ${selectedIds.size} member(s)?`)) return;
    try {
      await applyBulk([...selectedIds], delta, reason);
      showToast(`Points applied to ${selectedIds.size} members`);
    } catch (err) { console.error(err); showToast('Bulk apply failed'); }
  });

  // Add to ALL members
  document.getElementById('bulk-apply-all')?.addEventListener('click', async () => {
    const delta  = Number(document.getElementById('bulk-delta').value);
    const reason = document.getElementById('bulk-reason').value.trim() || 'Bulk award — all members';
    if (!delta) { showToast('Enter a point value'); return; }
    if (!confirm(`${delta > 0 ? 'Add' : 'Remove'} ${Math.abs(delta)} point(s) ${delta > 0 ? 'to' : 'from'} ALL ${allMembers.length} members?`)) return;
    try {
      await applyBulk(allMembers.map(m => m.id), delta, reason);
      showToast(`Points applied to all ${allMembers.length} members`);
    } catch (err) { console.error(err); showToast('Failed to apply to all'); }
  });

  // Expose refresh for AI assistant
  window.refreshPointsTable = loadMembers;

  // Init AI assistant
  initGroqAssistant('ai-assistant-container');
});
