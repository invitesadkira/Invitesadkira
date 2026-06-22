// ===================== GUEST VIEW =====================
async function renderGuestView() {
  // controlo de lado será aplicado após carregar evento

  // Show a minimal loading veil immediately — the parent #screen-guest has
  // 'std-pending' (added by Router.go) which hides everything else via CSS.
  // This is what prevents any flash of the full invite or RSVP form before
  // we know whether Save the Date should gate this visit.
  const _screenGuestEl = document.getElementById('screen-guest');
  if (_screenGuestEl && !document.getElementById('std-loading-veil')) {
    const veil = document.createElement('div');
    veil.id = 'std-loading-veil';
    veil.innerHTML = '<div class="std-spinner"></div>';
    _screenGuestEl.appendChild(veil);
  }
  // Safety net: never leave the page stuck on the loading veil forever,
  // even if something throws unexpectedly further down before we reach
  // a normal reveal point.
  setTimeout(() => {
    document.getElementById('screen-guest')?.classList.remove('std-pending');
    document.getElementById('std-loading-veil')?.remove();
  }, 8000);

  // ── Personalized guest link lock screen ─────────────────────────────
  // If this URL is a personalized link (set by checkURLForEvent via
  // Store._lockedGuestName/_guestLinkCode) AND this browser's own RSVP
  // confirmation for this event doesn't match that name, someone other
  // than the intended guest opened this link — show a lock screen and
  // stop here entirely. Never reveal the invite under the wrong name.
  if (Store._lockedGuestName && Store._guestLinkCode) {
    let localClaim = null;
    try { localClaim = JSON.parse(localStorage.getItem('adkira_guest_link_claim_' + Store._guestLinkCode) || 'null'); } catch(e) {}
    const claimMatches = localClaim && localClaim.guestName === Store._lockedGuestName;
    if (!claimMatches) {
      const screenGuestEl = document.getElementById('screen-guest');
      if (screenGuestEl) {
        screenGuestEl.classList.remove('std-pending');
        document.getElementById('std-loading-veil')?.remove();
        screenGuestEl.innerHTML = `<div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center;background:#0d2a35;color:#fff;font-family:Quicksand,sans-serif">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" style="margin-bottom:1.25rem;opacity:0.85"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:0.6rem">Este convite pertence a ${escapeHTML(Store._lockedGuestName)}</h2>
          <p style="opacity:0.75;font-size:0.88rem;max-width:320px">Este link de convite é pessoal e está associado a outro convidado. Se acreditas que isto é um erro, contacta quem te enviou o link.</p>
        </div>`;
      }
      return;
    }
  }


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
      document.getElementById('screen-guest')?.classList.remove('std-pending');
      document.getElementById('std-loading-veil')?.remove();
      return; 
    }
    eventData = ev;
  }

  // ── Sincronizar o estado local de confirmação com a base de dados real ──
  // Se o organizador eliminou a confirmação deste convidado no painel admin,
  // o localStorage deste browser ainda diria "confirmado" — isso bloquearia
  // o Save the Date para sempre, mesmo sem confirmação real na BD. Aqui
  // comparamos contra a lista real de confirmações (já incluída na resposta
  // da query principal, sem custo extra de rede) e limpamos o localStorage
  // se a confirmação já não existir, permitindo ao convidado ver o Save the
  // Date novamente e confirmar presença de novo.
  if (eventData.id && typeof rsvpCheckConfirmed === 'function') {
    const localConfirmation = rsvpCheckConfirmed(eventData.id);
    if (localConfirmation && localConfirmation.attending === true && localConfirmation.name) {
      const stillExistsInDb = (eventData.confirmations || []).some(
        c => c.name && c.name.toLowerCase() === localConfirmation.name.toLowerCase() && c.attending === true
      );
      if (!stillExistsInDb) {
        dlog('🔄 Confirmação local não encontrada na base de dados (foi eliminada pelo organizador) — a repor o Save the Date.');
        rsvpClearConfirmed(eventData.id);
      }
    }
  }

  // ── Analytics: log this guest visit once per event id load ──
  // (deliberately fire-and-forget, never blocks rendering)
  if (eventData.id && Store._lastTrackedGuestEventId !== eventData.id) {
    Store._lastTrackedGuestEventId = eventData.id;
    supabaseRequest('visit_log', 'POST', { visit_type: 'guest_view', event_id: eventData.id }).catch(() => {});
  }
  
  dlog('👤 renderGuestView - Dados do evento:', {
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
    dlog('⚠️ RSVP desativado para este evento');
    Router.go('not-found');
    document.getElementById('screen-guest')?.classList.remove('std-pending');
    document.getElementById('std-loading-veil')?.remove();
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
      document.getElementById('screen-guest')?.classList.remove('std-pending');
      document.getElementById('std-loading-veil')?.remove();
      return;
    }
  }

  // ── Load date/time from dedicated table BEFORE snapshotting _keepFields ──
  // (must run first: _keepFields below captures these values to protect them
  // from being overwritten by the visuals merge later, so it needs the
  // freshest data, not whatever checkURLForEvent's initial fetch had)
  try {
    const dates = await loadEventDates(eventData.id || Store.currentEventId);
    if (dates.event_date) eventData.date      = dates.event_date;
    if (dates.event_time) eventData.time      = dates.event_time;
    if (dates.show_time)  eventData.show_time = dates.show_time;
    if (dates.confirm_by_date) eventData.confirm_by_date = dates.confirm_by_date;
  } catch(e) { console.warn('loadEventDates failed:', e); }

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
    allow_edit_rsvp: eventData.allow_edit_rsvp,
    save_the_date_enabled: eventData.save_the_date_enabled,
    release_type: eventData.release_type, release_date: eventData.release_date,
    is_invite_released: eventData.is_invite_released,
    std_title: eventData.std_title, std_subtitle: eventData.std_subtitle,
    std_font_family: eventData.std_font_family,
    std_name_size: eventData.std_name_size, std_title_size: eventData.std_title_size,
    std_intro_enabled: eventData.std_intro_enabled, std_intro_text: eventData.std_intro_text,
    std_intro_photo_url: eventData.std_intro_photo_url,
    std_intro_photo_mobile_url: eventData.std_intro_photo_mobile_url,
    std_intro_photo_desktop_url: eventData.std_intro_photo_desktop_url,
    std_intro_on_invite: eventData.std_intro_on_invite,
    std_cover_mobile_url: eventData.std_cover_mobile_url,
    std_cover_desktop_url: eventData.std_cover_desktop_url,
    personalized_links_enabled: eventData.personalized_links_enabled,
    std_cover_url: eventData.std_cover_url,
    std_scratch_enabled: eventData.std_scratch_enabled, std_scratch_mode: eventData.std_scratch_mode,
    std_scratch_photo_url: eventData.std_scratch_photo_url, std_scratch_text: eventData.std_scratch_text,
    std_date_style: eventData.std_date_style,
    std_show_iban: eventData.std_show_iban,
    show_rsvp_in_full_invite: eventData.show_rsvp_in_full_invite,
    show_guest_name_in_invite: eventData.show_guest_name_in_invite,
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

    // ── Analytics: log this guest visit (once per render, fire-and-forget) ──
    // Skip when the organiser is previewing their own event ("Ver como Convidado")
    if (!Store.viewingAsGuestFromOrganizer) {
      const _visitEventId = eventData.id || Store.currentEventId;
      if (_visitEventId && !window._stdVisitLoggedFor) {
        window._stdVisitLoggedFor = _visitEventId;
        supabaseRequest('visit_log', 'POST', { visit_type: 'guest_view', event_id: _visitEventId }).catch(() => {});
      }
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
    'save_the_date_enabled','release_type','release_date','is_invite_released','std_title','std_subtitle','std_font_family',
    'std_name_size','std_title_size','std_intro_enabled','std_intro_text','std_intro_photo_url'];
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

  const RSVP_ONLY_FIELDS = new Set(['show_time','time','date','title','confirm_by_date','deadline','allowCompanions','allow_companions','maxCompanions','max_companions','allowKids','allow_kids','maxKids','max_kids','allowGifts','allow_gifts','allowSides','allow_sides','side1_name','side2_name','allowMessages','allow_messages','showGuestMessages','show_guest_messages','id','eventCode','cover_image','rsvp_enabled','save_the_date_enabled','release_type','release_date','is_invite_released','std_title','std_subtitle','std_font_family','std_name_size','std_title_size','std_intro_enabled','std_intro_text','std_intro_photo_url','std_show_cover','personalized_links_enabled','show_rsvp_in_full_invite','show_guest_name_in_invite','std_cover_url','userId','user_id','std_scratch_enabled','std_scratch_mode','std_scratch_photo_url','std_scratch_text','std_date_style','std_show_iban','allow_edit_rsvp','std_intro_photo_mobile_url','std_intro_photo_desktop_url','std_intro_on_invite','std_cover_mobile_url','std_cover_desktop_url']);

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
    // Hide entire RSVP CTA section if organiser disabled it for this event.
    // rsvp_enabled defaults to true in DB; if it's false (boolean or string),
    // hide the section. null/undefined = default enabled.
    const rsvpIsDisabled = eventData.rsvp_enabled === false || eventData.rsvp_enabled === 'false';
    // If Save the Date is active, the in-invite RSVP CTA is redundant by
    // default (the guest already confirms on the Save the Date screen) —
    // hide it automatically UNLESS the organiser explicitly turned on
    // "mostrar confirmação também no convite completo" for this event.
    const stdActive = eventData.save_the_date_enabled === true || eventData.save_the_date_enabled === 'true';
    const wantsBothRsvp = eventData.show_rsvp_in_full_invite === true || eventData.show_rsvp_in_full_invite === 'true';
    const hideDueToStd = stdActive && !wantsBothRsvp;
    dlog('🔖 RSVP section visibility check:', { rsvp_enabled: eventData.rsvp_enabled, stdActive, wantsBothRsvp, hideDueToStd });
    _rsvpSec.style.display = (rsvpIsDisabled || hideDueToStd) ? 'none' : '';
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
    // CRITICAL: keep 'std-pending' active while Save the Date is showing.
    // It hides #screen-guest's children via visibility:hidden — including
    // the floating music button and full music player, which otherwise
    // could flash into view during scroll (their fixed positioning combined
    // with viewport scroll quirks could briefly reveal them despite a lower
    // z-index than the overlay). We only remove the loading veil here, never
    // std-pending — the overlay covers everything visually, and std-pending
    // adds a second layer of certainty that nothing else can flash through.
    document.getElementById('std-loading-veil')?.remove();
    // Lock page scroll while the Save the Date overlay is open — its own
    // #std-screen-overlay already scrolls internally (overflow-y:auto), so
    // the underlying page never needs to scroll at the same time.
    document.body.style.overflow = 'hidden';
    return; // Stop here — do not render the full invite sections
  } else {
    // Restore normal page scroll now that Save the Date is not gating this visit
    document.body.style.overflow = '';
    // Ensure the Save the Date overlay (if any) is removed so the full invite shows
    if (typeof window._stdRestoreMusicPlayer === 'function') {
      window._stdRestoreMusicPlayer();
      window._stdRestoreMusicPlayer = null;
    }
    document.getElementById('std-screen-overlay')?.remove();
  }

  // ── Tela de abertura com foto, também no convite completo ──────────────
  // Mostra-se quando: (a) não há Save the Date activo, ou (b) há Save the
  // Date mas o organizador activou "Mostrar também antes do convite
  // completo" (std_intro_on_invite). Nunca aparece duas vezes na mesma
  // visita — Store._introShownThisVisit garante isso mesmo que
  // renderGuestView seja chamada de novo (ex: depois de confirmar presença).
  const introEnabledForInvite = (eventData.std_intro_enabled === true || eventData.std_intro_enabled === 'true')
    && !!_pickIntroPhotoForDevice(eventData)
    && (!eventData.save_the_date_enabled || eventData.std_intro_on_invite !== false)
    && !Store._introShownThisVisit;

  if (introEnabledForInvite) {
    Store._introShownThisVisit = true;
    const introOverlay = document.createElement('div');
    introOverlay.id = 'invite-intro-overlay';
    introOverlay.innerHTML = _buildIntroScreenHtml(eventData, eventData.event_color || '#007f9f', 'invite-intro-screen');
    document.body.appendChild(introOverlay);
    _wireIntroScreenButton('invite-intro-screen');
  }

  // ===== RENDER SECTIONS (awaited so venues load properly) =====
  await renderGuestSections(eventData);

  // Reveal the full invite now that everything below is ready, then continue
  // the rest of this function (RSVP drawer init, music, etc.) as normal.
  document.getElementById('screen-guest')?.classList.remove('std-pending');
  document.getElementById('std-loading-veil')?.remove();
  
  // ✅ CRÍTICO: Mostrar hora para convidados baseado em show_time
  // Verificar AMBAS as formas (show_time e showTime)
  const showTimeRaw = eventData.show_time !== undefined ? eventData.show_time : eventData.showTime;
  const showTime = String(showTimeRaw).toLowerCase() === 'yes' || showTimeRaw === true;
  
  dlog('👤 Guest view - Verificando show_time:', { raw: showTimeRaw, string: String(showTimeRaw), parsed: showTime });
  
  // ✅ NOVO: Mostrar hora APENAS se show_time está ativo (true ou 'yes')
  const timeDisplay = showTime 
    ? formatDate(eventData.date) + ' às ' + eventData.time
    : formatDate(eventData.date);
  
  dlog('👤 Guest view - Time display:', { showTime, timeDisplay });
  
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
  
  dlog('👤 GUEST VIEW - Deadline para convidado:');
  dlog('  confirm_by_date:', eventData.confirm_by_date);
  dlog('  deadline:', eventData.deadline);
  dlog('  date:', eventData.date);
  dlog('  Resultado final:', deadlineDate);
  
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

