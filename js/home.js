// js/home.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

function parseDateLocal(s) {
  if (!s) return null;
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

function escHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

// ── Next Meeting with countdown ────────────────────────────────────
export async function refreshNextMeeting() {
  const el = document.getElementById('home-next-meeting');
  if (!el) return;
  try {
    const snap = await getDocs(collection(db, 'events'));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcoming = items
      .map(it => ({ it, d: parseDateLocal(it.date) }))
      .filter(x => x.d && x.d >= todayStart)
      .sort((a, b) => a.d - b.d);
    const chosen = upcoming.find(x => (x.it.type || '').toLowerCase() === 'meeting') || upcoming[0] || null;
    if (!chosen) {
      el.innerHTML = `<p style="font-size:0.88rem;color:var(--ink-300)">No upcoming meetings scheduled.</p>`;
      return;
    }
    const ev = chosen.it;
    const d  = chosen.d;
    const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    el.innerHTML = `
      <div style="margin-bottom:var(--space-3)">
        <div style="font-weight:600;color:var(--navy);margin-bottom:4px">${escHtml(ev.title || 'Next Meeting')}</div>
        <div style="font-size:0.85rem;color:var(--ink-400)">${dateStr}${ev.time ? ' · ' + escHtml(ev.time) : ''}${ev.location ? ' · ' + escHtml(ev.location) : ''}</div>
      </div>
      <div class="countdown-grid" id="meeting-countdown"></div>`;
    startCountdown(d, document.getElementById('meeting-countdown'));
  } catch (err) {
    console.error('Failed to load next meeting', err);
    el.innerHTML = '<p style="font-size:0.88rem;color:var(--ink-300)">Unable to load meeting info.</p>';
  }
}

function startCountdown(targetDate, container) {
  if (!container) return;
  function update() {
    const now  = Date.now();
    const diff = targetDate.getTime() - now;
    if (diff <= 0) {
      container.innerHTML = `<div style="grid-column:1/-1;font-size:0.88rem;color:var(--gold-500);font-weight:600">🎉 Today!</div>`;
      return;
    }
    const days    = Math.floor(diff / 86400000);
    const hours   = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    container.innerHTML = [
      [days,    'Days'],
      [hours,   'Hours'],
      [minutes, 'Min'],
      [seconds, 'Sec'],
    ].map(([n, l]) => `<div class="countdown-cell"><span class="countdown-num">${String(n).padStart(2,'0')}</span><span class="countdown-label">${l}</span></div>`).join('');
  }
  update();
  const timer = setInterval(update, 1000);
  // cleanup when element removed
  const obs = new MutationObserver(() => { if (!document.contains(container)) { clearInterval(timer); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
}

window.refreshNextMeeting = refreshNextMeeting;
document.addEventListener('DOMContentLoaded', () => { refreshNextMeeting().catch(() => {}); });
