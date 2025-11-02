// admin-dashboard.js
// Fetch summary counts for the admin landing tiles and render them.
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

async function getAllMembers(){
  const snap = await getDocs(collection(db,'members'));
  return snap.docs.map(d=>({ id: d.id, ...d.data() }));
}

async function getAllEvents(){
  const snap = await getDocs(collection(db,'events'));
  return snap.docs.map(d=>({ id: d.id, ...d.data() }));
}

function formatNumber(n){ return typeof n === 'number' ? n.toLocaleString() : (n || '0'); }

export async function renderAdminStats(){
  const container = document.getElementById('admin-stats');
  if(!container) return;
  try{
    const members = await getAllMembers();
    const totalMembers = members.length;
    const totalPoints = members.reduce((s,m)=>s + (typeof m.pointsTotal === 'number' ? m.pointsTotal : 0), 0);
    const activeMembers = members.filter(m=> (m.status || 'active') === 'active').length;
    const events = await getAllEvents();
    const now = new Date();
    const upcomingCount = events.filter(ev=>{ try{ return new Date(ev.date) >= new Date(now.toISOString().slice(0,10)); }catch(e){ return false; } }).length;

    // update DOM — match tile order
    const tiles = container.querySelectorAll('.stat-tile');
    if(tiles[0]) tiles[0].querySelector('.value').textContent = formatNumber(totalMembers);
    if(tiles[1]) tiles[1].querySelector('.value').textContent = formatNumber(totalPoints);
    if(tiles[2]) tiles[2].querySelector('.value').textContent = formatNumber(activeMembers);
    if(tiles[3]) tiles[3].querySelector('.value').textContent = formatNumber(upcomingCount);
  }catch(err){ console.error('admin stats failed', err); }
}

// Auto-render on DOM ready
document.addEventListener('DOMContentLoaded', ()=>{ renderAdminStats(); });

export default renderAdminStats;