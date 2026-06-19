// ===================== TOAST =====================
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast-msg';
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 2600);
}


// ===================== HELPERS =====================
function togglePassVisibility(inputId, btn) {
  const inp = document.getElementById(inputId);
  const isPass = inp.type === 'password';
  inp.type = isPass ? 'text' : 'password';
  btn.innerHTML = isPass ? '<i data-lucide="eye-off" class="w-5 h-5"></i>' : '<i data-lucide="eye" class="w-5 h-5"></i>';
  lucide.createIcons();
}

function toggleSwitch(el, extraId) {
  el.classList.toggle('active');
  if (extraId) {
    document.getElementById(extraId).classList.toggle('hidden', !el.classList.contains('active'));
  }
}

function previewCover(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('cover-img');
    img.src = e.target.result;
    img.classList.remove('hidden');
    document.getElementById('cover-placeholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function uid() { 
  // ✅ Gerar ID aleatório com 8 caracteres (formato: F6KK7LVA, TE0IYVAT, etc)
  // Caracteres disponíveis: letras maiúsculas + números (mais fácil de ler)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function formatDate(d) {
  if (!d) return '';
  const parts = d.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function parseDateTimeValue(value, options = {}) {
  if (!value) return null;
  const clean = String(value).trim();
  if (!clean) return null;

  const endOfDay = options.endOfDay === true;
  const defaultTime = endOfDay ? '23:59:59' : (options.defaultTime || '00:00:00');

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date(`${clean}T${defaultTime}`);
  }

  const normalized = clean.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    return new Date(`${normalized}:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return new Date(normalized);
  }

  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getEventStartAt(eventData) {
  if (!eventData || !eventData.date) return null;
  return parseDateTimeValue(`${eventData.date} ${eventData.time || '00:00'}`);
}

function getRSVPDeadlineAt(eventData) {
  if (!eventData) return null;
  const rawDeadline = eventData.confirm_by_date || eventData.deadline || eventData.date;
  if (!rawDeadline) return null;
  return parseDateTimeValue(rawDeadline, { endOfDay: !String(rawDeadline).trim().includes(' ') });
}

function getRSVPCloseInfo(eventData) {
  const now = new Date();
  const eventStartAt = getEventStartAt(eventData);
  const deadlineAt = getRSVPDeadlineAt(eventData);

  let cutoffAt = deadlineAt || eventStartAt;
  if (deadlineAt && eventStartAt && eventStartAt < deadlineAt) {
    cutoffAt = eventStartAt;
  }

  const closedByDeadline = deadlineAt ? now > deadlineAt : false;
  const closedByEvent = eventStartAt ? now > eventStartAt : false;
  const closed = closedByDeadline || closedByEvent;
  const reason = closedByEvent ? 'event' : 'deadline';

  return {
    closed,
    reason,
    cutoffAt,
    deadlineAt,
    eventStartAt
  };
}

function getRSVPClosedMessage(eventData) {
  const closeInfo = getRSVPCloseInfo(eventData);
  if (!closeInfo.closed) return '';
  if (closeInfo.reason === 'event') {
    return 'As confirmações estão encerradas porque a data do evento já passou.';
  }
  return 'As confirmações estão encerradas porque o prazo limite já foi atingido.';
}

// ✅ Formatar convidado com acompanhantes no formato "Nome e Acompanhante"
function formatGuestWithCompanions(conf) {
  if (!conf || !conf.name) return '';
  
  // Se não tem acompanhantes, retornar apenas o nome
  if (!conf.companions || conf.companions.length === 0) {
    return conf.name;
  }
  
  // ✅ CRÍTICO: Conectar nome + acompanhantes com "e"
  // Exemplo: "Araújo Cataca e Maria Quissola"
  const allNames = [conf.name, ...conf.companions];
  
  // Juntar com ", " até a última, depois usar " e "
  if (allNames.length === 2) {
    return allNames.join(' e ');
  } else {
    const lastPerson = allNames.pop();
    return allNames.join(', ') + ' e ' + lastPerson;
  }
}

function normalizeGuestName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function isSideSelectionEnabled(eventData) {
  return eventData && (
    eventData.allowSides === true ||
    eventData.allow_sides === true ||
    String(eventData.allow_sides).toLowerCase() === 'yes'
  );
}

function getEventSideNames(eventData) {
  const side1 = eventData && eventData.side1_name && String(eventData.side1_name).trim()
    ? String(eventData.side1_name).trim()
    : 'Grupo 1';
  const side2 = eventData && eventData.side2_name && String(eventData.side2_name).trim()
    ? String(eventData.side2_name).trim()
    : 'Grupo 2';
  return { side1, side2 };
}

function getSideBucket(sideValue, eventData) {
  const value = String(sideValue || '').trim().toLowerCase();
  const names = getEventSideNames(eventData);
  if (['noivo', 'side1', names.side1.toLowerCase()].includes(value)) return 'side1';
  if (['noiva', 'side2', names.side2.toLowerCase()].includes(value)) return 'side2';
  return 'other';
}

function getSideLabel(sideValue, eventData) {
  if (!isSideSelectionEnabled(eventData)) return '';
  const names = getEventSideNames(eventData);
  const bucket = getSideBucket(sideValue, eventData);
  if (bucket === 'side1') return names.side1;
  if (bucket === 'side2') return names.side2;
  return 'Sem grupo definido';
}

function validateDeadlineDate() {
  const eventDateInput = document.getElementById('evt-date');
  const deadlineInput = document.getElementById('evt-deadline');
  
  const eventDate = eventDateInput.value;
  const deadline = deadlineInput.value;
  
  if (!eventDate || !deadline) return;
  
  // Comparar datas: deadline DEVE ser ANTES do evento
  if (deadline >= eventDate) {
    toast(' Data limite deve ser ANTES do dia do evento!');
    deadlineInput.value = '';
    return false;
  }
  
  return true;
}


// ===================== TOPBAR & DRAWER =====================
function showTopbar(user) {
  const bar = document.getElementById('app-topbar');
  if (bar) bar.classList.add('visible');
  const tu = document.getElementById('topbar-username');
  if (tu) tu.textContent = user ? (user.phone || user.id || '—') : '—';
  const du = document.getElementById('drawer-username');
  if (du) du.textContent = user ? (user.phone || user.id || '—') : '—';
  const dr = document.getElementById('drawer-role');
  if (dr) dr.textContent = user && user.role === 'admin' ? 'Administrador do Sistema' : 'Conta Standard';
  buildDrawerNav(user);
}
function hideTopbar() {
  const bar = document.getElementById('app-topbar');
  if (bar) bar.classList.remove('visible');
  closeDrawer();
}
function toggleDrawer() {
  const d = document.getElementById('side-drawer');
  const o = document.getElementById('drawer-overlay');
  const btn = document.getElementById('hamburger-btn');
  const isOpen = d.classList.contains('open');
  d.classList.toggle('open', !isOpen);
  o.classList.toggle('open', !isOpen);
  btn.classList.toggle('open', !isOpen);
}
function closeDrawer() {
  document.getElementById('side-drawer').classList.remove('open');
  document.getElementById('drawer-overlay').classList.remove('open');
  const btn = document.getElementById('hamburger-btn');
  if (btn) btn.classList.remove('open');
}
function buildDrawerNav(user) {
  const nav = document.getElementById('drawer-nav');
  if (!nav || !user) return;
  const isAdmin = user.role === 'admin';

  // Count pending accounts for badge
  const pendingCount = isAdmin ? (Store.users || []).filter(u => u.status === 'pending').length : 0;
  const pendingBadge = pendingCount > 0
    ? `<span style="background:#f59e0b;color:#fff;font-size:0.68rem;font-weight:700;border-radius:999px;padding:1px 7px;margin-left:auto;">${pendingCount}</span>`
    : '';

  const items = isAdmin ? [
    { icon: 'layout-dashboard', label: 'Painel Admin',        action: "Router.go('admin'); closeDrawer();" },
    { icon: 'user-check',       label: 'Contas por Aprovar',  action: "openPendingAccounts(); closeDrawer();", badge: pendingBadge },
    { icon: 'calendar',         label: 'Todos os Eventos',    action: "Router.go('admin'); closeDrawer();" },
    { icon: 'user',             label: 'Gerir como Utilizador', action: "showAdminUserPicker(); closeDrawer();" },
    { icon: 'settings',         label: 'Definicoes',          action: "Router.go('settings'); closeDrawer();" },
    { icon: 'hard-drive',       label: 'Ficheiros Storage',   action: "openStorageManager(); closeDrawer();" },
  ] : [
    { icon: 'calendar-check', label: 'Os Meus Eventos', action: "Router.go('dashboard'); closeDrawer();" },
    { icon: 'plus-circle',    label: 'Criar Evento',    action: "goToCreateEvent(); closeDrawer();" },
    { icon: 'search',         label: 'Buscar Evento',   action: "Router.go('home'); closeDrawer();" },
    { id:'drawer-btn-return-admin', hidden: true, icon:'arrow-left', label:'Voltar ao Admin', action:"backToAdminPanel(); closeDrawer();" },
  ];

  nav.innerHTML = items.map(it => `
    <button class="drawer-item${it.hidden?' hidden':''}" ${it.id?`id="${it.id}"`:''}
      onclick="${it.action}" style="border:none;display:flex;align-items:center;gap:0.9rem;padding:0.85rem 1.4rem;width:100%;background:none;cursor:pointer;color:#374151;font-weight:600;font-size:0.93rem;">
      <span class="di-icon"><i data-lucide="${it.icon}"></i></span>
      <span style="flex:1;text-align:left">${it.label}</span>
      ${it.badge || ''}
    </button>
  `).join('<div class="drawer-sep"></div>');
  lucide.createIcons();
}
function buildDashboardQuickGrid(user) {
  const isAdmin = user && user.role === 'admin';
  const grid = document.getElementById('dashboard-quick-grid');
  if (!grid) return;
  const items = isAdmin ? [
    { icon:'layout-dashboard', label:'Painel Admin', action:"Router.go('admin')" },
    { icon:'plus-circle',      label:'Criar Evento', action:"goToCreateEvent()" },
    { icon:'users',            label:'Utilizadores',  action:"Router.go('admin')" },
    { icon:'search',           label:'Buscar Evento', action:"Router.go('home')" },
  ] : [
    { icon:'plus-circle',      label:'Criar Evento',  action:"goToCreateEvent()" },
    { icon:'search',           label:'Buscar Evento', action:"Router.go('home')" },
    { icon:'calendar',         label:'Meus Eventos',  action:"Router.go('dashboard')" },
  ];
  grid.innerHTML = items.map(it => `
    <button class="quick-card" onclick="${it.action}">
      <div class="qc-icon"><i data-lucide="${it.icon}"></i></div>
      <div class="qc-label">${it.label}</div>
    </button>`).join('');
  lucide.createIcons();
}
function buildAdminQuickGrid() {
  const grid = document.getElementById('admin-quick-grid');
  if (!grid) return;
  const pendingCount = (Store.users || []).filter(u => u.status === 'pending').length;
  const items = [
    { icon:'user-check',   label:'Por Aprovar',     action:"openPendingAccounts()", badge: pendingCount },
    { icon:'user-plus',    label:'Criar Conta',     action:"openCreateUserModal()" },
    { icon:'user',         label:'Gerir Utilizador',action:"showAdminUserPicker()" },
    { icon:'calendar',     label:'Eventos',          action:"document.getElementById('admin-stats').scrollIntoView({behavior:'smooth'})" },
    { icon:'hard-drive',   label:'Ficheiros',        action:"openStorageManager()" },
    { icon:'type',         label:'Fontes',           action:"Router.go('settings')" },
    { icon:'message-square',label:'FAQ',             action:"openFaqEditor()" },
    { icon:'star',         label:'Evento Exemplo',   action:"Router.go('settings')" },
    { icon:'settings',     label:'Definicoes',       action:"Router.go('settings')" },
    { icon:'package',      label:'Pacotes',          action:"openPackageEditor()" },
    { icon:'send',         label:'Link Cliente',     action:"openIntakeLinkPicker()" },
    { icon:'megaphone',    label:'Avisos Site',      action:"openSiteNoticesManager()" },
    { icon:'star',         label:'Avaliações',       action:"openReviewsManager()" },
    { icon:'shopping-bag', label:'Encomendas',       action:"openOrdersManager()" },
    { icon:'bell',         label:'Notificar Todos',  action:"openSendNotificationModal()" },
    { icon:'bar-chart-3',  label:'Análise de Acessos', action:"openAnalyticsPanel()" },
    { icon:'file-text',  label:'Política e Termos', action:"openLegalPagesEditor()" },
    { icon:'clock',  label:'Prazo de Entrega', action:"adminEditDeliveryText()" },
  ];
  grid.innerHTML = items.map(it => `
    <button class="quick-card" onclick="${it.action}" style="position:relative">
      ${it.badge > 0 ? `<span style="position:absolute;top:8px;right:8px;background:#f59e0b;color:#fff;font-size:0.65rem;font-weight:700;border-radius:999px;padding:1px 6px;line-height:1.4">${it.badge}</span>` : ''}
      <div class="qc-icon"><i data-lucide="${it.icon}"></i></div>
      <div class="qc-label">${it.label}</div>
    </button>`).join('');
  lucide.createIcons();
}


// ===================== RSVP DRAWER =====================
// ── RSVP Drawer state machine ──────────────────────────────────────────
// States: FORM | SUCCESS
// Transitions: open → check storage → FORM or SUCCESS
//              submit → save → SUCCESS
//              editGuestResponse → clear storage → FORM

// Check if current device guest has confirmed — first check in-memory, then Supabase
function _rsvpGetConfirmedName(eventId) {
  if (!eventId) return null;
  // In-memory cache for current session (avoids repeated Supabase hits)
  return Store._rsvpConfirmedName?.[eventId] || null;
}

async function _rsvpCheckConfirmedFromSupabase(eventId) {
  if (!eventId) return null;
  // Already checked this session
  if (Store._rsvpConfirmedName?.[eventId]) return Store._rsvpConfirmedName[eventId];
  // Check guestEventData confirmations (already loaded from Supabase)
  const guestName = Store._deviceGuestName?.[eventId];
  if (!guestName) return null;
  // Verify this name actually exists in confirmations
  const ev = Store.guestEventData;
  if (ev && ev.confirmations) {
    const found = ev.confirmations.find(c => c.name && c.name.toLowerCase() === guestName.toLowerCase());
    if (found) {
      if (!Store._rsvpConfirmedName) Store._rsvpConfirmedName = {};
      Store._rsvpConfirmedName[eventId] = guestName;
      return guestName;
    }
  }
  // Try Supabase directly
  try {
    const rows = await supabaseRequest(`rsvps?event_id=eq.${eventId}&guest_name=eq.${encodeURIComponent(guestName)}&select=guest_name&limit=1`);
    if (rows && rows[0]) {
      if (!Store._rsvpConfirmedName) Store._rsvpConfirmedName = {};
      Store._rsvpConfirmedName[eventId] = rows[0].guest_name;
      return rows[0].guest_name;
    }
  } catch(e) {}
  return null;
}

function _rsvpSetState(state) {
  // state: 'FORM' | 'SUCCESS'
  const headerEl  = document.getElementById('rsvp-drawer-header');
  const formEl    = document.getElementById('rsvp-form');
  const successEl = document.getElementById('rsvp-success');
  const promoEl   = document.getElementById('rsvp-promo-banner');
  const closedEl  = document.getElementById('rsvp-closed-notice');
  if (!formEl || !successEl) return;

  if (state === 'SUCCESS') {
    if (headerEl)  headerEl.style.display  = 'none';   // hide title+X
    formEl.classList.add('hidden');
    successEl.classList.remove('hidden');
    if (promoEl)  promoEl.classList.remove('hidden');
    if (closedEl) closedEl.classList.add('hidden');
  } else { // FORM
    if (headerEl)  headerEl.style.display  = '';       // show title+X
    formEl.classList.remove('hidden');
    successEl.classList.add('hidden');
    if (promoEl)  promoEl.classList.add('hidden');
  }
  lucide.createIcons();
}

async function openRsvpDrawer() {
  const drawer = document.getElementById('rsvp-drawer');
  if (!drawer) return;
  drawer.classList.add('open');
  document.body.style.overflow = 'hidden';

  const eventId = Store.currentEventId || (Store.guestEventData && Store.guestEventData.id);
  const confirmed = rsvpCheckConfirmed(eventId);
  _rsvpRender(confirmed ? 'SUCCESS' : 'FORM');
}
function closeRsvpDrawer() {
  const drawer = document.getElementById('rsvp-drawer');
  if (drawer) {
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function startDeadlineCountdown(deadlineStr) {
  if (window._deadlineInterval) clearInterval(window._deadlineInterval);
  const container = document.getElementById('rsvp-deadline-countdown');
  if (!container) return;
  if (!deadlineStr || !String(deadlineStr).trim()) return;
  function update() {
    // Robust date parsing — handle "YYYY-MM-DD", "YYYY-MM-DD HH:MM", "YYYY-MM-DDTHH:MM"
    const clean = String(deadlineStr).trim().replace(' ', 'T');
    const parts = clean.split('T');
    const datePart = parts[0];
    const timePart = parts[1] ? parts[1].split(':').slice(0,2).join(':') : '23:59';
    const target = new Date(datePart + 'T' + timePart + ':00');
    if (!target || isNaN(target.getTime())) { container.style.display = 'none'; return; }
    const diff = target - new Date();
    if (diff <= 0) {
      container.style.display = 'none';
      clearInterval(window._deadlineInterval);
      return;
    }
    container.style.display = 'flex';
    const dEl = document.getElementById('rdl-days');
    const hEl = document.getElementById('rdl-hours');
    const mEl = document.getElementById('rdl-mins');
    const sEl = document.getElementById('rdl-secs');
    if (!dEl || !hEl || !mEl || !sEl) return;
    dEl.textContent = Math.floor(diff/86400000);
    hEl.textContent = Math.floor((diff%86400000)/3600000);
    mEl.textContent = Math.floor((diff%3600000)/60000);
    sEl.textContent = Math.floor((diff%60000)/1000);
  }
  update();
  window._deadlineInterval = setInterval(update, 1000);
}


// ===================== MUSIC PLAYER =====================
function extractYouTubeId(url) {
  const patterns = [
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

function setMusicPlayingUI(playing) {
  const icon = document.getElementById('music-play-icon');
  const eq   = document.getElementById('music-equalizer');
  const sub  = document.getElementById('music-sub-text');
  if (icon) { icon.setAttribute('data-lucide', playing ? 'pause' : 'play'); lucide.createIcons(); }
  if (eq)   eq.classList.toggle('paused', !playing);
  if (sub)  sub.textContent = playing ? 'A tocar' : 'Clique para tocar';

  // Also sync the floating circular button (used standalone in the Save the
  // Date screen, where the full player bar above doesn't exist)
  const floatBtn = document.getElementById('floating-music-btn');
  if (floatBtn) {
    const PLAY_ICON  = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    const PAUSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    const existingIcon = floatBtn.querySelector('svg');
    if (existingIcon) existingIcon.remove();
    const iconEl = document.createElement('div');
    iconEl.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    const ring = floatBtn.querySelector('.fmb-ring');
    if (ring) floatBtn.insertBefore(iconEl.firstChild, ring);
    else floatBtn.appendChild(iconEl.firstChild);
    floatBtn.classList.toggle('paused', !playing);
    floatBtn.setAttribute('title', playing ? 'Pausar música' : 'Tocar música');
  }
}

function toggleMusicPlayer() {
  const ytFrame = document.getElementById('yt-music-frame');
  const audio   = document.getElementById('guest-audio');

  if (ytFrame && ytFrame.src) {
    const isPlaying = ytFrame.dataset.playing === '1';
    ytFrame.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: isPlaying ? 'pauseVideo' : 'playVideo', args: [] }), '*'
    );
    ytFrame.dataset.playing = isPlaying ? '0' : '1';
    setMusicPlayingUI(!isPlaying);
    return;
  }

  if (audio && audio.src) {
    if (audio.paused) {
      audio.play().then(() => setMusicPlayingUI(true))
        .catch(() => toast('Não foi possível reproduzir. Verifique o link de áudio.'));
    } else {
      audio.pause();
      setMusicPlayingUI(false);
    }
  }
}

function startMusicAutoplay(ytId, audioSrc) {
  const icon = document.getElementById('music-play-icon');
  const eq   = document.getElementById('music-equalizer');
  const sub  = document.getElementById('music-sub-text');

  if (ytId) {
    let ytFrame = document.getElementById('yt-music-frame');
    if (!ytFrame) {
      ytFrame = document.createElement('iframe');
      ytFrame.id = 'yt-music-frame';
      ytFrame.style.cssText = 'display:none;width:0;height:0;position:absolute;pointer-events:none;';
      document.body.appendChild(ytFrame);
    }
    // autoplay=1: browser pode bloquear se não houver interacção prévia
    // Si bloqueado, o player fica pronto para o utilizador clicar
    ytFrame.allow = 'autoplay; encrypted-media';
    ytFrame.src = `https://www.youtube.com/embed/${ytId}?enablejsapi=1&autoplay=1&mute=0&rel=0&modestbranding=1&origin=${encodeURIComponent(window.location.origin)}`;
    ytFrame.dataset.playing = '1';
    // Optimista: assumir que está a tocar; se o browser bloquear o iframe não emite erro detectável
    setMusicPlayingUI(true);
    // YT iframe autoplay is often blocked on mobile — set up a gesture-based
    // unlock retry, same approach as the direct-audio path below. We can't
    // detect blocking directly (cross-origin iframe), so we proactively
    // re-send the play command on the first real user gesture regardless.
    let _ytUnlocked = false;
    const tryYtPlay = () => {
      if (_ytUnlocked) return;
      _ytUnlocked = true;
      try {
        if (ytFrame.contentWindow) {
          ytFrame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*');
          ytFrame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
        }
      } catch(e) {}
      _removeYtListeners();
    };
    function _removeYtListeners() {
      document.removeEventListener('touchstart', tryYtPlay);
      document.removeEventListener('pointerdown', tryYtPlay);
      document.removeEventListener('click', tryYtPlay);
    }
    document.addEventListener('touchstart', tryYtPlay, { passive: true });
    document.addEventListener('pointerdown', tryYtPlay, { passive: true });
    document.addEventListener('click', tryYtPlay);
    setTimeout(() => {
      // If user hasn't interacted, assume blocked and show play prompt
      if (sub && sub.textContent !== '') sub.textContent = 'Toca para ouvir';
    }, 2000);
  } else if (audioSrc) {
    const audio = document.getElementById('guest-audio');
    if (audio) {
      audio.src = audioSrc;
      audio.loop = true;
      audio.volume = 1.0;
      // NOTE: we deliberately do NOT start muted. The user explicitly requested
      // music never play muted under any circumstance. Browsers block
      // non-muted autoplay without a prior user gesture, so we try a direct
      // unmuted play() first; if blocked, we fall back to waiting for the
      // first real interaction (tap/scroll/click) to start it — at which
      // point it plays with full sound immediately, never silently.
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          setMusicPlayingUI(true);
        }).catch(() => {
          _startAudioFullyManual(audio, sub);
        });
      }
      return;
    }
  }
}

