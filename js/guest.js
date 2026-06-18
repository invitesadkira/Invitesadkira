// ===================== GUEST VIEW =====================
async function renderGuestView() {
  // controlo de lado será aplicado após carregar evento

  // ✅ MOSTRAR/ESCONDER botão de voltar baseado se veio do painel
  const backBtn = document.getElementById('guest-back-btn');
  if (backBtn) {
    if (Store.viewingAsGuestFromOrganizer) {
      backBtn.classList.remove('hidden');
  try { if (Store.currentEventId && Store.events) {
    const ev = Store.events.find(e => e.id === Store.currentEventId);
    if (ev) controlarLado(ev.allowSides);
  }} catch(e) { console.warn('Erro ao aplicar controlo de lado', e); }

    } else {
      backBtn.classList.add('hidden');
    }
  }
  
  // ✅ CRÍTICO: Tentar PRIMEIRO usar guestEventData (carregado da busca/URL)
  // DEPOIS tentar Store.events (se estiver logado)
  let eventData = Store.guestEventData;
  
  if (!eventData) {
    const ev = Store.events.find(e => e.id === Store.currentEventId);
    if (!ev) { 
      console.error('❌ Evento não encontrado');
      // Show helpful message instead of redirecting — guest may have arrived via link
      const appRoot = document.getElementById('app-root');
      if (appRoot) {
        appRoot.innerHTML = `<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center;background:#f8fafc">
          <div style="font-size:3rem;margin-bottom:1rem">💌</div>
          <h2 style="font-size:1.4rem;font-weight:800;color:#1e293b;margin-bottom:0.5rem">Este evento não foi encontrado</h2>
          <p style="color:#6b7280;margin-bottom:1.5rem;max-width:380px">O link pode ter expirado ou o evento foi removido. Verifique com quem te enviou o convite.</p>
          <a href="/" style="background:#007f9f;color:#fff;padding:0.75rem 2rem;border-radius:999px;font-weight:700;text-decoration:none">Ir para o início</a>
        </div>`;
      }
      Router.go('not-found'); 
      return; 
    }
    eventData = ev;
  }
  
  console.log('👤 renderGuestView - Dados do evento:', {
    id: eventData.id,
    title: eventData.title,
    confirm_by_date: eventData.confirm_by_date,
    deadline: eventData.deadline,
    allowCompanions: eventData.allowCompanions,
    maxCompanions: eventData.maxCompanions,
    allowKids: eventData.allowKids,
    maxKids: eventData.maxKids,
    allowSides: eventData.allowSides,
    showTime: eventData.showTime
  });

  // Verificar se RSVP está desativado
  if (!eventData.allowRSVP && eventData.allowRSVP !== undefined) {
    console.log('⚠️ RSVP desativado para este evento');
    Router.go('not-found');
    return;
  }

  // ── Cover image → hero background ──
  const coverImage = eventData.cover_image || eventData.cover || '';
  const heroEl = document.getElementById('guest-hero-bg');
  if (heroEl) {
    if (coverImage && coverImage.startsWith('http')) {
      heroEl.style.backgroundImage = `url('${coverImage}')`;
      // If image fails to load, fallback to gradient
      const _testImg = new Image();
      _testImg.onerror = () => { heroEl.style.backgroundImage = ''; heroEl.style.background = 'linear-gradient(135deg, var(--ev-color,#007f9f) 0%, #0d4f6a 100%)'; };
      _testImg.src = coverImage;
      heroEl.style.backgroundSize = 'cover';
      heroEl.style.backgroundPosition = 'center';
    } else {
      heroEl.style.background = 'linear-gradient(135deg, #007f9f 0%, #0d4f6a 100%)';
    }
  }

  // guest-title hidden — couple names not shown in CTA section

  // ── Check event expiry ──
  if (eventData.expires_at) {
    const expiry = new Date(eventData.expires_at);
    if (expiry < new Date()) {
      const root = document.getElementById('app-root');
      if (root) root.innerHTML = `<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center;background:#f8fafc;font-family:Quicksand,sans-serif">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:1rem"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <h2 style="font-size:1.3rem;font-weight:800;color:#1e293b;margin-bottom:0.5rem">Convite encerrado</h2>
        <p style="color:#6b7280;max-width:340px">Este convite já não está disponível. O evento terminou. Obrigado pela vossa presença!</p>
      </div>`;
      return;
    }
  }

  // ── Load visual settings from event_visuals table ──
  // Save ALL critical fields that must NEVER be overwritten by the visuals table
  const _keepFields = {
    // dates
    show_time: eventData.show_time, time: eventData.time, date: eventData.date,
    title: eventData.title, confirm_by_date: eventData.confirm_by_date,
    deadline: eventData.deadline,
    // RSVP permissions — come from events table, never from event_visuals
    allowCompanions: eventData.allowCompanions, allow_companions: eventData.allow_companions,
    maxCompanions: eventData.maxCompanions, max_companions: eventData.max_companions,
    allowKids: eventData.allowKids, allow_kids: eventData.allow_kids,
    maxKids: eventData.maxKids, max_kids: eventData.max_kids,
    allowGifts: eventData.allowGifts, allow_gifts: eventData.allow_gifts,
    allowSides: eventData.allowSides, allow_sides: eventData.allow_sides,
    side1_name: eventData.side1_name, side2_name: eventData.side2_name,
    allowMessages: eventData.allowMessages, allow_messages: eventData.allow_messages,
    showGuestMessages: eventData.showGuestMessages, show_guest_messages: eventData.show_guest_messages,
    // identity
    id: eventData.id, eventCode: eventData.eventCode, cover_image: eventData.cover_image,
    rsvp_enabled: eventData.rsvp_enabled,
    save_the_date_enabled: eventData.save_the_date_enabled,
    release_type: eventData.release_type, release_date: eventData.release_date,
    is_invite_released: eventData.is_invite_released,
    std_title: eventData.std_title, std_subtitle: eventData.std_subtitle,
    std_font_family: eventData.std_font_family,
    // Visual data that's ALREADY in events table — keep unless visuals has a better value
    event_color: eventData.event_color,
    bible_text: eventData.bible_text, bible_ref: eventData.bible_ref,
    groom_name: eventData.groom_name, bride_name: eventData.bride_name,
    groom_parents: eventData.groom_parents, bride_parents: eventData.bride_parents,
    gallery_urls: eventData.gallery_urls,
    invite_text: eventData.invite_text,
    music_url: eventData.music_url, music_title: eventData.music_title,
    iban_number: eventData.iban_number, iban_holder: eventData.iban_holder,
    schedule_items: eventData.schedule_items, story_text: eventData.story_text,
    section_order: eventData.section_order,
  };
  try {
    const visuals = await loadEventVisuals(eventData.id || Store.currentEventId);
    if (visuals && Object.keys(visuals).length > 0) {
      Object.keys(visuals).forEach(k => {
        if (k !== 'event_id' && k !== 'updated_at' && visuals[k] !== null && visuals[k] !== undefined) {
          eventData[k] = visuals[k];
        }
      });
    }
  } catch(e) {
    console.warn('event_visuals load failed:', e);
  }

  // ── CRITICAL FIX: load venue/location data from the dedicated event_venues table ──
  // This was previously never loaded for guests — venue_ceremony/venue_civil/venue_reception
  // etc. live ONLY in event_venues, never in the events table, so without this call
  // "Locais do Evento" could never appear no matter how it was configured.
  try {
    const venues = await loadEventVenues(eventData.id || Store.currentEventId);
    if (venues && Object.keys(venues).length > 0) {
      Object.keys(venues).forEach(k => {
        if (k !== 'event_id' && k !== 'updated_at' && venues[k] !== null && venues[k] !== undefined) {
          eventData[k] = venues[k];
        }
      });
    }
  } catch(e) {
    console.warn('event_venues load failed:', e);
  }

  // ── Fallback: if critical visual fields still null, reload from events table directly ──
  // NOTE: only fields that actually exist as columns on the `events` table belong here.
  // couplemsg_text, dresscode_*, parents_size live ONLY in event_visuals (no fallback needed
  // there since loadEventVisuals already tried). std_* and release_* live on `events` directly.
  const _criticalNulls = ['bible_text','gallery_urls','invite_text','groom_parents','bride_parents',
    'iban_number','story_text','event_color','groom_name','bride_name','music_url','schedule_items',
    'manual_items','show_manual','show_schedule','show_story',
    'save_the_date_enabled','release_type','release_date','is_invite_released','std_title','std_subtitle','std_font_family'];
  const _stillMissing = _criticalNulls.filter(k => !eventData[k]);
  if (_stillMissing.length > 0) {
    try {
      const _evId = eventData.id || Store.currentEventId;
      const _fresh = await supabaseRequest(
        `events?id=eq.${_evId}&select=${_criticalNulls.join(',')}&limit=1`
      );
      if (_fresh && _fresh[0]) {
        _criticalNulls.forEach(k => {
          if (!eventData[k] && _fresh[0][k]) eventData[k] = _fresh[0][k];
        });
      }
    } catch(e2) { console.warn('Visual fallback reload failed:', e2); }
  }
  // ── Also load date/time from dedicated table ──
  try {
    const dates = await loadEventDates(eventData.id || Store.currentEventId);
    if (dates.event_date) eventData.date      = dates.event_date;
    if (dates.event_time) eventData.time      = dates.event_time;
    if (dates.show_time)  eventData.show_time = dates.show_time;
    if (dates.confirm_by_date) eventData.confirm_by_date = dates.confirm_by_date;
  } catch(e) { console.warn('loadEventDates failed:', e); }

  const RSVP_ONLY_FIELDS = new Set(['show_time','time','date','title','confirm_by_date','deadline','allowCompanions','allow_companions','maxCompanions','max_companions','allowKids','allow_kids','maxKids','max_kids','allowGifts','allow_gifts','allowSides','allow_sides','side1_name','side2_name','allowMessages','allow_messages','showGuestMessages','show_guest_messages','id','eventCode','cover_image','rsvp_enabled','save_the_date_enabled','release_type','release_date','is_invite_released','std_title','std_subtitle','std_font_family']);

  // Restore all fields: RSVP fields always from events table; visual fields use
  // whichever source (visuals or events table) has a non-null value
  Object.keys(_keepFields).forEach(k => {
    if (RSVP_ONLY_FIELDS.has(k)) {
      // RSVP/identity — always restore from events table
      if (_keepFields[k] !== null && _keepFields[k] !== undefined) eventData[k] = _keepFields[k];
    } else {
      // Visual field — if current value is null, restore from events table
      if ((eventData[k] === null || eventData[k] === undefined) &&
          _keepFields[k] !== null && _keepFields[k] !== undefined) {
        eventData[k] = _keepFields[k];
      }
    }
  });

  // ── CRITICAL: Update Store.guestEventData with fully merged eventData ──
  Store.guestEventData = eventData;

  // (Save the Date gate check happens at the END of this function, after
  // the full invite — including RSVP drawer and music player — has been
  // set up. This way the gate is just a visual overlay and everything
  // underneath remains fully functional once unlocked.)

  // ── Apply event color — AFTER all merges ──
  // Check both sources: visuals table first, then events table, then default
  const _evCol = eventData.event_color || '#007f9f';
  document.documentElement.style.setProperty('--ev-color', _evCol);
  const _rsvpSec = document.getElementById('rsvp-section');
  if (_rsvpSec) {
    _rsvpSec.style.background = _evCol;
    // Hide entire RSVP CTA section if organiser disabled it for this event
    _rsvpSec.style.display = (eventData.rsvp_enabled === false) ? 'none' : '';
  }
  // Also apply to music player icon
  document.querySelectorAll('.music-icon').forEach(el => el.style.background = _evCol);

  // ── Apply custom font ──
  if (eventData.custom_font_family) {
    const fontName = eventData.custom_font_family;
    document.documentElement.style.setProperty('--event-font', `'${fontName}', serif`);
    const fontId = 'font-face-' + fontName.replace(/\s/g,'_');
    if (!document.getElementById(fontId)) {
      const fontDef = (Store.availableFonts || []).find(f => f.name === fontName);
      if (fontDef) {
        const style = document.createElement('style');
        style.id = fontId;
        style.textContent = `@font-face { font-family: '${fontName}'; src: url('${fontDef.url}'); font-display: swap; }`;
        document.head.appendChild(style);
      }
    }
  } else {
    document.documentElement.style.removeProperty('--event-font');
  }

  // ── Render couple names ──
  renderHeroCoupleNames(eventData);

  // ===== MUSIC PLAYER =====
  const musicPlayerEl = document.getElementById('guest-music-player');
  const guestAudio    = document.getElementById('guest-audio');
  if (musicPlayerEl) {
    const musicUrl = eventData.music_url;
    if (musicUrl && musicUrl.trim() !== '') {
      const titleEl = document.getElementById('music-player-title');
      if (titleEl) titleEl.textContent = eventData.music_title || 'Música do Evento';
      musicPlayerEl.classList.remove('hidden');
      const oldFrame = document.getElementById('yt-music-frame');
      if (oldFrame) { oldFrame.src = ''; oldFrame.dataset.playing = '0'; }
      if (guestAudio) { guestAudio.pause(); guestAudio.src = ''; }
      const ytId = extractYouTubeId(musicUrl);
      startMusicAutoplay(ytId || null, ytId ? null : musicUrl);
    } else {
      musicPlayerEl.classList.add('hidden');
      if (guestAudio) { guestAudio.pause(); guestAudio.src = ''; }
    }
  }

  // ===== SAVE THE DATE GATE =====
  // Decide whether to show the minimalist "Save the Date" screen instead of
  // the full invite, based on the event's release rules.
  const stdDecision = _evaluateSaveTheDate(eventData);
  if (stdDecision.showSaveTheDate) {
    renderSaveTheDateScreen(eventData, stdDecision);
    return; // Stop here — do not render the full invite sections
  } else {
    // Ensure the Save the Date overlay (if any) is removed so the full invite shows
    document.getElementById('std-screen-overlay')?.remove();
  }

  // ===== RENDER SECTIONS (awaited so venues load properly) =====
  await renderGuestSections(eventData);
  
  // ✅ CRÍTICO: Mostrar hora para convidados baseado em show_time
  // Verificar AMBAS as formas (show_time e showTime)
  const showTimeRaw = eventData.show_time !== undefined ? eventData.show_time : eventData.showTime;
  const showTime = String(showTimeRaw).toLowerCase() === 'yes' || showTimeRaw === true;
  
  console.log('👤 Guest view - Verificando show_time:', { raw: showTimeRaw, string: String(showTimeRaw), parsed: showTime });
  
  // ✅ NOVO: Mostrar hora APENAS se show_time está ativo (true ou 'yes')
  const timeDisplay = showTime 
    ? formatDate(eventData.date) + ' às ' + eventData.time
    : formatDate(eventData.date);
  
  console.log('👤 Guest view - Time display:', { showTime, timeDisplay });
  
  // guest-date removed:  timeDisplay;
  
  // ✅ CRÍTICO: Usar deadline/confirm_by_date correto
  let deadlineDate = eventData.confirm_by_date || eventData.deadline || eventData.date;
  
  // Remover qualquer espaço extra e validar
  if (deadlineDate) {
    deadlineDate = deadlineDate.trim();
  }
  
  // Fallback: se ainda estiver vazio, usar data do evento
  if (!deadlineDate || deadlineDate === '') {
    deadlineDate = eventData.date;
  }
  
  console.log('👤 GUEST VIEW - Deadline para convidado:');
  console.log('  confirm_by_date:', eventData.confirm_by_date);
  console.log('  deadline:', eventData.deadline);
  console.log('  date:', eventData.date);
  console.log('  Resultado final:', deadlineDate);
  
  // ✅ Extrair data da deadline para mostrar ao convidado
  const deadlineDateOnly = deadlineDate.split(' ')[0];
  
  document.getElementById('guest-deadline-text').textContent = 'Favor confirmar até ' + formatDate(deadlineDateOnly);
  // Start CTA section deadline countdown
  startDeadlineCountdown(deadlineDateOnly);

  const closeInfo = getRSVPCloseInfo(eventData);

  // ── All RSVP state and rendering handled by rsvp.js ──
  if (typeof _rsvpRender === 'function') {
    _rsvpRender('FORM');
  }

  renderGuestMessageWall(eventData);

  // ── SAVE THE DATE GATE (overlay) ──────────────────────────────────
  // The full invite above is already fully rendered and functional
  // (RSVP drawer, music, sections). If Save the Date is enabled and the
  // release condition isn't met yet, show the gate screen on top.
  try {
    console.log('🔖 Save the Date — diagnóstico:', {
      save_the_date_enabled: eventData.save_the_date_enabled,
      release_type: eventData.release_type,
      release_date: eventData.release_date,
      is_invite_released: eventData.is_invite_released,
      show_couplemsg: eventData.show_couplemsg,
      couplemsg_text: eventData.couplemsg_text ? '(presente)' : '(vazio)',
      show_dresscode: eventData.show_dresscode,
      dresscode_text: eventData.dresscode_text ? '(presente)' : '(vazio)',
      show_venues: eventData.show_venues,
      venue_ceremony: eventData.venue_ceremony ? '(presente)' : '(vazio)',
      venue_civil: eventData.venue_civil ? '(presente)' : '(vazio)',
      venue_reception: eventData.venue_reception ? '(presente)' : '(vazio)',
    });
    if (eventData.save_the_date_enabled === true || eventData.save_the_date_enabled === 'true') {
      const _shouldShowSTD = await _shouldShowSaveTheDate(eventData);
      if (_shouldShowSTD) {
        renderSaveTheDateScreen(eventData);
      } else {
        document.getElementById('save-the-date-screen')?.remove();
      }
    } else {
      document.getElementById('save-the-date-screen')?.remove();
    }
  } catch(stdErr) {
    console.error('Erro no Save the Date gate (a continuar com o convite normal):', stdErr);
    document.getElementById('save-the-date-screen')?.remove();
  }
}

