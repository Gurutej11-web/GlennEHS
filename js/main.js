// js/main.js — shared site behaviour
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { toYMD, displayDateFromYMD } from './date-utils.js';

// ── Announcements ────────────────────────────────────────────────
async function loadAnnouncements() {
  const container = document.getElementById('news-list');
  if (!container) return;
  try {
    const snapshot = await getDocs(collection(db, 'announcements'));
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (!list.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📢</div><h3>No announcements yet</h3><p>Check back soon for updates from the team.</p></div>`;
      return;
    }
    // Sort by date descending
    list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    container.innerHTML = list.map((a, i) => `
      <div class="announcement-card${i === 0 ? ' pinned' : ''}">
        <div class="announcement-dot"></div>
        <div class="announcement-body">
          <div class="announcement-title">${escHtml(a.title || '')}</div>
          <div class="announcement-text">${escHtml(a.content || '')}</div>
          <div class="announcement-date">${a.date ? displayDateFromYMD(toYMD(a.date)) : ''}</div>
        </div>
        ${i === 0 ? '<span class="badge badge-gold" style="flex-shrink:0;align-self:flex-start">New</span>' : ''}
      </div>`).join('');
  } catch (err) {
    console.error('Failed to load announcements', err);
    container.innerHTML = `<p style="color:var(--ink-300);font-size:0.9rem">Could not load announcements.</p>`;
  }
}

document.addEventListener('DOMContentLoaded', loadAnnouncements);

// ── DOM-ready init ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  initScrollProgress();
  initReveal();
  initBackToTop();
  initRipple();
  initEventFilters();
  initCounters();
  initQuoteRotator();
  initEventCards();
});

// ── Theme (dark/light) ───────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('enhs-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const toggle = document.getElementById('dark-toggle');
  if (!toggle) return;
  toggle.textContent = saved === 'dark' ? '☀️' : '🌙';
  toggle.addEventListener('click', () => {
    const cur  = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('enhs-theme', next);
    toggle.textContent = next === 'dark' ? '☀️' : '🌙';
  });
}

// ── Navigation ───────────────────────────────────────────────────
function initNav() {
  const nav    = document.getElementById('site-nav');
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.getElementById('primary-navigation');

  // Scrolled shadow
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 12);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile hamburger
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = document.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', String(open));
      links.classList.toggle('open', open);
    });
    // Close on link click (mobile)
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
          document.body.classList.remove('nav-open');
          toggle.setAttribute('aria-expanded', 'false');
          links.classList.remove('open');
        }
      });
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) {
        document.body.classList.remove('nav-open');
        toggle.setAttribute('aria-expanded', 'false');
        links.classList.remove('open');
      }
    });
  }

  // Smooth anchor scroll
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const el = document.getElementById(a.getAttribute('href').slice(1));
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
}

// ── Scroll progress bar ──────────────────────────────────────────
function initScrollProgress() {
  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.prepend(bar);
  window.addEventListener('scroll', () => {
    const h = document.documentElement;
    const pct = (window.scrollY / (h.scrollHeight - h.clientHeight)) * 100;
    bar.style.width = pct + '%';
  }, { passive: true });
}

// ── Scroll reveal ────────────────────────────────────────────────
function initReveal() {
  const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  if (!els.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  els.forEach(el => obs.observe(el));
}

// ── Back to top ──────────────────────────────────────────────────
function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 400), { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ── Button ripple ────────────────────────────────────────────────
function initRipple() {
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const r = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const sz = Math.max(r.width, r.height);
      ripple.style.cssText = `width:${sz}px;height:${sz}px;left:${e.clientX - r.left - sz / 2}px;top:${e.clientY - r.top - sz / 2}px`;
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    });
  });
}

// ── Event filter buttons ─────────────────────────────────────────
function initEventFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('btn-navy', 'active');
        b.classList.add('btn-ghost');
      });
      btn.classList.add('btn-navy', 'active');
      btn.classList.remove('btn-ghost');
      const filter = btn.dataset.filter;
      document.querySelectorAll('#events-list .event-card').forEach(card => {
        card.style.display = (filter === 'all' || card.dataset.type === filter) ? '' : 'none';
      });
    });
  });
}

// ── Animated number counters ─────────────────────────────────────
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el  = e.target;
      const end = parseInt(el.dataset.count, 10);
      const dur = 1800;
      const start = performance.now();
      function step(now) {
        const t   = Math.min(1, (now - start) / dur);
        const val = Math.round(easeOut(t) * end);
        el.textContent = val + (el.dataset.suffix || '+');
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = end + (el.dataset.suffix || '+');
      }
      requestAnimationFrame(step);
      obs.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => obs.observe(c));
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

// ── Literary quote rotator ───────────────────────────────────────
const QUOTES = [
  { text: "A reader lives a thousand lives before he dies. The man who never reads lives only one.", author: "George R.R. Martin" },
  { text: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
  { text: "So it goes.", author: "Kurt Vonnegut, Slaughterhouse-Five" },
  { text: "It is our choices that show what we truly are, far more than our abilities.", author: "J.K. Rowling" },
  { text: "The only way out of the labyrinth of suffering is to forgive.", author: "John Green, Looking for Alaska" },
  { text: "Words are, in my not-so-humble opinion, our most inexhaustible source of magic.", author: "Albus Dumbledore" },
];

function initQuoteRotator() {
  const container = document.getElementById('quote-rotator');
  if (!container) return;
  let current = 0;
  const dots = document.querySelectorAll('.quote-dot');

  function show(idx) {
    const slides = container.querySelectorAll('.quote-slide');
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    current = idx;
  }
  dots.forEach((d, i) => d.addEventListener('click', () => show(i)));

  // Auto-rotate every 5s
  setInterval(() => show((current + 1) % QUOTES.length), 5000);
  show(0);
}

// ── Clickable event cards → detail modal ────────────────────────
function initEventCards() {
  document.addEventListener('click', e => {
    const card = e.target.closest('.event-card');
    if (!card || e.target.closest('.btn') || e.target.closest('button')) return;
    const title = card.querySelector('.event-title')?.textContent || '';
    const desc  = card.querySelector('.event-desc')?.textContent || '';
    const type  = card.dataset.type || 'other';
    const dateBlock = card.querySelector('.event-date-block');
    const month = dateBlock?.querySelector('.event-date-month')?.textContent || '';
    const day   = dateBlock?.querySelector('.event-date-day')?.textContent || '';
    const year  = dateBlock?.querySelector('.event-date-year')?.textContent || '';
    const loc   = card.querySelector('.event-meta-item')?.textContent?.trim() || '';
    if (!title) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <span class="event-modal-type badge-${type}">${type}</span>
        <div class="event-modal-date">
          <div class="event-modal-date-block">
            <div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;color:var(--gold-300)">${month}</div>
            <div style="font-family:var(--font-display);font-size:1.8rem;font-weight:600;line-height:1">${day}</div>
            <div style="font-size:0.65rem;color:rgba(255,255,255,0.5)">${year}</div>
          </div>
          <div>
            <div style="font-weight:600;color:var(--navy)">${escHtml(title)}</div>
            ${loc ? `<div style="font-size:0.85rem;color:var(--ink-400);margin-top:4px">📍 ${escHtml(loc)}</div>` : ''}
          </div>
        </div>
        ${desc ? `<p style="color:var(--ink-500);line-height:1.7;margin-bottom:var(--space-5)">${escHtml(desc)}</p>` : ''}
        <div class="modal-actions"><button class="btn btn-navy" id="modal-close">Close</button></div>
      </div>`;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#modal-close').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', ev => { if (ev.target === backdrop) backdrop.remove(); });
    document.addEventListener('keydown', function esc(ev) { if (ev.key === 'Escape') { backdrop.remove(); document.removeEventListener('keydown', esc); } });
  });
}

function escHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }
window._escHtml = escHtml;