function _startAudioFullyManual(audio, sub) {
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      setMusicPlayingUI(true);
    }).catch(() => {
      // Browser blocked autoplay entirely (expected on most https hosts)
      setMusicPlayingUI(false);
      if (sub) sub.textContent = 'Toca para ouvir';

      // Pulse the music player to draw attention
      const playerEl = document.getElementById('guest-music-player');
      if (playerEl) {
        playerEl.style.animation = 'musicPulseAttention 1.2s ease-in-out 3';
        setTimeout(() => { if (playerEl) playerEl.style.animation = ''; }, 4000);
      }

      // Show floating button immediately (don't wait for scroll)
      const floatBtn = document.getElementById('floating-music-btn');
      if (floatBtn) floatBtn.classList.add('visible');

      // ── Mobile autoplay unlock ──
      // iOS Safari and most mobile browsers only honor audio.play() when
      // called synchronously inside a genuine user-gesture event handler.
      // 'scroll' events — even ones caused by a touch swipe — are NOT
      // trusted gestures on iOS, so relying on them silently fails. The
      // most reliable triggers are touchstart, pointerdown, and click,
      // all called synchronously the instant the event fires.
      let _played = false;
      const tryPlay = () => {
        if (_played) return;
        _played = true; // mark immediately to avoid double-firing across multiple listeners
        audio.play().then(() => {
          setMusicPlayingUI(true);
          const fb = document.getElementById('floating-music-btn');
          if (fb) fb.classList.remove('visible');
          _removeAllTryPlayListeners();
        }).catch(() => {
          _played = false; // allow retry on the next gesture if this one didn't work
        });
      };
      function _removeAllTryPlayListeners() {
        document.removeEventListener('touchstart', tryPlay);
        document.removeEventListener('pointerdown', tryPlay);
        document.removeEventListener('click', tryPlay);
      }
      document.addEventListener('touchstart', tryPlay, { passive: true });
      document.addEventListener('pointerdown', tryPlay, { passive: true });
      document.addEventListener('click', tryPlay);
    });
  }
}


