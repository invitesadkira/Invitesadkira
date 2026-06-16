// =====================================================================
// RSVP — Confirmação de Presença (rebuilt from scratch)
// =====================================================================
// State: stored in Supabase (rsvps table) + in-memory (Store._rsvp)
// NO localStorage — source of truth is always Supabase
// =====================================================================

// ── RSVP Persistence: sessionStorage (cleared on tab close, persists on refresh) ──
function rsvpCheckConfirmed(eventId) {
  if (!eventId) return null;
  try {
    const saved = sessionStorage.getItem('rsvp_confirmed_' + eventId);
    return saved ? JSON.parse(saved) : null;
  } catch(e) { return null; }
}

function rsvpSetConfirmed(eventId, data) {
  try { sessionStorage.setItem('rsvp_confirmed_' + eventId, JSON.stringify(data)); } catch(e) {}
  if (!Store._rsvp) Store._rsvp = {};
  Store._rsvp[eventId] = data;
}

function rsvpClearConfirmed(eventId) {
  try { sessionStorage.removeItem('rsvp_confirmed_' + eventId); } catch(e) {}
  if (!Store._rsvp) Store._rsvp = {};
  Store._rsvp[eventId] = null;
}

// ── Open the RSVP drawer ───────────────────────────────────────────────
async function openRsvpDrawer() {
  const drawer = document.getElementById('rsvp-drawer');
  if (!drawer) return;
  drawer.classList.add('open');
  document.body.style.overflow = 'hidden';

  const eventId = Store.currentEventId;
  const confirmed = await rsvpCheckConfirmed(eventId);
  _rsvpRender(confirmed ? 'SUCCESS' : 'FORM');
}

function closeRsvpDrawer() {
  const drawer = document.getElementById('rsvp-drawer');
  if (!drawer) return;
  drawer.classList.remove('open');
  document.body.style.overflow = '';
}

