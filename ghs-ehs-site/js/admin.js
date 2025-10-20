// ======== Admin Portal Logic (Firestore-backed) ========
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
// expose reconcile for sync.js
window.reconcileCalendarToEvents = async function(){
  try{
    const calSnap = await getDocs(collection(db,'calendar'));
    const evSnap = await getDocs(collection(db,'events'));
    const evIds = new Set(evSnap.docs.map(d=>d.id));
    const ops = [];
    calSnap.docs.forEach(d=>{
      if(!evIds.has(d.id)){
        const data = d.data() || {};
        const mapped = { title: data.title || '', description: data.description || data.desc || '', date: data.date || new Date().toISOString() };
        ops.push(setDoc(doc(db,'events',d.id), mapped));
      }
    });
    if(ops.length) await Promise.all(ops);
  }catch(err){ console.error('Failed to reconcile calendar->events', err); }
}

// Shared admin password
const ADMIN_PASSWORD = "glennEHS2025";

// Get references to DOM elements
const loginContainer = document.getElementById("admin-login");
const portalContainer = document.getElementById("admin-portal");
const loginBtn = document.getElementById("login-btn");
const passwordInput = document.getElementById("password");
const logoutBtn = document.getElementById("logout-btn");

// Form inputs for adding event/news
const eventTitleInput = document.getElementById("event-title");
const eventDateInput = document.getElementById("event-date");
const eventDescInput = document.getElementById("event-description");
const eventTypeInput = document.getElementById("event-type");
const eventTimeInput = document.getElementById('event-time');
const eventLocationInput = document.getElementById('event-location');
const newsTitleInput = document.getElementById("news-title");
const newsContentInput = document.getElementById("news-content");
const newsDateInput = document.getElementById("news-date");
const cancelEventEditBtn = document.getElementById('cancel-event-edit');
const cancelNewsEditBtn = document.getElementById('cancel-news-edit');

// Containers for displaying lists
const eventList = document.getElementById("event-list");
const newsList = document.getElementById("news-list");

// ======== LOGIN / LOGOUT SYSTEM ========

// Check if user is already logged in (localStorage kept for persistence)
document.addEventListener("DOMContentLoaded", async () => {
  const isLoggedIn = localStorage.getItem("adminLoggedIn");

  if (isLoggedIn === "true") {
    showAdminPortal();
  } else {
    showLogin();
  }

  // load initial lists (if logged in still allowed to fetch)
  // if admin is logged in, reconcile calendar -> events so admin sees all items
  if (isLoggedIn === "true"){
    await reconcileCalendarToEvents();
  }
  await renderEvents();
  await renderNews();
  // wire admin tab switching
  document.querySelectorAll('.admin-tab').forEach(tab=>tab.addEventListener('click', (e)=>{
    document.querySelectorAll('.admin-tab').forEach(t=>{ t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
    tab.classList.add('active'); tab.setAttribute('aria-selected','true');
    const target = tab.getAttribute('data-target');
    document.querySelectorAll('.admin-pane').forEach(p=>p.classList.remove('active'));
    const pane = document.getElementById(target); if(pane) pane.classList.add('active');
  }));
});

loginBtn?.addEventListener("click", async () => {
  const password = passwordInput.value.trim();
  if (password === ADMIN_PASSWORD) {
    localStorage.setItem("adminLoggedIn", "true");
    sessionStorage.setItem("adminLoggedIn", "true"); // sync for calendar.js
    showAdminPortal();
    // ensure any calendar-only items are mirrored into events for the admin
    await reconcileCalendarToEvents();
    await renderEvents();
    await renderNews();
  } else {
    showToast('Incorrect password.');
  }
});

// allow pressing Enter in the password input to submit
passwordInput?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    loginBtn?.click();
  }
});

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem("adminLoggedIn");
  sessionStorage.removeItem("adminLoggedIn");
  showLogin();
});

// sync calendar -> events on demand
// Note: Sync & Test buttons removed from markup. The `reconcileCalendarToEvents` helper
// remains available for programmatic use (e.g., imported by other scripts).

// ======== DISPLAY CONTROL ========
function showAdminPortal() {
  loginContainer?.classList.add('hidden');
  portalContainer?.classList.remove('hidden');
  logoutBtn?.classList.remove('hidden');
}

function showLogin() {
  portalContainer?.classList.add('hidden');
  loginContainer?.classList.remove('hidden');
  logoutBtn?.classList.add('hidden');
  if(passwordInput) passwordInput.value = "";
}