// ===================== FLOATING MUSIC BTN =====================
function initFloatingMusicBtn() {
  const player  = document.getElementById('guest-music-player');
  const floatBtn = document.getElementById('floating-music-btn');
  if (!player || !floatBtn) return;

  const PLAY_ICON  = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  const PAUSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

  // Add spinner ring element
  if (!floatBtn.querySelector('.fmb-ring')) {
    const ring = document.createElement('div');
    ring.className = 'fmb-ring';
    floatBtn.appendChild(ring);
  }

  function syncFloatBtn(isPlaying) {
    // Remove old icon, keep ring
    const existingIcon = floatBtn.querySelector('svg');
    if (existingIcon) existingIcon.remove();
    const iconEl = document.createElement('div');
    iconEl.innerHTML = isPlaying ? PAUSE_ICON : PLAY_ICON;
    floatBtn.insertBefore(iconEl.firstChild, floatBtn.querySelector('.fmb-ring'));
    floatBtn.classList.toggle('paused', !isPlaying);
    floatBtn.setAttribute('title', isPlaying ? 'Pausar música' : 'Tocar música');
  }
  // Set initial state (play icon = not playing yet)
  syncFloatBtn(false);

  // Observe hero player visibility
  if ('IntersectionObserver' in window) {
    const heroObs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        floatBtn.classList.remove('visible');
      } else {
        floatBtn.classList.add('visible');
        // Sync state
        const ytFrame = document.getElementById('yt-music-frame');
        const audio   = document.getElementById('guest-audio');
        const isPlaying = (ytFrame && ytFrame.dataset.playing === '1') ||
                          (audio && !audio.paused && audio.src);
        syncFloatBtn(isPlaying);
      }
    }, { threshold: 0.1 });
    heroObs.observe(player);
  }
}