// ── Render the drawer in the given state ──────────────────────────────
function _rsvpRender(state) {
  const ev = Store.guestEventData;
  if (!ev) return;
  const evColor = ev.event_color || '#007f9f';

  const panel = document.getElementById('rsvp-drawer-panel');
  if (!panel) return;

  if (state === 'SUCCESS') {
    _rsvpRenderSuccess(panel, evColor);
  } else {
    _rsvpRenderForm(panel, ev, evColor);
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Success screen ─────────────────────────────────────────────────────
function _rsvpRenderSuccess(panel, evColor) {
  panel.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;padding:2.5rem 1.5rem 2rem;text-align:center">
      <!-- Close button top-right -->
      <button onclick="closeRsvpDrawer()" style="position:absolute;top:1rem;right:1rem;background:none;border:none;cursor:pointer;color:#9ca3af;padding:4px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <!-- Check icon -->
      <div style="width:64px;height:64px;border-radius:50%;background:color-mix(in srgb,${evColor} 12%,white);display:flex;align-items:center;justify-content:center;margin-bottom:1.25rem">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${evColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>

      <h2 style="font-size:1.2rem;font-weight:800;color:#1e293b;margin-bottom:0.35rem">Presença Confirmada!</h2>
      <p style="font-size:0.88rem;color:#6b7280;margin-bottom:1.75rem;max-width:280px">A sua resposta foi registada com sucesso.</p>

      <!-- Action buttons -->
      <button onclick="rsvpEdit()" style="background:${evColor};color:#fff;border:none;border-radius:999px;padding:0.75rem 2rem;font-weight:700;font-size:0.92rem;cursor:pointer;font-family:inherit;width:100%;max-width:280px;margin-bottom:0.75rem">
        Editar Resposta
      </button>

      <button onclick="rsvpOpenFelicitacoes()" style="background:transparent;color:${evColor};border:1.5px solid ${evColor};border-radius:999px;padding:0.65rem 2rem;font-weight:700;font-size:0.88rem;cursor:pointer;font-family:inherit;width:100%;max-width:280px;margin-bottom:0.75rem">
        Ver Felicitações
      </button>

      <button onclick="rsvpLeaveFelicitacao()" style="background:transparent;color:#6b7280;border:1.5px solid #e5e7eb;border-radius:999px;padding:0.65rem 2rem;font-weight:600;font-size:0.82rem;cursor:pointer;font-family:inherit;width:100%;max-width:280px">
        Deixar Felicitação
      </button>

      <!-- Promo -->
      <div style="margin-top:1.75rem;padding:1rem;border-radius:1rem;background:linear-gradient(135deg,#0f172a,#1e3a4a);width:100%;max-width:320px">
        <p style="color:#94a3b8;font-size:0.72rem;line-height:1.65;margin:0">
          Gostou deste convite digital?
          <a href="https://wa.me/244959823409" target="_blank" style="color:#5eead4;font-weight:700;display:block;margin-top:0.3rem">WhatsApp 959 823 409</a>
        </p>
      </div>
    </div>`;
}

// ── Form screen ────────────────────────────────────────────────────────
function _rsvpRenderForm(panel, ev, evColor) {
  const allowSides = ev.allowSides === true || String(ev.allow_sides||'').toLowerCase() === 'yes';
  const allowComp  = ev.allowCompanions === true || String(ev.allow_companions||'').toLowerCase() === 'yes';
  const allowKids  = ev.allowKids === true || String(ev.allow_kids||'').toLowerCase() === 'yes';
  const allowMsg   = ev.allowMessages === true || String(ev.allow_messages||'').toLowerCase() === 'yes';
  const side1 = ev.side1_name || 'Noivo';
  const side2 = ev.side2_name || 'Noiva';

  const sidesHtml = allowSides ? `
    <div class="rsvp-field-group">
      <label class="rsvp-label">Escolhe o grupo</label>
      <div style="display:flex;gap:0.5rem">
        <label class="rsvp-radio-btn" id="rsvp-side1-lbl">
          <input type="radio" name="rsvp-side" value="side1" style="display:none" onchange="document.getElementById('rsvp-side1-lbl').classList.add('active');document.getElementById('rsvp-side2-lbl').classList.remove('active')">
          ${escapeHTML(side1)}
        </label>
        <label class="rsvp-radio-btn" id="rsvp-side2-lbl">
          <input type="radio" name="rsvp-side" value="side2" style="display:none" onchange="document.getElementById('rsvp-side2-lbl').classList.add('active');document.getElementById('rsvp-side1-lbl').classList.remove('active')">
          ${escapeHTML(side2)}
        </label>
      </div>
    </div>` : '';

  const compHtml = allowComp ? `
    <div class="rsvp-field-group">
      <label class="rsvp-label">Acompanhantes <span style="font-weight:400;color:#9ca3af">(opcional)</span></label>
      <div id="rsvp-comp-list"></div>
      <button type="button" onclick="rsvpAddCompanion()" style="background:transparent;border:1.5px dashed #d1d5db;border-radius:0.75rem;padding:0.5rem 1rem;color:#6b7280;font-size:0.82rem;cursor:pointer;width:100%;font-family:inherit;margin-top:0.25rem;transition:border-color 0.2s" onmouseover="this.style.borderColor='${evColor}'" onmouseout="this.style.borderColor='#d1d5db'">
        + Adicionar acompanhante
      </button>
    </div>` : '';

  const kidsHtml = allowKids ? `
    <div class="rsvp-field-group">
      <label class="rsvp-label">Crianças <span style="font-weight:400;color:#9ca3af">(opcional)</span></label>
      <div id="rsvp-kids-list-new"></div>
      <button type="button" onclick="rsvpAddKid()" style="background:transparent;border:1.5px dashed #d1d5db;border-radius:0.75rem;padding:0.5rem 1rem;color:#6b7280;font-size:0.82rem;cursor:pointer;width:100%;font-family:inherit;margin-top:0.25rem;transition:border-color 0.2s" onmouseover="this.style.borderColor='${evColor}'" onmouseout="this.style.borderColor='#d1d5db'">
        + Adicionar criança
      </button>
    </div>` : '';

  const msgHtml = allowMsg ? `
    <div class="rsvp-field-group">
      <label class="rsvp-label">Deixar uma mensagem <span style="font-weight:400;color:#9ca3af">(opcional)</span></label>
      <textarea id="rsvp-msg-new" class="input-field" rows="3" placeholder="Escreve algo especial..." style="resize:none"></textarea>
    </div>` : '';

  panel.innerHTML = `
    <div style="position:relative">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:center;padding:1rem 1.25rem 0.75rem;position:relative">
        <h3 style="font-size:1.05rem;font-weight:800;color:#1e293b;margin:0">Confirmação de Presença</h3>
        <button onclick="closeRsvpDrawer()" style="position:absolute;right:0.75rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#9ca3af;padding:4px;line-height:0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style="padding:0 1.25rem 1.5rem">
        <!-- Attending -->
        <div class="rsvp-field-group">
          <label class="rsvp-label">Confirma presença?</label>
          <div style="display:flex;gap:0.5rem">
            <label class="rsvp-radio-btn" id="rsvp-yes-lbl">
              <input type="radio" name="rsvp-attending" value="yes" style="display:none" onchange="_rsvpToggleAttending('yes')"> Sim
            </label>
            <label class="rsvp-radio-btn" id="rsvp-no-lbl">
              <input type="radio" name="rsvp-attending" value="no" style="display:none" onchange="_rsvpToggleAttending('no')"> Não
            </label>
          </div>
        </div>

        <!-- Name -->
        <div class="rsvp-field-group">
          <label class="rsvp-label">Seu Nome <span style="color:#ef4444">*</span></label>
          <input id="rsvp-name-new" class="input-field" placeholder="Máx. 3 nomes" oninput="limitToThreeWords(this,3)" required>
        </div>

        ${sidesHtml}
        ${compHtml}
        ${kidsHtml}
        ${msgHtml}

        <button onclick="rsvpSubmit()" id="rsvp-submit-btn" style="background:${evColor};color:#fff;border:none;border-radius:999px;padding:0.9rem;font-weight:800;font-size:0.95rem;cursor:pointer;width:100%;font-family:inherit;margin-top:0.75rem;transition:opacity 0.2s">
          Enviar Confirmação
        </button>

        <!-- View felicitações -->
        <button onclick="rsvpOpenFelicitacoes()" style="background:transparent;border:none;color:${evColor};font-size:0.82rem;font-weight:600;cursor:pointer;width:100%;margin-top:0.75rem;font-family:inherit;padding:0.25rem">
          Ver Felicitações
        </button>
      </div>
    </div>`;
}

function _rsvpToggleAttending(val) {
  const yesLbl = document.getElementById('rsvp-yes-lbl');
  const noLbl  = document.getElementById('rsvp-no-lbl');
  if (val === 'yes') { yesLbl?.classList.add('active'); noLbl?.classList.remove('active'); }
  else               { noLbl?.classList.add('active');  yesLbl?.classList.remove('active'); }

  // Show/hide companion and kids sections based on attending
  const ev = Store.guestEventData;
  const compSection = document.querySelector('.rsvp-comp-section');
  // if not attending, companions don't make sense
  ['rsvp-comp-list', 'rsvp-kids-list-new'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.parentElement) {
      el.parentElement.style.display = (val === 'no') ? 'none' : '';
    }
  });
}

// ── Add companion / kid ───────────────────────────────────────────────
function rsvpAddCompanion() {
  const list = document.getElementById('rsvp-comp-list');
  if (!list) return;
  const ev = Store.guestEventData;
  const max = ev?.maxCompanions || ev?.max_companions || 5;
  if (list.children.length >= max) { toast(`Máximo de ${max} acompanhantes.`); return; }
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;gap:0.4rem;margin-bottom:0.4rem;align-items:center';
  div.innerHTML = `<input class="input-field" placeholder="Nome (máx. 3 palavras)" oninput="limitToThreeWords(this,3)" style="flex:1;font-size:0.85rem">
    <button type="button" onclick="this.parentElement.remove()" style="background:#fee2e2;border:none;border-radius:0.5rem;padding:0.4rem 0.6rem;cursor:pointer;color:#ef4444;flex-shrink:0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  list.appendChild(div);
}

function rsvpAddKid() {
  const list = document.getElementById('rsvp-kids-list-new');
  if (!list) return;
  const ev = Store.guestEventData;
  const max = ev?.maxKids || ev?.max_kids || 5;
  if (list.children.length >= max) { toast(`Máximo de ${max} crianças.`); return; }
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;gap:0.4rem;margin-bottom:0.4rem;align-items:center';
  div.innerHTML = `<input class="input-field" placeholder="Nome da criança (máx. 3 palavras)" oninput="limitToThreeWords(this,3)" style="flex:1;font-size:0.85rem">
    <button type="button" onclick="this.parentElement.remove()" style="background:#fee2e2;border:none;border-radius:0.5rem;padding:0.4rem 0.6rem;cursor:pointer;color:#ef4444;flex-shrink:0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  list.appendChild(div);
}

// ── Submit RSVP ───────────────────────────────────────────────────────
async function rsvpSubmit() {
  const ev      = Store.guestEventData;
  const eventId = Store.currentEventId;
  const name    = (document.getElementById('rsvp-name-new')?.value || '').trim();
  const attending = document.querySelector('input[name="rsvp-attending"]:checked')?.value;

  if (!name) { toast('Por favor insere o teu nome.'); document.getElementById('rsvp-name-new')?.focus(); return; }
  if (!attending) { toast('Por favor indica se confirmas presença.'); return; }

  const sideInput = document.querySelector('input[name="rsvp-side"]:checked');
  const side = sideInput ? sideInput.value : null;

  const companions = Array.from(document.querySelectorAll('#rsvp-comp-list input')).map(i=>i.value.trim()).filter(Boolean);
  const kids       = Array.from(document.querySelectorAll('#rsvp-kids-list-new input')).map(i=>i.value.trim()).filter(Boolean);
  const message    = document.getElementById('rsvp-msg-new')?.value?.trim() || null;

  const btn = document.getElementById('rsvp-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'A enviar...'; btn.style.opacity = '0.6'; }

  try {
    // Check if already exists (update) or new (insert)
    const existing = await supabaseRequest(
      `rsvps?event_id=eq.${eventId}&guest_name=ilike.${encodeURIComponent(name)}&select=id&limit=1`
    );

    const payload = {
      event_id:   eventId,
      guest_name: name,
      attending:  attending === 'yes',
      side:       side,
      companions: companions.join('|') || null,
      kids:       kids.join('|') || null,
      message:    message,
      updated_at: new Date().toISOString(),
    };

    if (existing && existing[0]) {
      await supabaseRequest(`rsvps?id=eq.${existing[0].id}`, 'PATCH', payload);
    } else {
      payload.wants_gift = false;
      await supabaseRequest('rsvps', 'POST', payload);
    }

    // Save to in-memory store
    rsvpSetConfirmed(eventId, { name, attending: attending === 'yes', side, companions, kids, message });

    // Update local confirmations list
    if (ev.confirmations) {
      const existingIdx = ev.confirmations.findIndex(c => c.name?.toLowerCase() === name.toLowerCase());
      const newEntry = { name, attending: attending === 'yes', side, companions, kids, message: message || '', ownerReply: '' };
      if (existingIdx > -1) ev.confirmations[existingIdx] = newEntry;
      else ev.confirmations.push(newEntry);
    }

    const isUpdate = !!(existing && existing[0]);
    toast(isUpdate ? 'Resposta actualizada!' : 'Presença confirmada!');

    _rsvpRender('SUCCESS');

    // ── Confetti on confirm, warm message on decline ──
    if (attending === 'yes') {
      _rsvpShowConfetti();
    } else {
      _rsvpShowDecline();
    }

  } catch(e) {
    console.error('RSVP submit error:', e);
    toast('Erro ao enviar. Tenta novamente.');
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar Confirmação'; btn.style.opacity = '1'; }
  }
}

// ── Edit response ─────────────────────────────────────────────────────
async function rsvpEdit() {
  const eventId = Store.currentEventId;

  // Load previous answer from Supabase before clearing confirmation
  const ev = Store.guestEventData;
  const confirmed = rsvpCheckConfirmed(eventId);
  const prevName = confirmed?.name || '';
  let prevData = null;

  if (prevName) {
    try {
      const rows = await supabaseRequest(
        `rsvps?event_id=eq.${eventId}&guest_name=ilike.${encodeURIComponent(prevName)}&select=guest_name,attending,side,companions,kids,message&limit=1`
      );
      if (rows && rows[0]) prevData = rows[0];
    } catch(e) {}
  }

  rsvpClearConfirmed(eventId);
  _rsvpRender('FORM');

  // Pre-fill all fields with previous answers
  setTimeout(() => {
    if (prevData) {
      const nameEl = document.getElementById('rsvp-name-new');
      if (nameEl) nameEl.value = prevData.guest_name || prevName;

      // Attending
      const attVal = prevData.attending === true ? 'yes' : prevData.attending === false ? 'no' : null;
      if (attVal) {
        const radio = document.querySelector(`input[name="rsvp-attending"][value="${attVal}"]`);
        if (radio) { radio.checked = true; _rsvpToggleAttending(attVal); }
      }

      // Side
      if (prevData.side) {
        const sideRadio = document.querySelector(`input[name="rsvp-side"][value="${prevData.side}"]`);
        if (sideRadio) {
          sideRadio.checked = true;
          document.getElementById('rsvp-side1-lbl')?.classList.toggle('active', prevData.side === 'side1');
          document.getElementById('rsvp-side2-lbl')?.classList.toggle('active', prevData.side === 'side2');
        }
      }

      // Companions
      const compList = document.getElementById('rsvp-comp-list');
      if (compList && prevData.companions) {
        const names = prevData.companions.split('|').filter(Boolean);
        names.forEach(name => {
          const div = document.createElement('div');
          div.style.cssText = 'display:flex;gap:0.4rem;margin-bottom:0.4rem;align-items:center';
          div.innerHTML = `<input class="input-field" placeholder="Nome (máx. 3 palavras)" oninput="limitToThreeWords(this,3)" style="flex:1;font-size:0.85rem" value="${escapeHTML(name)}">
            <button type="button" onclick="this.parentElement.remove()" style="background:#fee2e2;border:none;border-radius:0.5rem;padding:0.4rem 0.6rem;cursor:pointer;color:#ef4444;flex-shrink:0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>`;
          compList.appendChild(div);
        });
      }

      // Kids
      const kidsList = document.getElementById('rsvp-kids-list-new');
      if (kidsList && prevData.kids) {
        const names = prevData.kids.split('|').filter(Boolean);
        names.forEach(name => {
          const div = document.createElement('div');
          div.style.cssText = 'display:flex;gap:0.4rem;margin-bottom:0.4rem;align-items:center';
          div.innerHTML = `<input class="input-field" placeholder="Nome da criança" oninput="limitToThreeWords(this,3)" style="flex:1;font-size:0.85rem" value="${escapeHTML(name)}">
            <button type="button" onclick="this.parentElement.remove()" style="background:#fee2e2;border:none;border-radius:0.5rem;padding:0.4rem 0.6rem;cursor:pointer;color:#ef4444;flex-shrink:0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>`;
          kidsList.appendChild(div);
        });
      }

      // Message
      const msgEl = document.getElementById('rsvp-msg-new');
      if (msgEl && prevData.message) msgEl.value = prevData.message;
    } else if (prevName) {
      const nameEl = document.getElementById('rsvp-name-new');
      if (nameEl) nameEl.value = prevName;
    }
  }, 80);
}