// escapeHTML() agora vive em config.js (carregado primeiro) — única fonte
// de verdade, usada em todos os ficheiros.




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

  dlog('📝 Processando RSVP:', { name, attending, side, companions, kids });

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
    dlog('🔄 Atualizando resposta anterior (índice:', existingConfIndex, ')');
    
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
    dlog('✨ Adicionando nova resposta');
    
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
        dlog('✅ RSVP atualizado no Supabase');
        // 📢 Enviar notificação em tempo real
        sendRealtimeNotification(data);
        // ✅ CRÍTICO: Aguardar um pouco e depois recarregar
        dlog('⏳ Aguardando 500ms antes de recarregar evento...');
        await new Promise(r => setTimeout(r, 500));
        await reloadEventFromSupabase(data.event_id);
      } else {
        console.error('❌ Erro ao atualizar confirmação');
      }
    } else {
      // Criar novo registro
      const response = await supabaseRequest('rsvps', 'POST', data);
      if (response && response.length > 0) {
        dlog('✅ RSVP criado no Supabase');
        // 📢 Enviar notificação em tempo real
        sendRealtimeNotification(data);
        // ✅ CRÍTICO: Aguardar um pouco e depois recarregar
        dlog('⏳ Aguardando 500ms antes de recarregar evento...');
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
    dlog('🔄 Recarregando evento do Supabase:', eventId);
    
    // Buscar evento COM JOIN para presentes e RSVPs
    const eventData = await supabaseRequest(`events?id=eq.${eventId}&select=id,title,date,time,user_id,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,allow_messages,show_guest_messages,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,groom_name,bride_name,couple_size,show_couple,bg_url,bg_overlay,bible_text,bible_ref,show_bible,invite_text,show_invite,groom_parents,bride_parents,show_parents,gallery_urls,show_gallery,show_manual,manual_items,show_schedule,schedule_items,custom_font_family,section_order,story_text,invite_blessing,event_color,confirm_by_date,cover_image,event_code,gifts(id,name,category,reserved,reserved_by,quantity,image_url),rsvps(guest_name,attending,side,companions,kids,wants_gift,message,created_at,updated_at)`);
    
    if (eventData && eventData.length > 0) {
      const event = eventData[0];
      dlog('✅ Evento recarregado do Supabase com', (event.rsvps || []).length, 'RSVPs');
      
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
          reservedBy: g.reserved_by || null,
        quantity: g.quantity || 1,
        imageUrl: g.image_url || null
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
        dlog('✅ Store.events[' + existingIndex + '] COMPLETAMENTE atualizado com', normalizedEvent.confirmations.length, 'confirmações');
      } else {
        // Se não existe, adicionar
        Store.events.push(normalizedEvent);
        dlog('✅ Evento NOVO adicionado ao Store com', normalizedEvent.confirmations.length, 'confirmações');
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
        reserved_by: gift.reservedBy || null,
        quantity: gift.quantity || 1,
        image_url: gift.imageUrl || null
      };
      
      const response = await supabaseRequest('gifts', 'POST', giftData);
      if (!response || response.length === 0) {
        console.error('❌ Erro ao salvar presente:', gift.name);
      }
    }
    dlog('✅ Presentes sincronizados com Supabase');
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
        reservedBy: g.reserved_by || null,
        quantity: g.quantity || 1,
        imageUrl: g.image_url || null
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
// ===================== MODAIS: DRESS CODE + SUGESTÃO DE PRESENTES =====================
// Abertos a partir dos botões da secção combinada (ver buildDressGiftsSection
// em sections.js). Ambos funcionam sem o convidado ter de confirmar presença
// primeiro — só pedem o nome no momento em que escolhem mesmo um presente.

function openGuestDresscodeModal() {
  const ev = Store.guestEventData || Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'guest-dresscode-modal';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-base font-bold text-gray-800">Dress Code</h3>
      <button onclick="this.closest('.modal-overlay').remove()" style="background:none;border:none;cursor:pointer;color:#9ca3af;padding:4px;line-height:0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    ${_buildDresscodeContentHTML(ev)}
  </div>`;
  document.body.appendChild(modal);
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  lucide.createIcons();
}

function _giftGuestNameKey(eventId) { return `giftGuestName_${eventId}`; }

function _resolveKnownGuestName(eventId) {
  if (Store.currentGuestSession?.guestName) return Store.currentGuestSession.guestName;
  const confirmed = rsvpCheckConfirmed(eventId);
  if (confirmed && confirmed.name) return confirmed.name;
  // ✅ Nome dado anteriormente só para escolher presente (sem ter confirmado
  // presença) — guardado neste aparelho, para nunca pedir duas vezes nem
  // arriscar uma escrita diferente da primeira vez (o que deixava a mesma
  // pessoa escolher 2 presentes sem o site perceber que era a mesma pessoa).
  try {
    const saved = localStorage.getItem(_giftGuestNameKey(eventId));
    if (saved) return saved;
  } catch(e) {}
  return null;
}

function _rememberGiftGuestName(eventId, name) {
  try { localStorage.setItem(_giftGuestNameKey(eventId), name); } catch(e) {}
}

function _giftClaimants(g) {
  return (g.reservedBy || '').split('|').map(s => s.trim()).filter(Boolean);
}
function _giftQuantity(g) { return g.quantity && g.quantity > 0 ? g.quantity : 1; }
function _giftIsFull(g) { return _giftClaimants(g).length >= _giftQuantity(g); }

function _giftCardInner(g, knownName) {
  const claimants = _giftClaimants(g);
  const qty = _giftQuantity(g);
  const full = claimants.length >= qty;
  const mineClaimed = knownName && claimants.some(c => normalizeGuestName(c) === normalizeGuestName(knownName));
  const badgeText = qty > 1 ? `${claimants.length}/${qty} escolhido${claimants.length===1?'':'s'}` : (full ? 'Escolhido' : 'Disponível');
  const badgeClass = full && qty === 1 ? 'bg-green-100 text-green-700' : (claimants.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600');
  return { claimants, qty, full, mineClaimed, badgeText, badgeClass };
}

function _renderGuestGiftsContent(ev, viewMode) {
  const knownName = _resolveKnownGuestName(ev.id);
  const categories = {};
  ev.gifts.forEach(g => {
    const cat = g.category || 'Sem categoria';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(g);
  });

  if (viewMode === 'grid') {
    return Object.keys(categories).sort().map(cat => `
      <div class="mb-4">
        <h4 class="text-sm font-bold text-teal-700 mb-2">${escapeHTML(cat)}</h4>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.6rem">
          ${categories[cat].map(g => {
            const { full, badgeText, badgeClass } = _giftCardInner(g, knownName);
            return `<div class="rounded-xl border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition bg-white" onclick="_selectGiftInModal('${g.id}', this)">
              <div style="aspect-ratio:1;background:#f1f5f9;display:flex;align-items:center;justify-content:center;overflow:hidden">
                ${g.imageUrl ? `<img src="${g.imageUrl}" style="width:100%;height:100%;object-fit:cover">` : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`}
              </div>
              <div class="p-2">
                <p class="text-xs font-medium ${full ? 'text-gray-500 line-through' : 'text-gray-800'} break-words leading-tight mb-1">${escapeHTML(g.name)}</p>
                <span class="text-[0.65rem] font-semibold px-1.5 py-0.5 rounded-full ${badgeClass}">${badgeText}</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('');
  }

  // viewMode === 'list' (padrão)
  return Object.keys(categories).sort().map(cat => `
    <div class="bg-white rounded-xl shadow-sm border-l-4 border-teal-500 overflow-hidden mb-3">
      <div class="bg-teal-50 px-4 py-2.5 border-b border-teal-100">
        <h4 class="text-sm font-bold text-teal-700">${escapeHTML(cat)}</h4>
      </div>
      <div class="divide-y">
        ${categories[cat].map(g => {
          const { full, badgeText, badgeClass } = _giftCardInner(g, knownName);
          return `<div class="flex items-center gap-3 p-3.5 hover:bg-gray-50 transition active:bg-teal-50 cursor-pointer" onclick="_selectGiftInModal('${g.id}', this)">
            ${g.imageUrl
              ? `<div style="width:42px;height:42px;border-radius:0.5rem;overflow:hidden;flex-shrink:0;background:#f1f5f9"><img src="${g.imageUrl}" style="width:100%;height:100%;object-fit:cover"></div>`
              : `<div class="flex-shrink-0 w-7 h-7 rounded-full border-2 ${full ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'} flex items-center justify-center transition-all" data-gift-checkbox="${g.id}">${full ? '<i data-lucide="check" class="w-4 h-4 text-white"></i>' : ''}</div>`}
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium ${full ? 'text-gray-500 line-through' : 'text-gray-800'} break-words">${escapeHTML(g.name)}</p>
            </div>
            <span class="text-xs font-semibold px-2 py-1 rounded-full ${badgeClass} flex-shrink-0">${badgeText}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`).join('');
}

function _toggleGuestGiftsView(mode) {
  localStorage.setItem('giftViewMode', mode);
  const ev = Store.guestEventData || Store.events.find(e => e.id === Store.currentEventId);
  document.getElementById('guest-gifts-modal-list').innerHTML = _renderGuestGiftsContent(ev, mode);
  document.getElementById('gv-btn-list')?.classList.toggle('active-view', mode === 'list');
  document.getElementById('gv-btn-grid')?.classList.toggle('active-view', mode === 'grid');
  lucide.createIcons();
}

function openGuestGiftsModal() {
  const ev = Store.guestEventData || Store.events.find(e => e.id === Store.currentEventId);
  if (!ev || !Array.isArray(ev.gifts) || ev.gifts.length === 0) { toast('Ainda não há presentes configurados.'); return; }

  const knownName = _resolveKnownGuestName(ev.id);
  const viewMode = localStorage.getItem('giftViewMode') || 'list';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'guest-gifts-modal';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl shadow-lg p-5 max-w-md w-full mx-4" style="max-height:85vh;overflow-y:auto">
    <div class="flex items-center justify-between mb-1">
      <h3 class="text-base font-bold text-gray-800">Sugestão de Presentes</h3>
      <button onclick="this.closest('.modal-overlay').remove()" style="background:none;border:none;cursor:pointer;color:#9ca3af;padding:4px;line-height:0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="flex items-center justify-between mb-3">
      <p class="text-xs text-gray-500">Escolhe um presente.</p>
      <div style="display:flex;gap:0.25rem;background:#f1f5f9;border-radius:999px;padding:2px">
        <button id="gv-btn-list" class="gift-view-toggle-btn ${viewMode==='list'?'active-view':''}" onclick="_toggleGuestGiftsView('list')" title="Lista"><i data-lucide="list" class="w-3.5 h-3.5"></i></button>
        <button id="gv-btn-grid" class="gift-view-toggle-btn ${viewMode==='grid'?'active-view':''}" onclick="_toggleGuestGiftsView('grid')" title="Grelha"><i data-lucide="grid-2x2" class="w-3.5 h-3.5"></i></button>
      </div>
    </div>
    <div id="guest-gifts-modal-list">${_renderGuestGiftsContent(ev, viewMode)}</div>
  </div>`;
  document.body.appendChild(modal);
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  modal.dataset.knownName = knownName || '';
  lucide.createIcons();
}

// Modal próprio para pedir o nome do convidado — substitui o prompt() nativo
// do browser, que aparecia no topo, mostrava o domínio do site em vez do
// nome dos noivos, e não tinha estilo nenhum.
function askGuestNameModal(coupleLabel) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '10800';
    modal.id = 'ask-guest-name-modal';
    modal.innerHTML = `<div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-base font-bold text-gray-800 mb-1">${escapeHTML(coupleLabel || 'Escolher Presente')}</h3>
      <p class="text-sm text-gray-500 mb-3">Para escolher este presente, diz-nos o teu nome:</p>
      <input id="ask-guest-name-input" type="text" class="input-field" placeholder="O teu nome" autocomplete="off">
      <div class="flex gap-2 mt-4">
        <button id="ask-guest-name-ok" class="flex-1 btn-main">Confirmar</button>
        <button id="ask-guest-name-cancel" class="btn-outline">Cancelar</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    const input = document.getElementById('ask-guest-name-input');
    input.focus();

    const finish = (value) => { modal.remove(); resolve(value); };
    document.getElementById('ask-guest-name-ok').onclick = () => {
      const v = input.value.trim();
      if (!v) { input.style.borderColor = '#ef4444'; return; }
      finish(v);
    };
    document.getElementById('ask-guest-name-cancel').onclick = () => finish(null);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('ask-guest-name-ok').click(); });
    modal.onclick = (e) => { if (e.target === modal) finish(null); };
  });
}

async function _selectGiftInModal(giftId, element) {
  const ev = Store.guestEventData || Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;
  const gift = ev.gifts.find(g => g.id === giftId);
  if (!gift) return;

  const modal = document.getElementById('guest-gifts-modal');
  let guestName = (modal && modal.dataset.knownName) || _resolveKnownGuestName(ev.id);

  const claimants = _giftClaimants(gift);
  const qty = _giftQuantity(gift);
  const alreadyMine = guestName && claimants.some(c => normalizeGuestName(c) === normalizeGuestName(guestName));

  // Já totalmente reservado por outras pessoas (e não é já meu) — não deixa escolher
  if (claimants.length >= qty && !alreadyMine) {
    toast(qty > 1 ? 'Este presente já atingiu o limite de pessoas.' : 'Este presente já foi escolhido por outro convidado.');
    return;
  }
  if (alreadyMine) { toast('Já escolheste este presente!'); return; }

  // ── Não sabemos ainda quem é o convidado: pedir o nome antes de continuar ──
  if (!guestName) {
    const coupleLabel = ev.title || [ev.groom_name, ev.bride_name].filter(Boolean).join(' & ') || 'Escolher Presente';
    const typed = await askGuestNameModal(coupleLabel);
    if (!typed) return;
    guestName = typed;
    if (modal) modal.dataset.knownName = guestName;
    _rememberGiftGuestName(ev.id, guestName);
  }

  // Regra: um convidado só pode escolher 1 presente no total — mesmo que
  // ESTE presente em particular permita várias pessoas (quantity > 1), a
  // mesma pessoa não pode estar a escolher um SEGUNDO presente diferente.
  const otherReserved = ev.gifts.find(g => g.id !== giftId && _giftClaimants(g).some(c => normalizeGuestName(c) === normalizeGuestName(guestName)));
  if (otherReserved) { showAlreadyReservedModal(); return; }

  const newClaimants = [...claimants, guestName];
  const newReservedByStr = newClaimants.join('|');
  const nowFull = newClaimants.length >= qty;

  gift.reservedBy = newReservedByStr;
  gift.reserved = nowFull;
  try {
    await updateGiftReservationInSupabase(giftId, nowFull, newReservedByStr);
  } catch (e) {
    gift.reservedBy = claimants.join('|') || null; gift.reserved = claimants.length >= qty;
    toast('Não foi possível reservar o presente. Tenta novamente.');
    return;
  }
  reloadEventFromSupabase(ev.id).catch(() => {});

  // Re-renderiza o item para refletir o novo estado (compatível com lista e grelha)
  const viewMode = localStorage.getItem('giftViewMode') || 'list';
  const listEl = document.getElementById('guest-gifts-modal-list');
  if (listEl) listEl.innerHTML = _renderGuestGiftsContent(ev, viewMode);
  lucide.createIcons();
  toast(`Presente escolhido, obrigado ${guestName.split(' ')[0]}!`);
}


function backFromGifts() {
  dlog('👈 Voltando da tela de presentes');
  dlog('  guestEventData:', Store.guestEventData ? 'Sim' : 'Não');
  dlog('  currentEventId:', Store.currentEventId);
  
  // ✅ NOVO: Se veio de URL com ?gifts=only, voltar para home
  const params = new URLSearchParams(window.location.search);
  const giftsOnly = params.get('gifts') === 'only';
  
  if (giftsOnly) {
    dlog('🏠 URL com modo gifts-only detectado - voltando para home');
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
      
      html += '<div class="bg-white rounded-lg shadow-sm border-l-3 border-teal-500 p-3"><div class="flex items-center justify-between mb-2"><h4 class="text-sm font-bold text-teal-600">' + escapeHTML(cat) + '</h4><button class="text-gray-300 hover:text-red-500 transition" onclick="deleteCategory(\'' + encodeURIComponent(cat).replace(/'/g, '%27') + '\', \'' + ev.id + '\')"><i data-lucide="trash-2" class="w-4 h-4"></i></button></div><div class="space-y-1">';
      
      gifts.forEach(g => {
        const claimants = _giftClaimants(g);
        const qty = _giftQuantity(g);
        const badge = qty > 1 ? `<span class="text-[0.6rem] font-semibold px-1 py-0.5 rounded bg-blue-50 text-blue-600 flex-shrink-0">${claimants.length}/${qty}</span>` : '';
        const thumb = g.imageUrl ? `<img src="${g.imageUrl}" style="width:18px;height:18px;border-radius:4px;object-fit:cover;flex-shrink:0">` : '<span class="text-teal-400 flex-shrink-0">◯</span>';
        html += '<div class="flex items-center gap-2 group hover:bg-gray-50 px-1 rounded transition text-xs">' + thumb + '<span class="text-gray-700 flex-1 truncate">' + escapeHTML(g.name) + '</span>' + badge + '<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition"><button class="text-gray-300 hover:text-teal-500 p-0.5" onclick="editGiftModal(\'' + g.id + '\')"><i data-lucide="edit" class="w-3 h-3"></i></button><button class="text-gray-300 hover:text-red-500 p-0.5" onclick="deleteGift(\'' + g.id + '\')"><i data-lucide="trash-2" class="w-3 h-3"></i></button></div></div>';
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
        ${ev.iban_message ? `<p class="text-sm text-gray-600 mb-3 leading-relaxed whitespace-pre-line">${escapeHTML(ev.iban_message)}</p>` : ''}
        <div class="bg-white rounded-lg px-3 py-2 mb-2 border border-teal-200">
          <p class="text-xs text-gray-400 mb-0.5">IBAN</p>
          <p class="iban-value">${escapeHTML(ev.iban_number)}</p>
        </div>
        ${ev.iban_holder ? `<div class="bg-white rounded-lg px-3 py-2 mb-2 border border-teal-200"><p class="text-xs text-gray-400 mb-0.5">Titular</p><p class="text-sm font-semibold text-gray-700">${escapeHTML(ev.iban_holder)}</p></div>` : ''}
        ${ev.iban_footer ? `<p class="text-xs text-gray-500 mt-2 text-right italic">${escapeHTML(ev.iban_footer)}</p>` : ''}
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
          <h4 class="text-sm font-bold text-teal-700">${escapeHTML(cat)}</h4>
        </div>
        <div class="divide-y">
          ${gifts.map(g => `
            <div class="flex items-center gap-3 p-4 hover:bg-gray-50 transition active:bg-teal-50 cursor-pointer" onclick="toggleGiftSelection('${g.id}', this)">
              <div class="flex-shrink-0 w-8 h-8 rounded-full border-2 ${g.reserved ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white'} flex items-center justify-center transition-all" data-gift-checkbox="${g.id}">
                ${g.reserved ? '<i data-lucide="check" class="w-5 h-5 text-white"></i>' : ''}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium ${g.reserved ? 'text-gray-500 line-through' : 'text-gray-800'} break-words">${escapeHTML(g.name)}</p>
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
    dlog('✅ Nome obtido da sessão:', guestName);
  }
  // 2️⃣ Tentar input do formulário (se estiver visível)
  else if (document.getElementById('rsvp-name')) {
    const nameInput = document.getElementById('rsvp-name').value?.trim();
    if (nameInput) {
      guestName = nameInput;
      dlog('✅ Nome obtido do input:', guestName);
    }
  }
  // 3️⃣ Nome guardado anteriormente (escolheu presente sem ter confirmado presença)
  if (!guestName) {
    const saved = _resolveKnownGuestName(ev.id);
    if (saved) { guestName = saved; dlog('✅ Nome obtido da memória de presentes:', guestName); }
  }
  // 4️⃣ Fallback (não deveria chegar aqui)
  if (!guestName) {
    guestName = 'Convidado Anónimo';
    dlog('⚠️ Nome padrão usado:', guestName);
  } else {
    _rememberGiftGuestName(ev.id, guestName);
  }
  
  dlog('👤 Nome do convidado FINAL:', { guestName, session: Store.currentGuestSession });

  const claimants = _giftClaimants(gift);
  const qty = _giftQuantity(gift);
  const alreadyMine = claimants.some(c => normalizeGuestName(c) === normalizeGuestName(guestName));

  // ✅ Convidado só pode ESCOLHER presente, não desmarcar
  if (claimants.length >= qty && !alreadyMine) {
    dlog('❌ Presente já atingiu o limite de pessoas:', gift.reservedBy);
    toast(qty > 1 ? 'Este presente já atingiu o limite de pessoas.' : 'Este presente já foi escolhido por outro convidado.');
    return;
  }
  if (alreadyMine) { toast('Já escolheste este presente!'); return; }

  // ✅ CRÍTICO: Verificar se convidado JÁ ESCOLHEU outro presente (diferente deste)
  const otherReservedGifts = ev.gifts.filter(g =>
    g.id !== giftId &&
    _giftClaimants(g).some(c => normalizeGuestName(c) === normalizeGuestName(guestName))
  );

  dlog('🎁 Verificação de presente anterior:', {
    guestName,
    giftIdAtual: giftId,
    outrosPresentes: otherReservedGifts,
    totalOutros: otherReservedGifts.length
  });

  if (otherReservedGifts.length > 0) {
    dlog('⚠️ ALERTA: Convidado já tem outro(s) presente(s) escolhido(s)!');
    showAlreadyReservedModal();
    return;
  }

  dlog('🎁 Escolhendo presente:', { giftId, giftName: gift.name, chosenBy: guestName });

  const newClaimants = [...claimants, guestName];
  const newReservedByStr = newClaimants.join('|');
  const nowFull = newClaimants.length >= qty;

  gift.reservedBy = newReservedByStr;
  gift.reserved = nowFull;

  // ✅ Sincronizar com Supabase
  try {
    await updateGiftReservationInSupabase(giftId, nowFull, newReservedByStr);
  } catch (error) {
    gift.reservedBy = claimants.join('|') || null;
    gift.reserved = claimants.length >= qty;
    console.error('Erro ao reservar presente:', error);
    toast('Nao foi possivel reservar o presente. Tente novamente.');
    return;
  }
  
  // ✅ CRÍTICO: Recarregar evento do Supabase para garantir que dono vê a mudança
  dlog('🔄 Recarregando evento do Supabase para sincronizar com dono...');
  reloadEventFromSupabase(ev.id).then(() => {
    dlog('✅ Evento recarregado. Dono verá a mudança em tempo real.');
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

  const claimants = _giftClaimants(gift);
  const qty = _giftQuantity(gift);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4" style="max-height:88vh;overflow-y:auto">
      <h3 class="text-lg font-bold text-gray-800 mb-4">Editar Presente</h3>
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Nome</label>
          <input id="edit-gift-name" class="input-field" value="${escapeHTML(gift.name)}">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Categoria</label>
          <input id="edit-gift-category" class="input-field" value="${escapeHTML(gift.category || 'Sem categoria')}">
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Quantas pessoas podem escolher este presente?</label>
          <input id="edit-gift-quantity" type="number" min="1" max="50" class="input-field" value="${qty}">
          <p class="text-xs text-gray-400 mt-1">1 = só um convidado pode escolher (padrão). Mais que 1 = vários convidados podem escolher o mesmo presente (ex: contribuição para lua-de-mel).</p>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Foto do presente (opcional)</label>
          <div id="edit-gift-image-wrap" class="${gift.imageUrl ? '' : 'hidden'} relative mb-2" style="max-width:140px">
            <img id="edit-gift-image-preview" class="rounded-lg w-full" style="aspect-ratio:1;object-fit:cover" src="${gift.imageUrl || ''}">
            <button type="button" onclick="document.getElementById('edit-gift-image-url').value='';document.getElementById('edit-gift-image-wrap').classList.add('hidden')" class="absolute top-1 right-1 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-red-500 text-xs font-bold">✕</button>
          </div>
          <input type="hidden" id="edit-gift-image-url" value="${gift.imageUrl || ''}">
          <div class="flex gap-2">
            <input type="file" id="edit-gift-image-input" accept="image/*" class="input-field text-sm" onchange="handleGiftImageUpload(this)" style="flex:1">
          </div>
          <button type="button" class="text-xs text-teal-600 font-semibold mt-1" onclick="openMediaLibraryPicker((url) => { document.getElementById('edit-gift-image-url').value=url; document.getElementById('edit-gift-image-preview').src=url; document.getElementById('edit-gift-image-wrap').classList.remove('hidden'); })">📁 Escolher da Biblioteca</button>
        </div>
        ${claimants.length ? `
        <div class="bg-amber-50 border-l-3 border-amber-500 p-3 rounded text-xs text-amber-700">
          <p class="font-semibold mb-2">Escolhido por (${claimants.length}/${qty}):</p>
          ${claimants.map(name => `<div class="flex items-center justify-between mb-1"><span>${escapeHTML(name)}</span><button type="button" class="text-amber-600 hover:text-red-600 font-semibold underline text-xs" onclick="removeGiftReservationFromModal('${giftId}', '${encodeURIComponent(name)}', this.closest('.modal-overlay'))">remover</button></div>`).join('')}
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

async function handleGiftImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 4*1024*1024) { toast('Imagem muito grande. Máx. 4 MB.'); return; }
  const eventId = Store.currentEventId;
  const label = 'Foto de presente';
  const applyUrl = (url) => {
    document.getElementById('edit-gift-image-url').value = url;
    document.getElementById('edit-gift-image-preview').src = url;
    document.getElementById('edit-gift-image-wrap').classList.remove('hidden');
  };
  const proceed = await _confirmIfDuplicatePhoto(file, eventId, label, applyUrl);
  if (!proceed) { input.value = ''; return; }
  toast('A carregar foto...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers', label);
    applyUrl(url);
    toast('Foto do presente carregada!');
  } catch(e) { toast('Erro ao carregar a foto.'); }
}

// ✅ Remover a reserva de UM convidado específico (não afecta outros, se o
// presente permitir várias pessoas).
function removeGiftReservationFromModal(giftId, claimantNameEncoded, modal) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  const gift = ev.gifts.find(g => g.id === giftId);
  if (!gift) return;
  const claimantName = decodeURIComponent(claimantNameEncoded);

  const confirmModal = document.createElement('div');
  confirmModal.className = 'modal-overlay';
  confirmModal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Remover Reserva?</h3>
      <p class="text-sm text-gray-600 mb-2">Presente: <strong>${escapeHTML(gift.name)}</strong></p>
      <p class="text-sm text-gray-600 mb-4">Pessoa: <strong>${escapeHTML(claimantName)}</strong></p>
      
      <p class="text-xs text-amber-600 font-semibold mb-4">"${escapeHTML(claimantName)}" poderá escolher outro presente.</p>
      
      <div class="flex gap-2">
        <button class="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 px-4 font-semibold transition" onclick="confirmRemoveGiftReservation('${giftId}', '${claimantNameEncoded}', this.closest('.modal-overlay'), document.querySelector('[class*=\"modal-overlay\"]'))">
          Remover Reserva
        </button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmModal);
}

// ✅ Confirmar remoção da reserva de UM convidado específico
async function confirmRemoveGiftReservation(giftId, claimantNameEncoded, confirmModal, editModal) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  const gift = ev.gifts.find(g => g.id === giftId);
  if (!gift) return;
  const claimantName = decodeURIComponent(claimantNameEncoded);

  const previousClaimants = _giftClaimants(gift);
  const newClaimants = previousClaimants.filter(c => normalizeGuestName(c) !== normalizeGuestName(claimantName));
  const newReservedByStr = newClaimants.join('|') || null;
  const qty = _giftQuantity(gift);

  gift.reservedBy = newReservedByStr;
  gift.reserved = newClaimants.length >= qty;

  try {
    await updateGiftReservationInSupabase(giftId, gift.reserved, newReservedByStr);
    confirmModal.remove();
    if (editModal) editModal.remove();

    toast(`Reserva de "${gift.name}" removida para "${claimantName}". Pode escolher outro presente.`);
    renderEventDetails();
  } catch (error) {
    gift.reservedBy = previousClaimants.join('|') || null;
    gift.reserved = previousClaimants.length >= qty;
    console.error('Erro ao remover reserva:', error);
    toast('Nao foi possivel remover a reserva. Tente novamente.');
  }
}

// ✅ Remover reserva de presente (pelo botão na lista de confirmações) — de UM convidado específico
function removeGiftReservation(giftId, claimantNameEncoded) {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  const gift = ev.gifts.find(g => g.id === giftId);
  if (!gift) return;
  const claimantName = decodeURIComponent(claimantNameEncoded || '');

  const confirmModal = document.createElement('div');
  confirmModal.className = 'modal-overlay';
  confirmModal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Remover Reserva?</h3>
      <p class="text-sm text-gray-600 mb-2">Presente: <strong>${escapeHTML(gift.name)}</strong></p>
      <p class="text-sm text-gray-600 mb-4">Pessoa: <strong>${escapeHTML(claimantName)}</strong></p>
      
      <p class="text-xs text-amber-600 font-semibold mb-4">"${escapeHTML(claimantName)}" poderá escolher outro presente.</p>
      
      <div class="flex gap-2">
        <button class="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 px-4 font-semibold transition" onclick="confirmRemoveGiftReservation('${giftId}', '${claimantNameEncoded}', this.closest('.modal-overlay'), null)">
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
  const newQuantity = parseInt(document.getElementById('edit-gift-quantity')?.value, 10) || 1;
  const newImageUrl = document.getElementById('edit-gift-image-url')?.value.trim() || null;

  if (!newName) { toast('Digite o nome do presente!'); return; }

  gift.name = newName;
  gift.category = newCategory || 'Sem categoria';
  gift.quantity = Math.max(1, newQuantity);
  gift.imageUrl = newImageUrl;
  // Se a nova quantidade ficar abaixo do nº de pessoas já inscritas, o
  // presente passa a "completo" com quem já está — não remove ninguém.
  gift.reserved = _giftClaimants(gift).length >= gift.quantity;

  // ✅ Sincronizar com Supabase
  saveGiftsToSupabase(ev.id, ev.gifts);

  modal.remove();
  toast('Presente atualizado!');
  renderGifts();
}

function deleteCategory(categoryEncoded, eventId) {
  const category = decodeURIComponent(categoryEncoded);
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
        <button class="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 px-4 font-semibold transition" onclick="confirmDeleteCategory('${encodeURIComponent(category).replace(/'/g, '%27')}', this.closest('.modal-overlay'))">Eliminar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function confirmDeleteCategory(categoryEncoded, modal) {
  const category = decodeURIComponent(categoryEncoded);
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
      <p class="text-gray-500 text-sm mb-4">"${escapeHTML(gift.name)}" - Esta ação não pode ser desfeita.</p>
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
    dlog('🎁 Presente reservado:', { giftName: gift.name, reservedBy: guestName });
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
  
  dlog('🗑️ Iniciando exclusão de RSVP:', {
    eventId: Store.currentEventId,
    guestName: guestName,
    confIndex: confIndex
  });
  
  // ✅ CRÍTICO: Deletar do Supabase PRIMEIRO, DEPOIS remover do Store
  // Usar URL encoding correto para o nome do convidado
  const encodedGuestName = encodeURIComponent(guestName).replace(/%20/g, ' ');
  const deleteUrl = `rsvps?event_id=eq.${Store.currentEventId}&guest_name=eq.${encodedGuestName}`;
  
  dlog('📤 URL de exclusão:', deleteUrl);
  
  supabaseRequest(deleteUrl, 'DELETE', {}).then(result => {
    dlog('✅ RSVP deletado do Supabase:', { guestName, result });
    
    // DEPOIS: remover do Store local
    if (ev.confirmations && confIndex >= 0 && confIndex < ev.confirmations.length) {
      ev.confirmations.splice(confIndex, 1);
      dlog('✅ RSVP removido do Store local. Restam:', ev.confirmations.length);
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
async function handleBgUpload(input, variant) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { toast('Imagem de fundo muito grande. Máx. 8 MB.'); return; }
  const eventId = Store.currentEventId || Store._intakeEventId;
  const label = variant === 'desktop' ? 'Foto de fundo do convite (computador)' : 'Foto de fundo do convite (telemóvel)';
  const applyUrl = (url) => {
    document.getElementById(`evt-bg-url-${variant}`).value = url;
    const prev = document.getElementById(`bg-preview-${variant}`);
    if (prev) prev.src = url;
    document.getElementById(`bg-preview-${variant}-wrap`)?.classList.remove('hidden');
    const a = document.getElementById(`bg-upload-area-${variant}`);
    if (a) a.innerHTML = `<span class="text-xs text-teal-600 font-semibold">Imagem carregada</span>`;
  };
  const proceed = await _confirmIfDuplicatePhoto(file, eventId, label, applyUrl);
  if (!proceed) { input.value = ''; return; }
  const area = document.getElementById(`bg-upload-area-${variant}`);
  if (area) area.innerHTML = '<span class="text-xs text-teal-600 font-semibold">A carregar...</span>';
  try {
    const url = await uploadImageToStorage(file, 'event-covers', label);
    applyUrl(url);
    toast('Imagem de fundo carregada!');
  } catch(e) {
    toast('Erro ao carregar imagem de fundo.');
    if (area) area.innerHTML = `<i data-lucide="${variant === 'desktop' ? 'monitor' : 'smartphone'}" class="w-5 h-5 mb-1 text-gray-400"></i> Carregar imagem de fundo (${variant === 'desktop' ? 'computador' : 'telemóvel'})`;
    lucide.createIcons();
  }
}

function removeBgPhoto(variant) {
  document.getElementById(`evt-bg-url-${variant}`).value = '';
  document.getElementById(`bg-file-input-${variant}`).value = '';
  document.getElementById(`bg-preview-${variant}-wrap`)?.classList.add('hidden');
  toast('Foto de fundo removida.');
}

// ── Detecção de fotos duplicadas ────────────────────────────────────────────
// Calcula um hash SHA-256 real do conteúdo do ficheiro (não apenas do nome ou
// tamanho), usando a Web Crypto API nativa do browser — isto identifica com
// 100% de certeza se é EXACTAMENTE a mesma imagem, mesmo que tenha sido
// renomeada ou re-seleccionada do disco. O registo de hashes já usados é
// guardado por evento, para nunca comparar fotos de eventos diferentes entre si.
async function _hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verifica se este ficheiro já foi carregado antes para este evento. Se sim,
// pergunta ao utilizador se quer substituir mesmo assim. Devolve `true` se
// deve continuar com o upload, `false` se o utilizador cancelou.
// Verifica se este ficheiro já foi carregado antes por esta conta (em
// QUALQUER evento, não só o actual) — consulta a biblioteca persistente em
// Supabase, não memória local, por isso funciona mesmo dias depois.
// Se houver uma foto igual e o utilizador escolher reaproveitar, aplica o
// URL existente via `applyUrlFn` e devolve false (não prosseguir com upload
// novo). Devolve true se deve prosseguir com um upload normal.
async function _confirmIfDuplicatePhoto(file, eventId, fieldLabel, applyUrlFn) {
  const userId = Store.currentUser?.id;
  if (!userId) return true; // sem conta identificada, não há biblioteca para comparar
  try {
    const hash = await _hashFile(file);
    const matches = await supabaseRequest(
      `media_library?user_id=eq.${userId}&file_hash=eq.${hash}&select=url,label,created_at&order=created_at.desc&limit=1`
    );
    const match = matches && matches[0];
    if (match) {
      const usedWhen = match.created_at ? new Date(match.created_at).toLocaleDateString('pt-PT') : '';
      const reuse = confirm(
        `Esta foto já está na tua biblioteca (usada em "${match.label || 'outro local'}"${usedWhen ? ', em ' + usedWhen : ''}).\n\n` +
        `OK = reaproveitar essa foto (não ocupa espaço novo)\nCancelar = carregar como uma cópia nova`
      );
      if (reuse) {
        if (applyUrlFn) applyUrlFn(match.url);
        toast('Foto reaproveitada da biblioteca!');
        return false; // já aplicado — não prosseguir com upload
      }
      // segue para upload normal (cópia nova, intencional)
    }
  } catch(e) {
    console.warn('Falha ao verificar duplicado na biblioteca:', e);
    // Em caso de erro, não bloquear o upload — apenas seguir sem a verificação
  }
  return true;
}

async function uploadImageToStorage(file, bucket, label) {
  const ext = file.name.split('.').pop().toLowerCase();
  const fileName = `img_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': file.type || 'image/jpeg', 'x-upsert': 'true' },
    body: file
  });
  if (!res.ok) throw new Error(await res.text());
  const url = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}`;

  // ✅ Regista esta imagem na biblioteca pessoal (para detetar duplicados e
  // permitir reaproveitar mais tarde, em vez de carregar de novo e gastar
  // espaço — o plano grátis do Supabase só tem 1GB).
  try {
    const userId = Store.currentUser?.id;
    if (userId) {
      const hash = await _hashFile(file).catch(() => null);
      await supabaseRequest('media_library', 'POST', {
        user_id: userId,
        event_id: Store.currentEventId || Store._intakeEventId || null,
        url, file_hash: hash, label: label || null,
        bucket, file_path: fileName, size_bytes: file.size || null
      });
    }
  } catch(e) { console.warn('Não foi possível registar na biblioteca de imagens:', e); }

  return url;
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
  const eventId = Store.currentEventId || Store._intakeEventId;
  toast('A verificar ' + files.length + ' imagem(ns)...');
  const urls = [];
  for (const file of files) {
    let reusedUrl = null;
    const proceed = await _confirmIfDuplicatePhoto(file, eventId, 'Galeria de Fotos', (url) => { reusedUrl = url; });
    if (reusedUrl) { urls.push(reusedUrl); continue; } // reaproveitada — não conta para upload novo
    if (!proceed) continue; // utilizador cancelou esta foto especificamente
    try {
      const url = await uploadImageToStorage(file, 'event-covers', 'Galeria de Fotos');
      urls.push(url);
    } catch(e) { toast('Erro a carregar: ' + file.name); }
  }
  urlInput.value = (existing ? existing + '\n' : '') + urls.join('\n');
  toast(urls.length + ' imagem(ns) adicionada(s)!');
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
  const diag = {
    save_the_date_enabled: ev.save_the_date_enabled,
    type: typeof ev.save_the_date_enabled,
    release_type: ev.release_type,
    is_invite_released: ev.is_invite_released,
    release_date: ev.release_date,
  };
  // Feature off entirely → always show full invite (current behaviour)
  if (!ev.save_the_date_enabled || ev.save_the_date_enabled === false || ev.save_the_date_enabled === 'no') {
    dlog('🚪 STD Gate: OFF (save_the_date_enabled is falsy) →', diag);
    return { showSaveTheDate: false };
  }

  const releaseType = ev.release_type || 'manual';

  // Condition C: Manual — admin/organiser controls is_invite_released directly
  if (releaseType === 'manual') {
    if (ev.is_invite_released === true || ev.is_invite_released === 'yes') {
      dlog('🚪 STD Gate: OFF — manual release, is_invite_released=true →', diag);
      return { showSaveTheDate: false };
    }
    dlog('🚪 STD Gate: ON — manual release, not yet released →', diag);
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

// ── Bloco de data do evento dentro do Save the Date — estilo configurável ──
// ── Tela de abertura com foto — reutilizável no Save the Date E no convite ──
// Detecta se o ecrã é de telemóvel ou computador (via largura da janela) e
// escolhe a foto certa entre as duas que o organizador carregou. Se só uma
// foi carregada, usa essa em qualquer dispositivo.
// ── Escolhe a foto certa (mobile/desktop) consoante a largura do ecrã ──────
// Função genérica reutilizada para a tela de abertura, a foto de capa do
// Save the Date, e a foto de fundo do convite. Se só uma variante foi
// carregada, usa essa em qualquer dispositivo; "legacyUrl" é o campo antigo
// (de antes de existirem variantes mobile/desktop), usado como último recurso
// para eventos criados antes desta funcionalidade existir.
function _pickPhotoForDevice(mobileUrl, desktopUrl, legacyUrl) {
  const isMobile = window.innerWidth < 768;
  if (isMobile) return mobileUrl || desktopUrl || legacyUrl || null;
  return desktopUrl || mobileUrl || legacyUrl || null;
}

function _pickIntroPhotoForDevice(ev) {
  return _pickPhotoForDevice(ev.std_intro_photo_mobile_url, ev.std_intro_photo_desktop_url, ev.std_intro_photo_url);
}

function _buildIntroScreenHtml(ev, evColor, screenId) {
  const photoUrl = _pickIntroPhotoForDevice(ev);
  if (!photoUrl) return '';
  return `
    <div id="${screenId}" class="std-intro-open-btn" style="position:fixed;inset:0;z-index:9500;cursor:pointer;background:#0f172a">
      <div style="position:absolute;inset:0;background:url('${photoUrl}') center/cover no-repeat"></div>
      <div style="position:absolute;inset:0;background:rgba(0,0,0,0.18)"></div>
    </div>`;
}

// Liga o clique em qualquer ponto da tela de abertura: desbloqueia o áudio
// (HTML5 e YouTube) e remove a própria tela, revelando o conteúdo por trás.
// Não há texto nem botão — a foto inteira é o convite a clicar.
function _wireIntroScreenButton(screenId, onOpen) {
  const screen = document.getElementById(screenId);
  if (!screen) return;
  screen.onclick = () => {
    // Fade out suavemente em vez de remover de imediato — isto disfarça
    // qualquer instante em que o conteúdo por trás ainda esteja a desenhar
    // (imagem de capa a carregar, etc.), evitando um "salto" visual brusco.
    screen.style.transition = 'opacity 0.35s ease';
    screen.style.opacity = '0';
    setTimeout(() => screen.remove(), 350);

    const audio = document.getElementById('guest-audio');
    if (audio && audio.src) { audio.muted = false; audio.play().then(() => setMusicPlayingUI(true)).catch(() => {}); }
    const ytFrame = document.getElementById('yt-music-frame');
    if (ytFrame && ytFrame.src) {
      let att = 0;
      const cmd = () => {
        att++;
        try {
          if (ytFrame.contentWindow) {
            ytFrame.contentWindow.postMessage(JSON.stringify({event:'command',func:'unMute',args:[]}), '*');
            ytFrame.contentWindow.postMessage(JSON.stringify({event:'command',func:'playVideo',args:[]}), '*');
            ytFrame.dataset.playing = '1';
            setMusicPlayingUI(true);
          }
        } catch(e) {}
        if (att < 4) setTimeout(cmd, 600);
      };
      setTimeout(cmd, 300);
    }
    if (typeof onOpen === 'function') onOpen();
  };
}

function _buildStdDateBlock(eventDateLabel, evColor, style) {
  if (!eventDateLabel) return '';
  style = style || 'card';

  if (style === 'minimal') {
    return `
      <div style="margin-bottom:1.1rem;text-align:center">
        <p style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;color:${evColor};opacity:0.6;font-weight:700;margin-bottom:0.15rem">Data do Evento</p>
        <p style="font-size:1rem;font-weight:700;color:#1e293b">${eventDateLabel}</p>
      </div>`;
  }

  if (style === 'bignum') {
    // Extract day number and rest of the label (e.g. "23 de Setembro de 2026")
    const dayMatch = eventDateLabel.match(/^(\d{1,2})\s+(.*)$/);
    const day = dayMatch ? dayMatch[1] : '';
    const rest = dayMatch ? dayMatch[2] : eventDateLabel;
    return `
      <div style="margin-bottom:1.1rem;display:flex;align-items:center;gap:0.75rem;background:${evColor}0d;border-radius:0.85rem;padding:0.6rem 1.25rem">
        <span style="font-size:2.1rem;font-weight:900;color:${evColor};line-height:1">${day}</span>
        <div style="text-align:left">
          <p style="font-size:0.58rem;text-transform:uppercase;letter-spacing:0.1em;color:${evColor};opacity:0.65;font-weight:700">Data do Evento</p>
          <p style="font-size:0.8rem;font-weight:700;color:#1e293b">${rest}</p>
        </div>
      </div>`;
  }

  // Style: CARD (default) — original look, kept as-is
  return `
    <div style="background:${evColor}13;border-radius:0.75rem;padding:0.45rem 1.5rem;margin-bottom:1.1rem;display:inline-block">
      <p style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;color:${evColor};opacity:0.65;font-weight:700;margin-bottom:0.1rem">Data do Evento</p>
      <p style="font-size:0.95rem;font-weight:800;color:${evColor}">${eventDateLabel}</p>
    </div>`;
}

function renderSaveTheDateScreen(ev, decision) {
  const evColor = ev.event_color || '#007f9f';
  const invertNames = _yesOrTrue(ev.invert_names);
  let groom = ev.groom_name || ''; let bride = ev.bride_name || '';
  if (invertNames && groom && bride) { [groom, bride] = [bride, groom]; }
  const coupleNames = (groom || bride)
    ? `${escapeHTML(groom)}${groom && bride ? ' &amp; ' : ''}${escapeHTML(bride)}` : '';

  const stdTitle    = ev.std_title    || 'Save the Date';
  const stdSubtitle = ev.std_subtitle || 'Nosso Casamento';
  const nameFont    = ev.std_font_family || ev.custom_font_family || null;
  const nameSize    = parseFloat(ev.std_name_size) || 2.4;
  const titleSize   = parseFloat(ev.std_title_size) || 0.78;
  const rsvpAllowed = ev.rsvp_enabled !== false;
  // Cover photo: ONLY the dedicated Save the Date cover. Never falls back to
  // the invite's own background photo — the organiser must upload one
  // specifically for this screen if they want a cover here at all.
  // Escolhe a variante mobile ou desktop consoante o ecrã do visitante.
  const coverUrl    = _pickPhotoForDevice(ev.std_cover_mobile_url, ev.std_cover_desktop_url, ev.std_cover_url);
  const showCover   = ev.std_show_cover !== false && !!coverUrl;

  const parseDateSafe = (str) => {
    if (!str) return null;
    const s = String(str).trim();
    let d;
    const pt = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (pt) d = new Date(`${pt[3]}-${pt[2].padStart(2,'0')}-${pt[1].padStart(2,'0')}T23:59:59`);
    else d = new Date(s.includes('T') ? s : s + 'T23:59:59');
    if (isNaN(d.getTime())) return null;
    const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    return { date: d, label: `${String(d.getDate()).padStart(2,'0')} de ${months[d.getMonth()]} de ${d.getFullYear()}` };
  };

  const eventDateParsed = parseDateSafe(ev.date);
  const deadlineParsed  = parseDateSafe(ev.confirm_by_date);

  // If we have a separate RSVP deadline AND it differs from the event date, use it.
  // If the deadline IS the event date (or not set), still show a countdown but to the
  // event date, with a different label. Always show something useful.
  const deadlineIsEventDate = deadlineParsed && eventDateParsed &&
    Math.abs(deadlineParsed.date - eventDateParsed.date) < 86400000; // within 1 day
  const hasRealDeadline = deadlineParsed && !deadlineIsEventDate;

  const countdownTarget = deadlineParsed || eventDateParsed; // always show countdown
  const eventDateLabel  = eventDateParsed ? eventDateParsed.label : null;
  const deadlineLabel   = hasRealDeadline ? `Confirmar até ${deadlineParsed.label}` : null;

  // Diagnostic: log what data actually arrived so debugging is easy
  dlog('🔖 Save the Date — dados:', {
    std_cover_url_completo: coverUrl,
    std_cover_url_comprimento: coverUrl ? coverUrl.length : 0,
    bg_url: ev.bg_url ? '✓' : '✗',
    confirm_by_date: ev.confirm_by_date || '✗ null',
    date: ev.date,
    hasRealDeadline,
    countdownTo: countdownTarget?.label || 'nada',
  });

  let fontFaceCSS = '';
  if (nameFont) {
    const fd = (Store.availableFonts||[]).find(f=>f.name===nameFont);
    if (fd) fontFaceCSS = `@font-face{font-family:'${nameFont}';src:url('${fd.url}');font-display:swap}`;
  }

  if (typeof window._stdRestoreMusicPlayer === 'function') {
    window._stdRestoreMusicPlayer(); window._stdRestoreMusicPlayer = null;
  }
  document.getElementById('std-screen-overlay')?.remove();

  const eventIdForRsvp = ev.id || Store.currentEventId;
  const alreadyConfirmed = (() => {
    const c = rsvpCheckConfirmed(eventIdForRsvp);
    return c && c.attending === true;
  })();

  const rsvpBtnHtml = rsvpAllowed ? `
    <button id="std-rsvp-btn" class="std-rsvp-btn-anim" style="background:${alreadyConfirmed?'#16a34a':evColor};color:#fff;border:none;border-radius:999px;padding:0.9rem 2.4rem;font-weight:800;font-size:0.95rem;cursor:pointer;box-shadow:0 4px 16px ${alreadyConfirmed?'#16a34a':evColor}55;display:inline-flex;align-items:center;gap:0.5rem;font-family:'Quicksand',sans-serif">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${alreadyConfirmed?'<path d="M20 6 9 17l-5-5"/>':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'}</svg>
      <span id="std-rsvp-btn-label">${alreadyConfirmed?'Presença Confirmada':'Confirmar Presença'}</span>
    </button>` : '';

  const introEnabled = (ev.std_intro_enabled === true || ev.std_intro_enabled === 'true') && !!_pickIntroPhotoForDevice(ev);

  const overlay = document.createElement('div');
  overlay.id = 'std-screen-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;overflow-y:auto;background:#fdfaf6;display:flex;flex-direction:column;align-items:center';

  overlay.innerHTML = `
    <style>${fontFaceCSS}</style>
    ${introEnabled ? _buildIntroScreenHtml(ev, evColor, 'std-intro-screen') : ''}
    ${showCover ? `
    <div id="std-cover-wrap" class="std-cover-anim" style="position:relative;width:100%;height:42vh;max-height:380px;overflow:hidden;background:#1a1a2e;flex-shrink:0">
      <img id="std-cover-img" src="${coverUrl}" loading="eager" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block"
        onerror="console.error('❌ Falha ao carregar a foto de capa do Save the Date. URL tentado:', this.src); this.style.display='none';"
        onload="dlog('✅ Foto de capa do Save the Date carregada com sucesso:', this.src);">
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.15) 0%,rgba(0,0,0,0.35) 100%)"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:0 1rem">
        <p style="font-size:${titleSize}rem;letter-spacing:0.3em;text-transform:uppercase;font-weight:800;color:#fff;font-family:'Quicksand',sans-serif;text-shadow:0 2px 12px rgba(0,0,0,0.5);margin:0">${escapeHTML(stdTitle)}</p>
      </div>
    </div>` : `<div style="height:2.5rem;flex-shrink:0"></div>`}
    <div id="std-main-content" style="position:relative;z-index:2;max-width:440px;width:100%;text-align:center;color:#1e293b;padding:1rem 1.5rem 2.5rem;flex:1;display:flex;flex-direction:column;align-items:center">
      ${!showCover ? `<p class="std-anim std-anim-1" style="font-size:${titleSize}rem;letter-spacing:0.25em;text-transform:uppercase;font-weight:800;color:${evColor};font-family:'Quicksand',sans-serif;margin-bottom:0.5rem">${escapeHTML(stdTitle)}</p>` : ''}
      ${coupleNames ? `<h2 class="std-anim std-anim-2" style="font-family:${nameFont?`'${nameFont}',`:''}var(--event-font,'Playfair Display',serif);font-size:clamp(1.4rem,7vw,${nameSize}rem);line-height:1.2;margin-bottom:0.3rem;color:${evColor};padding:0 0.5rem">${coupleNames}</h2>` : ''}
      <p class="std-anim std-anim-3" style="font-size:0.9rem;font-weight:500;color:#6b7280;font-family:'Quicksand',sans-serif;margin-bottom:1.25rem">${escapeHTML(stdSubtitle)}</p>
      <div class="std-anim std-anim-4">${_buildStdDateBlock(eventDateLabel, evColor, ev.std_date_style)}</div>
      <div id="std-countdown-wrap" class="std-anim std-anim-5" style="width:100%;margin-bottom:1.1rem">
        <p id="std-countdown-label" style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.1em;opacity:0.5;margin-bottom:0.4rem;font-weight:700">A calcular...</p>
        <div style="display:flex;gap:0.4rem;justify-content:center">
          <div style="background:${evColor}12;border-radius:0.6rem;padding:0.5rem 0.2rem;flex:1;max-width:66px"><div id="std-days" style="font-size:1.15rem;font-weight:900;color:${evColor}">--</div><div style="font-size:0.55rem;opacity:0.55;text-transform:uppercase">Dias</div></div>
          <div style="background:${evColor}12;border-radius:0.6rem;padding:0.5rem 0.2rem;flex:1;max-width:66px"><div id="std-hours" style="font-size:1.15rem;font-weight:900;color:${evColor}">--</div><div style="font-size:0.55rem;opacity:0.55;text-transform:uppercase">Horas</div></div>
          <div style="background:${evColor}12;border-radius:0.6rem;padding:0.5rem 0.2rem;flex:1;max-width:66px"><div id="std-mins" style="font-size:1.15rem;font-weight:900;color:${evColor}">--</div><div style="font-size:0.55rem;opacity:0.55;text-transform:uppercase">Min</div></div>
          <div style="background:${evColor}12;border-radius:0.6rem;padding:0.5rem 0.2rem;flex:1;max-width:66px"><div id="std-secs" style="font-size:1.15rem;font-weight:900;color:${evColor}">--</div><div style="font-size:0.55rem;opacity:0.55;text-transform:uppercase">Seg</div></div>
        </div>
      </div>
      <p id="std-rsvp-status-text" class="std-anim std-anim-6" style="font-size:0.82rem;color:#16a34a;margin-bottom:0.7rem;font-weight:600;min-height:1.1em">${alreadyConfirmed?'Obrigado por confirmar! Já contamos consigo. 🎉':''}</p>
      <div class="std-anim std-anim-6">${rsvpBtnHtml}</div>
      ${countdownTarget ? `<p class="std-anim std-anim-7" style="font-size:0.73rem;color:#9ca3af;margin-top:0.5rem;font-weight:500">Confirmar até ${countdownTarget.label}</p>` : ''}
      ${(ev.std_show_iban === true && ev.iban_number) ? `
      <div class="std-anim std-anim-7" style="background:#fff;border-radius:0.85rem;padding:1rem 1.1rem;margin-top:1.5rem;max-width:320px;width:100%;border:1.5px solid color-mix(in srgb,${evColor} 22%,transparent);text-align:center">
        ${ev.iban_message ? ev.iban_message.split('\n').map(l => `<p style="font-size:0.82rem;font-weight:700;color:#1e293b;margin-bottom:0.4rem;line-height:1.4">${escapeHTML(l)}</p>`).join('') : `<p style="font-size:0.88rem;font-weight:800;color:${evColor};margin-bottom:0.6rem">Gostaria de nos presentear?</p>`}
        <div style="background:#f8fafc;border-radius:0.6rem;padding:0.5rem 0.7rem;margin-bottom:0.5rem;margin-top:0.4rem">
          <p style="font-size:0.62rem;color:#94a3b8;margin-bottom:0.15rem">IBAN</p>
          <p style="font-size:0.78rem;font-weight:700;color:#374151;word-break:break-all">${escapeHTML(ev.iban_number)}</p>
        </div>
        ${ev.iban_holder ? `<p style="font-size:0.7rem;color:#9ca3af;margin-bottom:0.5rem">Titular: ${escapeHTML(ev.iban_holder)}</p>` : ''}
        <button onclick="copyIban('${escapeHTML(ev.iban_number)}')" style="background:${evColor}14;color:${evColor};border:none;border-radius:999px;padding:0.45rem 1rem;font-size:0.75rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:0.35rem">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copiar IBAN
        </button>
        ${ev.iban_footer ? `<p style="font-size:0.65rem;color:#9ca3af;margin-top:0.6rem;font-style:italic">${escapeHTML(ev.iban_footer)}</p>` : ''}
      </div>` : ''}
    </div>`;

  document.body.appendChild(overlay);

  // Música removida do Save the Date a pedido explícito do utilizador —
  // o leitor só aparece no convite completo, nunca nesta tela.
  window._stdRestoreMusicPlayer = null;

  if (introEnabled) {
    _wireIntroScreenButton('std-intro-screen');
  }

  const rsvpBtn = document.getElementById('std-rsvp-btn');
  if (rsvpBtn) rsvpBtn.onclick = () => { if (typeof openRsvpDrawer==='function') openRsvpDrawer(); };

  if (window._stdCountdownInterval) clearInterval(window._stdCountdownInterval);
  const labelEl = document.getElementById('std-countdown-label');
  if (countdownTarget) {
    // This screen's countdown is always about the RSVP confirmation deadline —
    // never "Grande Dia"/event-day language, even when no separate deadline
    // was set and the countdown falls back to the event date itself.
    const countdownLabel = 'Prazo para Confirmar Presença';
    const expiredLabel   = 'Prazo de confirmação encerrado';
    if (labelEl) labelEl.textContent = countdownLabel;
    const target = countdownTarget.date;
    const tick = () => {
      const diff = target - new Date();
      const set = (id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
      if (diff<=0) {
        clearInterval(window._stdCountdownInterval);
        set('std-days',0);set('std-hours',0);set('std-mins',0);set('std-secs',0);
        if(labelEl)labelEl.textContent = expiredLabel;
        return;
      }
      set('std-days',  Math.floor(diff/86400000));
      set('std-hours', Math.floor((diff%86400000)/3600000));
      set('std-mins',  Math.floor((diff%3600000)/60000));
      set('std-secs',  Math.floor((diff%60000)/1000));
    };
    tick();
    window._stdCountdownInterval = setInterval(tick,1000);
  } else {
    // No date at all — hide the countdown
    if(labelEl)labelEl.textContent='';
    const wrap=document.getElementById('std-countdown-wrap');
    if(wrap)wrap.style.display='none';
  }

  window._stdCheckUnlockAfterRsvp = () => {
    const confirmed = rsvpCheckConfirmed(eventIdForRsvp);
    const yes = confirmed && confirmed.attending===true;
    if (decision.reason==='on_confirmation' && yes) {
      if(window._stdCountdownInterval)clearInterval(window._stdCountdownInterval);
      if(typeof window._stdRestoreMusicPlayer==='function'){window._stdRestoreMusicPlayer();window._stdRestoreMusicPlayer=null;}
      // Fade out puro — a tela esvanece-se completamente, dando espaço
      // ao convite completo por trás, sem qualquer deslocamento.
      overlay.style.transition = 'opacity 0.5s ease';
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        renderGuestView();
      }, 480);
      return;
    }
    if (yes) {
      const btn=document.getElementById('std-rsvp-btn');
      if(btn){btn.style.background='#16a34a';btn.style.boxShadow='0 4px 16px #16a34a55';btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg><span>Presença Confirmada</span>';}
      const st=document.getElementById('std-rsvp-status-text');
      if(st){st.textContent='Obrigado por confirmar! Já contamos consigo. 🎉';st.style.color='#16a34a';}
    }
  };
}
