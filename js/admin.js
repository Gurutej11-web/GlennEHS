// ======== Admin Portal Logic (Firestore-backed) ========
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db, auth } from "./firebase-config.js";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";
import { showToast, showToastWithAction } from './ui.js';
import { signOut, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
// Global error monitoring: surface critical runtime errors to the user and log details to console.
// This helps diagnose issues like failed Firestore reads/writes when users see only generic 'check console' toasts.
window.addEventListener('error', (ev) => {
  try{ console.error('Uncaught error:', ev.error || ev.message || ev); showToast('An unexpected error occurred (check console)'); }catch(e){ console.error(e); }
});
window.addEventListener('unhandledrejection', (ev) => {
  try{ console.error('Unhandled promise rejection:', ev.reason); const msg = ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason); showToast('Async error: ' + (msg.length > 120 ? msg.slice(0,120) + '...' : msg)); }catch(e){ console.error(e); }
});
// small HTML-escape helper used by render functions
function escapeHtml(s){ if(s == null) return ''; return String(s).replace(/[&<>"']/g, (ch)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" })[ch]); }
// Date helpers: normalize stored date to YYYY-MM-DD (no timezone) and
// render dates in the user's local timezone correctly. Storing dates as
// a plain Y-M-D string avoids accidental UTC shifting when parsing.
function toYMD(dateLike){
  if(!dateLike) return '';
  // If already in YYYY-MM-DD format, return it
  if(/^\d{4}-\d{2}-\d{2}$/.test(dateLike)) return dateLike;
  // If it's a Firestore timestamp-like object with toDate, convert
  if(typeof dateLike === 'object' && typeof dateLike.toDate === 'function'){
    const d = dateLike.toDate();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  // Try JS Date parsing; then build local YMD
  const d = new Date(dateLike);
  if(isNaN(d)) return String(dateLike);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function displayDateFromYMD(ymd){
  if(!ymd) return '';
  const parts = String(ymd).split('-');
  if(parts.length < 3) return String(ymd);
  const y = Number(parts[0]), m = Number(parts[1]) - 1, d = Number(parts[2]);
  const dt = new Date(y, m, d);
  return dt.toLocaleDateString();
}
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
        const mapped = { title: data.title || '', description: data.description || data.desc || '', date: toYMD(data.date) || toYMD(new Date()) };
        ops.push(setDoc(doc(db,'events',d.id), mapped));
      }
    });
    if(ops.length) await Promise.all(ops);
  }catch(err){ console.error('Failed to reconcile calendar->events', err); }
}

// Shared admin password (legacy fallback)
const ADMIN_PASSWORD = "glennEHS2026";

// Tab tracking key used to detect how many site tabs are open. When the
// last tab closes we remove the persistent admin flag so the user must
// re-login on the next visit.
const TAB_KEY = 'ehs_tabs';

function readTabs(){
  try{ return JSON.parse(localStorage.getItem(TAB_KEY) || '[]'); }catch(e){ return []; }
}
function writeTabs(t){ localStorage.setItem(TAB_KEY, JSON.stringify(Array.from(new Set(t)))); }
function registerTab(){
  // reuse session-stored tab id when navigating within the same tab
  let id = sessionStorage.getItem('ehs_tab_id');
  if(!id){ id = Date.now().toString(36) + Math.random().toString(36).slice(2,8); sessionStorage.setItem('ehs_tab_id', id); }
  window._ehsTabId = id;
  const tabs = readTabs(); tabs.push(id); writeTabs(tabs);
}
function unregisterTab(){
  const id = sessionStorage.getItem('ehs_tab_id') || window._ehsTabId; if(!id) return;
  const tabs = readTabs().filter(t=>t!==id); writeTabs(tabs);
  // if no tabs remain, clear the persistent login flag after a short delay
  // (this avoids clearing during same-tab navigation where the new page
  //  registers quickly). Delay of 700ms is typically sufficient.
  setTimeout(()=>{ const t = readTabs(); if(t.length === 0){ localStorage.removeItem('adminLoggedIn'); } }, 700);
}

// React to admin login/logout across tabs
window.addEventListener('storage', (e)=>{
  if(e.key === 'adminLoggedIn'){
    if(e.newValue === 'true') showAdminPortal();
    else showLogin();
  }
});

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
// Home inline admin editor container (may only exist on index.html)
const newsAdminDiv = document.getElementById('news-admin');
// opener button on Home to reveal the news editor (only shown to admins)
const openNewsAdminBtn = document.getElementById('open-news-admin');
// event admin form and opener (admin-events page)
const eventAdminForm = document.getElementById('event-admin-form');
const openEventBtn = document.getElementById('open-add-event');
// Gallery admin opener (added to admin landing)
const openGalleryAdminBtn = document.getElementById('open-gallery-admin');