async function replyToGuestMessage(confIndex) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev || !ev.confirmations || !ev.confirmations[confIndex]) return;

  const conf = ev.confirmations[confIndex];
  if (!conf.message) {
    toast('Este convidado nao deixou recado.');
    return;
  }

  const reply = prompt('Responder ao recado de ' + conf.name + ':', conf.ownerReply || '');
  if (reply === null) return;

  const cleanReply = reply.trim();
  const response = await supabaseRequest(
    `rsvps?event_id=eq.${ev.id}&guest_name=eq.${encodeURIComponent(conf.name)}`,
    'PATCH',
    { user_reply: cleanReply }
  );

  if (!response) {
    toast('Nao foi possivel guardar a resposta.');
    return;
  }

  conf.ownerReply = cleanReply;
  toast(cleanReply ? 'Resposta guardada!' : 'Resposta removida.');
  renderEventDetails();
}

function renderGuestMessageWall(eventData) {
  const wall = document.getElementById('guest-message-wall');
  const felSec = document.getElementById('felicitacoes-section');
  if (!wall) return;

  const showMessages = eventData.showGuestMessages === true ||
    eventData.show_guest_messages === true ||
    String(eventData.show_guest_messages).toLowerCase() === 'yes';

  const messages = (eventData.confirmations || [])
    .filter(c => c.message && String(c.message).trim())
    .map(c => ({
      name:      c.name,
      message:   String(c.message || '').trim(),
      attending: c.attending === true || c.attending === 'yes',
      ownerReply: String(c.ownerReply || '').trim()
    }))
    .filter(c => c.message);

  if (!showMessages || messages.length === 0) {
    wall.innerHTML = '';
    if (felSec) felSec.style.display = 'none';
    return;
  }

  if (felSec) felSec.style.display = '';
  wall.classList.remove('hidden');

  const evColor = (Store.guestEventData || eventData).event_color || '#007f9f';

  wall.innerHTML = `
    <div style="max-width:700px;margin:0 auto">
      <div style="text-align:center;margin-bottom:1.75rem">
        <p style="font-size:0.65rem;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:${evColor};margin-bottom:0.3rem">RECADOS</p>
        <h3 class="section-title" style="margin-bottom:0.35rem">Correio do Amor</h3>
        <p style="font-size:0.82rem;color:#6b7280;line-height:1.6;max-width:340px;margin:0 auto">Deixe uma mensagem especial para este momento.<br>Prometemos ler com muito carinho!</p>
      </div>
      <div class="felicitation-grid" id="felicitation-grid">
        ${messages.map((item, i) => `
          <div class="felicitation-card" style="animation-delay:${i * 0.08}s">
            <span class="fc-quote">"</span>
            <p class="fc-message">${escapeHTML(item.message)}</p>
            <div class="fc-name">${escapeHTML(item.name)}</div>
            <span class="felicitation-card fc-attending ${item.attending ? 'fc-yes' : 'fc-no'}" style="background:none;border:none;padding:0;box-shadow:none;border-top:none;margin-top:0.35rem;display:inline-flex">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color:${item.attending ? '#166534' : '#991b1b'}"><polyline points="${item.attending ? '20 6 9 17 4 12' : '18 6 6 18 M6 6 18 18'}"/></svg>
              ${item.attending ? 'Confirmado' : 'Não confirmado'}
            </span>
            ${item.ownerReply ? `
              <div style="margin-top:0.75rem;padding-top:0.6rem;border-top:1px solid #e5e7eb">
                <p style="font-size:0.7rem;font-weight:700;color:#9ca3af;margin-bottom:0.2rem">Resposta do organizador</p>
                <p style="font-size:0.82rem;color:#374151;font-style:italic">${escapeHTML(item.ownerReply)}</p>
              </div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>`;
}

function changeGuestMessageWallPage(direction) {
  const eventData = Store.guestEventData || Store.events.find(e => e.id === Store.currentEventId);
  if (!eventData) return;
  Store.guestMessageWallPage = Math.max(0, (Store.guestMessageWallPage || 0) + direction);
  renderGuestMessageWall(eventData);
}

function escapeHTML(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}




function startCountdown(deadline) {
  // deadline countdown (for RSVP section)
  if (deadline) {
    const clean = String(deadline).trim().split('T')[0].split(' ')[0];
    startDeadlineCountdown(clean);
  }
}

// ✅ NOVA FUNÇÃO: Voltar do guest view para o painel do organizador
function backFromGuestView() {
  // Limpar flag
  Store.viewingAsGuestFromOrganizer = false;
  Store.guestEventData = null;
  
  // Voltar para detalhes do evento
  Router.go('event-details');
}

// ✅ SHOW/HIDE botão de voltar (guest view)
function showGuestBackButton() {
  const backBtn = document.createElement('button');
  backBtn.id = 'guest-back-btn';
  backBtn.className = 'flex items-center gap-1 text-teal-500 font-semibold mb-4 hover:text-teal-600 transition';
  backBtn.innerHTML = '<i data-lucide="arrow-left" class="w-5 h-5"></i> Voltar';
  backBtn.onclick = backFromGuestView;
  backBtn.classList.add('hidden');
  
  const guestSection = document.getElementById('screen-guest');
  if (guestSection && !document.getElementById('guest-back-btn')) {
    guestSection.prepend(backBtn);
  }
}

let companionCount = 0;
let kidCount = 0;

function addCompanionField() {
  // ✅ CRÍTICO: Convidados usam guestEventData, organizadores usam Store.events
  const ev = Store.guestEventData || Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;
  const list = document.getElementById('rsvp-companions-list');
  if (list.children.length >= ev.maxCompanions) { toast('Máximo de ' + ev.maxCompanions + ' acompanhantes.'); return; }
  companionCount++;
  const div = document.createElement('div');
  div.className = 'flex gap-2 mb-2';
  div.innerHTML = `<input class="input-field text-sm" placeholder="Máx. 3 nomes" data-companion oninput="limitToThreeWords(this,3)" /><button type="button" class="text-red-400 hover:text-red-600 transition px-2" onclick="this.parentElement.remove()"><i data-lucide="x" class="w-4 h-4"></i></button>`;
  list.appendChild(div);
  lucide.createIcons();
}

function addKidField() {
  // ✅ CRÍTICO: Convidados usam guestEventData, organizadores usam Store.events
  const ev = Store.guestEventData || Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;
  const list = document.getElementById('rsvp-kids-list');
  if (list.children.length >= ev.maxKids) { toast('Máximo de ' + ev.maxKids + ' crianças.'); return; }
  kidCount++;
  const div = document.createElement('div');
  div.className = 'flex gap-2 mb-2';
  div.innerHTML = `<input class="input-field text-sm" placeholder="Máx. 3 nomes" data-kid oninput="limitToThreeWords(this,3)" /><button type="button" class="text-red-400 hover:text-red-600 transition px-2" onclick="this.parentElement.remove()"><i data-lucide="x" class="w-4 h-4"></i></button>`;
  list.appendChild(div);
  lucide.createIcons();
}

function handleRSVP(e) {
  e.preventDefault();
  
  // ✅ CRÍTICO: Usar guestEventData para convidados, Store.events para organizadores
  const ev = Store.guestEventData || Store.events.find(ev => ev.id === Store.currentEventId);
  if (!ev) {
    console.error('❌ Evento não encontrado em Store.guestEventData ou Store.events');
    toast('Erro: evento não encontrado. Recarregue a página.');
    return;
  }

  const closeInfo = getRSVPCloseInfo(ev);
  if (closeInfo.closed) {
    toast(getRSVPClosedMessage(ev));
    renderGuestView();
    return;
  }

  const attending = document.querySelector('input[name="rsvp-confirm"]:checked').value === 'yes';
  const name = document.getElementById('rsvp-name').value.trim();
  
  // ✅ Determinar lado (pode ser customizado)
  const allowSides = (ev.allowSides === true) || (ev.allow_sides === 'yes') || (String(ev.allow_sides).toLowerCase() === 'yes');
  let side = '';
  
  if (allowSides) {
    // Se permite escolher lado, ler valor do formulário
    const sideRadio = document.querySelector('input[name="rsvp-side"]:checked');
    if (sideRadio) {
      side = sideRadio.value;
    }
  } else {
    side = '';
  }
  
  const wantsGift = document.querySelector('input[name="rsvp-wants-gift"]:checked')?.value === 'yes';
  const companions = [...document.querySelectorAll('[data-companion]')].map(i => i.value.trim()).filter(Boolean);
  const kids = [...document.querySelectorAll('[data-kid]')].map(i => i.value.trim()).filter(Boolean);
  const messageText = document.getElementById('rsvp-message')?.value?.trim() || '';

  console.log('📝 Processando RSVP:', { name, attending, side, companions, kids });

  // ✅ CRÍTICO: Verificar se JÁ EXISTE resposta anterior para este convidado
  const existingConfIndex = ev.confirmations ? ev.confirmations.findIndex(c => c.name.toLowerCase() === name.toLowerCase()) : -1;
  
  // ✅ Verificar se este convidado já tem um presente reservado
  const hasReservedGift = ev.gifts && ev.gifts.some(g => g.reserved && normalizeGuestName(g.reservedBy) === normalizeGuestName(name));
  
  // Criar dados da resposta
  // Mostrar hora para convidados
  const showTime = document.getElementById('sw-show-time').classList.contains('active');
  
  const eventData = {
    event_id: Store.currentEventId,
    guest_name: name,
    attending: attending,
    side: side,
    companions: companions.join('|'),
    kids: kids.join('|'),
    wants_gift: wantsGift,
    message: messageText,
    updated_at: new Date().toISOString()
  };

  if (existingConfIndex !== -1 && ev.confirmations) {
    // ✅ JÁ EXISTE - fazer UPDATE
    console.log('🔄 Atualizando resposta anterior (índice:', existingConfIndex, ')');
    
    ev.confirmations[existingConfIndex] = {
      name: name,
      attending: attending,
      side: side,
      companions: companions,
      kids: kids,
      wantsGift: wantsGift,
      message: messageText,
      updatedAt: new Date().toISOString()
    };
    
    // ✅ Atualizar no Supabase
    saveRSVPToSupabase(eventData, true);
  } else {
    // ✅ NOVO - fazer INSERT
    console.log('✨ Adicionando nova resposta');
    
    if (!ev.confirmations) ev.confirmations = [];
    ev.confirmations.push({
      name: name,
      attending: attending,
      side: side,
      companions: companions,
      kids: kids,
      wantsGift: wantsGift,
      message: messageText,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // ✅ Criar no Supabase
    saveRSVPToSupabase(eventData, false);
  }

  // ✅ Atualizar sessão do convidado
  Store.currentGuestSession = { eventId: Store.currentEventId, guestName: name };
  // Save confirmation to in-memory Store (not localStorage)
  // The name is persisted in Supabase via the RSVP insert/update above
  if (!Store._rsvpConfirmedName) Store._rsvpConfirmedName = {};
  if (!Store._deviceGuestName) Store._deviceGuestName = {};
  Store._rsvpConfirmedName[Store.currentEventId] = name;
  Store._deviceGuestName[Store.currentEventId] = name;
  renderGuestMessageWall(ev);

  // Show success screen
  const _form = document.getElementById('rsvp-form');
  const _succ = document.getElementById('rsvp-success');
  const _promo = document.getElementById('rsvp-promo-banner');

  if (attending === true && wantsGift === true && ev.allowGifts === true && !hasReservedGift) {
    toast('Presença confirmada! Escolha um presente.');
    setTimeout(() => Router.go('gifts'), 600);
  } else {
    toast(hasReservedGift ? 'Presença atualizada!' : 'Presença confirmada!');
    _rsvpSetState('SUCCESS');
  }
}

// ✅ Salvar RSVP no Supabase
async function saveRSVPToSupabase(data, isUpdate) {
  try {
    if (isUpdate) {
      // Atualizar registro existente
      const response = await supabaseRequest(
        `rsvps?event_id=eq.${data.event_id}&guest_name=eq.${encodeURIComponent(data.guest_name)}`,
        'PATCH',
        data
      );
      if (response) {
        console.log('✅ RSVP atualizado no Supabase');
        // 📢 Enviar notificação em tempo real
        sendRealtimeNotification(data);
        // ✅ CRÍTICO: Aguardar um pouco e depois recarregar
        console.log('⏳ Aguardando 500ms antes de recarregar evento...');
        await new Promise(r => setTimeout(r, 500));
        await reloadEventFromSupabase(data.event_id);
      } else {
        console.error('❌ Erro ao atualizar confirmação');
      }
    } else {
      // Criar novo registro
      const response = await supabaseRequest('rsvps', 'POST', data);
      if (response && response.length > 0) {
        console.log('✅ RSVP criado no Supabase');
        // 📢 Enviar notificação em tempo real
        sendRealtimeNotification(data);
        // ✅ CRÍTICO: Aguardar um pouco e depois recarregar
        console.log('⏳ Aguardando 500ms antes de recarregar evento...');
        await new Promise(r => setTimeout(r, 500));
        await reloadEventFromSupabase(data.event_id);
      } else {
        console.error('❌ Erro ao salvar confirmação');
      }
    }
  } catch (error) {
    console.error('❌ Erro ao salvar RSVP:', error);
  }
}

// ✅ NOVA FUNÇÃO: Recarregar evento do Supabase
async function reloadEventFromSupabase(eventId) {
  try {
    console.log('🔄 Recarregando evento do Supabase:', eventId);
    
    // Buscar evento COM JOIN para presentes e RSVPs
    const eventData = await supabaseRequest(`events?id=eq.${eventId}&select=id,title,date,time,user_id,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,allow_messages,show_guest_messages,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,groom_name,bride_name,couple_size,show_couple,bg_url,bg_overlay,bible_text,bible_ref,show_bible,invite_text,show_invite,groom_parents,bride_parents,show_parents,gallery_urls,show_gallery,show_manual,manual_items,show_schedule,schedule_items,custom_font_family,section_order,story_text,invite_blessing,event_color,confirm_by_date,cover_image,event_code,gifts(id,name,category,reserved,reserved_by),rsvps(guest_name,attending,side,companions,kids,wants_gift,message,created_at,updated_at)`);
    
    if (eventData && eventData.length > 0) {
      const event = eventData[0];
      console.log('✅ Evento recarregado do Supabase com', (event.rsvps || []).length, 'RSVPs');
      
      // Normalizar dados
      const maxComp = event.max_companions !== null && event.max_companions !== undefined ? parseInt(event.max_companions) : 2;
      const maxKds = event.max_kids !== null && event.max_kids !== undefined ? parseInt(event.max_kids) : 2;
      let deadlineDate = event.confirm_by_date;
      if (deadlineDate) deadlineDate = deadlineDate.trim();
      if (!deadlineDate || deadlineDate === '') deadlineDate = event.date;
      
      const normalizedEvent = {
        id: event.id,
        user_id: event.user_id,
        userId: event.user_id,
        title: event.title,
        date: event.date,
        time: event.time,
        eventCode: event.event_code || event.id,
        deadline: deadlineDate,
        confirm_by_date: deadlineDate,
        maxCompanions: maxComp,
        max_companions: maxComp,
        maxKids: maxKds,
        max_kids: maxKds,
        allowCompanions: String(event.allow_companions).toLowerCase() === 'yes',
        allow_companions: event.allow_companions,
        allowGifts: String(event.allow_gifts).toLowerCase() === 'yes',
        allow_gifts: event.allow_gifts,
        allowKids: String(event.allow_kids).toLowerCase() === 'yes',
        allow_kids: event.allow_kids,
        allowSides: String(event.allow_sides).toLowerCase() === 'yes',
        allow_sides: event.allow_sides,
      side1_name: event.side1_name,
      side2_name: event.side2_name,
      show_time: event.show_time,
      showTime: String(event.show_time).toLowerCase() === 'yes' || event.show_time === true,
      allow_messages: event.allow_messages,
      allowMessages: String(event.allow_messages).toLowerCase() === 'yes' || event.allow_messages === true,
      show_guest_messages: event.show_guest_messages,
      showGuestMessages: String(event.show_guest_messages).toLowerCase() === 'yes' || event.show_guest_messages === true,
        music_url: event.music_url || null,
        music_title: event.music_title || null,
        iban_message: event.iban_message || null,
        iban_number: event.iban_number || null,
        iban_holder: event.iban_holder || null,
        iban_footer: event.iban_footer || null,
      groom_name: event.groom_name || null,
      bride_name: event.bride_name || null,
      couple_size: event.couple_size || 2.4,
      show_couple: event.show_couple || null,
      bg_url: event.bg_url || null,
      bg_overlay: event.bg_overlay !== undefined ? event.bg_overlay : 35,
      bible_text: event.bible_text || null,
      bible_ref: event.bible_ref || null,
      show_bible: event.show_bible || null,
      invite_text: event.invite_text || null,
      show_invite: event.show_invite || null,
      groom_parents: event.groom_parents || null,
      bride_parents: event.bride_parents || null,
      show_parents: event.show_parents || null,
      gallery_urls: event.gallery_urls || null,
      show_gallery: event.show_gallery || null,
      show_manual: event.show_manual || null,
      manual_items: event.manual_items || null,
      show_schedule: event.show_schedule || null,
      schedule_items: event.schedule_items || null,
      custom_font_family: event.custom_font_family || null,
      section_order: event.section_order || null,
      story_text: event.story_text || null,
      invite_blessing: event.invite_blessing || null,
      event_color: event.event_color || null,
        cover: event.cover_image,
        cover_image: event.cover_image,
        gifts: (event.gifts || []).map(g => ({
          id: g.id,
          name: g.name,
          category: g.category || 'Sem categoria',
          reserved: g.reserved || false,
          reservedBy: g.reserved_by || null
        })),
        confirmations: (event.rsvps || []).map(rsvp => ({
          name: rsvp.guest_name,
          attending: rsvp.attending === true || rsvp.attending === 'yes',
          side: rsvp.side ?? null,
          companions: rsvp.companions ? rsvp.companions.split('|').filter(Boolean) : [],
          kids: rsvp.kids ? rsvp.kids.split('|').filter(Boolean) : [],
          wantsGift: rsvp.wants_gift === true || rsvp.wants_gift === 'yes',
          message: rsvp.message || '',
          ownerReply: rsvp.owner_reply || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }))
      };
      
      // ✅ CRÍTICO: Atualizar o evento em Store.events COMPLETAMENTE (não apenas confirmations)
      const existingIndex = Store.events.findIndex(e => e.id === eventId);
      if (existingIndex !== -1) {
        // ✅ SUBSTITUIR COMPLETAMENTE o evento antigo pelo novo
        Store.events[existingIndex] = normalizedEvent;
        console.log('✅ Store.events[' + existingIndex + '] COMPLETAMENTE atualizado com', normalizedEvent.confirmations.length, 'confirmações');
      } else {
        // Se não existe, adicionar
        Store.events.push(normalizedEvent);
        console.log('✅ Evento NOVO adicionado ao Store com', normalizedEvent.confirmations.length, 'confirmações');
      }
      
      return normalizedEvent;
    }
  } catch (error) {
    console.error('❌ Erro ao recarregar evento:', error);
  }
}

// 📢 NOTIFICAÇÃO EM TEMPO REAL
function sendRealtimeNotification(rsvpData) {
  const event = Store.events.find(e => e.id === rsvpData.event_id);
  if (!event) return;
  
  const ownerUserId = event.userId || event.user_id;
  
  // Só notificar se o owner estiver online (logado)
  if (Store.currentUser && Store.currentUser.id === ownerUserId) {
    const attending = rsvpData.attending ? 'confirmou presença' : 'disse que não vai';
    const side = getSideLabel(rsvpData.side, event);
    const sideText = side ? side + ' - ' : '';
    
    // Criar notificação visual atraente
    const notif = document.createElement('div');
    notif.className = 'fixed bottom-24 right-4 z-50 animate-bounce';
    notif.style.animation = 'slideInRight 0.4s ease-out';
    notif.innerHTML = `
      <div class="bg-gradient-to-r from-green-400 to-green-500 text-white rounded-xl shadow-2xl p-4 max-w-xs">
        <div class="flex items-start gap-3">
          <div class="text-2xl"><i data-lucide="check-circle" style="width:32px;height:32px;color:#22c55e"></i></div>
          <div class="flex-1">
            <p class="font-bold text-sm">Nova Confirmação!</p>
            <p class="text-xs opacity-90">${rsvpData.guest_name}</p>
            <p class="text-xs opacity-90">${sideText}${attending}</p>
            <p class="text-xs opacity-75 mt-1"> ${event.title}</p>
          </div>
        </div>
      </div>
    `;
    
    // Adicionar estilo de animação
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInRight {
        from {
          transform: translateX(100%) translateY(0);
          opacity: 0;
        }
        to {
          transform: translateX(0) translateY(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notif);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
      notif.style.animation = 'slideInRight 0.4s ease-out reverse';
      setTimeout(() => notif.remove(), 400);
    }, 5000);
    
    // 🔔 Som de notificação (opcional)
    playNotificationSound();
  }
}

// 🔔 Som de notificação
function playNotificationSound() {
  // Usar API de Web Audio para criar som simples
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Melodia simples: duas notas
    oscillator.frequency.value = 800;
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
    
    // Segunda nota
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      osc2.frequency.value = 1000;
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.15);
    }, 100);
  } catch (e) {
    // Silenciosamente falhar se Web Audio não estiver disponível
  }
}

