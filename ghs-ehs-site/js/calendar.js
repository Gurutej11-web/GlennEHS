// js/calendar.js
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

const calendarGrid = document.querySelector(".calendar-grid");
const monthNameEl = document.querySelector(".calendar-month");
const prevBtn = document.querySelector("#prev-month");
const nextBtn = document.querySelector("#next-month");

let currentDate = new Date();
let events = [];
let isAdmin = sessionStorage.getItem("adminLoggedIn") === "true";

// Logout buttons removed from calendar navigation
// Only Admin link visible
document.addEventListener("DOMContentLoaded", fetchEvents);

function showToast(msg, timeout = 2500){
  const wrapId = '__cal_toast_wrap';
  let wrap = document.getElementById(wrapId);
  if(!wrap){ wrap = document.createElement('div'); wrap.id = wrapId; wrap.style.position='fixed'; wrap.style.right='18px'; wrap.style.bottom='18px'; wrap.style.zIndex='120'; document.body.appendChild(wrap); }
  const t = document.createElement('div'); t.textContent = msg; t.style.background = 'rgba(52,111,208,0.95)'; t.style.color='white'; t.style.padding='8px 12px'; t.style.borderRadius='8px'; t.style.marginTop='8px'; wrap.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; setTimeout(()=>t.remove(),350); }, timeout);
}

async function fetchEvents() {
  events = [];
  const snapshot = await getDocs(collection(db, "calendar"));
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    data.id = docSnap.id;
    events.push(data);
  });
  renderCalendar();
  renderUpcomingList();
}

// Parse a date-only string (YYYY-MM-DD) as a local Date (avoids timezone shifts)
function parseDateLocal(s){
  if(!s) return null;
  // if it looks like YYYY-MM-DD, construct local date
  const m = /^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(s);
  if(m){
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(s);
}

function renderUpcomingList(){
  const upEl = document.getElementById('calendar-upcoming');
  if(!upEl) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = events
    .map(ev=>({ev, d: parseDateLocal(ev.date)}))
    .filter(x=>x.d && x.d >= today)
    .sort((a,b)=> a.d - b.d)
    .slice(0,5);
  upEl.innerHTML = upcoming.length ? upcoming.map(x=>{
    const ev = x.ev; const dt = x.d;
    return `<div class="event-card" style="padding:8px;margin-bottom:8px"><div style="display:flex;justify-content:space-between"><div><strong>${escapeHtml(ev.title||'')}</strong><div style='color:var(--muted);font-size:0.85rem'>${dt.toLocaleDateString()}</div></div><div class='event-type ${escapeHtml(ev.type||'other')}' style='align-self:center'>${escapeHtml(ev.type||'other')}</div></div></div>`;
  }).join('') : `<div class="muted">No upcoming events.</div>`;
}

function renderCalendar() {
  calendarGrid.innerHTML = "";
  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1,0).getDate();

  monthNameEl.textContent = currentDate.toLocaleString("default",{month:"long",year:"numeric"});

  for(let i=0;i<firstDay;i++) calendarGrid.appendChild(document.createElement("div"));

  for(let day=1;day<=daysInMonth;day++){
    const dayDiv = document.createElement("div");
    dayDiv.className="calendar-day";

    const dayNumber = document.createElement("div");
    dayNumber.className="day-number";
    dayNumber.textContent=day;
    dayDiv.appendChild(dayNumber);

    const dayEvents = events.filter(ev=>{
      const evDate = parseDateLocal(ev.date);
      if(!evDate) return false;
      return evDate.getDate()===day && evDate.getMonth()===month && evDate.getFullYear()===year;
    });

    dayEvents.forEach(ev=>{
      const evDiv = document.createElement("div");
      const type = ev.type || 'other';
      evDiv.className="calendar-event type-" + type;
      evDiv.innerHTML = `<div class="calendar-event-title">${escapeHtml(ev.title||'')}</div>${ev.time || ev.location ? `<div class="calendar-event-meta">${escapeHtml(ev.time||'')}${ev.time && ev.location ? ' • ' : ''}${escapeHtml(ev.location||'')}</div>` : ''}`;

  evDiv.addEventListener("mouseover", e=>showTooltip(ev,e));
      evDiv.addEventListener("mouseout", hideTooltip);

      if(isAdmin){
        evDiv.style.cursor="pointer";
        evDiv.addEventListener("click", ()=>editEvent(ev));
      }

      dayDiv.appendChild(evDiv);
    });

  if(isAdmin) dayDiv.addEventListener("click", e=>{if(e.target===dayDiv)addEvent(day);});

    calendarGrid.appendChild(dayDiv);
  }
}

const tooltip = document.createElement("div");
tooltip.className="calendar-tooltip";
document.body.appendChild(tooltip);

function showTooltip(ev,e){
  const when = ev.date || '';
  const meta = (ev.time ? escapeHtml(ev.time) : '') + (ev.time && ev.location ? ' • ' : '') + (ev.location ? escapeHtml(ev.location) : '');
  tooltip.innerHTML=`<strong>${escapeHtml(ev.title)}</strong><br>${escapeHtml(ev.description || ev.desc || "")}<br><small style="opacity:0.9">${when}${meta ? ' • ' + meta : ''}</small>`;
  tooltip.style.display="block";
  // position tooltip and clamp to viewport
  const margin = 12;
  const vw = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  let left = e.pageX + 10;
  let top = e.pageY + 10;
  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
  // measure and adjust if overflowing
  const rect = tooltip.getBoundingClientRect();
  if(rect.right > vw - margin) tooltip.style.left = (left - (rect.right - vw) - margin) + 'px';
  if(rect.bottom > vh - margin) tooltip.style.top = (top - (rect.bottom - vh) - margin) + 'px';
}
function hideTooltip(){tooltip.style.display="none";}