// ======== LOGIN / LOGOUT SYSTEM ========

// Check if user is already logged in (localStorage kept for persistence)
document.addEventListener("DOMContentLoaded", async () => {
  // register this browser tab so we can track active tabs and clear
  // the admin flag when the last tab closes
  registerTab();
  // Developer convenience: when running on localhost, enable admin flag so testing is easier.
  // This only affects local testing and does not run on the deployed site.
  if (location && (location.hostname === '127.0.0.1' || location.hostname === 'localhost')) {
    try{ localStorage.setItem('adminLoggedIn','true'); console.info('Dev: adminLoggedIn auto-enabled for localhost'); }catch(e){ }
  }
  window.addEventListener('beforeunload', () => { unregisterTab(); });
  // Listen for Firebase auth state changes. If a user is signed in via Firebase,
  // show the admin portal. Otherwise, fall back to the legacy localStorage flag.
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Signed in via Firebase -> set persistent local flag so other tabs
      // will open the portal as well during this site session.
      localStorage.setItem('adminLoggedIn','true');
      showAdminPortal();
      await reconcileCalendarToEvents();
      await renderEvents();
      // show the 'Add Announcement' opener on Home (do not auto-open the editor)
      if(openNewsAdminBtn) openNewsAdminBtn.style.display = 'inline-block';
      // show the 'Add Event' opener on admin events page
      if(openEventBtn) openEventBtn.classList.remove('hidden');
      await renderNews();
    } else {
      // If localStorage has adminLoggedIn set (from another tab or prior
      // login), allow opening the portal without re-entering password.
      const isLoggedIn = localStorage.getItem('adminLoggedIn');
      if (isLoggedIn === 'true'){
        showAdminPortal();
        await reconcileCalendarToEvents();
      } else {
        showLogin();
      }
      await renderEvents();
      // hide the home 'Add Announcement' opener and editor when not admin
      if(openNewsAdminBtn) openNewsAdminBtn.style.display = 'none';
      if(newsAdminDiv) newsAdminDiv.classList.add('hidden');
      // hide add-event opener when not admin
      if(openEventBtn) openEventBtn.classList.add('hidden');
      await renderNews();
    }
  });

  // wire admin tab switching
  document.querySelectorAll('.admin-tab').forEach(tab=>tab.addEventListener('click', (e)=>{
    document.querySelectorAll('.admin-tab').forEach(t=>{ t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
    tab.classList.add('active'); tab.setAttribute('aria-selected','true');
    const target = tab.getAttribute('data-target');
    document.querySelectorAll('.admin-pane').forEach(p=>p.classList.remove('active'));
    const pane = document.getElementById(target); if(pane) pane.classList.add('active');
  }));
  // Wire the Home 'Add Announcement' opener and the admin Events opener
  if(openNewsAdminBtn){
    openNewsAdminBtn.addEventListener('click', ()=>{
      if(newsAdminDiv) { newsAdminDiv.classList.remove('hidden'); newsTitleInput.focus(); }
      // hide the opener while editor is visible
      openNewsAdminBtn.style.display = 'none';
      if(cancelNewsEditBtn) cancelNewsEditBtn.classList.remove('hidden');
      const addBtn = document.getElementById('add-news-btn'); if(addBtn) addBtn.textContent = 'Add Announcement';
    });
  }
  if(openEventBtn && eventAdminForm){
    openEventBtn.addEventListener('click', ()=>{
      eventAdminForm.classList.remove('hidden');
      openEventBtn.classList.add('hidden');
      const addBtn = document.getElementById('add-event-btn'); if(addBtn) addBtn.classList.remove('hidden');
      if(cancelEventEditBtn) cancelEventEditBtn.classList.remove('hidden');
      eventTitleInput.focus();
    });
    // ensure event form hidden initially and opener visible only when appropriate (auth handler will toggle)
    eventAdminForm.classList.add('hidden');
  }

  // Wire gallery admin opener
  if(openGalleryAdminBtn){
    openGalleryAdminBtn.addEventListener('click', ()=>{ openGalleryAdmin(); });
  }
});

// ========== Gallery admin (upload/delete images to Storage + index in Firestore) ==========
const storage = getStorage();

