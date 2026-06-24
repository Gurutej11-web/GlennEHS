// Shared UI utilities: accessible toasts and helpers
export function ensureLiveRegion(){
  let live = document.getElementById('site-live');
  if(!live){
    live = document.createElement('div');
    live.id = 'site-live';
    live.setAttribute('aria-live','polite');
    live.setAttribute('aria-atomic','true');
    live.className = 'sr-only';
    document.body.appendChild(live);
  }
  return live;
}

export function showToast(text, timeout = 3000){
  ensureLiveRegion().textContent = text;
  let wrap = document.querySelector('.toast-wrap');
  if(!wrap){ wrap = document.createElement('div'); wrap.className='toast-wrap'; document.body.appendChild(wrap); }
  const t = document.createElement('div'); t.className='toast'; t.textContent = text; wrap.appendChild(t);
  setTimeout(()=>{ t.style.opacity=0; setTimeout(()=>t.remove(),400); }, timeout);
}

export function showToastWithAction(text, actionLabel, actionFn, timeout = 6000){
  ensureLiveRegion().textContent = text;
  let wrap = document.querySelector('.toast-wrap');
  if(!wrap){ wrap = document.createElement('div'); wrap.className='toast-wrap'; document.body.appendChild(wrap); }
  const t = document.createElement('div'); t.className='toast';
  const span = document.createElement('span'); span.textContent = text; t.appendChild(span);
  const btn = document.createElement('button'); btn.className='btn btn-ghost'; btn.style.marginLeft='10px'; btn.textContent = actionLabel;
  btn.addEventListener('click', ()=>{ actionFn(); if(t.parentNode) t.remove(); });
  t.appendChild(btn); wrap.appendChild(t);
  const timer = setTimeout(()=>{ if(t.parentNode) t.remove(); }, timeout);
}