function openLightbox(src) {
  // Collect all gallery URLs (use data-url if set, otherwise img.src)
  window._galleryImages = Array.from(document.querySelectorAll('.gallery-item img'))
    .filter(i => !i.closest('.gallery-item').style.display.includes('none'))
    .map(i => i.dataset.url || i.src)
    .filter(u => u && u.startsWith('http'));
  window._galleryIndex = window._galleryImages.indexOf(src);
  if (window._galleryIndex < 0) {
    window._galleryImages = [src];
    window._galleryIndex = 0;
  }
  _showLightboxAt(window._galleryIndex);
}
function _showLightboxAt(idx) {
  const existing = document.getElementById('_lb');
  if (existing) existing.remove();
  const src = window._galleryImages[idx];
  const hasPrev = idx > 0, hasNext = idx < window._galleryImages.length - 1;
  const NAV = (dir, pts) => `<button onclick="event.stopPropagation();_galleryNav(${dir === 'left' ? -1 : 1})" style="position:absolute;top:50%;${dir}:1rem;transform:translateY(-50%);background:rgba(255,255,255,0.18);border:none;border-radius:50%;width:46px;height:46px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;z-index:4"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${pts}"/></svg></button>`;
  const el = document.createElement('div');
  el.id = '_lb';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.96);z-index:9999;display:flex;align-items:center;justify-content:center;';
  el.innerHTML = `
    <button onclick="document.getElementById('_lb').remove()" style="position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.15);border:none;border-radius:50%;width:42px;height:42px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;z-index:5">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    ${hasPrev ? NAV('left',  '15 18 9 12 15 6') : ''}
    ${hasNext ? NAV('right', '9 18 15 12 9 6')  : ''}
    <div style="position:absolute;bottom:1rem;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.55);font-size:0.8rem;font-weight:600;letter-spacing:0.08em">${idx+1} / ${window._galleryImages.length}</div>
    <img src="${src}" style="max-width:92vw;max-height:86vh;border-radius:8px;object-fit:contain;display:block" onclick="event.stopPropagation()">`;
  el.onclick = () => el.remove();
  document.body.appendChild(el);
}
function _galleryNav(dir) {
  const next = (window._galleryIndex || 0) + dir;
  if (next < 0 || next >= (window._galleryImages || []).length) return;
  window._galleryIndex = next;
  _showLightboxAt(next);
}