function createGalleryAdminModal(){
  const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div'); modal.className = 'modal';
  modal.style.maxWidth = '860px';
  modal.innerHTML = `
    <h3 style="margin-top:0">Manage Gallery</h3>
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
      <input id="gallery-files" type="file" accept="image/*" multiple />
      <button id="gallery-upload" class="btn">Upload</button>
      <div id="gallery-progress" style="flex:1"></div>
    </div>
    <div id="gallery-preview" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px"></div>
    <h4 style="margin:8px 0">Existing Images</h4>
    <div id="gallery-existing" style="display:flex;flex-wrap:wrap;gap:8px;max-height:360px;overflow:auto"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button id="gallery-close" class="btn btn-ghost">Close</button>
    </div>
  `;
  backdrop.appendChild(modal); document.body.appendChild(backdrop);
  return { backdrop, modal };
}

async function openGalleryAdmin(){
  // only allow admins
  const isAuth = (auth && auth.currentUser) || localStorage.getItem('adminLoggedIn') === 'true';
  if(!isAuth){ showToast('Please log in to manage gallery'); return; }
  const { backdrop, modal } = createGalleryAdminModal();
  const fileInput = modal.querySelector('#gallery-files');
  const uploadBtn = modal.querySelector('#gallery-upload');
  const preview = modal.querySelector('#gallery-preview');
  const existing = modal.querySelector('#gallery-existing');
  const progressEl = modal.querySelector('#gallery-progress');
  const closeBtn = modal.querySelector('#gallery-close');

  function renderPreviewFiles(files){
    preview.innerHTML = '';
    Array.from(files).forEach(f=>{
      const url = URL.createObjectURL(f);
      const el = document.createElement('div'); el.style.width='140px'; el.style.height='100px'; el.style.overflow='hidden'; el.style.border='1px solid var(--muted)'; el.style.display='flex'; el.style.alignItems='center'; el.style.justifyContent='center';
      const img = document.createElement('img'); img.src = url; img.style.maxWidth='100%'; img.style.maxHeight='100%'; el.appendChild(img); preview.appendChild(el);
    });
  }

  fileInput.addEventListener('change', ()=> renderPreviewFiles(fileInput.files));

  uploadBtn.addEventListener('click', async ()=>{
    const files = fileInput.files;
    if(!files || files.length === 0){ showToast('Select one or more images to upload'); return; }
    progressEl.textContent = 'Uploading...';
    for(const f of Array.from(files)){
      try{
        const path = `gallery/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9_.-]/g,'_')}`;
        const sRef = storageRef(storage, path);
        const uploadTask = uploadBytesResumable(sRef, f);
        await new Promise((res, rej)=>{
          uploadTask.on('state_changed', (snap)=>{
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            progressEl.textContent = `Uploading ${f.name} — ${pct}%`;
          }, rej, res);
        });
        const url = await getDownloadURL(sRef);
        await addDoc(collection(db,'gallery'), { filename: f.name, path, url, uploadedAt: new Date().toISOString(), uploadedBy: (auth && auth.currentUser && auth.currentUser.email) || 'admin' });
        progressEl.textContent = `Uploaded ${f.name}`;
      }catch(err){
        console.error('Failed to upload', err);
        // Detect common Firebase permission error and provide actionable guidance
        const msg = err && (err.code || err.message || String(err));
        if(String(msg).toLowerCase().includes('permission') || String(msg).toLowerCase().includes('insufficient')){
          showToast('Upload denied: insufficient Firebase permissions. See console for details.');
          // also surface a visible instruction in the progress area if present
          try{ progressEl.textContent = 'Permission denied: ensure Firestore/Storage rules allow uploads and you are authenticated.'; }catch(e){}
        } else {
          showToast('Failed to upload ' + f.name);
        }
      }
    }
    // refresh existing list
    await loadExistingGallery(existing);
    progressEl.textContent = 'All uploads finished';
    fileInput.value = '';
    preview.innerHTML = '';
  });

  closeBtn.addEventListener('click', ()=>{ backdrop.remove(); });

  // load existing gallery images and allow deleting
  await loadExistingGallery(existing);
}