// ======== EVENT MANAGEMENT (Firestore) ========
document.getElementById("add-event-btn")?.addEventListener("click", async () => {
  const title = eventTitleInput.value.trim();
  const date = eventDateInput.value;
  const description = eventDescInput.value.trim();

  const type = eventTypeInput ? eventTypeInput.value : 'other';

  if (!title || !date) {
    showToast('Please enter both title and date.');
    return;
  }

  const event = { title, date, description, type };
  try{
      // if editing an existing event (dataset on input), save by id instead
      const editingId = eventTitleInput.dataset.editId;
      if(editingId){
        const id = editingId;
        const time = eventTimeInput && eventTimeInput.value ? eventTimeInput.value : '';
        const location = eventLocationInput && eventLocationInput.value ? eventLocationInput.value : '';
        const evRef = doc(db,'events',id);
        await updateDoc(evRef, { title: event.title, date: event.date, description: event.description, type: event.type, time, location });
        const calRef = doc(db,'calendar',id);
        await setDoc(calRef, { title: event.title, date: event.date, description: event.description, type: event.type, time, location });
        // clear edit marker
        delete eventTitleInput.dataset.editId;
      } else {
        const time = eventTimeInput && eventTimeInput.value ? eventTimeInput.value : '';
        const location = eventLocationInput && eventLocationInput.value ? eventLocationInput.value : '';
        await saveEventToFirestore(Object.assign({}, event, { time, location }));
      }
    eventTitleInput.value = "";
    eventDateInput.value = "";
    eventDescInput.value = "";
    eventTypeInput.value = 'other';
  // reset edit state UI
  if(cancelEventEditBtn){ cancelEventEditBtn.classList.add('hidden'); }
  const addBtn = document.getElementById('add-event-btn'); if(addBtn) addBtn.textContent = 'Add Event';
    showToast('Event added');
    await renderEvents();
    if(window.refreshEvents) await window.refreshEvents();
  }catch(err){
    console.error('Failed to add event', err);
    showToast('Failed to add event. Check console.');
  }
});

// Cancel editing event, clear form state
cancelEventEditBtn?.addEventListener('click', ()=>{
  eventTitleInput.value = '';
  eventDateInput.value = '';
  eventDescInput.value = '';
  eventTypeInput.value = 'other';
  // clear any editing flag
  delete eventTitleInput.dataset.editId;
  cancelEventEditBtn.classList.add('hidden');
  const addBtn = document.getElementById('add-event-btn'); if(addBtn) addBtn.textContent = 'Add Event';
});

async function saveEventToFirestore(event){
  // create a calendar docRef with generated id, then set same id in events collection
  const calRef = doc(collection(db, 'calendar'));
  await setDoc(calRef, event);
  const evRef = doc(db, 'events', calRef.id);
  await setDoc(evRef, event);
}

// ======== NEWS / ANNOUNCEMENTS (Firestore) ========
document.getElementById("add-news-btn")?.addEventListener("click", async () => {
  const title = newsTitleInput.value.trim();
  const content = newsContentInput.value.trim();

  if (!title || !content) {
    showToast('Please fill in both fields.');
    return;
  }

  const news = { title, content, date: new Date().toISOString() };
  try{
    // if admin provided a specific date, use it (ISO), otherwise current timestamp
    const newsDate = newsDateInput && newsDateInput.value ? new Date(newsDateInput.value).toISOString() : new Date().toISOString();
    const newsDoc = { title, content, date: newsDate };
    const editingNewsId = newsTitleInput.dataset.editId;
    if(editingNewsId){
      // update existing announcement
      await updateDoc(doc(db,'announcements',editingNewsId), newsDoc);
      delete newsTitleInput.dataset.editId;
      const addBtn = document.getElementById('add-news-btn'); if(addBtn) addBtn.textContent = 'Add Announcement';
    } else {
      await addDoc(collection(db, 'announcements'), newsDoc);
    }
    newsTitleInput.value = "";
    newsContentInput.value = "";
    if(newsDateInput) newsDateInput.value = "";
    showToast('Announcement added');
    await renderNews();
    if(cancelNewsEditBtn) cancelNewsEditBtn.classList.add('hidden');
  }catch(err){
    console.error('Failed to add announcement', err);
    showToast('Failed to add announcement. Check console.');
  }
});

// Cancel editing news
cancelNewsEditBtn?.addEventListener('click', ()=>{
  newsTitleInput.value = '';
  newsContentInput.value = '';
  newsDateInput.value = '';
  delete newsTitleInput.dataset.editId;
  cancelNewsEditBtn.classList.add('hidden');
});