function renderHeroCoupleNames(ev) {
  const nameEl = document.getElementById('hero-couple-names');
  if (!nameEl) return;
  const hasCouple = _yesOrTrue(ev.show_couple || ev.sw_couple);
  const invertNames = _yesOrTrue(ev.invert_names);
  let groom = ev.groom_name || '';
  let bride  = ev.bride_name  || '';
  if (invertNames && groom && bride) { [groom, bride] = [bride, groom]; }

  if (!hasCouple || (!groom && !bride)) { nameEl.innerHTML = ''; nameEl.style.display = 'none'; return; }

  nameEl.style.display = '';
  if (ev.custom_font_family) nameEl.style.fontFamily = `'${ev.custom_font_family}', serif`;

  // Single line: "Araújo & Marlene"
  // Use only first name of each person for the hero
  const firstName = (name) => (name || '').split(' ')[0];
  const amp = groom && bride ? ` <span style="font-size:0.6em;opacity:0.65;font-weight:300">&amp;</span> ` : '';

  nameEl.innerHTML = firstName(groom) + amp + firstName(bride);

  // Responsive font size using clamp
  const size = parseFloat(ev.couple_size || 2.4);
  nameEl.style.fontSize = `${size}rem`;
  nameEl.style.whiteSpace = 'nowrap';
  nameEl.style.display = 'flex';
  nameEl.style.alignItems = 'center';
  nameEl.style.justifyContent = 'center';
  nameEl.style.gap = '0.3em';
}


