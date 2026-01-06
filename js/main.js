// js/main.js
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { toYMD, displayDateFromYMD } from './date-utils.js';

// Load Announcements for Home Page
async function loadAnnouncements() {
  const container = document.getElementById("news-list");
  if (!container) return;
  
  const snapshot = await getDocs(collection(db, "announcements"));
  const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  container.innerHTML = list.length
    ? list.map(a => `
        <div class="announcement-card">
          <div style="flex:1">
            <h4 style="margin:0 0 6px 0">${a.title || ''}</h4>
            <p style="margin:0;color:var(--muted)">${a.content || ''}</p>
          </div>
          <span>${a.date ? displayDateFromYMD(toYMD(a.date)) : ''}</span>
        </div>
      `).join("")
    : "<div class='item'><div class='left'>No announcements yet. Officers can add announcements in the Admin Portal.</div></div>";
}

document.addEventListener("DOMContentLoaded", loadAnnouncements);

// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primary-navigation');
  if (!toggle || !nav) return;
  function closeNav(){
    document.body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  function openNav(){
    document.body.classList.add('nav-open');
    toggle.setAttribute('aria-expanded', 'true');
  }
  toggle.addEventListener('click', () => {
    const open = document.body.classList.contains('nav-open');
    if (open) closeNav(); else openNav();
  });
  // Close nav on resize to avoid stuck open state when switching to large screen
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeNav();
  });
  
  // Smooth scroll for internal anchor links
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', e=>{
      const targetId = a.getAttribute('href').slice(1);
      const el = document.getElementById(targetId);
      if(el){
        e.preventDefault();
        el.scrollIntoView({behavior:'smooth',block:'start'});
        history.replaceState(null,'',`#${targetId}`);
      }
    })
  });

  // Reveal on scroll
  const reveals = document.querySelectorAll('.reveal');
  if(reveals.length){
    const obs = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.classList.add('in-view');
          obs.unobserve(e.target);
        }
      })
    },{threshold:0.18});
    reveals.forEach(r=>obs.observe(r));
  }

  // Back to top button
  const backBtn = document.getElementById('back-to-top');
  if(backBtn){
    backBtn.style.display='none';
    window.addEventListener('scroll', ()=>{
      if(window.scrollY > 320) backBtn.style.display='block'; else backBtn.style.display='none';
    });
    backBtn.addEventListener('click', ()=>window.scrollTo({top:0,behavior:'smooth'}));
  }

  // Button ripple effect
  document.querySelectorAll('.btn').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
      btn.appendChild(ripple);
      setTimeout(()=>ripple.remove(), 650);
    });
  });

  // add a scroll listener to toggle a class for nav shadow behavior
  function updateAtTop(){ if(window.scrollY < 8) document.body.classList.add('at-top'); else document.body.classList.remove('at-top'); }
  updateAtTop();
  window.addEventListener('scroll', updateAtTop);
});
