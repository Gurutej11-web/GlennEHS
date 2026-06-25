// js/groq-admin.js — Groq AI assistant for ENHS admin
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, increment, query, orderBy, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { db } from "./firebase-config.js";
import { showToast } from "./ui.js";

// API key is stored in localStorage (never committed to source control)
// Admin sets it once via the key-setup UI in admin.html
function getGroqKey() { return localStorage.getItem('enhs-groq-key') || ''; }
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";

function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]); }

// ── Fetch live context from Firestore ────────────────────────────
async function fetchContext() {
  const [membersSnap, announcementsSnap, eventsSnap] = await Promise.all([
    getDocs(query(collection(db, 'members'), orderBy('name'))),
    getDocs(collection(db, 'announcements')),
    getDocs(collection(db, 'events')),
  ]);
  const members = membersSnap.docs.map(d => ({
    id: d.id,
    name: d.data().name || '',
    points: d.data().pointsTotal || 0,
    year: d.data().year || '',
    status: d.data().status || 'active',
  }));
  const announcements = announcementsSnap.docs.map(d => ({
    id: d.id,
    title: d.data().title || '',
    content: d.data().content || '',
    date: d.data().date || '',
  }));
  const events = eventsSnap.docs.map(d => ({
    id: d.id,
    title: d.data().title || '',
    date: d.data().date || '',
    type: d.data().type || 'other',
  }));
  return { members, announcements, events };
}

// ── Execute AI-requested actions ─────────────────────────────────
async function executeAction(action) {
  const { type, payload } = action;
  try {
    switch (type) {

      case 'POST_ANNOUNCEMENT': {
        const { title, content, date } = payload;
        if (!title || !content) return { ok: false, msg: 'Title and content required.' };
        const d = date || new Date().toISOString().split('T')[0];
        await addDoc(collection(db, 'announcements'), { title, content, date: d, createdAt: serverTimestamp() });
        return { ok: true, msg: `Announcement "${title}" posted.` };
      }

      case 'ADD_POINTS_ONE': {
        const { memberId, memberName, delta, reason } = payload;
        if (!memberId || !delta) return { ok: false, msg: 'Member ID and points delta required.' };
        await addDoc(collection(db, 'members', memberId, 'points'), {
          delta, reason: reason || 'Added by AI assistant', timestamp: serverTimestamp(), by: 'AI admin'
        });
        await updateDoc(doc(db, 'members', memberId), { pointsTotal: increment(delta) });
        return { ok: true, msg: `${delta > 0 ? '+' : ''}${delta} points applied to ${memberName}.` };
      }

      case 'ADD_POINTS_ALL': {
        const { delta, reason } = payload;
        if (!delta) return { ok: false, msg: 'Delta required.' };
        const snap = await getDocs(collection(db, 'members'));
        const ops = snap.docs.map(d => Promise.all([
          addDoc(collection(db, 'members', d.id, 'points'), {
            delta, reason: reason || 'Bulk award by AI assistant', timestamp: serverTimestamp(), by: 'AI admin'
          }),
          updateDoc(doc(db, 'members', d.id), { pointsTotal: increment(delta) }),
        ]));
        await Promise.all(ops);
        return { ok: true, msg: `${delta > 0 ? '+' : ''}${delta} points added to all ${snap.docs.length} members.` };
      }

      case 'ADD_POINTS_BULK': {
        const { memberIds, delta, reason } = payload;
        if (!memberIds?.length || !delta) return { ok: false, msg: 'Member IDs and delta required.' };
        const ops = memberIds.map(id => Promise.all([
          addDoc(collection(db, 'members', id, 'points'), {
            delta, reason: reason || 'Bulk award', timestamp: serverTimestamp(), by: 'AI admin'
          }),
          updateDoc(doc(db, 'members', id), { pointsTotal: increment(delta) }),
        ]));
        await Promise.all(ops);
        return { ok: true, msg: `${delta > 0 ? '+' : ''}${delta} points added to ${memberIds.length} members.` };
      }

      case 'DELETE_ANNOUNCEMENT': {
        const { announcementId } = payload;
        if (!announcementId) return { ok: false, msg: 'Announcement ID required.' };
        await deleteDoc(doc(db, 'announcements', announcementId));
        return { ok: true, msg: 'Announcement deleted.' };
      }

      default:
        return { ok: false, msg: `Unknown action type: ${type}` };
    }
  } catch (err) {
    console.error('AI action error', err);
    return { ok: false, msg: err.message };
  }
}