// ✅ Salvar presentes no Supabase
async function saveGiftsToSupabase(eventId, gifts) {
  try {
    // Primeiro, deletar presentes antigos do evento
    await supabaseRequest(`gifts?event_id=eq.${eventId}`, 'DELETE', {});
    
    // Depois, criar novos presentes
    for (const gift of gifts) {
      const giftData = {
        event_id: eventId,
        name: gift.name,
        category: gift.category || 'Sem categoria',
        reserved: gift.reserved || false,
        reserved_by: gift.reservedBy || null
      };
      
      const response = await supabaseRequest('gifts', 'POST', giftData);
      if (!response || response.length === 0) {
        console.error('❌ Erro ao salvar presente:', gift.name);
      }
    }
    console.log('✅ Presentes sincronizados com Supabase');
  } catch (error) {
    console.error('❌ Erro ao salvar presentes:', error);
  }
}

// ✅ Carregar presentes do Supabase
async function loadGiftsFromSupabase(eventId) {
  try {
    const giftsData = await supabaseRequest(`gifts?event_id=eq.${eventId}`);
    if (giftsData && giftsData.length > 0) {
      return giftsData.map(g => ({
        id: g.id,
        name: g.name,
        category: g.category || 'Sem categoria',
        reserved: g.reserved || false,
        reservedBy: g.reserved_by || null
      }));
    }
    return [];
  } catch (error) {
    console.error('❌ Erro ao carregar presentes:', error);
    return [];
  }
}