// ── Felicitações overlay ──────────────────────────────────────────────
function rsvpOpenFelicitacoes() {
  const ev = Store.guestEventData;
  const evColor = ev?.event_color || '#007f9f';
  const messages = (ev?.confirmations || []).filter(c => c.message && String(c.message).trim());

  const overlay = document.createElement('div');
  overlay.id = 'felicitacoes-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:#f8fafc;z-index:99998;overflow-y:auto;font-family:Quicksand,sans-serif';

  const cards = messages.length ? messages.map((item, i) => `
    <div class="felicitation-card" style="animation-delay:${i*0.07}s;--ev-color:${evColor}">
      <span class="fc-quote" style="color:${evColor}">"</span>
      <p class="fc-message">${escapeHTML(item.message)}</p>
      <div class="fc-name" style="color:${evColor}">— ${escapeHTML(item.name)}</div>
      <span class="fc-attending ${item.attending ? 'fc-yes' : 'fc-no'}" style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.68rem;font-weight:700;padding:2px 8px;border-radius:999px;margin-top:0.35rem;background:${item.attending?'#dcfce7':'#fee2e2'};color:${item.attending?'#166534':'#991b1b'}">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">${item.attending ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}</svg>
        ${item.attending ? 'Confirmado' : 'Não confirmado'}
      </span>
      ${item.ownerReply ? `<div style="margin-top:0.6rem;padding-top:0.5rem;border-top:1px solid #f3f4f6"><p style="font-size:0.7rem;font-weight:700;color:#9ca3af;margin-bottom:0.15rem">Resposta do organizador</p><p style="font-size:0.8rem;color:#374151;font-style:italic">${escapeHTML(item.ownerReply)}</p></div>` : ''}
    </div>`) .join('') :
    `<div style="text-align:center;padding:3rem 1rem;color:#9ca3af">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:0.75rem;opacity:0.4"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      <p>Ainda não há mensagens.</p>
     </div>`;

  overlay.innerHTML = `
    <div style="position:sticky;top:0;background:rgba(255,255,255,0.96);backdrop-filter:blur(8px);border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;z-index:10">
      <div>
        <p style="font-size:0.65rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${evColor};margin:0">RECADOS</p>
        <h2 style="font-size:1.05rem;font-weight:800;color:#1e293b;margin:0">Correio do Amor</h2>
      </div>
      <button id="fel-overlay-close-btn" style="background:#f3f4f6;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="max-width:640px;margin:0 auto;padding:1.5rem 1rem">
      <p style="font-size:0.82rem;color:#6b7280;text-align:center;margin-bottom:1.5rem;font-style:italic">Deixe uma mensagem especial para este momento.<br>Prometemos ler com muito carinho!</p>
      <div class="felicitation-grid">${cards}</div>
      <div style="text-align:center;margin-top:1.5rem">
        <button onclick="rsvpLeaveFelicitacao()" style="background:${evColor};color:#fff;border:none;border-radius:999px;padding:0.75rem 2rem;font-weight:700;font-size:0.88rem;cursor:pointer;font-family:inherit">
          Deixar Felicitação
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  document.getElementById('fel-overlay-close-btn').onclick = () => overlay.remove();
}

// ── Leave a message ───────────────────────────────────────────────────
function rsvpLeaveFelicitacao() {
  const ev = Store.guestEventData;
  const evColor = ev?.event_color || '#007f9f';
  const eventId = Store.currentEventId;

  // Require prior RSVP (confirmed or declined)
  const confirmed = rsvpCheckConfirmed(eventId);
  if (!confirmed || !confirmed.name) {
    toast('Para deixar uma felicitação, confirma ou declina a tua presença primeiro.');
    return;
  }
  const confirmedName = confirmed.name;

  const modalId = '_fel-modal-' + Date.now();
  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:flex-end;justify-content:center;padding:0';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:1.25rem 1.25rem 0 0;width:100%;max-width:560px;padding:1.5rem 1.25rem 2rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
        <h3 style="font-size:1rem;font-weight:800;color:#1e293b;margin:0">Deixar Felicitação</h3>
        <button id="${modalId}-close" style="background:#f3f4f6;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      ${confirmedName
        ? `<div style="background:#f0f9fb;border-radius:0.65rem;padding:0.6rem 0.85rem;margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#007f9f" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            <span style="font-size:0.82rem;font-weight:700;color:#007f9f">${escapeHTML(confirmedName)}</span>
            <span style="font-size:0.75rem;color:#6b7280;margin-left:auto">Nome bloqueado</span>
          </div>`
        : `<input id="fel-name-input" class="input-field" placeholder="O teu nome" style="margin-bottom:0.75rem" oninput="limitToThreeWords(this,3)">`
      }
      <input type="hidden" id="fel-name-value" value="${escapeHTML(confirmedName)}">
      <textarea id="fel-msg-input" class="input-field" rows="4" placeholder="Escreve a tua mensagem com carinho..." style="resize:none;margin-bottom:1rem"></textarea>
      <button id="${modalId}-submit" style="background:${evColor};color:#fff;border:none;border-radius:999px;padding:0.85rem;font-weight:700;font-size:0.92rem;cursor:pointer;width:100%;font-family:inherit">
        Enviar Mensagem
      </button>
    </div>`;

  document.body.appendChild(modal);

  // Wire close button
  document.getElementById(`${modalId}-close`).onclick = () => modal.remove();
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  // Wire submit button
  document.getElementById(`${modalId}-submit`).onclick = async function() {
    const nameEl = document.getElementById('fel-name-input');
    const name = confirmedName || (nameEl?.value?.trim() || '');
    const msg  = document.getElementById('fel-msg-input')?.value?.trim();
    if (!name) { toast('Por favor insere o teu nome.'); return; }
    if (!msg)  { toast('Escreve uma mensagem antes de enviar.'); return; }

    this.disabled = true; this.textContent = 'A enviar...'; this.style.opacity = '0.6';

    try {
      const existing = await supabaseRequest(
        `rsvps?event_id=eq.${eventId}&guest_name=ilike.${encodeURIComponent(name)}&select=id,attending&limit=1`
      );
      if (existing && existing[0]) {
        await supabaseRequest(`rsvps?id=eq.${existing[0].id}`, 'PATCH', { message: msg, updated_at: new Date().toISOString() });
      } else {
        await supabaseRequest('rsvps', 'POST', {
          event_id: eventId, guest_name: name, attending: false,
          message: msg, wants_gift: false, updated_at: new Date().toISOString()
        });
      }
      toast('Mensagem enviada com carinho!');
      modal.remove();
      // Close felicitações overlay if open
      document.getElementById('felicitacoes-overlay')?.remove();
    } catch(e) {
      toast('Erro ao enviar. Tenta novamente.');
      this.disabled = false; this.textContent = 'Enviar Mensagem'; this.style.opacity = '1';
    }
  };

  setTimeout(() => document.getElementById('fel-msg-input')?.focus(), 100);
}

