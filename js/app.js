/* js/app.js
   Loads data/site-data.json and renders content for public pages.
   Basic features: announcement preview, officers list, events list, filters, theme colors.
*/

(async function(){
  const dataUrl = 'data/site-data.json';
  let data = null;

  async function loadData(){
    try {
      const res = await fetch(dataUrl + '?_=' + Date.now());
      data = await res.json();
      applyTheme();
      renderAll();
    } catch (err) {
      console.error('Failed to load site-data.json', err);
      // graceful fallbacks
      const ann = document.getElementById('announcement-preview');
      if(ann) ann.textContent = 'No announcements (data file missing).';
    }
  }

  function applyTheme(){
    if(!data || !data.settings) return;
    const colors = data.settings.colors || {};
    document.documentElement.style.setProperty('--primary', colors.primary || '#0b2340');
    document.documentElement.style.setProperty('--accent', colors.accent || '#ff7a00');
    document.documentElement.style.setProperty('--bg', colors.background || '#f9fafb');
    if(data.settings.siteName) document.title = data.settings.siteName;
  }

  function renderAll(){
    renderAnnouncement();
    renderNextEvent();
    renderOfficers();
    renderEvents();
  }

  function renderAnnouncement(){
    const el = document.getElementById('announcement-preview');
    if(!el) return;
    const ann = (data.announcements && data.announcements[0]) || null;
    if(!ann) { el.textContent = 'No announcements yet.'; return; }
    el.innerHTML = `<div style="font-weight:700">${escapeHtml(ann.title)}</div>
                    <div style="font-size:0.9rem;color:var(--muted);margin-top:6px">${escapeHtml(ann.date)}</div>
                    <div style="margin-top:8px">${escapeHtml(ann.content)}</div>`;
  }

  function renderNextEvent(){
    const el = document.getElementById('next-event');
    if(!el) return;
    const upcoming = (data.events || []).filter(ev => new Date(ev.date) >= new Date()).sort((a,b)=> new Date(a.date)-new Date(b.date));
    if(upcoming.length===0){ el.textContent = 'No upcoming events.'; return; }
    const next = upcoming[0];
    el.innerHTML = `<div style="font-weight:700">${escapeHtml(next.title)}</div>
                    <div style="font-size:0.9rem;color:var(--muted);margin-top:6px">${escapeHtml(next.date)} • ${escapeHtml(next.time||'')}</div>
                    <div style="margin-top:8px">${escapeHtml(next.desc||'')}</div>`;
  }

  function renderOfficers(){
    const container = document.getElementById('officers-list');
    if(!container) return;
    const officers = data.officers || [];
    if(officers.length===0){ container.innerHTML = '<div class="muted">No officers yet.</div>'; return; }
    container.innerHTML = '';
    officers.forEach(off=>{
      const div = document.createElement('div');
      div.className = 'card officer reveal';
      div.innerHTML = `
        <img src="${off.photo||'assets/images/placeholder.png'}" alt="${escapeHtml(off.name)}" />
        <div style="margin-top:12px;font-weight:700">${escapeHtml(off.name)}</div>
        <div class="role">${escapeHtml(off.role)}</div>
        <div class="bio">${escapeHtml(off.bio||'')}</div>
      `;
      container.appendChild(div);
    });
    revealOnScroll();
  }

  function renderEvents(filter='all'){
    const container = document.getElementById('events-list');
    if(!container) return;
    const events = (data.events || []).slice().sort((a,b)=> new Date(a.date)-new Date(b.date));
    const now = new Date();
    let filtered = events;
    if(filter === 'upcoming') filtered = events.filter(e=> new Date(e.date) >= now);
    if(filter === 'past') filtered = events.filter(e=> new Date(e.date) < now).reverse();
    if(filtered.length===0){ container.innerHTML = '<div class="muted">No events found.</div>'; return; }
    container.innerHTML = '';
    filtered.forEach(ev=>{
      const el = document.createElement('div');
      el.className = 'event-item reveal';
      el.innerHTML = `
        <div class="event-left">
          <div style="font-weight:700">${escapeHtml(ev.title)}</div>
          <div class="muted" style="margin-top:6px">${escapeHtml(ev.date)} • ${escapeHtml(ev.time||'')} • ${escapeHtml(ev.location||'')}</div>
          <p style="margin-top:8px">${escapeHtml(ev.desc||'')}</p>
        </div>
        <div class="date-badge">${formatDateShort(ev.date)}</div>
      `;
      container.appendChild(el);
    });
    revealOnScroll();
  }

  // helpers
  function escapeHtml(s){ if(s==null) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
  function formatDateShort(d){ try{ const dt = new Date(d); return dt.toLocaleDateString(undefined,{month:'short',day:'numeric'});}catch(e){return d||'';} }

  // event filters (if present)
  document.getElementById('filter-upcoming')?.addEventListener('click', ()=> renderEvents('upcoming'));
  document.getElementById('filter-past')?.addEventListener('click', ()=> renderEvents('past'));
  document.getElementById('filter-all')?.addEventListener('click', ()=> renderEvents('all'));

  // back to top button
  const backBtn = document.getElementById('backToTop');
  window.addEventListener('scroll', () => {
    if(!backBtn) return;
    backBtn.style.display = window.scrollY > 300 ? 'block' : 'none';
  });
  backBtn?.addEventListener('click', ()=> window.scrollTo({top:0,behavior:'smooth'}));

  // simple reveal
  function revealOnScroll(){
    const list = document.querySelectorAll('.reveal');
    const obs = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting) e.target.classList.add('show');
      });
    }, {threshold:0.12});
    list.forEach(i=> obs.observe(i));
  }

  await loadData();

  // expose data for admin (if loaded from same origin)
  window.__GHS_EHS_DATA = data;
})();