async function updateGiftReservationInSupabase(giftId, reserved, reservedBy) {
  const response = await supabaseRequest(`gifts?id=eq.${giftId}`, 'PATCH', {
    reserved,
    reserved_by: reservedBy || null
  });

  if (!response) {
    throw new Error('Não foi possível atualizar a reserva do presente no Supabase.');
  }
}


// ===================== GIFTS =====================
let giftEditingId = null;

function renderGifts() {
  // ✅ CRÍTICO: Usar guestEventData se estiver disponível (convidado), senão usar Store.events (organizador)
  const ev = Store.guestEventData || Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) { 
    console.error('❌ Evento não encontrado em guestEventData nem em Store.events');
    console.error('  currentEventId:', Store.currentEventId);
    console.error('  guestEventData:', Store.guestEventData);
    Router.go('not-found'); 
    return; 
  }

  const isOwner = Store.currentUser && Store.currentUser.id === ev.userId;
  
  if (isOwner) {
    renderGiftsManager(ev);
  } else {
    renderGiftsGuest(ev);
  }
}

// ✅ NOVA FUNÇÃO: Mostrar aviso quando convidado tenta escolher segundo presente
function showAlreadyReservedModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <div class="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mx-auto mb-4">
        <i data-lucide="alert-circle" class="w-6 h-6 text-amber-600"></i>
      </div>
      
      <h3 class="text-lg font-bold text-gray-800 text-center mb-2">Presente Já Escolhido</h3>
      
      <p class="text-sm text-gray-600 text-center mb-4">
        Você já escolheu um presente. Para escolher outro, contacte o dono do evento para remover a sua escolha anterior.
      </p>
      
      <div class="bg-blue-50 border-l-3 border-blue-500 p-3 rounded mb-4 text-xs text-blue-700">
        <p class="font-semibold mb-1">O que fazer:</p>
        <p>Edite sua resposta ou contacte directamente o organizador para alterar o presente escolhido.</p>
      </div>
      
      <button class="btn-main w-full" onclick="this.closest('.modal-overlay').remove()">
        Entendido
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  lucide.createIcons();
}

// ✅ NOVA FUNÇÃO: Voltar da tela de presentes para guest view
function backFromGifts() {
  console.log('👈 Voltando da tela de presentes');
  console.log('  guestEventData:', Store.guestEventData ? 'Sim' : 'Não');
  console.log('  currentEventId:', Store.currentEventId);
  
  // ✅ NOVO: Se veio de URL com ?gifts=only, voltar para home
  const params = new URLSearchParams(window.location.search);
  const giftsOnly = params.get('gifts') === 'only';
  
  if (giftsOnly) {
    console.log('🏠 URL com modo gifts-only detectado - voltando para home');
    Router.go('home');
  }
  // Se temos guestEventData, voltar para guest view (RSVP)
  else if (Store.guestEventData && Store.currentEventId) {
    Router.go('guest');
  } else {
    // Senão, voltar para dashboard (organizador)
    Router.go('event-details');
  }
}

function renderGiftsManager(ev) {
  // Agrupar presentes por categoria
  const categories = {};
  ev.gifts.forEach(g => {
    const cat = g.category || 'Sem categoria';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(g);
  });

  let html = `
    <div class="mb-6 bg-white rounded-xl shadow-sm p-4">
      <h3 class="text-base font-bold text-gray-800 mb-3">Adicionar Presentes</h3>
      <div class="space-y-2 mb-3">
        <input id="new-gift-category" class="input-field text-sm" placeholder="Categoria (ex: Cozinha)">
        <textarea id="new-gift-names" class="input-field text-sm h-20 p-2 resize-none" placeholder="Cole uma lista simples:&#10;Pano de loiça&#10;Jogo de copos&#10;Talheres" style="font-size: 0.875rem; line-height: 1.3;"></textarea>
      </div>
      <button class="btn-main text-sm w-full" onclick="addGiftsFromTextarea()">Adicionar</button>
    </div>
  `;

  // Mostrar presentes em layout de colunas
  const categoryArray = Object.keys(categories).sort();
  html += '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">';
  
  for (let colIndex = 0; colIndex < 2; colIndex++) {
    html += '<div class="space-y-4">';
    
    // Distribuir categorias entre as colunas
    for (let catIndex = colIndex; catIndex < categoryArray.length; catIndex += 2) {
      const cat = categoryArray[catIndex];
      const gifts = categories[cat];
      
      html += '<div class="bg-white rounded-lg shadow-sm border-l-3 border-teal-500 p-3"><div class="flex items-center justify-between mb-2"><h4 class="text-sm font-bold text-teal-600">' + cat + '</h4><button class="text-gray-300 hover:text-red-500 transition" onclick="deleteCategory(\'' + cat + '\', \'' + ev.id + '\')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div><div class="space-y-1">';
      
      gifts.forEach(g => {
        html += '<div class="flex items-center gap-2 group hover:bg-gray-50 px-1 rounded transition text-xs"><span class="text-teal-400 flex-shrink-0">◯</span><span class="text-gray-700 flex-1 truncate">' + g.name + '</span><div class="flex gap-1 opacity-0 group-hover:opacity-100 transition"><button class="text-gray-300 hover:text-teal-500 p-0.5" onclick="editGiftModal(\'' + g.id + '\')"><i data-lucide="edit" class="w-3 h-3"></i></button><button class="text-gray-300 hover:text-red-500 p-0.5" onclick="deleteGift(\'' + g.id + '\')"><i data-lucide="trash-2" class="w-3 h-3"></i></button></div></div>';
      });
      
      html += '</div></div>';
    }
    
    html += '</div>';
  }
  
  html += '</div>';

  document.getElementById('gifts-container').innerHTML = html;
  lucide.createIcons();
}