// ===================== SCROLL REVEAL =====================
function initScrollReveal() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => el.classList.add('visible'));
    return;
  }
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.reveal, .reveal-stagger').forEach(el => obs.observe(el));
}


// ===================== GUEST CONFIRMATION PERSISTENCE =====================
function saveGuestConfirmationToStorage(eventId, guestName) {
  // confirmation tracked in Store._rsvpConfirmedName and Store._deviceGuestName
}
function getGuestConfirmationFromStorage(eventId) {
  return Store._rsvpConfirmedName?.[eventId] || null;
}
function clearGuestConfirmationFromStorage(eventId) {
  if (Store._rsvpConfirmedName) delete Store._rsvpConfirmedName[eventId];
}


// ===================== COUPLE SIZE =====================
// ── Generic copy-to-clipboard with visual feedback on the trigger button ──
function copyToClipboard(text, btnEl) {
  const cleanText = String(text).replace(/\s+/g, '');
  const doFeedback = () => {
    if (!btnEl) { toast('Copiado!'); return; }
    const original = btnEl.innerHTML;
    btnEl.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    setTimeout(() => { if (btnEl) btnEl.innerHTML = original; }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cleanText).then(doFeedback).catch(() => {
      toast('Não foi possível copiar. Copia manualmente: ' + cleanText);
    });
  } else {
    toast('Não foi possível copiar. Copia manualmente: ' + cleanText);
  }
}

