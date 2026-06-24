// js/home.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

// parse YYYY-MM-DD as local date
function parseDateLocal(s){ if(!s) return null; const m=/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/.exec(s); if(m) return new Date(Number(m[1]),Number(m[2])-1,Number(m[3])); return new Date(s); }

export async function refreshNextMeeting(){
  const el = document.getElementById('home-next-meeting');
  if(!el) return;
  try{
    const snap = await getDocs(collection(db,'events'));
    const items = snap.docs.map(d=>({id:d.id, ...d.data()}));
    const now = new Date();
    // prefer type 'meeting' but fallback to earliest upcoming
    const upcoming = items.map(it=>({it, d: parseDateLocal(it.date)})).filter(x=>x.d && x.d >= new Date(now.toDateString())).sort((a,b)=>a.d-b.d);
    let chosen = upcoming.find(x=> (x.it.type||'').toLowerCase() === 'meeting') || (upcoming.length ? upcoming[0] : null);
    if(!chosen){ el.innerHTML = '<div class="muted">No upcoming meetings scheduled.</div>'; return; }
    const ev = chosen.it; const d = chosen.d;
    const dateStr = d.toLocaleDateString(undefined,{weekday:'short', month:'short', day:'numeric'});
    const timeStr = ev.time ? ' • ' + escapeHtml(ev.time) : '';
    const locStr = ev.location ? ' • ' + escapeHtml(ev.location) : '';
    el.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px"><strong style="color:var(--primary-500);font-size:1.05rem">${escapeHtml(ev.title||'Next Meeting')}</strong><div style="color:var(--muted)">${dateStr}${timeStr}${locStr}</div><p style="margin:6px 0 0 0">${escapeHtml(ev.description||'')}</p></div>`;
  }catch(err){ console.error('Failed to load next meeting', err); el.innerHTML = '<div class="muted">Failed to load next meeting.</div>'; }
}

function escapeHtml(s){ if(s==null) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// Expose globally for other scripts to call after adding events
window.refreshNextMeeting = refreshNextMeeting;

// Auto-run on load
document.addEventListener('DOMContentLoaded', ()=>{ refreshNextMeeting().catch(()=>{}); });