function renderGiftsGuest(ev) {
  let html = '';

  // ── IBAN card (se configurado) ──
  if (ev.iban_number) {
    html += `
      <div class="iban-card mb-5">
        <div class="flex items-center gap-2 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#007f9f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          <span class="text-sm font-bold text-teal-700">Transferência Bancária</span>
        </div>
        ${ev.iban_message ? `<p class="text-sm text-gray-600 mb-3 leading-relaxed whitespace-pre-line">${ev.iban_message}</p>` : ''}
        <div class="bg-white rounded-lg px-3 py-2 mb-2 border border-teal-200">
          <p class="text-xs text-gray-400 mb-0.5">IBAN</p>
          <p class="iban-value">${ev.iban_number}</p>
        </div>
        ${ev.iban_holder ? `<div class="bg-white rounded-lg px-3 py-2 mb-2 border border-teal-200"><p class="text-xs text-gray-400 mb-0.5">Titular</p><p class="text-sm font-semibold text-gray-700">${ev.iban_holder}</p></div>` : ''}
        ${ev.iban_footer ? `<p class="text-xs text-gray-500 mt-2 text-right italic">${ev.iban_footer}</p>` : ''}
      </div>`;
  }

  // ── Lista de presentes ──
  const categories = {};
  ev.gifts.forEach(g => {
    const cat = g.category || 'Sem categoria';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(g);
  });

  html += '<div class="space-y-4">';
  const categoryArray = Object.keys(categories).sort();
  categoryArray.forEach(cat => {
    const gifts = categories[cat];
    html += `
      <div class="bg-white rounded-xl shadow-sm border-l-4 border-teal-500 overflow-hidden">
        <div class="bg-teal-50 px-4 py-3 border-b border-teal-100">
          <h4 class="text-sm font-bold text-teal-700">${cat}</h4>
        </div>
        <div class="divide-y">
          ${gifts.map(g => `
            <div class="flex items-center gap-3 p-4 hover:bg-gray-50 transition active:bg-teal-50 cursor-pointer" onclick="toggleGiftSelection('${g.id}', this)">
              <div class="flex-shrink-0 w-8 h-8 rounded-full border-2 ${g.reserved ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'} flex items-center justify-center transition-all" data-gift-checkbox="${g.id}">
                ${g.reserved ? '<i data-lucide="check" class="w-5 h-5 text-white"></i>' : ''}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium ${g.reserved ? 'text-gray-500 line-through' : 'text-gray-800'} break-words">${g.name}</p>
              </div>
              ${g.reserved
                ? `<span class="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700 flex-shrink-0">Escolhido</span>`
                : `<span class="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600 flex-shrink-0">Disponível</span>`}
            </div>
          `).join('')}
        </div>
      </div>`;
  });
  html += '</div>';

  document.getElementById('gifts-container').innerHTML = html;
  lucide.createIcons();
}

async function toggleGiftSelection(giftId, element) {
  // ✅ CRÍTICO: Usar guestEventData se estiver disponível (convidado), senão usar Store.events (organizador)
  const ev = Store.guestEventData || Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) {
    console.error('❌ Evento não encontrado em guestEventData ou Store.events');
    toast('Erro: evento não encontrado. Recarregue a página.');
    return;
  }
  
  const gift = ev.gifts.find(g => g.id === giftId);
  if (!gift) {
    console.error('❌ Presente não encontrado:', giftId);
    return;
  }
  
  // ✅ Obter o NOME DO CONVIDADO correto (tentar TODAS as fontes)
  let guestName = null;
  
  // 1️⃣ Tentar sessão armazenada
  if (Store.currentGuestSession?.guestName) {
    guestName = Store.currentGuestSession.guestName;
    console.log('✅ Nome obtido da sessão:', guestName);
  }
  // 2️⃣ Tentar input do formulário (se estiver visível)
  else if (document.getElementById('rsvp-name')) {
    const nameInput = document.getElementById('rsvp-name').value?.trim();
    if (nameInput) {
      guestName = nameInput;
      console.log('✅ Nome obtido do input:', guestName);
    }
  }
  // 3️⃣ Fallback (não deveria chegar aqui)
  if (!guestName) {
    guestName = 'Convidado Anónimo';
    console.log('⚠️ Nome padrão usado:', guestName);
  }
  
  console.log('👤 Nome do convidado FINAL:', { guestName, session: Store.currentGuestSession });
  
  // ✅ Convidado só pode ESCOLHER presente, não desmarcar
  if (gift.reserved && normalizeGuestName(gift.reservedBy) !== normalizeGuestName(guestName)) {
    console.log('❌ Presente já reservado por outro convidado:', gift.reservedBy);
    toast('Este presente já foi escolhido por outro convidado.');
    return;
  }
  
  // ✅ CRÍTICO: Verificar se convidado JÁ ESCOLHEU outro presente (diferente deste)
  const otherReservedGifts = ev.gifts.filter(g => 
    g.id !== giftId &&                                      // Não é este presente
    g.reserved &&                                           // Está reservado
    normalizeGuestName(g.reservedBy) === normalizeGuestName(guestName)  // Por ESTE convidado
  );
  
  console.log('🎁 Verificação de presente anterior:', {
    guestName,
    giftIdAtual: giftId,
    giftsDoConvidado: ev.gifts.filter(g => normalizeGuestName(g.reservedBy) === normalizeGuestName(guestName)),
    outrosPresentes: otherReservedGifts,
    totalOutros: otherReservedGifts.length
  });
  
  if (otherReservedGifts.length > 0) {
    console.log('⚠️ ALERTA: Convidado já tem outro(s) presente(s) escolhido(s)!');
    console.log('  Presentes existentes:', otherReservedGifts.map(g => ({ name: g.name, reservedBy: g.reservedBy })));
    
    // ✅ Mostrar modal com aviso IMEDIATAMENTE
    showAlreadyReservedModal();
    return;
  }
  
  console.log('🎁 Escolhendo presente:', { giftId, giftName: gift.name, chosenBy: guestName });
  
  gift.reserved = true;
  gift.reservedBy = guestName;
  
  // ✅ Sincronizar com Supabase
  try {
    await updateGiftReservationInSupabase(giftId, true, guestName);
  } catch (error) {
    gift.reserved = false;
    gift.reservedBy = null;
    console.error('Erro ao reservar presente:', error);
    toast('Nao foi possivel reservar o presente. Tente novamente.');
    return;
  }
  
  // ✅ CRÍTICO: Recarregar evento do Supabase para garantir que dono vê a mudança
  console.log('🔄 Recarregando evento do Supabase para sincronizar com dono...');
  reloadEventFromSupabase(ev.id).then(() => {
    console.log('✅ Evento recarregado. Dono verá a mudança em tempo real.');
  });
  
  // Animar a seleção
  const checkbox = element.querySelector('[data-gift-checkbox]');
  if (checkbox) {
    checkbox.classList.remove('border-gray-300', 'bg-white');
    checkbox.classList.add('border-green-500', 'bg-green-500');
    checkbox.innerHTML = '<i data-lucide="check" class="w-5 h-5 text-white"></i>';
  }
  lucide.createIcons();
  
  // Mostrar mensagem de sucesso e ir para tela de confirmação
  setTimeout(() => {
    toast('Presente escolhido!');
    setTimeout(() => Router.go('gift-confirmed'), 600);
  }, 300);
}

function addGiftsFromTextarea() {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  const category = document.getElementById('new-gift-category').value.trim();
  const giftsText = document.getElementById('new-gift-names').value.trim();

  if (!category) { toast('Digite a categoria!'); return; }
  if (!giftsText) { toast('Cole ou digite os presentes!'); return; }

  // Parse presentes do textarea (um por linha)
  const lines = giftsText.split('\n').map(l => l.trim()).filter(l => l);
  
  let added = 0;
  lines.forEach(line => {
    // Remover símbolos decorativos (◯, •, -, *, etc)
    let name = line.replace(/^[\s◯•\-\*\.]+/, '').trim();
    
    if (name && name.length > 1) {
      // Verificar se já existe
      const exists = ev.gifts.some(g => 
        g.name.toLowerCase() === name.toLowerCase() && 
        g.category === category
      );
      
      if (!exists) {
        ev.gifts.push({
          id: uid(),
          name: name,
          category: category,
          reserved: false,
          reservedBy: null
        });
        added++;
      }
    }
  });

  if (added === 0) { toast('Nenhum presente adicionado (podem estar duplicados).'); return; }

  // ✅ Sincronizar com Supabase
  saveGiftsToSupabase(ev.id, ev.gifts);

  document.getElementById('new-gift-category').value = '';
  document.getElementById('new-gift-names').value = '';
  toast(`${added} presente(s) adicionado(s)!`);
  renderGifts();
}

function editGiftModal(giftId) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  const gift = ev.gifts.find(g => g.id === giftId);
  if (!gift) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-4">Editar Presente</h3>
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Nome</label>
          <input id="edit-gift-name" class="input-field" value="${gift.name}">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Categoria</label>
          <input id="edit-gift-category" class="input-field" value="${gift.category || 'Sem categoria'}">
        </div>
        ${gift.reserved ? `
        <div class="bg-amber-50 border-l-3 border-amber-500 p-3 rounded text-xs text-amber-700">
          <p class="font-semibold mb-1">Presente Reservado</p>
          <p class="mb-2">Escolhido por: <strong>${gift.reservedBy}</strong></p>
          <button type="button" class="text-amber-600 hover:text-amber-700 font-semibold underline" onclick="removeGiftReservationFromModal('${giftId}', this.closest('.modal-overlay'))">
            Remover Reserva
          </button>
        </div>
        ` : ''}
      </div>
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="saveGiftEdit('${giftId}', this.closest('.modal-overlay'))">Salvar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ✅ NOVA FUNÇÃO: Remover reserva de presente do modal
function removeGiftReservationFromModal(giftId, modal) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  const gift = ev.gifts.find(g => g.id === giftId);
  if (!gift || !gift.reserved) return;

  const confirmModal = document.createElement('div');
  confirmModal.className = 'modal-overlay';
  confirmModal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Remover Reserva?</h3>
      <p class="text-sm text-gray-600 mb-2">Presente: <strong>${gift.name}</strong></p>
      <p class="text-sm text-gray-600 mb-4">Pessoa: <strong>${gift.reservedBy}</strong></p>
      
      <p class="text-xs text-amber-600 font-semibold mb-4">O convidado "${gift.reservedBy}" poderá escolher outro presente.</p>
      
      <div class="flex gap-2">
        <button class="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 px-4 font-semibold transition" onclick="confirmRemoveGiftReservation('${giftId}', this.closest('.modal-overlay'), document.querySelector('[class*=\"modal-overlay\"]'))">
          Remover Reserva
        </button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmModal);
}

// ✅ NOVA FUNÇÃO: Confirmar remoção de reserva
async function confirmRemoveGiftReservation(giftId, confirmModal, editModal) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  const gift = ev.gifts.find(g => g.id === giftId);
  if (!gift) return;

  console.log('🎁 Removendo reserva do presente:', { giftId, giftName: gift.name, reservedBy: gift.reservedBy });

  const previousReservedBy = gift.reservedBy;
  gift.reserved = false;
  gift.reservedBy = null;

  try {
    await updateGiftReservationInSupabase(giftId, false, null);
    confirmModal.remove();
    if (editModal) editModal.remove();
    
    toast(`Reserva de "${gift.name}" foi removida. "${previousReservedBy}" pode escolher outro presente.`);
    renderEventDetails();
  } catch (error) {
    gift.reserved = true;
    gift.reservedBy = previousReservedBy;
    console.error('Erro ao remover reserva:', error);
    toast('Nao foi possivel remover a reserva. Tente novamente.');
  }
}

// ✅ NOVA FUNÇÃO: Remover reserva de presente (pelo botão na lista de confirmações)
function removeGiftReservation(giftId) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  const gift = ev.gifts.find(g => g.id === giftId);
  if (!gift || !gift.reserved) return;

  const confirmModal = document.createElement('div');
  confirmModal.className = 'modal-overlay';
  confirmModal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Remover Reserva?</h3>
      <p class="text-sm text-gray-600 mb-2">Presente: <strong>${gift.name}</strong></p>
      <p class="text-sm text-gray-600 mb-4">Pessoa: <strong>${gift.reservedBy}</strong></p>
      
      <p class="text-xs text-amber-600 font-semibold mb-4">O convidado "${gift.reservedBy}" poderá escolher outro presente.</p>
      
      <div class="flex gap-2">
        <button class="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 px-4 font-semibold transition" onclick="confirmRemoveGiftReservation('${giftId}', this.closest('.modal-overlay'), null)">
          Remover Reserva
        </button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmModal);
}