function changeCoupleSize(delta) {
  const inp = document.getElementById('evt-couple-size');
  const lbl = document.getElementById('couple-size-label');
  if (!inp) return;
  let v = parseFloat(inp.value) || 2.4;
  v = Math.max(1.0, Math.min(16.0, parseFloat((v + delta * 0.2).toFixed(1))));
  inp.value = v;
  if (lbl) lbl.textContent = v + 'rem';
}

function changeParentsSize(delta) {
  const inp = document.getElementById('evt-parents-size');
  const lbl = document.getElementById('parents-size-label');
  if (!inp) return;
  let v = parseFloat(inp.value) || 0.88;
  v = Math.max(0.6, Math.min(2.5, parseFloat((v + delta * 0.08).toFixed(2))));
  inp.value = v;
  if (lbl) lbl.textContent = v + 'rem';
}

function changeBibleSize(delta) {
  const inp = document.getElementById('evt-bible-size');
  const lbl = document.getElementById('bible-size-label');
  if (!inp) return;
  let v = parseFloat(inp.value) || 0.92;
  v = Math.max(0.6, Math.min(2.0, parseFloat((v + delta * 0.08).toFixed(2))));
  inp.value = v;
  if (lbl) lbl.textContent = v + 'rem';
}

function changeStdNameSize(delta) {
  const inp = document.getElementById('evt-std-name-size');
  const lbl = document.getElementById('std-name-size-label');
  if (!inp) return;
  let v = parseFloat(inp.value) || 2.4;
  v = Math.max(1.0, Math.min(5.0, parseFloat((v + delta * 0.2).toFixed(1))));
  inp.value = v;
  if (lbl) lbl.textContent = v + 'rem';
}

function changeStdTitleSize(delta) {
  const inp = document.getElementById('evt-std-title-size');
  const lbl = document.getElementById('std-title-size-label');
  if (!inp) return;
  let v = parseFloat(inp.value) || 0.78;
  v = Math.max(0.5, Math.min(2.0, parseFloat((v + delta * 0.08).toFixed(2))));
  inp.value = v;
  if (lbl) lbl.textContent = v + 'rem';
}

