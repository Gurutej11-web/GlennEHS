import { collection, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

// Automatically reconcile calendar -> events on pages where this file is loaded.
async function reconcileCalendarToEvents(){
  try{
    const calSnap = await getDocs(collection(db,'calendar'));
    const evSnap = await getDocs(collection(db,'events'));
    const evIds = new Set(evSnap.docs.map(d=>d.id));
    const ops = [];
    calSnap.docs.forEach(d=>{
      if(!evIds.has(d.id)){
        const data = d.data() || {};
        const mapped = {
          title: data.title || '',
          description: data.description || data.desc || '',
          date: data.date || new Date().toISOString()
        };
        ops.push(setDoc(doc(db,'events',d.id), mapped));
      }
    });
    if(ops.length) await Promise.all(ops);
  }catch(err){
    console.error('auto-sync failed', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Run sync in background but don't block page rendering
  reconcileCalendarToEvents();
});

export { reconcileCalendarToEvents };