async function loadExistingGallery(container){
  if(!container) return;
  container.innerHTML = '';
  try{
    const snap = await getDocs(collection(db,'gallery'));
    if(snap.empty){ container.innerHTML = '<div class="muted">No images yet.</div>'; return; }
    snap.docs.forEach(d=>{
      const data = d.data();
      const el = document.createElement('div'); el.style.width='140px'; el.style.border='1px solid var(--muted)'; el.style.padding='6px'; el.style.display='flex'; el.style.flexDirection='column'; el.style.alignItems='stretch'; el.style.gap='6px';
      const img = document.createElement('img'); img.src = data.url; img.style.width='100%'; img.style.height='88px'; img.style.objectFit='cover';
      const name = document.createElement('div'); name.textContent = data.filename || ''; name.style.fontSize='0.85rem'; name.style.whiteSpace='nowrap'; name.style.overflow='hidden'; name.style.textOverflow='ellipsis';
      const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between';
      const del = document.createElement('button'); del.className='btn btn-ghost'; del.textContent='Delete';
      del.addEventListener('click', async ()=>{
        if(!confirm('Delete this image?')) return;
        try{
          // delete storage object then remove firestore doc
          if(data.path){ await deleteObject(storageRef(storage, data.path)).catch(()=>{}); }
          await deleteDoc(doc(db,'gallery',d.id));
          showToast('Image deleted');
          await loadExistingGallery(container);
        }catch(err){ console.error('Failed to delete gallery item', err); showToast('Failed to delete image'); }
      });
      row.appendChild(del);
      el.appendChild(img); el.appendChild(name); el.appendChild(row); container.appendChild(el);
    });
  }catch(err){ console.error('Failed to load existing gallery', err); container.innerHTML = '<div class="muted">Failed to load images.</div>'; }
}

loginBtn?.addEventListener("click", async () => {
  const password = passwordInput.value.trim();
  // email input removed from UI; keep compatibility but prefer master password
  const emailInput = document.getElementById('admin-email');
  const email = emailInput ? emailInput.value.trim() : '';

  // Master shared password override: allow the single combined admin password
  // to work regardless of whether an email is entered. This preserves the
  // original 'one password for all admins' workflow while still supporting
  // optional Firebase email/password sign-in.
  if (password === ADMIN_PASSWORD) {
    try {
      localStorage.setItem("adminLoggedIn", "true");
      showAdminPortal();
      await reconcileCalendarToEvents();
      await renderEvents();
      await renderNews();
      showToast('Signed in with shared admin password');
    } catch (err) {
      console.error('Error during legacy login flow', err);
      showToast('Signed in (legacy) — there was a minor UI error (check console)');
    }
    return;
  }

  // If no master password supplied, and an email was provided, attempt Firebase sign-in
  if (email) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle showing the portal and setting the local flag
      showToast('Signed in');
      return;
    } catch (err) {
      console.error('Firebase sign-in failed', err);
      // surface friendly message for common errors
      const code = err && err.code ? err.code : '';
      if (code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        showToast('Incorrect email or password.');
      } else if (String(err).toLowerCase().includes('permission')) {
        showToast('Sign-in denied: permission error.');
      } else {
        showToast('Sign-in failed (check console)');
      }
      return;
    }
  }

  // If we reach here, the provided credentials weren't accepted
  showToast('Incorrect password.');
});

// NOTE: single shared password flow — no email sign-in option in this build.

// allow pressing Enter in the password input to submit
passwordInput?.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    loginBtn?.click();
  }
});

logoutBtn?.addEventListener("click", async () => {
  try{
    // If Firebase auth is active, sign out there as well
    if(auth && auth.currentUser){
      await signOut(auth);
    }
  }catch(e){ console.warn('Firebase signOut failed', e); }
  // clear persistent flag and notify other tabs (storage event)
  localStorage.removeItem("adminLoggedIn");
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
  // guard: ensure admin is authenticated for actions
  const isAuth = (auth && auth.currentUser) || localStorage.getItem('adminLoggedIn') === 'true';
  if (!isAuth) {
    showToast('Please log in to add events.');
    showLogin();
    return;
  }
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
    // hide the event admin form after save and restore the opener
    try{ if(eventAdminForm) eventAdminForm.classList.add('hidden'); if(openEventBtn) openEventBtn.classList.remove('hidden'); }catch(e){}
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
  // hide the event form after cancelling and show the opener if present
  if(eventAdminForm) eventAdminForm.classList.add('hidden');
  if(openEventBtn) openEventBtn.classList.remove('hidden');
});

async function saveEventToFirestore(event){
  // create a calendar docRef with generated id, then set same id in events collection
  const calRef = doc(collection(db, 'calendar'));
  // ensure date saved in YYYY-MM-DD form (no timezone offsets)
  const payload = Object.assign({}, event, { date: toYMD(event.date) || toYMD(new Date()) });
  await setDoc(calRef, payload);
  const evRef = doc(db, 'events', calRef.id);
  await setDoc(evRef, payload);
}