async function handleStdIntroPhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.includes('png') && !file.type.includes('jpeg') && !file.type.includes('jpg')) {
    toast('Seleciona um ficheiro PNG ou JPG.'); return;
  }
  if (file.size > 4 * 1024 * 1024) { toast('Imagem muito grande. Máx. 4 MB.'); return; }
  const prevWrap = document.getElementById('std-intro-photo-preview-wrap');
  const prev = document.getElementById('std-intro-photo-preview');
  if (prevWrap) prevWrap.classList.add('hidden');
  toast('A carregar foto...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers');
    document.getElementById('evt-std-intro-photo-url').value = url;
    if (prev) prev.src = url;
    if (prevWrap) prevWrap.classList.remove('hidden');
    toast('Foto de abertura carregada!');
  } catch(e) {
    toast('Erro ao carregar a foto.');
  }
}

function removeStdIntroPhoto() {
  document.getElementById('evt-std-intro-photo-url').value = '';
  document.getElementById('evt-std-intro-photo').value = '';
  document.getElementById('std-intro-photo-preview-wrap')?.classList.add('hidden');
  toast('Foto de abertura removida.');
}

// ── Limit text input to max N words ──
function limitToThreeWords(input, max) {
  max = max || 3;
  const words = input.value.trim().split(/\s+/).filter(Boolean);
  if (words.length > max) {
    input.value = words.slice(0, max).join(' ');
    input.style.borderColor = '#ef4444';
    setTimeout(() => { input.style.borderColor = ''; }, 800);
  }
}

function updateDressCodeSwatches(value) {
  const container = document.getElementById('evt-dresscode-swatches');
  if (!container) return;
  const colors = value.split(/\n|,/).map(c => c.trim()).filter(c => /^#[0-9a-fA-F]{3,6}$/.test(c)).slice(0, 4);
  container.innerHTML = colors.map(c =>
    `<div style="width:32px;height:32px;border-radius:50%;background:${c};border:2px solid #e5e7eb;flex-shrink:0" title="${c}"></div>`
  ).join('');
}


function toggleStdReleaseFields(releaseType) {
  const dateWrap = document.getElementById('std-release-date-wrap');
  const manualWrap = document.getElementById('std-manual-release-wrap');
  if (dateWrap) dateWrap.classList.toggle('hidden', releaseType !== 'by_date');
  if (manualWrap) manualWrap.classList.toggle('hidden', releaseType !== 'manual');
}

async function handleStdCoverUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { toast('Imagem muito grande. Máx. 5 MB.'); return; }
  toast('A carregar foto de capa...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers');
    document.getElementById('evt-std-cover-url').value = url;
    const prev = document.getElementById('std-cover-preview');
    if (prev) prev.src = url;
    document.getElementById('std-cover-preview-wrap')?.classList.remove('hidden');
    toast('Foto de capa do Save the Date carregada!');
  } catch(e) { toast('Erro ao carregar a foto.'); }
}

function removeStdCoverPhoto() {
  document.getElementById('evt-std-cover-url').value = '';
  document.getElementById('evt-std-cover-photo').value = '';
  document.getElementById('std-cover-preview-wrap')?.classList.add('hidden');
  toast('Foto de capa removida.');
}

async function handleFinalPhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { toast('Imagem muito grande. Máx. 5 MB.'); return; }
  toast('A carregar foto final...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers');
    document.getElementById('evt-final-photo-url').value = url;
    const prev = document.getElementById('final-photo-preview');
    if (prev) prev.src = url;
    document.getElementById('final-photo-preview-wrap')?.classList.remove('hidden');
    toast('Foto final dos noivos carregada!');
  } catch(e) { toast('Erro ao carregar a foto.'); }
}

function removeFinalPhoto() {
  document.getElementById('evt-final-photo-url').value = '';
  document.getElementById('evt-final-photo-input').value = '';
  document.getElementById('final-photo-preview-wrap')?.classList.add('hidden');
  toast('Foto final removida.');
}

async function handleVenueImageUpload(input, venueKey) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 4*1024*1024) { toast('Imagem muito grande. Máx. 4 MB.'); return; }
  toast('A carregar foto do local...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers');
    document.getElementById(`evt-venue-${venueKey}-image`).value = url;
    const prev = document.getElementById(`venue-${venueKey}-image-preview`);
    if (prev) prev.src = url;
    document.getElementById(`venue-${venueKey}-image-wrap`)?.classList.remove('hidden');
    toast('Foto do local carregada!');
  } catch(e) { toast('Erro ao carregar a foto.'); }
}

function removeVenueImage(venueKey) {
  document.getElementById(`evt-venue-${venueKey}-image`).value = '';
  document.getElementById(`evt-venue-${venueKey}-image-input`).value = '';
  document.getElementById(`venue-${venueKey}-image-wrap`)?.classList.add('hidden');
  toast('Foto do local removida.');
}
