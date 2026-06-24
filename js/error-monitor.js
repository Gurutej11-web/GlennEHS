// error-monitor.js
// Lightweight runtime error monitor shown on the page to help debugging.
function ensureBanner(){
  let b = document.getElementById('runtime-error-banner');
  if(!b){
    b = document.createElement('div');
    b.id = 'runtime-error-banner';
    b.style.position = 'fixed';
    b.style.left = '12px';
    b.style.right = '12px';
    b.style.top = '12px';
    b.style.zIndex = 9999;
    b.style.background = 'linear-gradient(90deg, #ffdddd, #ffecec)';
    b.style.border = '1px solid #ff9b9b';
    b.style.color = '#611';
    b.style.padding = '10px 12px';
    b.style.borderRadius = '6px';
    b.style.boxShadow = '0 8px 20px rgba(0,0,0,0.06)';
    b.style.fontSize = '0.95rem';
    b.style.display = 'none';
    b.style.gap = '8px';
    const close = document.createElement('button');
    close.textContent = 'Dismiss';
    close.className = 'btn btn-ghost';
    close.style.marginLeft = '12px';
    close.addEventListener('click', ()=>{ b.style.display='none'; });
    const text = document.createElement('span'); text.id = 'runtime-error-text';
    b.appendChild(text); b.appendChild(close);
    document.body.appendChild(b);
  }
  return b;
}

window.addEventListener('error', (ev) => {
  try{
    console.error('Runtime error (captured):', ev.error || ev.message || ev);
    const b = ensureBanner();
    const text = document.getElementById('runtime-error-text');
    const msg = ev.error && ev.error.message ? ev.error.message : (ev.message || String(ev));
    text.textContent = 'Runtime error: ' + (msg.length > 200 ? msg.slice(0,200) + '...' : msg) + ' — check console for details.';
    b.style.display = 'flex';
  }catch(e){ console.error('error-monitor handler failed', e); }
});

window.addEventListener('unhandledrejection', (ev) => {
  try{
    console.error('Unhandled promise rejection (captured):', ev.reason);
    const b = ensureBanner();
    const text = document.getElementById('runtime-error-text');
    const msg = ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason);
    text.textContent = 'Async error: ' + (msg.length > 200 ? msg.slice(0,200) + '...' : msg) + ' — check console for details.';
    b.style.display = 'flex';
  }catch(e){ console.error('error-monitor handler failed', e); }
});

// Also expose a manual helper to show a message
export function showRuntimeNotice(msg){ const b = ensureBanner(); const text = document.getElementById('runtime-error-text'); text.textContent = msg; b.style.display='flex'; }