function escapeHtml(s){ if(s==null) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

prevBtn.addEventListener("click",()=>{currentDate.setMonth(currentDate.getMonth()-1);renderCalendar();});
nextBtn.addEventListener("click",()=>{currentDate.setMonth(currentDate.getMonth()+1);renderCalendar();});

function addEvent(day){
  const modal = createModal();
  const month = currentDate.getMonth()+1;
  const year = currentDate.getFullYear();
  const formattedDate = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;

  modal.querySelector("#modal-date").value=formattedDate;
  modal.querySelector("#modal-title").focus();

  modal.querySelector("#modal-save").onclick=async()=>{
    const title = modal.querySelector("#modal-title").value.trim();
    const description = modal.querySelector("#modal-desc").value.trim();
    const date = modal.querySelector("#modal-date").value;
    if(!title) { showToast('Title is required!'); return; }
    // create calendar doc with a generated id, then mirror to events with same id
    try{
      const type = modal.querySelector('#modal-type') ? modal.querySelector('#modal-type').value : 'other';
      const calRef = doc(collection(db, 'calendar'));
      await setDoc(calRef, { title, description, date, type });
      await setDoc(doc(db, 'events', calRef.id), { title, description, date, type });
    }catch(err){ console.error('Failed to save calendar event', err); showToast('Failed to save event.'); return; }
    document.body.removeChild(modal);
    showToast('Event added');
    fetchEvents();
    if(window.refreshEvents) await window.refreshEvents();
  };

  // attach cancel and Escape key handling for add modal
  const cancelAddBtn = modal.querySelector("#modal-cancel");
  const onCancel = ()=>{
    document.body.removeChild(modal);
    document.removeEventListener('keydown', onKey);
  };
  cancelAddBtn.onclick = onCancel;
  function onKey(e){ if(e.key === 'Escape') onCancel(); }
  document.addEventListener('keydown', onKey);
}

function editEvent(ev){
  const modal = createModal(ev);
  const buttonRow = modal.querySelector("div:last-child");
  // ensure modal cancel works
  const cancelBtn = modal.querySelector('#modal-cancel');
  const onCancel = ()=>{ document.body.removeChild(modal); document.removeEventListener('keydown', onKey); };
  cancelBtn.onclick = onCancel;
  function onKey(e){ if(e.key === 'Escape') onCancel(); }
  document.addEventListener('keydown', onKey);

  modal.querySelector("#modal-save").onclick=async()=>{
    const title = modal.querySelector("#modal-title").value.trim();
    const description = modal.querySelector("#modal-desc").value.trim();
    const date = modal.querySelector("#modal-date").value;
    if(!title) { showToast('Title is required!'); return; }
    try{
      await updateDoc(doc(db,"calendar",ev.id),{title,description,date});
      try{ await updateDoc(doc(db,'events',ev.id),{title,description,date}); }catch(e){ console.warn('Failed to update events mirror',e); }
    }catch(err){ console.error('Failed to update calendar event', err); showToast('Failed to update event.'); return; }
    document.body.removeChild(modal);
    showToast('Event updated');
    fetchEvents();
    if(window.refreshEvents) await window.refreshEvents();
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.className="btn btn-primary";
  deleteBtn.textContent="Delete";
  buttonRow.insertBefore(deleteBtn,cancelBtn);

  deleteBtn.addEventListener("click", async()=>{
    if(confirm("Delete this event?")){
      try{
        await deleteDoc(doc(db,'calendar',ev.id));
        await deleteDoc(doc(db,'events',ev.id));
        document.body.removeChild(modal);
        showToast('Event deleted');
        fetchEvents();
        if(window.refreshEvents) await window.refreshEvents();
      }catch(err){ console.error('Failed to delete event',err); showToast('Failed to delete event.'); }
    }
  });
}

function createModal(ev={title:"",description:"",date:""}){
  const modal=document.createElement("div");
  modal.className="modal-backdrop";
  modal.innerHTML=`
    <div class="modal">
      <h3>${ev.title?"Edit Event":"Add Event"}</h3>
      <input type="text" id="modal-title" class="input" placeholder="Title"><br><br>
      <textarea id="modal-desc" class="input" placeholder="Description"></textarea><br><br>
      <input type="date" id="modal-date" class="input"><br><br>
      <select id="modal-type" class="input">
        <option value="meeting">Meeting</option>
        <option value="workshop">Workshop</option>
        <option value="service">Service</option>
        <option value="other">Other</option>
      </select>
      <br><br>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button id="modal-save" class="btn btn-primary">Save</button>
        <button id="modal-cancel" class="btn btn-primary">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  // set values after append to avoid template-escaping issues
  const titleEl = modal.querySelector('#modal-title');
  const descEl = modal.querySelector('#modal-desc');
  const dateEl = modal.querySelector('#modal-date');
  titleEl.value = ev.title || '';
  descEl.value = ev.description || ev.desc || '';
  dateEl.value = ev.date || '';
  const typeEl = modal.querySelector('#modal-type');
  if(typeEl) typeEl.value = ev.type || 'other';
  return modal;
}