// ── Call Groq API ────────────────────────────────────────────────
async function callGroq(messages) {
  const key = getGroqKey();
  if (!key) throw new Error('Groq API key not set. Enter it in the AI Assistant settings above.');
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

// ── Build system prompt ──────────────────────────────────────────
function buildSystemPrompt(ctx) {
  const memberList = ctx.members.map(m =>
    `  - ${m.name} (ID: ${m.id}, Points: ${m.points}, Year: ${m.year}, Status: ${m.status})`
  ).join('\n');
  const announcementList = ctx.announcements.slice(0, 5).map(a =>
    `  - "${a.title}" (ID: ${a.id}, Date: ${a.date})`
  ).join('\n');
  const eventList = ctx.events.slice(0, 8).map(e =>
    `  - "${e.title}" on ${e.date} (ID: ${e.id}, Type: ${e.type})`
  ).join('\n');

  return `You are the AI admin assistant for the Glenn High School English Honors Society (ENHS) website. You help admins manage the club efficiently.

## Current Data
### Members (${ctx.members.length} total):
${memberList || '  (none yet)'}

### Recent Announcements:
${announcementList || '  (none yet)'}

### Upcoming Events:
${eventList || '  (none yet)'}

## Your Capabilities
You can:
1. **Post announcements** — write and publish announcements
2. **Adjust points** — add or subtract points for one member, a group, or all members
3. **Explain tasks** — walk the admin through any task step-by-step
4. **Suggest content** — draft announcement text, suggest point amounts for activities

## Response Format
When you need to PERFORM an action, include a JSON block in your response using this exact format:
<ACTION>{"type":"ACTION_TYPE","payload":{...}}</ACTION>

Available action types:
- POST_ANNOUNCEMENT: payload = { title, content, date (YYYY-MM-DD, optional) }
- ADD_POINTS_ONE: payload = { memberId, memberName, delta (number), reason }
- ADD_POINTS_ALL: payload = { delta (number), reason }
- ADD_POINTS_BULK: payload = { memberIds (array of IDs), delta (number), reason }
- DELETE_ANNOUNCEMENT: payload = { announcementId }

Always explain what you're doing before including the ACTION block.
If you're not sure who a member is, ask for clarification before acting.
Never make up member IDs — use only the IDs from the member list above.
If asked to help (not do), provide clear step-by-step instructions without ACTION blocks.`;
}

// ── Parse and execute actions from AI response ───────────────────
async function processResponse(text) {
  const actionRegex = /<ACTION>([\s\S]*?)<\/ACTION>/g;
  const results = [];
  let match;
  while ((match = actionRegex.exec(text)) !== null) {
    try {
      const action = JSON.parse(match[1]);
      const result = await executeAction(action);
      results.push(result);
    } catch (e) {
      results.push({ ok: false, msg: 'Failed to parse action: ' + e.message });
    }
  }
  // Strip ACTION tags from displayed text
  const displayText = text.replace(/<ACTION>[\s\S]*?<\/ACTION>/g, '').trim();
  return { displayText, results };
}

// ── Chat UI ──────────────────────────────────────────────────────
export function initGroqAssistant(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const history = []; // conversation history

  const savedKey = getGroqKey();

  container.innerHTML = `
    <div class="ai-assistant">
      <div class="ai-header">
        <div class="ai-header-icon">✦</div>
        <div>
          <div class="ai-header-title">AI Admin Assistant</div>
          <div class="ai-header-sub">Powered by Groq · Llama 3.3 70B</div>
        </div>
        <div class="ai-status" id="ai-status">Ready</div>
      </div>

      ${!savedKey ? `
      <div class="ai-key-setup" id="ai-key-setup">
        <span style="font-size:1.2rem">🔑</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:0.88rem;margin-bottom:4px">Enter your Groq API Key to enable the assistant</div>
          <div style="display:flex;gap:var(--space-2)">
            <input type="password" id="ai-key-input" class="input" placeholder="gsk_..." style="font-size:0.85rem;padding:6px 10px" />
            <button class="btn btn-navy btn-sm" id="ai-key-save">Save</button>
          </div>
        </div>
      </div>` : `
      <div class="ai-key-setup" id="ai-key-setup" style="display:none"></div>
      `}

      <div class="ai-quick-actions">
        <button class="ai-quick-btn" data-prompt="Draft a meeting reminder announcement for the next club meeting in Room 2212 on the second Monday at 3:35 PM.">📢 Draft Announcement</button>
        <button class="ai-quick-btn" data-prompt="Add 1 point to all members for attendance.">⭐ +1 to All Members</button>
        <button class="ai-quick-btn" data-prompt="Show me how to add a new member step by step.">📋 How to Add Member</button>
        <button class="ai-quick-btn" data-prompt="List all members and their current points, sorted by points.">🏆 Points Summary</button>
        <button class="ai-quick-btn" data-prompt="Help me write an announcement about an upcoming poetry slam event.">🎤 Poetry Slam Post</button>
        <button class="ai-quick-btn" data-prompt="Add 5 points to all members for completing this month's reading.">📚 Reading Points</button>
      </div>

      <div class="ai-messages" id="ai-messages">
        <div class="ai-msg ai-msg-bot">
          <div class="ai-msg-bubble">
            Hi! I'm your ENHS AI assistant. I can help you post announcements, manage member points, and handle any admin task. What would you like to do?
          </div>
        </div>
      </div>

      <div class="ai-input-row">
        <textarea class="ai-input" id="ai-input" placeholder="Ask me anything… e.g. 'Add 2 points to all members for today's meeting'" rows="2"></textarea>
        <button class="btn btn-navy ai-send-btn" id="ai-send">Send</button>
      </div>
    </div>`;

  const messagesEl = container.querySelector('#ai-messages');
  const inputEl    = container.querySelector('#ai-input');
  const sendBtn    = container.querySelector('#ai-send');
  const statusEl   = container.querySelector('#ai-status');

  function addMessage(role, text, actionResults = []) {
    const div = document.createElement('div');
    div.className = `ai-msg ai-msg-${role}`;
    // Convert markdown-ish bold/bullets to HTML
    const formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');
    let html = `<div class="ai-msg-bubble">${formatted}</div>`;
    if (actionResults.length) {
      html += actionResults.map(r =>
        `<div class="ai-action-result ${r.ok ? 'ok' : 'err'}">${r.ok ? '✓' : '✗'} ${esc(r.msg)}</div>`
      ).join('');
    }
    div.innerHTML = html;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function send(userText) {
    if (!userText.trim()) return;
    addMessage('user', esc(userText));
    inputEl.value = '';
    sendBtn.disabled = true;
    statusEl.textContent = 'Thinking…';
    statusEl.className = 'ai-status thinking';

    try {
      const ctx = await fetchContext();
      const systemPrompt = buildSystemPrompt(ctx);

      if (!history.length) {
        history.push({ role: 'system', content: systemPrompt });
      } else {
        // Refresh system prompt with latest data
        history[0] = { role: 'system', content: systemPrompt };
      }
      history.push({ role: 'user', content: userText });

      const raw = await callGroq(history);
      history.push({ role: 'assistant', content: raw });

      statusEl.textContent = 'Processing…';
      const { displayText, results } = await processResponse(raw);

      addMessage('bot', displayText, results);

      if (results.some(r => r.ok)) {
        showToast('AI action completed');
        // Refresh page data if available
        if (window.refreshPointsTable) window.refreshPointsTable();
        if (window.refreshAnnouncements) window.refreshAnnouncements();
      }
    } catch (err) {
      console.error('AI error', err);
      addMessage('bot', `Sorry, I ran into an error: ${err.message}`);
    } finally {
      sendBtn.disabled = false;
      statusEl.textContent = 'Ready';
      statusEl.className = 'ai-status';
    }
  }

  sendBtn.addEventListener('click', () => send(inputEl.value));
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inputEl.value); }
  });

  // Quick action buttons
  container.querySelectorAll('.ai-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => send(btn.dataset.prompt));
  });

  // Key setup save
  const keySaveBtn = container.querySelector('#ai-key-save');
  const keyInput   = container.querySelector('#ai-key-input');
  const keySetup   = container.querySelector('#ai-key-setup');
  if (keySaveBtn && keyInput) {
    keySaveBtn.addEventListener('click', () => {
      const k = keyInput.value.trim();
      if (!k.startsWith('gsk_')) { showToast('Invalid key — must start with gsk_'); return; }
      localStorage.setItem('enhs-groq-key', k);
      keySetup.style.display = 'none';
      addMessage('bot', 'API key saved! I\'m ready to help. What would you like to do?');
      showToast('Groq API key saved');
    });
  }
}