function saveGiftEdit(giftId, modal) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  const gift = ev.gifts.find(g => g.id === giftId);
  if (!gift) return;

  const newName = document.getElementById('edit-gift-name').value.trim();
  const newCategory = document.getElementById('edit-gift-category').value.trim();

  if (!newName) { toast('Digite o nome do presente!'); return; }

  gift.name = newName;
  gift.category = newCategory || 'Sem categoria';

  // ✅ Sincronizar com Supabase
  saveGiftsToSupabase(ev.id, ev.gifts);

  modal.remove();
  toast('Presente atualizado!');
  renderGifts();
}

function deleteCategory(category, eventId) {
  const ev = Store.events.find(e => e.id === eventId || e.id === Store.currentEventId);
  if (!ev) return;

  // Contar presentes nesta categoria
  const giftsInCategory = ev.gifts.filter(g => (g.category || 'Sem categoria') === category);
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Eliminar Categoria?</h3>
      <p class="text-gray-500 text-sm mb-4">Isto irá remover <strong>${giftsInCategory.length} presente(s)</strong> desta categoria. Esta ação não pode ser desfeita.</p>
      <div class="flex gap-2">
        <button class="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 px-4 font-semibold transition" onclick="confirmDeleteCategory('${category}', this.closest('.modal-overlay'))">Eliminar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function confirmDeleteCategory(category, modal) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  // Remover todos os presentes desta categoria
  ev.gifts = ev.gifts.filter(g => (g.category || 'Sem categoria') !== category);
  
  modal.remove();
  toast('Categoria eliminada!');
  renderGifts();
}

function deleteGift(giftId) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  const gift = ev.gifts.find(g => g.id === giftId);
  if (!gift) return;

  // Criar confirmação inline
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Eliminar Presente?</h3>
      <p class="text-gray-500 text-sm mb-4">"${gift.name}" - Esta ação não pode ser desfeita.</p>
      <div class="flex gap-2">
        <button class="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 px-4 font-semibold transition" onclick="confirmDeleteGift('${giftId}', this.closest('.modal-overlay'))">Eliminar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function confirmDeleteGift(giftId, modal) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  const giftIndex = ev.gifts.findIndex(g => g.id === giftId);
  if (giftIndex !== -1) {
    ev.gifts.splice(giftIndex, 1);
  }
  
  // ✅ Sincronizar com Supabase
  saveGiftsToSupabase(ev.id, ev.gifts);
  
  modal.remove();
  toast('Presente eliminado!');
  renderGifts();
}

async function reserveGift(giftId) {
  // Esta função foi substituída por toggleGiftSelection
  // Mantida apenas para compatibilidade se ainda for referenciada em algum lugar
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;
  const gift = ev.gifts.find(g => g.id === giftId);
  if (gift) { 
    const guestName = Store.currentGuestSession?.guestName || document.getElementById('rsvp-name')?.value || 'Convidado';
    gift.reserved = true; 
    gift.reservedBy = guestName; 
    console.log('🎁 Presente reservado:', { giftName: gift.name, reservedBy: guestName });
    await updateGiftReservationInSupabase(giftId, true, guestName);
  }
  Router.go('gift-confirmed');
}

function editGuestResponse() {
  const eventId = Store.currentEventId;

  // Clear in-memory confirmation (not localStorage)
  if (Store._rsvpConfirmedName) delete Store._rsvpConfirmedName[eventId];
  if (Store._deviceGuestName)   delete Store._deviceGuestName[eventId];

  // Reset form fields
  const formEl = document.getElementById('rsvp-form');
  if (formEl) { formEl.reset(); }
  const cl = document.getElementById('rsvp-companions-list');
  const kl = document.getElementById('rsvp-kids-list');
  if (cl) cl.innerHTML = '';
  if (kl) kl.innerHTML = '';

  // Pre-fill name if known
  const storedName = Store.currentGuestSession?.guestName;
  if (storedName) {
    const nameInput = document.getElementById('rsvp-name');
    if (nameInput) nameInput.value = storedName;
  }

  // ── Restore all form sections using same logic as initGuestRsvp ──
  const ev = Store.guestEventData;
  if (ev) {
    // sides
    const shouldShowSides = (ev.allowSides === true) ||
                            (ev.allow_sides === 'yes') ||
                            (String(ev.allow_sides || '').toLowerCase() === 'yes');
    const sideSection = document.getElementById('rsvp-side-section');
    if (sideSection) sideSection.classList.toggle('hidden', !shouldShowSides);
    if (shouldShowSides && ev.allowSides) {
      const sideNames = getEventSideNames(ev);
      const s1 = document.getElementById('rsvp-side1-label');
      const s2 = document.getElementById('rsvp-side2-label');
      if (s1) s1.textContent = sideNames.side1;
      if (s2) s2.textContent = sideNames.side2;
    }

    // companions
    const compSection = document.getElementById('rsvp-companions-section');
    if (compSection) compSection.classList.toggle('hidden', !ev.allowCompanions);

    // kids
    const kidsSection = document.getElementById('rsvp-kids-section');
    if (kidsSection) kidsSection.classList.toggle('hidden', !ev.allowKids);

    // gifts
    const giftsSection = document.getElementById('rsvp-gifts-section');
    if (giftsSection) giftsSection.classList.toggle('hidden', !ev.allowGifts);

    // messages
    const allowMsg = (ev.allowMessages === true) || (ev.allow_messages === 'yes') || (String(ev.allow_messages || '').toLowerCase() === 'yes');
    const msgSection = document.getElementById('rsvp-message-section');
    if (msgSection) msgSection.classList.toggle('hidden', !allowMsg);
  }

  // Switch to FORM state (shows header + form, hides success)
  _rsvpSetState('FORM');

  // Ensure drawer is open
  const drawer = document.getElementById('rsvp-drawer');
  if (drawer && !drawer.classList.contains('open')) {
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  lucide.createIcons();
}


// ===================== CONFIRMATION MANAGEMENT =====================
function editConfirmationModal(confIndex) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev || confIndex < 0 || confIndex >= ev.confirmations.length) return;

  const conf = ev.confirmations[confIndex];
  const sideNames = getEventSideNames(ev);
  const selectedSide = getSideBucket(conf.side, ev);
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full mx-4 max-h-96 overflow-y-auto">
      <h3 class="text-lg font-bold text-gray-800 mb-4">Editar Confirmação</h3>
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Nome</label>
          <input id="edit-conf-name" class="input-field" value="${conf.name}">
        </div>
        
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-2">Confirmação</label>
          <div class="flex gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="edit-conf-attending" value="yes" ${conf.attending ? 'checked' : ''} class="accent-teal-500">
              <span class="text-sm">Vai</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="edit-conf-attending" value="no" ${!conf.attending ? 'checked' : ''} class="accent-teal-500">
              <span class="text-sm">Não vai</span>
            </label>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-2">Grupo</label>
          <div class="flex gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="edit-conf-side" value="side1" ${selectedSide === 'side1' ? 'checked' : ''} class="accent-teal-500">
              <span class="text-sm">${escapeHTML(sideNames.side1)}</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="edit-conf-side" value="side2" ${selectedSide === 'side2' ? 'checked' : ''} class="accent-teal-500">
              <span class="text-sm">${escapeHTML(sideNames.side2)}</span>
            </label>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Acompanhantes</label>
          <div id="edit-companions-list" class="space-y-2 mb-2">
            ${conf.companions.map((comp, idx) => `
              <div class="flex gap-2">
                <input class="input-field text-sm" value="${comp}" data-edit-companion="${idx}">
                <button type="button" class="text-red-400 hover:text-red-600 transition px-2" onclick="this.parentElement.remove()">
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="text-teal-500 text-sm font-semibold hover:text-teal-600 transition" onclick="addEditCompanionField()">
            + Adicionar acompanhante
          </button>
        </div>
        
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Crianças</label>
          <div id="edit-kids-list" class="space-y-2 mb-2">
            ${conf.kids.map((kid, idx) => `
              <div class="flex gap-2">
                <input class="input-field text-sm" value="${kid}" data-edit-kid="${idx}">
                <button type="button" class="text-red-400 hover:text-red-600 transition px-2" onclick="this.parentElement.remove()">
                  <i data-lucide="x" class="w-4 h-4"></i>
                </button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="text-teal-500 text-sm font-semibold hover:text-teal-600 transition" onclick="addEditKidField()">
            + Adicionar criança
          </button>
        </div>
      </div>
      
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="saveConfirmationEdit(${confIndex}, this.closest('.modal-overlay'))">Guardar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  lucide.createIcons();
}

function addEditCompanionField() {
  const list = document.getElementById('edit-companions-list');
  const div = document.createElement('div');
  div.className = 'flex gap-2';
  div.innerHTML = `
    <input class="input-field text-sm" placeholder="Nome do acompanhante" data-edit-companion="new">
    <button type="button" class="text-red-400 hover:text-red-600 transition px-2" onclick="this.parentElement.remove()">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;
  list.appendChild(div);
  lucide.createIcons();
}

function addEditKidField() {
  const list = document.getElementById('edit-kids-list');
  const div = document.createElement('div');
  div.className = 'flex gap-2';
  div.innerHTML = `
    <input class="input-field text-sm" placeholder="Nome da criança" data-edit-kid="new">
    <button type="button" class="text-red-400 hover:text-red-600 transition px-2" onclick="this.parentElement.remove()">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;
  list.appendChild(div);
  lucide.createIcons();
}

function saveConfirmationEdit(confIndex, modal) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev || confIndex < 0 || confIndex >= ev.confirmations.length) return;

  const conf = ev.confirmations[confIndex];
  
  conf.name = document.getElementById('edit-conf-name').value.trim() || conf.name;
  conf.attending = document.querySelector('input[name="edit-conf-attending"]:checked').value === 'yes';
  conf.side = document.querySelector('input[name="edit-conf-side"]:checked').value;
  
  // Recolher acompanhantes atualizados - APENAS os que têm valor
  const companionInputs = document.querySelectorAll('#edit-companions-list [data-edit-companion], #edit-companions-list input[placeholder*="acompanhante"]');
  conf.companions = [];
  companionInputs.forEach(input => {
    const val = input.value.trim();
    if (val) conf.companions.push(val);
  });
  
  // Recolher crianças atualizadas - APENAS os que têm valor
  const kidInputs = document.querySelectorAll('#edit-kids-list [data-edit-kid], #edit-kids-list input[placeholder*="criança"]');
  conf.kids = [];
  kidInputs.forEach(input => {
    const val = input.value.trim();
    if (val) conf.kids.push(val);
  });
  
  modal.remove();
  toast('Confirmação atualizada!');
  renderEventDetails();
}

function deleteConfirmation(confIndex) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev || confIndex < 0 || confIndex >= ev.confirmations.length) return;

  const conf = ev.confirmations[confIndex];
  
  // Confirmação inline
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Eliminar Confirmação?</h3>
      <p class="text-gray-500 text-sm mb-4">Remover <strong>${conf.name}</strong>?</p>
      <div class="flex gap-2">
        <button class="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 px-4 font-semibold transition" onclick="confirmDeleteConfirmation(${confIndex}, this.closest('.modal-overlay'))">Eliminar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function confirmDeleteConfirmation(confIndex, modal) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev || confIndex < 0 || confIndex >= ev.confirmations.length) return;
  
  const conf = ev.confirmations[confIndex];
  const guestName = conf.name;
  
  console.log('🗑️ Iniciando exclusão de RSVP:', {
    eventId: Store.currentEventId,
    guestName: guestName,
    confIndex: confIndex
  });
  
  // ✅ CRÍTICO: Deletar do Supabase PRIMEIRO, DEPOIS remover do Store
  // Usar URL encoding correto para o nome do convidado
  const encodedGuestName = encodeURIComponent(guestName).replace(/%20/g, ' ');
  const deleteUrl = `rsvps?event_id=eq.${Store.currentEventId}&guest_name=eq.${encodedGuestName}`;
  
  console.log('📤 URL de exclusão:', deleteUrl);
  
  supabaseRequest(deleteUrl, 'DELETE', {}).then(result => {
    console.log('✅ RSVP deletado do Supabase:', { guestName, result });
    
    // DEPOIS: remover do Store local
    if (ev.confirmations && confIndex >= 0 && confIndex < ev.confirmations.length) {
      ev.confirmations.splice(confIndex, 1);
      console.log('✅ RSVP removido do Store local. Restam:', ev.confirmations.length);
    }
    
    modal.remove();
    toast('Convidado eliminado!');
    renderEventDetails();
  }).catch(error => {
    console.error('❌ Erro ao deletar RSVP:', error);
    modal.remove();
    toast(' Erro ao eliminar convidado. Tente novamente.');
  });
}