async function rsvpSubmitFelicitacao(btn) {
  const name = document.getElementById('fel-name-input')?.value?.trim();
  const msg  = document.getElementById('fel-msg-input')?.value?.trim();
  if (!name) { toast('Por favor insere o teu nome.'); return; }
  if (!msg)  { toast('Escreve uma mensagem antes de enviar.'); return; }

  btn.disabled = true; btn.textContent = 'A enviar...'; btn.style.opacity = '0.6';

  const eventId = Store.currentEventId;
  try {
    // Upsert RSVP with message
    const existing = await supabaseRequest(
      `rsvps?event_id=eq.${eventId}&guest_name=ilike.${encodeURIComponent(name)}&select=id,attending&limit=1`
    );
    if (existing && existing[0]) {
      await supabaseRequest(`rsvps?id=eq.${existing[0].id}`, 'PATCH', { message: msg, updated_at: new Date().toISOString() });
    } else {
      await supabaseRequest('rsvps', 'POST', {
        event_id: eventId, guest_name: name, attending: false,
        message: msg, wants_gift: false, updated_at: new Date().toISOString()
      });
    }
    toast('Mensagem enviada com carinho! 💌');
    btn.closest('[style*="position:fixed"]')?.remove();
  } catch(e) {
    toast('Erro ao enviar mensagem. Tenta novamente.');
    btn.disabled = false; btn.textContent = 'Enviar Mensagem'; btn.style.opacity = '1';
  }
}



// ── Confetti animation ────────────────────────────────────────────────
function _rsvpShowConfetti() {
  const colors = ['#007f9f','#22c55e','#fbbf24','#ec4899','#8b5cf6'];
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99990;overflow:hidden';
  document.body.appendChild(container);
  for (let i = 0; i < 80; i++) {
    const el = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = 6 + Math.random() * 8;
    const x = Math.random() * 100;
    const delay = Math.random() * 0.8;
    const dur = 1.5 + Math.random() * 1.5;
    el.style.cssText = `position:absolute;top:-10px;left:${x}%;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random()>0.5?'50%':'2px'};animation:confettiFall ${dur}s ${delay}s ease-in forwards`;
    container.appendChild(el);
  }
  const style = document.createElement('style');
  style.textContent = '@keyframes confettiFall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}';
  document.head.appendChild(style);
  setTimeout(() => { container.remove(); style.remove(); }, 4000);
}

// ── Decline animation ─────────────────────────────────────────────────
function _rsvpShowDecline() {
  // Show a brief "thank you anyway" toast — no sad emoji, just a warm message
  setTimeout(() => toast('Obrigado pela resposta! A tua presença em espírito conta muito.'), 500);
}
