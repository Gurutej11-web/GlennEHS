// members.js
// Admin Members management and points transactions
import {
  collection, getDocs, addDoc, updateDoc, doc, deleteDoc,
  serverTimestamp, increment, query, orderBy, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db, auth } from "./firebase-config.js";
import { showToast, showToastWithAction } from './ui.js';

// DOM refs
const addMemberBtn = document.getElementById('add-member-btn');
const cancelMemberEditBtn = document.getElementById('cancel-member-edit');
const memberNameInput = document.getElementById('member-name');
const memberYearInput = document.getElementById('member-year');
const memberEmailInput = document.getElementById('member-email');
const memberRoleInput = document.getElementById('member-role');
const memberStatusInput = document.getElementById('member-status');
const memberList = document.getElementById('member-list');
const memberSearch = document.getElementById('member-search');

function isAdmin(){
  return (auth && auth.currentUser) || localStorage.getItem('adminLoggedIn') === 'true';
}

async function loadMembers(){
  if(!memberList) return;
  memberList.innerHTML = '';
  try{
    const snap = await getDocs(query(collection(db,'members'), orderBy('name')));
    const term = memberSearch && memberSearch.value ? memberSearch.value.toLowerCase().trim() : '';
    snap.docs.forEach(d=>{
      const m = d.data();
      const id = d.id;
      const name = m.name || '(no name)';
      const year = m.year || '';
      const email = m.email || '';
      const status = m.status || 'active';
      const points = typeof m.pointsTotal === 'number' ? m.pointsTotal : 0;
      const display = `${name} ${year ? '• ' + year : ''}`;
      if(term){
        const hay = (name + ' ' + year + ' ' + email).toLowerCase();
        if(!hay.includes(term)) return;
      }
      const card = document.createElement('div'); card.className = 'member-card';
      card.innerHTML = `
        <div style="flex:1">
          <h3>${escapeHtml(name)}</h3>
          <div class="meta">${escapeHtml(year)} ${email ? '• ' + escapeHtml(email) : ''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <div style="text-align:right"><div class="meta">Points</div><div class="points">${points}</div></div>
          <div class="actions">
            ${ isAdmin() ? `<button class="btn small edit-member-btn" data-id="${id}">Edit</button>
            <button class="btn small manage-points-btn" data-id="${id}">Points</button>
            <button class="btn small delete-member-btn" data-id="${id}">Delete</button>` : '' }
          </div>
        </div>
      `;
      memberList.appendChild(card);
    });

    // wire buttons
    document.querySelectorAll('.edit-member-btn').forEach(b=>b.addEventListener('click', onEditMember));
    document.querySelectorAll('.delete-member-btn').forEach(b=>b.addEventListener('click', onDeleteMember));
    document.querySelectorAll('.manage-points-btn').forEach(b=>b.addEventListener('click', onManagePoints));
  }catch(err){ console.error('loadMembers failed', err); showToast('Failed to load members'); }
}

function escapeHtml(str){ if(!str) return ''; return String(str).replace(/[&<>"']/g, (s)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" })[s]); }

async function onEditMember(e){
  const id = e.currentTarget.getAttribute('data-id');
  try{
    const snap = await getDoc(doc(db,'members',id));
    if(!snap.exists()) return showToast('Member not found');
    const data = snap.data();
    memberNameInput.value = data.name || '';
    memberYearInput.value = data.year || '';
    memberEmailInput.value = data.email || ''; 
    memberStatusInput.value = data.status || 'active';
    memberNameInput.dataset.editId = id;
    // reveal the compact admin form and toggle top add button
    const form = document.getElementById('member-admin-form');
    const openBtn = document.getElementById('open-add-member');
    if(form) form.classList.remove('hidden');
    if(openBtn) openBtn.classList.add('hidden');
    if(cancelMemberEditBtn) cancelMemberEditBtn.classList.remove('hidden');
    if(addMemberBtn){ addMemberBtn.textContent = 'Save'; addMemberBtn.classList.remove('hidden'); }
    memberNameInput.focus();
  }catch(err){ console.error('edit member failed', err); showToast('Failed to load member for edit'); }
}