// ======== NEWS / ANNOUNCEMENTS (Firestore) ========
document.getElementById("add-news-btn")?.addEventListener("click", async () => {
  // guard: require login for announcements
  const isAuth = (auth && auth.currentUser) || localStorage.getItem('adminLoggedIn') === 'true';
  if (!isAuth) {
    showToast('Please log in to add announcements.');
    showLogin();
    return;
  }
  const title = newsTitleInput.value.trim();
  const content = newsContentInput.value.trim();

  if (!title || !content) {
    showToast('Please fill in both fields.');
    return;
  }

  const news = { title, content, date: new Date().toISOString() };
  try{
  // if admin provided a specific date, use it (YYYY-MM-DD), otherwise today's date
  const newsDate = newsDateInput && newsDateInput.value ? toYMD(newsDateInput.value) : toYMD(new Date());
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
    // hide the home news admin editor after save until admin explicitly opens it
    if(newsAdminDiv) newsAdminDiv.classList.add('hidden');
    if(openNewsAdminBtn) openNewsAdminBtn.style.display = 'inline-block';
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
  // hide the editor and show the opener button
  if(newsAdminDiv) newsAdminDiv.classList.add('hidden');
  if(openNewsAdminBtn) openNewsAdminBtn.style.display = 'inline-block';
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
  const displayDate = displayDateFromYMD(toYMD(ev.date));
  div.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div style="flex:1">
          <h3 style="margin:0">${escapeHtml(ev.title)}</h3>
          <p style="margin:6px 0"><strong>Date:</strong> ${escapeHtml(displayDate)}</p>
          <p style="margin:0">${escapeHtml(ev.description || '')}</p>
          ${timeLine}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span class="event-type ${escapeHtml(type)}">${escapeHtml(type)}</span>
          <div style="display:flex;gap:8px">
            ${ ( (auth && auth.currentUser) || localStorage.getItem('adminLoggedIn') === 'true') ? `
            <button class="btn small edit-event-btn" data-id="${d.id}">Edit</button>
            <button class="btn small delete-btn" data-id="${d.id}">Delete</button>
            ` : '' }
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
  eventDateInput.value = toYMD(data.date) || '';
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
          date: toYMD(data.date) || toYMD(new Date())
        };
        ops.push(setDoc(docRef, mapped));
      }
    });
    if(ops.length) await Promise.all(ops);
  }catch(err){ console.error('Failed to reconcile calendar->events', err); }
}

async function deleteEvent(id){
  // ensure only admins can delete
  const isAuth = (auth && auth.currentUser) || localStorage.getItem('adminLoggedIn') === 'true';
  if(!isAuth){ showToast('Please log in to delete events'); showLogin(); return; }
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
  // Render announcements using the same structure as `main.js` so layout remains consistent
  newsList.innerHTML = '';
  const snapshot = await getDocs(collection(db, 'announcements'));
  const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if(list.length){
    newsList.innerHTML = list.map(a => {
      const adminControls = ((auth && auth.currentUser) || localStorage.getItem('adminLoggedIn') === 'true') ?
        `<div class="admin-actions" style="margin-left:12px;display:flex;gap:6px;align-items:center">` +
        `<button class='btn small edit-news-btn' data-id='${a.id}'>Edit</button>` +
        `<button class='btn small delete-news-btn' data-id='${a.id}'>Delete</button>` +
        `</div>` : '';
      return `
        <div class="announcement-card" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
          <div style="flex:1">
            <h4 style="margin:0 0 6px 0">${escapeHtml(a.title || '')}</h4>
            <p style="margin:0;color:var(--muted)">${escapeHtml(a.content || '')}</p>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px">
            <span style="color:var(--muted);font-size:0.95rem">${a.date ? escapeHtml(displayDateFromYMD(toYMD(a.date))) : ''}</span>
            ${adminControls}
          </div>
        </div>
      `;
    }).join('');
  } else {
    newsList.innerHTML = '<div class="item"><div class="left">No announcements yet. Admin can add announcements in the Admin Portal.</div></div>';
  }

  // wire edit buttons for announcements
  document.querySelectorAll('.edit-news-btn').forEach(btn=>btn.addEventListener('click', async (e)=>{
    const id = e.target.getAttribute('data-id');
    try{
      const snap = await getDoc(doc(db,'announcements',id));
      if(!snap.exists()) return showToast('Announcement not found');
      const data = snap.data();
      newsTitleInput.value = data.title || '';
      newsContentInput.value = data.content || '';
  newsDateInput.value = toYMD(data.date) || '';
      newsTitleInput.dataset.editId = id;
      // reveal the inline editor on the home page if present
      if(newsAdminDiv) newsAdminDiv.classList.remove('hidden');
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
  // ensure only admins can delete announcements
  const isAuth = (auth && auth.currentUser) || localStorage.getItem('adminLoggedIn') === 'true';
  if(!isAuth){ showToast('Please log in to delete announcements'); showLogin(); return; }
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

/* ======= Confirm helper (kept) ======= */
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
