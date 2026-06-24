// js/events.js
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { toYMD, ymdToDate, displayDateFromYMD, formatDateShortFromYMD } from './date-utils.js';

async function loadEvents() {
  const container = document.getElementById("events-list");
  if (!container) return;
  // Use a small loading skeleton to avoid layout jumps
  container.innerHTML = `
    <div class="event-card loading" aria-busy="true">
      <div style="height:14px;width:70%;background:linear-gradient(90deg,#eef2fb,#f7fbff);border-radius:6px;margin-bottom:8px"></div>
      <div style="height:12px;width:40%;background:linear-gradient(90deg,#eef2fb,#f7fbff);border-radius:6px"></div>
    </div>`;

  // Try to reconcile if helper exists (do not block UI if it fails)
  if (window.reconcileCalendarToEvents) {
    try {
      await window.reconcileCalendarToEvents();
    } catch (e) {
      console.warn('reconcile failed', e);
    }
  }

  try {
    const snapshot = await getDocs(collection(db, "events"));
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // sort by date (earliest first) using normalized local dates
  list.sort((a, b) => (ymdToDate(toYMD(a.date)) || 0) - (ymdToDate(toYMD(b.date)) || 0));

    if (!list.length) {
      container.innerHTML = `<div class="muted">No upcoming events.</div>`;
      console.info('events: no documents found in events collection');
      return;
    }

    // Determine rendering mode from data attribute: "home" (compact, next 3) or "page" (today+future)
    const mode = container.dataset.mode || 'home';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let renderList = [];
    if (mode === 'page') {
      // show today + future (inclusive)
      renderList = list.filter(ev => (ymdToDate(toYMD(ev.date)) || 0) >= todayStart);
    } else {
      // home: show the next 3 upcoming events (inclusive of today)
      renderList = list.filter(ev => (ymdToDate(toYMD(ev.date)) || 0) >= todayStart).slice(0, 3);
    }

    if (renderList.length === 0) {
      container.innerHTML = `<div class="muted">No upcoming events.</div>`;
      return;
    }

    container.innerHTML = renderList.map(e => renderEventCard(e)).join('');

    // wire up filter buttons (only on page mode)
  if(mode === 'page'){
      const allBtn = document.getElementById('filter-all');
      const upcomingBtn = document.getElementById('filter-upcoming');
      const pastBtn = document.getElementById('filter-past');
      const typeSelect = document.getElementById('filter-type');
      // Remember user's current filter mode so changing type doesn't switch mode
      let currentMode = 'all';
      function setActiveButton(mode){
        const map = { all: allBtn, upcoming: upcomingBtn, past: pastBtn };
        // make all buttons ghosted and not active
        Object.values(map).forEach(b=>{
          if(!b) return;
          b.classList.remove('active');
          b.classList.add('btn-ghost');
        });
        // activate the chosen one (remove ghost)
        const chosen = map[mode];
        if(chosen){
          chosen.classList.add('active');
          chosen.classList.remove('btn-ghost');
        }
      }

      function renderFiltered(mode, selType){
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let filtered = list.slice();
        if(mode === 'upcoming') filtered = filtered.filter(ev => (ymdToDate(toYMD(ev.date)) || 0) >= todayStart);
        else if(mode === 'past') filtered = filtered.filter(ev => (ymdToDate(toYMD(ev.date)) || 0) < todayStart);
        if(selType && selType !== 'all') filtered = filtered.filter(ev => (ev.type||'other') === selType);
        // Sort: past -> newest first, otherwise -> oldest first
        filtered.sort((a,b) => {
          const da = a.date ? new Date(a.date) : new Date(0);
          const db = b.date ? new Date(b.date) : new Date(0);
          if(mode === 'past') return db - da; // newest first
          return da - db; // oldest first
        });
        container.innerHTML = filtered.map(e => renderEventCard(e)).join('');
        Array.from(container.querySelectorAll('.reveal')).forEach(el=>el.classList.add('in-view'));
      }

      function applyFilter(filter){ currentMode = filter; setActiveButton(filter); renderFiltered(filter, typeSelect?.value || 'all'); }
      allBtn?.addEventListener('click', ()=> applyFilter('all'));
      upcomingBtn?.addEventListener('click', ()=> applyFilter('upcoming'));
      pastBtn?.addEventListener('click', ()=> applyFilter('past'));
      // When type changes, keep currentMode and only re-render with the selected type
      typeSelect?.addEventListener('change', ()=> renderFiltered(currentMode, typeSelect.value || 'all'));

      // initialize active button based on default (all)
      setActiveButton('all');
    }

    // populate aside upcoming quick list if present
    try{
      const asideList = document.getElementById('upcoming-aside-list');
      if(asideList){
        const upcoming = list.filter(ev => (ymdToDate(toYMD(ev.date)) || 0) >= todayStart).slice(0,5);
        asideList.innerHTML = upcoming.length ? upcoming.map(e => `<li><strong style="color:var(--primary-500)">${escapeHtml(e.title||'')}</strong><div style="font-size:0.9rem;color:var(--muted)">${escapeHtml(displayDateFromYMD(toYMD(e.date)))}</div></li>`).join('') : '<li class="muted">No upcoming events</li>';
      }
    }catch(e){console.warn('failed to fill aside upcoming list',e)}

    // expose some debug info if console is open
    console.info('events: rendered', list.length, 'items');
    // ensure container has a reasonable min-height so it doesn't collapse
    try{ container.style.minHeight = '120px'; }catch(e){}
    // force visible state for reveal elements so they appear immediately
    Array.from(container.querySelectorAll('.reveal')).forEach(el=> el.classList.add('in-view'));
  } catch (err) {
    console.error('Failed to load events', err);
    container.innerHTML = `<div class="muted">Failed to load events. Check console for details.</div>`;
  }
}

// expose a refresh helper so other scripts (admin/calendar) can call
window.refreshEvents = loadEvents;
document.addEventListener("DOMContentLoaded", loadEvents);

function renderEventCard(e) {
  const date = e.date ? ymdToDate(toYMD(e.date)) : null;
  const type = e.type || 'other';
  const typeClass = `type-${escapeHtml(type)}`;
  const badgeClass = `badge-${escapeHtml(type)}`;
  const desc = escapeHtml((e.description || e.desc || '').trim());
  const shortDesc = desc.length > 200 ? desc.slice(0, 200) + '…' : desc;
  const month = date ? date.toLocaleString('default', { month: 'short' }).toUpperCase() : '';
  const day   = date ? date.getDate() : '';
  const year  = date ? date.getFullYear() : '';
  const loc   = escapeHtml(e.location || e.room || '');
  return `
    <article class="event-card ${typeClass}" data-type="${escapeHtml(type)}">
      <div class="event-date-block" aria-label="${month} ${day} ${year}">
        <span class="event-date-month">${month}</span>
        <span class="event-date-day">${day}</span>
        <span class="event-date-year">${year}</span>
      </div>
      <div class="event-body">
        <span class="event-type-badge ${badgeClass}">${escapeHtml(type)}</span>
        <div class="event-title">${escapeHtml(e.title || '')}</div>
        ${shortDesc ? `<p class="event-desc">${shortDesc}</p>` : ''}
        <div class="event-meta">
          ${loc ? `<span class="event-meta-item"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${loc}</span>` : ''}
        </div>
      </div>
    </article>
  `;
}

// small helper to escape HTML into text nodes for simple values
function escapeHtml(s) { if (s == null) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
