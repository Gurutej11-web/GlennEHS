// members-public.js
// Render a public members directory (no admin controls).
import { collection, getDocs, query, orderBy, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

const grid = document.getElementById('members-grid');
const search = document.getElementById('member-search');

function escapeHtml(str){ if(!str) return ''; return String(str).replace(/[&<>"']/g, (s)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" })[s]); }

function gradeLabelFromYear(gradYear){
  if(!gradYear) return '';
  const y = Number(gradYear);
  if(!y) return '';
  const now = new Date();
  // determine current school year (if month >= July, school year increments)
  const schoolYear = (now.getMonth() >= 6) ? now.getFullYear() + 1 : now.getFullYear();
  const diff = y - schoolYear; // years until graduation
  const gradeNumber = 12 - diff; // approximate grade number
  switch(gradeNumber){
    case 12: return 'Senior';
    case 11: return 'Junior';
    case 10: return 'Sophomore';
    case 9: return 'Freshman';
    default: return '';
  }
}

async function loadMembers(){
  if(!grid) return;
  grid.innerHTML = '<p class="muted">Loading members…</p>';
  try{
    const snap = await getDocs(query(collection(db,'members'), orderBy('name')));
    const term = search && search.value ? search.value.toLowerCase().trim() : '';
    grid.innerHTML = '';
    if(snap.empty){ grid.innerHTML = '<p class="muted">No members found.</p>'; return; }
    snap.docs.forEach(d=>{
      const m = d.data();
  // All profiles are public by default; show every member document
      const name = m.name || ''; const year = m.year || ''; const status = m.status || '';
      const points = typeof m.pointsTotal === 'number' ? m.pointsTotal : 0;
      const hay = (name + ' ' + year + ' ' + status).toLowerCase();
      if(term && !hay.includes(term)) return;
      const gradeLabel = gradeLabelFromYear(year);
      const initials = name.split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase() || 'G';
      const isOfficer = m.role && String(m.role).trim().length > 0;
      // Map simple status labels to more descriptive phrases (e.g. "Active" -> "Active Member" / "Active Officer")
      let statusLabel = '';
      if(status){
        const s = String(status).toLowerCase().trim();
        if(s === 'active') statusLabel = isOfficer ? 'Active Officer' : 'Active Member';
        else statusLabel = String(status);
      }
      const metaParts = [];
      if(statusLabel) metaParts.push(escapeHtml(statusLabel));
      if(isOfficer) metaParts.push(escapeHtml(m.role));
      const metaText = metaParts.join(' • ');
  const card = document.createElement('article'); card.className = 'public-member-card' + (isOfficer ? ' officer' : '');
      // Show avatar image when provided, otherwise fall back to initials
      const avatarHtml = m.avatarUrl ? `<img src="${m.avatarUrl}" alt="${escapeHtml(name)}'s avatar" />` : escapeHtml(initials);
      card.innerHTML = `
        <div class="avatar" aria-hidden="true">${avatarHtml}</div>
        <div>
          <h3>${escapeHtml(name)}</h3>
          <div class="meta">${metaText}</div>
          <div class="row">
            ${ gradeLabel ? `<span class="member-badge">${escapeHtml(gradeLabel)}</span>` : '' }
            <div style="flex:1"></div>
            <span class="member-points-pill">${points} pts</span>
          </div>
        </div>
      `;

      // If admin is logged in, allow editing via a small modal when clicking the card
      card.addEventListener('click', ()=>{
        const isAdmin = localStorage.getItem('adminLoggedIn') === 'true';
        if(!isAdmin) return;
        openMemberModal(d.id, m);
      });

      grid.appendChild(card);
    });
  }catch(err){ console.error('members-public load failed', err); grid.innerHTML = '<p class="muted">Failed to load members.</p>'; }
}

function createModalHtml(member){
  return `
    <h3 style="margin-top:0">${member ? 'Edit Member' : 'Add Member'}</h3>
    <div style="display:flex;flex-direction:column;gap:8px">
      <input id="m-edit-name" class="input" placeholder="Full name" value="${member ? escapeHtml(member.name||'') : ''}" />
      <input id="m-edit-year" class="input" placeholder="Graduation year" value="${member ? escapeHtml(member.year||'') : ''}" />
      <input id="m-edit-email" class="input" placeholder="Email" value="${member ? escapeHtml(member.email||'') : ''}" />
      <input id="m-edit-role" class="input" placeholder="Role (leave blank for member)" value="${member ? escapeHtml(member.role||'') : ''}" />
      <select id="m-edit-status" class="input">
        <option value="active">Active</option>
        <option value="alumni">Alumni</option>
        <option value="invited">Invited</option>
      </select>
  <!-- profiles are always public now (no toggle) -->
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="m-edit-cancel" class="btn btn-ghost">Cancel</button>
        ${ member ? `<button id="m-edit-delete" class="btn" style="background:crimson;color:white">Delete</button>` : '' }
        <button id="m-edit-save" class="btn btn-primary">Save</button>
      </div>
    </div>
  `;
}

async function openMemberModal(id, member){
  const backdrop = document.createElement('div'); backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div'); modal.className = 'modal';
  modal.innerHTML = createModalHtml(member);
  backdrop.appendChild(modal); document.body.appendChild(backdrop);
  // set status
  const statusEl = modal.querySelector('#m-edit-status'); if(statusEl) statusEl.value = member ? (member.status || 'active') : 'active';
  // cancel
  modal.querySelector('#m-edit-cancel').addEventListener('click', ()=>{ backdrop.remove(); });
  // delete if member
  if(member){
    modal.querySelector('#m-edit-delete').addEventListener('click', async ()=>{
      if(!confirm('Delete this member? This cannot be undone.')) return;
      try{ await deleteDoc(doc(db,'members',id)); backdrop.remove(); await loadMembers(); }catch(err){ console.error(err); alert('Failed to delete member'); }
    });
  }
  // save (create or update)
  modal.querySelector('#m-edit-save').addEventListener('click', async ()=>{
    const n = modal.querySelector('#m-edit-name').value.trim();
    if(!n){ alert('Please enter a name'); return; }
    const y = modal.querySelector('#m-edit-year').value.trim();
    const em = modal.querySelector('#m-edit-email').value.trim();
    const r = modal.querySelector('#m-edit-role').value.trim();
    const s = modal.querySelector('#m-edit-status').value;
  // All profiles are public by default
  const payload = { name: n, year: y, email: em, role: r, status: s, public: true };
    try{
      if(member){ await updateDoc(doc(db,'members',id), payload); }
      else { await addDoc(collection(db,'members'), Object.assign({}, payload, { pointsTotal:0, createdAt: new Date().toISOString() })); }
      backdrop.remove(); await loadMembers();
    }catch(err){ console.error('save member failed', err); alert('Failed to save member'); }
  });
}

// Show Add Member opener only when admin logged in
document.addEventListener('DOMContentLoaded', ()=>{
  const addBtn = document.getElementById('open-add-member');
  function update(){ const isAdmin = localStorage.getItem('adminLoggedIn') === 'true'; if(addBtn) addBtn.style.display = isAdmin ? 'inline-block' : 'none'; }
  if(addBtn){ addBtn.addEventListener('click', ()=> openMemberModal(null, null)); }
  update(); window.addEventListener('storage', (e)=>{ if(e.key === 'adminLoggedIn') update(); });
});

if(search) search.addEventListener('input', ()=>{ loadMembers(); });
document.addEventListener('DOMContentLoaded', ()=>{ loadMembers(); });

export { loadMembers };