// ===================== BACKGROUND UPLOAD =====================
async function handleBgUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { toast('Imagem de fundo muito grande. Máx. 8 MB.'); return; }
  const area = document.getElementById('bg-upload-area');
  if (area) area.innerHTML = '<span class="text-xs text-teal-600 font-semibold">A carregar...</span>';
  try {
    const url = await uploadImageToStorage(file, 'event-covers');
    document.getElementById('evt-bg-url').value = url;
    if (area) area.innerHTML = `<span class="text-xs text-teal-600 font-semibold">Imagem carregada</span>`;
    toast('Imagem de fundo carregada!');
  } catch(e) {
    toast('Erro ao carregar imagem de fundo.');
    if (area) area.innerHTML = '<i data-lucide="image" class="w-5 h-5 mb-1 text-gray-400"></i> Carregar imagem de fundo';
    lucide.createIcons();
  }
}

async function uploadImageToStorage(file, bucket) {
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': file.type || 'image/jpeg', 'x-upsert': 'true' },
    body: file
  });
  if (!res.ok) throw new Error(await res.text());
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;
}


// ===================== GALLERY UPLOAD =====================
function addGalleryImage() {
  document.getElementById('gallery-file-input').click();
}
async function handleGalleryUpload(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const urlInput = document.getElementById('evt-gallery-urls');
  const existing = urlInput.value.trim();
  toast('A carregar ' + files.length + ' imagem(ns)...');
  const urls = [];
  for (const file of files) {
    try {
      const url = await uploadImageToStorage(file, 'event-covers');
      urls.push(url);
    } catch(e) { toast('Erro a carregar: ' + file.name); }
  }
  urlInput.value = (existing ? existing + '\n' : '') + urls.join('\n');
  toast(urls.length + ' imagem(ns) carregada(s)!');
  input.value = '';
}

// ===================== FONT UPLOAD (ADMIN ONLY) =====================
function showFontUploadModal() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-md w-full">
      <h3 class="text-lg font-bold text-gray-800 mb-3">Carregar Fonte de Letra</h3>
      <p class="text-xs text-gray-500 mb-3">A fonte ficará disponível para todos os utilizadores. Formatos: TTF, OTF, WOFF, WOFF2.</p>
      <input id="font-name-input" class="input-field mb-2" placeholder="Nome da fonte (ex: Great Vibes)">
      <div id="font-upload-area" class="w-full rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center py-4 cursor-pointer hover:border-teal-400 transition text-sm text-gray-500 mb-3" onclick="document.getElementById('font-file-input').click()">
        <i data-lucide="type" class="w-6 h-6 mb-1 text-gray-400"></i> Clique para seleccionar ficheiro
      </div>
      <input id="font-file-input" type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" class="hidden" onchange="uploadFontFile(this)">
      <div id="font-upload-progress" class="hidden text-xs text-teal-600 font-semibold mb-2"></div>
      <div class="flex gap-2 mt-2">
        <button class="flex-1 btn-main" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  lucide.createIcons();
}