// ======== RENDER FUNCTIONS (Firestore reads) ========
async function renderEvents(){
  if(!eventList) return;
  eventList.innerHTML = '';
  const snapshot = await getDocs(collection(db, 'events'));
  snapshot.docs.forEach((d, index) => {
    const ev = d.data();
    const div = document.createElement('div');
    div.classList.add('card');
    const type = ev.type || 'other';
    div.classList.add('type-' + type);
    const timeLine = ev.time ? `<div style="color:var(--muted);font-size:0.95rem;margin-top:6px">${escapeHtml(ev.time)}${ev.location ? ' • ' + escapeHtml(ev.location) : ''}</div>` : '';
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div style="flex:1">
          <h3 style="margin:0">${escapeHtml(ev.title)}</h3>
          <p style="margin:6px 0"><strong>Date:</strong> ${new Date(ev.date).toLocaleDateString()}</p>
          <p style="margin:0">${escapeHtml(ev.description || '')}</p>
          ${timeLine}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span class="event-type ${escapeHtml(type)}">${escapeHtml(type)}</span>
          <div style="display:flex;gap:8px">
            <button class="btn small edit-event-btn" data-id="${d.id}">Edit</button>
            <button class="btn small delete-btn" data-id="${d.id}">Delete</button>
          </div>
        </div>
      </div>
    `;
    eventList.appendChild(div);
  });

  // wire edit buttons
  document.querySelectorAll('.edit-event-btn').forEach(btn=>btn.addEventListener('click', async (e)=>{
    const id = e.target.getAttribute('data-id');
    try{
      const snap = await getDoc(doc(db,'events',id));
      if(!snap.exists()) return showToast('Event not found');
      const data = snap.data();
      // populate form for editing
      eventTitleInput.value = data.title || '';
      eventDateInput.value = data.date ? new Date(data.date).toISOString().slice(0,10) : '';
      eventDescInput.value = data.description || '';
      eventTypeInput.value = data.type || 'other';
      // mark editing id
      eventTitleInput.dataset.editId = id;
      // show cancel button
      if(cancelEventEditBtn) cancelEventEditBtn.classList.remove('hidden');
      // attach editing id to the event object we'll use on save
      // We'll set a temporary property on the 'event' object when saving
      // So store it on inputs for later reading when saving
      eventTitleInput.dataset.editId = id;
      // change add button text to Save
      const addBtn = document.getElementById('add-event-btn'); if(addBtn) addBtn.textContent = 'Save';
    }catch(err){ console.error('Failed to fetch event for edit', err); showToast('Failed to load event for edit'); }
  }));

  document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e)=>{
    const id = e.target.getAttribute('data-id');
    showConfirm('Delete this event?', async ()=>{ await deleteEvent(id); });
  }));
}

// Reconcile any calendar documents that don't have a matching events doc.
// This helps when items were added directly to `calendar` (older flows) so
// the admin portal (which reads `events`) will show them.
async function reconcileCalendarToEvents(){
  try{
    const calSnap = await getDocs(collection(db,'calendar'));
    const evSnap = await getDocs(collection(db,'events'));
    const evIds = new Set(evSnap.docs.map(d=>d.id));
    const ops = [];
    calSnap.docs.forEach(d=>{
      if(!evIds.has(d.id)){
        const data = d.data() || {};
        const docRef = doc(db,'events',d.id);
        const mapped = {
          title: data.title || '',
          description: data.description || data.desc || '',
          date: data.date || new Date().toISOString()
        };
        ops.push(setDoc(docRef, mapped));
      }
    });
    if(ops.length) await Promise.all(ops);
  }catch(err){ console.error('Failed to reconcile calendar->events', err); }
}

async function deleteEvent(id){
  // delete from both collections if present
  try{
    await deleteDoc(doc(db, 'events', id));
    await deleteDoc(doc(db, 'calendar', id));
    await renderEvents();
    showToastWithAction('Event deleted', 'Undo', async ()=>{ showToast('Undo is not available for firestore deletes.'); }, 6000);
    if(window.refreshEvents) await window.refreshEvents();
  }catch(err){
    console.error('Failed to delete event', err);
    showToast('Failed to delete event. Check console.');
  }
}

async function renderNews(){
  if(!newsList) return;
  newsList.innerHTML = '';
  const snapshot = await getDocs(collection(db, 'announcements'));
  snapshot.docs.forEach(d=>{
    const n = d.data();
    const div = document.createElement('div');div.classList.add('card');
    div.innerHTML = `
      <h3>${n.title}</h3>
      <p>${n.content}</p>
      <small>${new Date(n.date).toLocaleDateString()}</small>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class='btn small edit-news-btn' data-id='${d.id}'>Edit</button>
        <button class='btn small delete-news-btn' data-id='${d.id}'>Delete</button>
      </div>
    `;
    newsList.appendChild(div);
  });

  // wire edit buttons for announcements
  document.querySelectorAll('.edit-news-btn').forEach(btn=>btn.addEventListener('click', async (e)=>{
    const id = e.target.getAttribute('data-id');
    try{
      const snap = await getDoc(doc(db,'announcements',id));
      if(!snap.exists()) return showToast('Announcement not found');
      const data = snap.data();
      newsTitleInput.value = data.title || '';
      newsContentInput.value = data.content || '';
      newsDateInput.value = data.date ? new Date(data.date).toISOString().slice(0,10) : '';
      newsTitleInput.dataset.editId = id;
      if(cancelNewsEditBtn) cancelNewsEditBtn.classList.remove('hidden');
      const addBtn = document.getElementById('add-news-btn'); if(addBtn) addBtn.textContent = 'Save';
    }catch(err){ console.error('Failed to fetch announcement for edit', err); showToast('Failed to load announcement for edit'); }
  }));

  document.querySelectorAll('.delete-news-btn').forEach(btn=>btn.addEventListener('click', (e)=>{
    const id = e.target.getAttribute('data-id');
    showConfirm('Delete this announcement?', async ()=>{ await deleteNews(id); });
  }));
}

async function deleteNews(id){
  try{
    await deleteDoc(doc(db,'announcements',id));
    await renderNews();
    showToastWithAction('Announcement deleted', 'Undo', async ()=>{ showToast('Undo not available for firestore deletes'); }, 6000);
  }catch(err){
    console.error('Failed to delete announcement', err);
    showToast('Failed to delete announcement. Check console.');
  }
}

// Load existing data when logged in handled in DOMContentLoaded above

/* ======= Toast + Confirm helpers (kept) ======= */
function showToast(text, timeout = 3000){
  let wrap = document.querySelector('.toast-wrap');
  if(!wrap){
    wrap = document.createElement('div');wrap.className='toast-wrap';document.body.appendChild(wrap);
  }
  const t = document.createElement('div');t.className='toast';t.textContent = text;wrap.appendChild(t);
  setTimeout(()=>{t.style.opacity=0;setTimeout(()=>t.remove(),400)}, timeout);
}

function showConfirm(message, onConfirm){
  const backdrop = document.createElement('div');backdrop.className='modal-backdrop';
  const modal = document.createElement('div');modal.className='modal';
  modal.innerHTML = `<div><strong>${message}</strong></div>`;
  const actions = document.createElement('div');actions.className='modal-actions';
  const cancel = document.createElement('button');cancel.className='btn btn-ghost';cancel.textContent='Cancel';
  const ok = document.createElement('button');ok.className='btn';ok.textContent='Confirm';
  actions.appendChild(cancel);actions.appendChild(ok);modal.appendChild(actions);backdrop.appendChild(modal);document.body.appendChild(backdrop);
  // focus trap
  const focusable = modal.querySelectorAll('button, [href], input, select, textarea');
  let lastFocused = document.activeElement;
  function trap(e){
    const isTab = e.key === 'Tab' || e.keyCode === 9;
    if(!isTab) return;
    const first = focusable[0];
    const last = focusable[focusable.length -1];
    if(e.shiftKey){ if(document.activeElement === first){ e.preventDefault(); last.focus(); } }
    else { if(document.activeElement === last){ e.preventDefault(); first.focus(); } }
  }
  function onKey(e){ if(e.key === 'Escape'){ backdrop.remove(); lastFocused?.focus(); } else trap(e); }
  document.addEventListener('keydown', onKey);

  cancel.addEventListener('click', ()=>{ backdrop.remove(); document.removeEventListener('keydown', onKey); lastFocused?.focus(); });
  ok.addEventListener('click', ()=>{ onConfirm(); backdrop.remove(); document.removeEventListener('keydown', onKey); lastFocused?.focus(); });
  // put focus on confirm button
  ok.focus();
}

function showToastWithAction(text, actionLabel, actionFn, timeout = 6000){
  let wrap = document.querySelector('.toast-wrap');
  if(!wrap){ wrap = document.createElement('div');wrap.className='toast-wrap';document.body.appendChild(wrap); }
  const t = document.createElement('div');t.className='toast';
  const span = document.createElement('span');span.textContent = text; t.appendChild(span);
  const btn = document.createElement('button');btn.className='btn btn-ghost';btn.style.marginLeft='10px';btn.textContent = actionLabel;
  btn.addEventListener('click', ()=>{ actionFn(); t.remove(); });
  t.appendChild(btn);wrap.appendChild(t);
  const timer = setTimeout(()=>{ if(t.parentNode) t.remove(); }, timeout);
}