async function onDeleteMember(e){
  const id = e.currentTarget.getAttribute('data-id');
  if(!isAdmin()){ showToast('Please log in to delete members'); return; }
  const ok = confirm('Delete this member? This cannot be undone from the UI.');
  if(!ok) return;
  try{
    await deleteDoc(doc(db,'members',id));
    showToastWithAction('Member deleted', 'Undo', async ()=>{ showToast('Undo not available for deletes'); }, 5000);
    await loadMembers();
  }catch(err){ console.error('delete member failed', err); showToast('Failed to delete member'); }
}

async function onManagePoints(e){
  const id = e.currentTarget.getAttribute('data-id');
  // open modal with current points and history, allow adding/subtracting
  try{
    const snap = await getDoc(doc(db,'members',id));
    if(!snap.exists()) return showToast('Member not found');
    const data = snap.data();
    const current = typeof data.pointsTotal === 'number' ? data.pointsTotal : 0;
    // build modal
    const backdrop = document.createElement('div'); backdrop.className='modal-backdrop';
    const modal = document.createElement('div'); modal.className='modal';
    modal.innerHTML = `
      <h3 style="margin-top:0">Points — ${escapeHtml(data.name || 'Member')}</h3>
      <div style="margin-bottom:8px">Current points: <strong>${current}</strong></div>
      <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center">
        <input type="number" id="points-delta" class="input" placeholder="Points (e.g. 5 or -3)" />
        <input type="text" id="points-reason" class="input" placeholder="Reason (e.g. Attendance)" />
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-bottom:8px">
        <button class="btn btn-ghost" id="points-cancel">Cancel</button>
        <button class="btn" id="points-apply">Apply</button>
      </div>
      <div id="points-history" style="max-height:260px;overflow:auto;border-top:1px solid var(--muted);padding-top:8px"></div>
    `;
    backdrop.appendChild(modal); document.body.appendChild(backdrop);

    const historyEl = modal.querySelector('#points-history');
    // load history
    const histSnap = await getDocs(query(collection(db,'members',id,'points'), orderBy('timestamp','desc')));
    if(histSnap.empty) historyEl.innerHTML = '<p style="color:var(--muted)">No transactions yet.</p>';
    else{
      histSnap.docs.forEach(h=>{
        const it = h.data();
        const line = document.createElement('div'); line.style.marginBottom='6px';
        const ts = it.timestamp && it.timestamp.toDate ? it.timestamp.toDate().toLocaleString() : '';
        line.innerHTML = `<div style="display:flex;justify-content:space-between"><div><strong>${it.delta > 0 ? '+'+it.delta : it.delta}</strong> — ${escapeHtml(it.reason || '')}</div><div style="color:var(--muted);font-size:0.9rem">${escapeHtml(it.by || 'admin')} • ${ts}</div></div>`;
        historyEl.appendChild(line);
      });
    }

    // wire modal buttons
    modal.querySelector('#points-cancel').addEventListener('click', ()=>{ backdrop.remove(); });
    modal.querySelector('#points-apply').addEventListener('click', async ()=>{
      if(!isAdmin()){ showToast('Please log in to modify points'); backdrop.remove(); return; }
      const deltaVal = Number(modal.querySelector('#points-delta').value || 0);
      const reason = modal.querySelector('#points-reason').value.trim() || 'Adjusted by admin';
      if(!deltaVal){ showToast('Enter a non-zero point value (use negative to deduct)'); return; }
      try{
        // write transaction and update parent total atomically-ish: write tx then update total using increment
        await addDoc(collection(db,'members',id,'points'), { delta: deltaVal, reason, timestamp: serverTimestamp(), by: (auth && auth.currentUser && auth.currentUser.email) || 'admin' });
        await updateDoc(doc(db,'members',id), { pointsTotal: increment(deltaVal) });
        showToast('Points updated');
        backdrop.remove();
        await loadMembers();
      }catch(err){ console.error('apply points failed', err); showToast('Failed to apply points'); }
    });

  }catch(err){ console.error('manage points failed', err); showToast('Failed to open points manager'); }
}