// Quick inline font upload from the Save the Date settings (derives name from filename)
async function handleStdFontUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Fonte muito grande. Máx. 5 MB.'); return; }
  const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  toast('A carregar fonte...');
  try {
    const ext = file.name.split('.').pop();
    const fileName = `font_${name.replace(/\s+/g,'_')}_${Date.now()}.${ext}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/event-covers/${fileName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/octet-stream',
        'x-upsert': 'true'
      },
      body: file
    });
    if (!res.ok) throw new Error(await res.text());
    const url = `${SUPABASE_URL}/storage/v1/object/public/event-covers/${fileName}`;
    await supabaseRequest('fonts', 'POST', { name, url, created_by: Store.currentUser?.id || null });
    toast(`Fonte "${name}" carregada!`);
    await loadAvailableFonts();
    const stdSel = document.getElementById('evt-std-font-select');
    if (stdSel) stdSel.value = name;
  } catch(e) {
    toast('Erro ao carregar fonte.');
  }
}

async function uploadFontFile(input) {
  const file = input.files[0];
  const name = document.getElementById('font-name-input').value.trim();
  const progress = document.getElementById('font-upload-progress');
  if (!file) return;
  if (!name) { toast('Dê um nome à fonte antes de carregar.'); return; }
  if (file.size > 5 * 1024 * 1024) { toast('Fonte muito grande. Máx. 5 MB.'); return; }
  if (progress) { progress.textContent = 'A carregar...'; progress.classList.remove('hidden'); }
  try {
    const ext = file.name.split('.').pop();
    const fileName = `font_${name.replace(/\s+/g,'_')}_${Date.now()}.${ext}`;
    // Fonts must be uploaded as application/octet-stream (generic binary)
    // because storage buckets restrict MIME types
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/event-covers/${fileName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/octet-stream',
        'x-upsert': 'true'
      },
      body: file
    });
    if (!res.ok) throw new Error(await res.text());
    const url = `${SUPABASE_URL}/storage/v1/object/public/event-covers/${fileName}`;
    // Register in supabase for all users
    await supabaseRequest('fonts', 'POST', { name, url, created_by: Store.currentUser.id });
    if (progress) progress.textContent = `Fonte "${name}" carregada com sucesso!`;
    toast(`Fonte "${name}" disponível para todos!`);
    loadAvailableFonts();
  } catch(e) {
    console.error('Font upload error:', e);
    const msg = String(e.message || '').includes('fonts') 
      ? 'Tabela "fonts" não existe. Corre o SQL de migração no Supabase primeiro.'
      : 'Erro ao carregar fonte: ' + (e.message || '');
    if (progress) { progress.textContent = msg; progress.classList.remove('hidden'); }
    toast('Erro ao carregar fonte. Verifica o console.');
  }
}

async function loadAvailableFonts() {
  try {
    const fonts = await supabaseRequest('fonts?select=name,url&order=name.asc');
    Store.availableFonts = fonts || [];
    // Inject @font-face for each
    (fonts || []).forEach(f => {
      if (!document.getElementById('font-face-' + f.name.replace(/\s/g,'_'))) {
        const style = document.createElement('style');
        style.id = 'font-face-' + f.name.replace(/\s/g,'_');
        style.textContent = `@font-face { font-family: '${f.name}'; src: url('${f.url}'); }`;
        document.head.appendChild(style);
      }
    });
    updateFontSelector();
    renderFontsList();
  } catch(e) { Store.availableFonts = []; }
}

function updateFontSelector() {
  const fonts = Store.availableFonts || [];
  const opts = `<option value="">Fonte padrão</option>` + fonts.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
  const sel = document.getElementById('evt-font-select');
  if (sel) sel.innerHTML = opts;
  const stdSel = document.getElementById('evt-std-font-select');
  if (stdSel) stdSel.innerHTML = opts;
}

// ── Share guest event ──
function shareGuestEvent() {
  const ev = Store.guestEventData;
  const title = ev ? ev.title : 'Convite Digital';
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title, text: `Estás convidado(a)! ${title}`, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => toast('Link copiado!')).catch(() => {
      prompt('Copia este link:', url);
    });
  }
}


// ===================== SAVE THE DATE =====================
// Decide if the minimalist "Save the Date" screen should show instead of
// the full invite, based on save_the_date_enabled + release_type rules.
function _evaluateSaveTheDate(ev) {
  // Feature off entirely → always show full invite (current behaviour)
  if (!ev.save_the_date_enabled || ev.save_the_date_enabled === false || ev.save_the_date_enabled === 'no') {
    return { showSaveTheDate: false };
  }

  const releaseType = ev.release_type || 'manual';

  // Condition C: Manual — admin/organiser controls is_invite_released directly
  if (releaseType === 'manual') {
    if (ev.is_invite_released === true || ev.is_invite_released === 'yes') {
      return { showSaveTheDate: false };
    }
    return { showSaveTheDate: true, reason: 'manual' };
  }

  // Condition B: By date — invite opens for everyone once release_date has passed
  if (releaseType === 'by_date') {
    if (ev.release_date) {
      const releaseAt = new Date(ev.release_date);
      if (!isNaN(releaseAt.getTime()) && new Date() >= releaseAt) {
        return { showSaveTheDate: false };
      }
    }
    return { showSaveTheDate: true, reason: 'by_date', releaseDate: ev.release_date };
  }

  // Condition A: On confirmation — invite opens only for the specific guest
  // once THEY confirm attendance positively (checked via sessionStorage RSVP state)
  if (releaseType === 'on_confirmation') {
    const eventId = ev.id || Store.currentEventId;
    const confirmed = rsvpCheckConfirmed(eventId);
    if (confirmed && confirmed.attending === true) {
      return { showSaveTheDate: false };
    }
    return { showSaveTheDate: true, reason: 'on_confirmation' };
  }

  // Unknown release_type — default to safe behaviour (show full invite)
  return { showSaveTheDate: false };
}

function renderSaveTheDateScreen(ev, decision) {
  const appRoot = document.getElementById('app-root') || document.body;
  const evColor = ev.event_color || '#007f9f';
  const invertNames = _yesOrTrue(ev.invert_names);
  let groom = ev.groom_name || ''; let bride = ev.bride_name || '';
  if (invertNames && groom && bride) { [groom, bride] = [bride, groom]; }
  const coupleNames = (groom || bride) ? `${escapeHTML(groom)}${groom && bride ? ' &amp; ' : ''}${escapeHTML(bride)}` : '';

  const stdTitle = ev.std_title || 'Save the Date';
  const stdSubtitle = ev.std_subtitle || 'Nosso Casamento';

  let dateLabel = '';
  if (ev.date) {
    const d = new Date(String(ev.date).split('T')[0] + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
      dateLabel = `${String(d.getDate()).padStart(2,'0')} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
    }
  }

  // Remove any previous instance before re-rendering
  document.getElementById('std-screen-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'std-screen-overlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:9000;overflow-y:auto;background:${ev.bg_url ? `url('${ev.bg_url}') center/cover no-repeat` : `linear-gradient(160deg, ${evColor}, #0d2a35)`};display:flex;align-items:center;justify-content:center;padding:1.5rem`;

  overlay.innerHTML = `
    <div style="position:absolute;inset:0;background:rgba(0,0,0,0.45)"></div>
    <div style="position:relative;z-index:1;max-width:420px;width:100%;text-align:center;color:#fff">
      <p style="font-size:0.78rem;letter-spacing:0.25em;text-transform:uppercase;opacity:0.85;margin-bottom:0.5rem">${escapeHTML(stdTitle)}</p>
      <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:1.5rem;opacity:0.95">${escapeHTML(stdSubtitle)}</h1>
      ${coupleNames ? `<h2 style="font-family:var(--event-font, 'Playfair Display', serif);font-size:2.4rem;margin-bottom:1rem;line-height:1.3">${coupleNames}</h2>` : ''}
      ${dateLabel ? `<p style="font-size:1.05rem;font-weight:600;margin-bottom:2rem;opacity:0.92">${dateLabel}</p>` : ''}

      <div id="std-countdown-grid" style="display:flex;gap:0.75rem;justify-content:center;margin-bottom:2rem">
        <div style="background:rgba(255,255,255,0.12);border-radius:0.75rem;padding:0.75rem 0.5rem;min-width:60px"><div id="std-days" style="font-size:1.5rem;font-weight:800">--</div><div style="font-size:0.65rem;opacity:0.75;text-transform:uppercase">Dias</div></div>
        <div style="background:rgba(255,255,255,0.12);border-radius:0.75rem;padding:0.75rem 0.5rem;min-width:60px"><div id="std-hours" style="font-size:1.5rem;font-weight:800">--</div><div style="font-size:0.65rem;opacity:0.75;text-transform:uppercase">Horas</div></div>
        <div style="background:rgba(255,255,255,0.12);border-radius:0.75rem;padding:0.75rem 0.5rem;min-width:60px"><div id="std-mins" style="font-size:1.5rem;font-weight:800">--</div><div style="font-size:0.65rem;opacity:0.75;text-transform:uppercase">Min</div></div>
        <div style="background:rgba(255,255,255,0.12);border-radius:0.75rem;padding:0.75rem 0.5rem;min-width:60px"><div id="std-secs" style="font-size:1.5rem;font-weight:800">--</div><div style="font-size:0.65rem;opacity:0.75;text-transform:uppercase">Seg</div></div>
      </div>
      <p style="font-size:0.7rem;opacity:0.65;margin-top:-1.5rem;margin-bottom:1.5rem">Contagem até à data limite de confirmação</p>

      <button id="std-rsvp-btn" style="background:#fff;color:${evColor};border:none;border-radius:999px;padding:0.9rem 2.5rem;font-weight:800;font-size:0.95rem;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.25)">
        Confirmar Presença
      </button>
    </div>`;
  appRoot.appendChild(overlay);

  // Wire RSVP button — opens the same drawer/flow as the full invite would
  document.getElementById('std-rsvp-btn').onclick = () => {
    if (typeof openRsvpDrawer === 'function') openRsvpDrawer();
  };

  // Countdown to confirm_by_date (RSVP deadline), falling back to event date
  const targetStr = ev.confirm_by_date || ev.date;
  if (targetStr) {
    const target = new Date(String(targetStr).includes('T') ? targetStr : targetStr + 'T23:59:59');
    if (!isNaN(target.getTime())) {
      if (window._stdCountdownInterval) clearInterval(window._stdCountdownInterval);
      const tick = () => {
        const diff = target - new Date();
        if (diff <= 0) { clearInterval(window._stdCountdownInterval); return; }
        const d = Math.floor(diff/86400000), h = Math.floor((diff%86400000)/3600000),
              m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
        const set = (id,v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('std-days', d); set('std-hours', h); set('std-mins', m); set('std-secs', s);
      };
      tick();
      window._stdCountdownInterval = setInterval(tick, 1000);
    }
  }

  // Background music still plays per the normal music player logic (already
  // initialised in renderGuestView before this screen is shown).

  // If gated "on_confirmation": once the guest confirms via the drawer, re-check
  // and remove this screen automatically without a full page reload.
  if (decision.reason === 'on_confirmation') {
    window._stdRecheckInterval = setInterval(() => {
      const confirmed = rsvpCheckConfirmed(ev.id || Store.currentEventId);
      if (confirmed && confirmed.attending === true) {
        clearInterval(window._stdRecheckInterval);
        overlay.remove();
        renderGuestView(); // Re-render to show the full invite now
      }
    }, 1500);
  }
}


// ===================== SAVE THE DATE =====================
// Decides whether the gate screen should show, based on release_type.
async function _shouldShowSaveTheDate(eventData) {
  const releaseType = eventData.release_type || 'manual';

  if (releaseType === 'manual') {
    // Show gate until admin manually flips is_invite_released
    return !(eventData.is_invite_released === true || eventData.is_invite_released === 'true');
  }

  if (releaseType === 'by_date') {
    // Show gate until release_date has passed
    if (!eventData.release_date) return true;
    const releaseAt = new Date(eventData.release_date);
    return new Date() < releaseAt;
  }

  if (releaseType === 'on_confirmation') {
    // Show gate until THIS guest has confirmed presence positively
    const eventId = eventData.id || Store.currentEventId;
    const confirmed = rsvpCheckConfirmed(eventId);
    if (confirmed && confirmed.attending === true) return false; // unlock for this guest
    return true; // still gated for this guest
  }

  return false; // unknown type — don't gate
}

function renderSaveTheDateScreen(eventData) {
  const evColor = eventData.event_color || '#007f9f';
  const invertNames = _yesOrTrue(eventData.invert_names);
  let groom = eventData.groom_name || '';
  let bride = eventData.bride_name || '';
  if (invertNames && groom && bride) { [groom, bride] = [bride, groom]; }
  const coupleNames = (groom || bride) ? `${groom}${groom && bride ? ' &amp; ' : ''}${bride}` : (eventData.title || '');

  const stdTitle    = eventData.std_title || 'Save the Date';
  const stdSubtitle = eventData.std_subtitle || 'Nosso Casamento';
  const stdFont     = eventData.std_font_family || eventData.custom_font_family || null;

  let eventDateStr = '';
  if (eventData.date) {
    const d = new Date(eventData.date + 'T00:00:00');
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    eventDateStr = `${String(d.getDate()).padStart(2,'0')} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
  }

  // Apply custom font if specified
  let fontFaceCSS = '';
  if (stdFont) {
    const fontDef = (Store.availableFonts || []).find(f => f.name === stdFont);
    if (fontDef) {
      fontFaceCSS = `@font-face { font-family: '${stdFont}'; src: url('${fontDef.url}'); font-display: swap; }`;
    }
  }

  // IMPORTANT: render as an OVERLAY on top of the existing guest page DOM
  // (which already has #rsvp-drawer, #guest-audio, etc.) instead of replacing
  // app-root entirely. This means the RSVP drawer and music player keep working.
  let screen = document.getElementById('save-the-date-screen');
  if (!screen) {
    screen = document.createElement('div');
    screen.id = 'save-the-date-screen';
    document.body.appendChild(screen);
  }
  screen.style.cssText = `position:fixed;inset:0;z-index:9000;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem 1.25rem;background:${eventData.bg_url ? `url('${eventData.bg_url}') center/cover no-repeat` : `linear-gradient(160deg, ${evColor}15, #fff 60%)`}`;

  screen.innerHTML = `
    <style>${fontFaceCSS}</style>
    ${eventData.bg_url ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.35)"></div>` : ''}
    <div style="position:relative;z-index:2;max-width:420px;width:100%">
      <p style="font-size:0.78rem;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;color:${eventData.bg_url ? '#fff' : evColor};opacity:0.85;margin-bottom:0.5rem">${escapeHTML(stdTitle)}</p>
      <h1 style="font-size:1.1rem;font-weight:600;color:${eventData.bg_url ? '#fff' : '#374151'};margin-bottom:1.5rem;${stdFont ? `font-family:'${stdFont}',serif` : ''}">${escapeHTML(stdSubtitle)}</h1>
      <h2 style="font-size:2.4rem;font-weight:800;color:${eventData.bg_url ? '#fff' : evColor};margin-bottom:0.5rem;line-height:1.2;text-shadow:${eventData.bg_url ? '0 2px 12px rgba(0,0,0,0.4)' : 'none'};white-space:nowrap;display:flex;align-items:center;justify-content:center;gap:0.3em">${coupleNames}</h2>
      <p style="font-size:1rem;font-weight:600;color:${eventData.bg_url ? '#fff' : '#6b7280'};margin-bottom:2rem">${eventDateStr}</p>

      <div id="std-countdown" style="display:flex;gap:0.75rem;justify-content:center;margin-bottom:0.5rem">
        <div style="background:${eventData.bg_url ? 'rgba(255,255,255,0.15)' : '#fff'};border-radius:0.75rem;padding:0.65rem 0.5rem;min-width:54px;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
          <div id="std-days" style="font-size:1.5rem;font-weight:800;color:${eventData.bg_url ? '#fff' : evColor}">--</div>
          <div style="font-size:0.6rem;color:${eventData.bg_url ? '#fff' : '#9ca3af'};opacity:0.8">Dias</div>
        </div>
        <div style="background:${eventData.bg_url ? 'rgba(255,255,255,0.15)' : '#fff'};border-radius:0.75rem;padding:0.65rem 0.5rem;min-width:54px;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
          <div id="std-hours" style="font-size:1.5rem;font-weight:800;color:${eventData.bg_url ? '#fff' : evColor}">--</div>
          <div style="font-size:0.6rem;color:${eventData.bg_url ? '#fff' : '#9ca3af'};opacity:0.8">Horas</div>
        </div>
        <div style="background:${eventData.bg_url ? 'rgba(255,255,255,0.15)' : '#fff'};border-radius:0.75rem;padding:0.65rem 0.5rem;min-width:54px;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
          <div id="std-mins" style="font-size:1.5rem;font-weight:800;color:${eventData.bg_url ? '#fff' : evColor}">--</div>
          <div style="font-size:0.6rem;color:${eventData.bg_url ? '#fff' : '#9ca3af'};opacity:0.8">Min</div>
        </div>
        <div style="background:${eventData.bg_url ? 'rgba(255,255,255,0.15)' : '#fff'};border-radius:0.75rem;padding:0.65rem 0.5rem;min-width:54px;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
          <div id="std-secs" style="font-size:1.5rem;font-weight:800;color:${eventData.bg_url ? '#fff' : evColor}">--</div>
          <div style="font-size:0.6rem;color:${eventData.bg_url ? '#fff' : '#9ca3af'};opacity:0.8">Seg</div>
        </div>
      </div>
      <p style="font-size:0.72rem;color:${eventData.bg_url ? '#fff' : '#9ca3af'};opacity:0.75;margin-bottom:2rem">até à data limite de confirmação</p>

      <button id="std-rsvp-btn" style="background:${evColor};color:#fff;border:none;border-radius:999px;padding:0.95rem 2.5rem;font-weight:700;font-size:0.95rem;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px ${evColor}55">
        Confirmar Presença
      </button>
    </div>
  `;

  // Countdown to confirm_by_date (the RSVP deadline) — falls back to event date
  const targetDate = eventData.confirm_by_date || eventData.date;
  if (targetDate) {
    const clean = String(targetDate).trim().replace(' ', 'T');
    const parts = clean.split('T');
    const datePart = parts[0];
    const timePart = parts[1] ? parts[1].split(':').slice(0,2).join(':') : '23:59';
    const target = new Date(datePart + 'T' + timePart + ':00');
    function _updateSTDCountdown() {
      const diff = target - new Date();
      if (diff <= 0) {
        ['std-days','std-hours','std-mins','std-secs'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '0'; });
        return;
      }
      const d = Math.floor(diff/86400000);
      const h = Math.floor((diff%86400000)/3600000);
      const m = Math.floor((diff%3600000)/60000);
      const s = Math.floor((diff%60000)/1000);
      const dEl = document.getElementById('std-days'); if (dEl) dEl.textContent = d;
      const hEl = document.getElementById('std-hours'); if (hEl) hEl.textContent = h;
      const mEl = document.getElementById('std-mins'); if (mEl) mEl.textContent = m;
      const sEl = document.getElementById('std-secs'); if (sEl) sEl.textContent = s;
    }
    _updateSTDCountdown();
    if (window._stdCountdownInterval) clearInterval(window._stdCountdownInterval);
    window._stdCountdownInterval = setInterval(_updateSTDCountdown, 1000);
  }

  // Wire RSVP button — opens the same drawer used in the full invite.
  // The drawer markup is already in the underlying guest page DOM (rendered
  // earlier by index.html), so this works without needing to rebuild anything.
  document.getElementById('std-rsvp-btn').onclick = () => {
    if (typeof openRsvpDrawer === 'function') openRsvpDrawer();
  };

  // After a successful RSVP confirmation (attending=yes) on an 'on_confirmation'
  // release type, automatically remove this gate and show the full invite.
  window._stdCheckUnlockAfterRsvp = () => {
    const releaseType = eventData.release_type || 'manual';
    if (releaseType !== 'on_confirmation') return;
    const confirmed = rsvpCheckConfirmed(eventData.id || Store.currentEventId);
    if (confirmed && confirmed.attending === true) {
      screen.remove();
      if (window._stdCountdownInterval) clearInterval(window._stdCountdownInterval);
    }
  };
}
