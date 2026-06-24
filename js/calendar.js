// js/calendar.js — redesigned for new ENHS site
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { showToast } from './ui.js';

// Use new HTML element IDs
const calDays     = document.getElementById('cal-days');
const monthTitle  = document.getElementById('cal-month-title');
const prevBtn     = document.getElementById('cal-prev');
const nextBtn     = document.getElementById('cal-next');
const selectedEl  = document.getElementById('cal-selected-events');

let currentDate = new Date();
let events = [];
let isAdmin = localStorage.getItem('adminLoggedIn') === 'true';
let selectedDay = null;

window.addEventListener('storage', e => {
  if (e.key === 'adminLoggedIn') { isAdmin = e.newValue === 'true'; renderCalendar(); }
});

document.addEventListener('DOMContentLoaded', fetchEvents);

async function fetchEvents() {
  if (monthTitle) monthTitle.textContent = 'Loading…';
  try {
    const snapshot = await getDocs(collection(db, 'calendar'));
    events = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCalendar();
  } catch (err) {
    console.error('Failed to load calendar events', err);
    if (calDays) calDays.innerHTML = '<p class="loading-text">Failed to load events.</p>';
  }
}

function parseDateLocal(s) {
  if (!s) return null;
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(s);
}

function renderCalendar() {
  if (!calDays) return;
  calDays.innerHTML = '';

  const month    = currentDate.getMonth();
  const year     = currentDate.getFullYear();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today    = new Date();

  if (monthTitle) {
    monthTitle.textContent = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  // Leading empty cells
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'calendar-day other-month';
    calDays.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
    if (isToday) cell.classList.add('today');
    if (selectedDay === day) cell.classList.add('selected');

    const numEl = document.createElement('div');
    numEl.className = 'calendar-day-num';
    numEl.textContent = day;
    cell.appendChild(numEl);

    const dayEvents = events.filter(ev => {
      const d = parseDateLocal(ev.date);
      return d && d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });

    dayEvents.slice(0, 3).forEach(ev => {
      const dot = document.createElement('div');
      dot.className = `cal-event-dot type-${escHtml(ev.type || 'other')}`;
      dot.textContent = escHtml(ev.title || '');
      cell.appendChild(dot);
    });
    if (dayEvents.length > 3) {
      const more = document.createElement('div');
      more.className = 'cal-event-dot type-other';
      more.textContent = `+${dayEvents.length - 3} more`;
      cell.appendChild(more);
    }

    // Click: show day events in sidebar
    cell.addEventListener('click', () => {
      document.querySelectorAll('.calendar-day.selected').forEach(c => c.classList.remove('selected'));
      cell.classList.add('selected');
      selectedDay = day;
      showDayEvents(day, month, year, dayEvents);
      if (isAdmin && dayEvents.length === 0) openAddModal(day);
    });

    calDays.appendChild(cell);
  }
}

