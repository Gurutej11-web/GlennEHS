// js/admin-import.js
import { addDoc, collection } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

const ta = document.getElementById('import-data');
const previewBtn = document.getElementById('preview-btn');
const importBtn = document.getElementById('import-btn');
const clearBtn = document.getElementById('clear-btn');
const preview = document.getElementById('preview');
const progress = document.getElementById('progress');

function safeParseJson(s){ try{ return JSON.parse(s); }catch(e){ return null; } }

function renderPreview(items){
  if(!items) { preview.innerHTML = '<p class="muted">Invalid JSON</p>'; return; }
  if(!Array.isArray(items)) { preview.innerHTML = '<p class="muted">Expected a JSON array of objects</p>'; return; }
  if(items.length === 0){ preview.innerHTML = '<p class="muted">Empty array</p>'; return; }
  preview.innerHTML = '<ol>' + items.slice(0,200).map(it=>`<li><strong>${(it.name||'—')}</strong> ${it.role?'<em>('+it.role+')</em>':''} — ${it.year||''}</li>`).join('') + '</ol>';
}

previewBtn && previewBtn.addEventListener('click', ()=>{
  const items = safeParseJson(ta.value);
  renderPreview(items);
});

clearBtn && clearBtn.addEventListener('click', ()=>{ ta.value=''; preview.innerHTML=''; progress.innerHTML='No import yet.'; });

importBtn && importBtn.addEventListener('click', async ()=>{
  const items = safeParseJson(ta.value);
  if(!Array.isArray(items)) { preview.innerHTML = '<p class="muted">Invalid JSON — expected array</p>'; return; }
  if(!confirm(`Import ${items.length} members to Firestore? This will create documents in the members collection.`)) return;
  progress.innerHTML = '';
  for(let i=0;i<items.length;i++){
    const it = items[i];
    const idx = i+1;
    try{
      // Basic normalization: keep only allowed keys
      const doc = {
        name: it.name || '',
        role: it.role || '',
        year: it.year || '',
        status: it.status || '',
        public: (typeof it.public === 'boolean') ? it.public : true,
        avatarUrl: it.avatarUrl || '',
        pointsTotal: (typeof it.pointsTotal === 'number') ? it.pointsTotal : 0,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db,'members'), doc);
      const li = document.createElement('div'); li.textContent = `${idx}/${items.length} — added ${doc.name}`; li.className = 'muted'; progress.appendChild(li);
    }catch(err){ console.error('import error', err); const errEl = document.createElement('div'); errEl.textContent = `${idx}/${items.length} — FAILED ${it && it.name ? it.name : ''}: ${err.message||err}`; errEl.style.color='crimson'; progress.appendChild(errEl); }
  }
  alert('Import finished — check Firestore console or members page.');
});

// Optionally auto-preview sample if empty
document.addEventListener('DOMContentLoaded', ()=>{
  if(ta && !ta.value) ta.value = '';
});