// Add or save member
addMemberBtn?.addEventListener('click', async ()=>{
  if(!isAdmin()){ showToast('Please log in to add members'); return; }
  const name = memberNameInput.value.trim();
  const year = memberYearInput.value.trim();
  const email = memberEmailInput.value.trim();
  const status = memberStatusInput.value;
  if(!name){ showToast('Please enter a name'); return; }
  try{
    const editingId = memberNameInput.dataset.editId;
    if(editingId){
      await updateDoc(doc(db,'members',editingId), { name, year, email, status, role: (memberRoleInput ? memberRoleInput.value.trim() : ''), public: true });
      delete memberNameInput.dataset.editId;
      showToast('Member updated');
    } else {
      await addDoc(collection(db,'members'), { name, year, email, status, role: (memberRoleInput ? memberRoleInput.value.trim() : ''), pointsTotal: 0, createdAt: serverTimestamp(), public: true });
      showToast('Member added');
    }
    memberNameInput.value = '';
    memberYearInput.value = '';
    memberEmailInput.value = '';
  if(memberRoleInput) memberRoleInput.value = '';
    memberStatusInput.value = 'active';
  if(cancelMemberEditBtn) cancelMemberEditBtn.classList.add('hidden');
  if(addMemberBtn) addMemberBtn.textContent = 'Add Member';
  // After saving, hide the compact form and restore top Add button
  const form = document.getElementById('member-admin-form'); const openBtn = document.getElementById('open-add-member');
  if(form) form.classList.add('hidden'); if(openBtn) openBtn.classList.remove('hidden'); if(addMemberBtn) addMemberBtn.classList.add('hidden');
  await loadMembers();
  }catch(err){ console.error('save member failed', err); showToast('Failed to save member'); }
});

cancelMemberEditBtn?.addEventListener('click', ()=>{
  memberNameInput.value = '';
  memberYearInput.value = '';
  memberEmailInput.value = '';
  memberStatusInput.value = 'active';
  delete memberNameInput.dataset.editId;
  cancelMemberEditBtn.classList.add('hidden');
  if(addMemberBtn) addMemberBtn.textContent = 'Add Member';
  // also restore the top add button and hide internal add button
  const openBtn = document.getElementById('open-add-member'); if(openBtn) openBtn.classList.remove('hidden');
  if(addMemberBtn) addMemberBtn.classList.add('hidden');
});

memberSearch?.addEventListener('input', async ()=>{ await loadMembers(); });

// initial load when admin pane is present
document.addEventListener('DOMContentLoaded', async ()=>{
  // only attempt to load members list if admin area exists
  // wire open-add-member button in admin-members page (if present)
  const openBtn = document.getElementById('open-add-member');
  const form = document.getElementById('member-admin-form');
  if(openBtn && form){
    openBtn.addEventListener('click', ()=>{
      form.classList.remove('hidden');
      openBtn.classList.add('hidden');
      // show internal add button
      if(addMemberBtn) addMemberBtn.classList.remove('hidden');
      if(cancelMemberEditBtn) cancelMemberEditBtn.classList.remove('hidden');
    });
    // ensure form hidden initially
    form.classList.add('hidden');
    if(addMemberBtn) addMemberBtn.classList.add('hidden');
  }

  if(document.getElementById('member-list')){
    await loadMembers();
  }
});

// Also react to storage events (when admin logs in/out from other tab) to re-render buttons
window.addEventListener('storage', (e)=>{ if(e.key === 'adminLoggedIn') setTimeout(()=>loadMembers(), 120); });

export { loadMembers };
