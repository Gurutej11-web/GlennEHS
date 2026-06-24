// gallery.js — render gallery from Firestore and provide a lightbox
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

async function loadGallery(){
  const grid = document.getElementById('gallery-grid');
  if(!grid) return;
  grid.innerHTML = '';
  try{
    const q = query(collection(db, 'gallery'), orderBy('uploadedAt','desc'));
    const snap = await getDocs(q);
    if(snap.empty) return; // nothing to show
    const imgs = [];
    snap.docs.forEach(d=>{
      const data = d.data();
      const url = data.url || data.downloadUrl || '';
      const card = document.createElement('div'); card.className = 'gallery-card';
      const img = document.createElement('img'); img.loading = 'lazy'; img.src = url; img.alt = data.filename || 'Gallery image';
      card.appendChild(img);
      grid.appendChild(card);
      imgs.push(img);
    });
    wireLightbox(imgs);
  }catch(err){ console.error('Failed to load gallery', err); }
}

function wireLightbox(images){
  if(!images || images.length === 0) return;
  // create lightbox DOM if missing
  let lightbox = document.getElementById('lightbox');
  if(!lightbox){
    lightbox = document.createElement('div'); lightbox.id = 'lightbox'; lightbox.className = 'lightbox-backdrop'; lightbox.setAttribute('aria-hidden','true');
    lightbox.innerHTML = `
      <div class="lightbox-content" role="dialog" aria-modal="true">
        <button class="lightbox-close" aria-label="Close">✕</button>
        <button class="lightbox-prev" aria-label="Previous">◀</button>
        <img src="" alt="" id="lightbox-img">
        <button class="lightbox-next" aria-label="Next">▶</button>
      </div>`;
    document.body.appendChild(lightbox);
  }
  const lightboxImg = lightbox.querySelector('#lightbox-img');
  const closeBtn = lightbox.querySelector('.lightbox-close');
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');
  let current = -1;
  function open(i){ current = i; const src = images[i].src; if(lightboxImg) { lightboxImg.src = src; lightboxImg.alt = images[i].alt || ''; } lightbox.classList.add('show'); lightbox.setAttribute('aria-hidden','false'); }
  function close(){ lightbox.classList.remove('show'); lightbox.setAttribute('aria-hidden','true'); if(lightboxImg) lightboxImg.src = ''; }
  function prev(){ if(current <= 0) current = images.length - 1; else current--; open(current); }
  function next(){ if(current >= images.length - 1) current = 0; else current++; open(current); }
  images.forEach((img,i)=>{ img.tabIndex = 0; img.addEventListener('click', ()=>open(i)); img.addEventListener('keydown', e=>{ if(e.key === 'Enter') open(i); }); });
  if(closeBtn) closeBtn.addEventListener('click', close);
  if(prevBtn) prevBtn.addEventListener('click', prev);
  if(nextBtn) nextBtn.addEventListener('click', next);
  lightbox.addEventListener('click', e=>{ if(e.target === lightbox) close(); });
  document.addEventListener('keydown', (e)=>{ if(!lightbox.classList.contains('show')) return; if(e.key === 'Escape') close(); if(e.key === 'ArrowLeft') prev(); if(e.key === 'ArrowRight') next(); });
}

document.addEventListener('DOMContentLoaded', ()=>{ loadGallery().catch(e=>console.error(e)); });

export { loadGallery };