function showDayEvents(day, month, year, dayEvents) {
  if (!selectedEl) return;
  const dateLabel = new Date(year, month, day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  if (!dayEvents.length) {
    selectedEl.innerHTML = `<p style="font-size:0.9rem;color:var(--ink-300)">${dateLabel}</p><p style="font-size:0.88rem;color:var(--ink-300);margin-top:var(--space-2)">No events this day.${isAdmin ? ' Click the day to add one.' : ''}</p>`;
    return;
  }
  selectedEl.innerHTML = `<p style="font-size:0.82rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--ink-300);margin-bottom:var(--space-3)">${dateLabel}</p>` +
    dayEvents.map(ev => {
      const type = ev.type || 'other';
      return `<div style="margin-bottom:var(--space-3);padding:var(--space-3);border-radius:var(--r-md);background:var(--surface-2);border-left:3px solid var(--ev-${type})">
        <div style="font-weight:600;font-size:0.9rem;color:var(--navy);margin-bottom:4px">${escHtml(ev.title || '')}</div>
        <span class="event-type-badge badge-${type}" style="font-size:0.65rem">${type}</span>
        ${ev.time ? `<div style="font-size:0.8rem;color:var(--ink-400);margin-top:4px">🕐 ${escHtml(ev.time)}</div>` : ''}
        ${ev.location ? `<div style="font-size:0.8rem;color:var(--ink-400)">📍 ${escHtml(ev.location)}</div>` : ''}
        ${ev.description ? `<p style="font-size:0.82rem;color:var(--ink-400);margin:6px 0 0">${escHtml(ev.description)}</p>` : ''}
        ${isAdmin ? `<div style="display:flex;gap:6px;margin-top:var(--space-2)"><button class="btn btn-ghost btn-sm" onclick="openEditModal('${ev.id}')">Edit</button><button class="btn btn-ghost btn-sm" style="color:var(--ruby)" onclick="deleteCalEvent('${ev.id}')">Delete</button></div>` : ''}
      </div>`;
    }).join('');
}

function openAddModal(day) {
  const month = currentDate.getMonth() + 1;
  const year  = currentDate.getFullYear();
  const date  = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  openModal({ date });
}

window.openEditModal = async (id) => {
  const ev = events.find(e => e.id === id);
  if (ev) openModal(ev);
};

window.deleteCalEvent = async (id) => {
  if (!confirm('Delete this event?')) return;
  try {
    await deleteDoc(doc(db, 'calendar', id));
    await deleteDoc(doc(db, 'events', id)).catch(() => {});
    showToast('Event deleted');
    await fetchEvents();
  } catch (err) { console.error(err); showToast('Failed to delete event.'); }
};

function openModal(ev = {}) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" style="max-width:480px">
      <h3>${ev.title ? 'Edit Event' : 'Add Event'}</h3>
      <div style="display:grid;gap:var(--space-3)">
        <div class="input-group"><label class="input-label">Title</label><input id="m-title" class="input" value="${escHtml(ev.title || '')}" placeholder="Event title" /></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3)">
          <div class="input-group"><label class="input-label">Date</label><input id="m-date" type="date" class="input" value="${escHtml(ev.date || '')}" /></div>
          <div class="input-group"><label class="input-label">Type</label>
            <select id="m-type" class="input">
              <option value="meeting">Meeting</option>
              <option value="workshop">Workshop</option>
              <option value="service">Service</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div class="input-group"><label class="input-label">Time (optional)</label><input id="m-time" class="input" value="${escHtml(ev.time || '')}" placeholder="e.g. 3:35 PM" /></div>
        <div class="input-group"><label class="input-label">Location (optional)</label><input id="m-location" class="input" value="${escHtml(ev.location || '')}" placeholder="Room / location" /></div>
        <div class="input-group"><label class="input-label">Description</label><textarea id="m-desc" class="input">${escHtml(ev.description || ev.desc || '')}</textarea></div>
      </div>
      <div class="modal-actions">
        <button id="m-cancel" class="btn btn-ghost">Cancel</button>
        <button id="m-save" class="btn btn-navy">Save Event</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  const typeEl = backdrop.querySelector('#m-type');
  if (typeEl) typeEl.value = ev.type || 'other';

  backdrop.querySelector('#m-cancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', esc); } });

  backdrop.querySelector('#m-save').addEventListener('click', async () => {
    const title    = backdrop.querySelector('#m-title').value.trim();
    const date     = backdrop.querySelector('#m-date').value;
    const type     = backdrop.querySelector('#m-type').value;
    const time     = backdrop.querySelector('#m-time').value.trim();
    const location = backdrop.querySelector('#m-location').value.trim();
    const desc     = backdrop.querySelector('#m-desc').value.trim();
    if (!title || !date) { showToast('Title and date are required.'); return; }
    const payload = { title, date, type, time, location, description: desc };
    try {
      if (ev.id) {
        await updateDoc(doc(db, 'calendar', ev.id), payload);
        await updateDoc(doc(db, 'events', ev.id), payload).catch(() => {});
        showToast('Event updated');
      } else {
        const calRef = doc(collection(db, 'calendar'));
        await setDoc(calRef, payload);
        await setDoc(doc(db, 'events', calRef.id), payload);
        showToast('Event added');
      }
      backdrop.remove();
      await fetchEvents();
      if (window.refreshEvents) window.refreshEvents();
    } catch (err) { console.error(err); showToast('Failed to save event.'); }
  });
}

if (prevBtn) prevBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); selectedDay = null; renderCalendar(); });
if (nextBtn) nextBtn.addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); selectedDay = null; renderCalendar(); });

function escHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

// Create tooltip
const tooltip = document.createElement('div');
tooltip.className = 'calendar-tooltip';
tooltip.style.display = 'none';
document.body.appendChild(tooltip);
