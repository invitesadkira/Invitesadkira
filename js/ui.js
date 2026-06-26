// ===================== TIPO DE EVENTO: adaptar rótulos do formulário =====================
// Casamento/Noivado mantêm a linguagem de "noivos". Aniversário (adultos)
// troca para linguagem de uma só pessoa — sem reescrever a estrutura de
// dados (continua a usar groom_name internamente, só muda o texto visível).
function updateLabelsForEventType(type) {
  const isBirthday = type === 'birthday';
  const isOther = type === 'other';
  const singlePerson = isBirthday || isOther;

  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
  const setPlaceholder = (id, text) => { const el = document.getElementById(id); if (el) el.placeholder = text; };

  set('lbl-couplemsg', singlePerson ? 'Mensagem para o Convidado de Honra' : 'Mensagem dos Noivos');
  set('lbl-final-photo', singlePerson ? 'Foto Final' : 'Foto Final dos Noivos');
  set('lbl-couple-names', singlePerson ? 'Nome no Hero' : 'Nomes dos Noivos no Hero');
  set('lbl-groom-parents', singlePerson ? 'Pais / Família' : 'Pais do Noivo');
  set('lbl-bride-parents', singlePerson ? 'Outros Familiares (opcional)' : 'Pais da Noiva');
  set('lbl-invert-hint', singlePerson ? 'Nome adicional aparece primeiro' : 'Noiva aparece primeiro');
  setPlaceholder('evt-groom-name', singlePerson ? 'Nome do Aniversariante' : 'Nome do Noivo / Aniversariante');
  setPlaceholder('evt-bride-name', singlePerson ? 'Nome adicional (opcional)' : 'Nome da Noiva (opcional)');
  setPlaceholder('evt-couplemsg-text', singlePerson
    ? 'Ex: Hoje celebramos mais um ano de vida e queremos partilhar este momento contigo...'
    : 'Ex: Cada um de vocês representa um capítulo especial da nossa história...');
}

// ===================== BIBLIOTECA DE IMAGENS =====================
// Mostra todas as fotos já carregadas por esta conta (em todos os eventos),
// para reaproveitar em vez de carregar de novo — poupa espaço no Supabase.
// ✅ Mostra tanto as registadas na tabela media_library (uploads recentes)
// como as "antigas" já usadas nos eventos antes desta funcionalidade
// existir (capa, galeria, foto final, fundo, locais, Save the Date, etc.)
// — senão, uma conta com muitas fotos já em uso aparecia como "vazia".
async function _gatherLegacyImagesForUser(userId) {
  const found = []; // {url, label}
  try {
    // ✅ CORREÇÃO: os campos do Save the Date (std_cover_url, std_intro_*,
    // std_scratch_photo_url) vivem na tabela `events`, não em
    // `event_visuals` — pedi-los do sítio errado causava erro 400 em
    // cada um deles, um a um.
    const events = await supabaseRequest(`events?user_id=eq.${userId}&select=id,title,cover_image,std_cover_url,std_cover_mobile_url,std_cover_desktop_url,std_intro_photo_url,std_intro_photo_mobile_url,std_intro_photo_desktop_url,std_scratch_photo_url`);
    if (!events || !events.length) return found;
    const ids = events.map(e => `"${e.id}"`).join(',');

    events.forEach(e => {
      const evLabel = e.title || e.id;
      if (e.cover_image) found.push({ url: e.cover_image, label: `Capa — ${evLabel}` });
      if (e.std_cover_url) found.push({ url: e.std_cover_url, label: `Capa Save the Date — ${evLabel}` });
      if (e.std_cover_mobile_url) found.push({ url: e.std_cover_mobile_url, label: `Capa STD (telemóvel) — ${evLabel}` });
      if (e.std_cover_desktop_url) found.push({ url: e.std_cover_desktop_url, label: `Capa STD (computador) — ${evLabel}` });
      if (e.std_intro_photo_url) found.push({ url: e.std_intro_photo_url, label: `Abertura STD — ${evLabel}` });
      if (e.std_intro_photo_mobile_url) found.push({ url: e.std_intro_photo_mobile_url, label: `Abertura STD (telemóvel) — ${evLabel}` });
      if (e.std_intro_photo_desktop_url) found.push({ url: e.std_intro_photo_desktop_url, label: `Abertura STD (computador) — ${evLabel}` });
      if (e.std_scratch_photo_url) found.push({ url: e.std_scratch_photo_url, label: `Raspadinha STD — ${evLabel}` });
    });

    // ✅ Estas duas consultas não dependem uma da outra — corre-las em
    // paralelo (Promise.all) em vez de uma a seguir à outra corta o tempo
    // de espera real quase a metade.
    const [visualsRows, venueRows] = await Promise.all([
      supabaseRequest(
        `event_visuals?event_id=in.(${ids})&select=event_id,gallery_urls,bg_url,bg_url_mobile,bg_url_desktop,final_photo_url,story_photo_url,dresscode_image_url`
      ).catch(() => []),
      supabaseRequest(
        `event_venues?event_id=in.(${ids})&select=event_id,venue_ceremony_image,venue_civil_image,venue_reception_image`
      ).catch(() => [])
    ]);
    (visualsRows || []).forEach(v => {
      const ev = events.find(e => e.id === v.event_id);
      const evLabel = ev ? (ev.title || ev.id) : v.event_id;
      if (v.gallery_urls) v.gallery_urls.split(/\n|\|/).map(u => u.trim()).filter(Boolean).forEach(u => found.push({ url: u, label: `Galeria — ${evLabel}` }));
      if (v.bg_url) found.push({ url: v.bg_url, label: `Fundo — ${evLabel}` });
      if (v.bg_url_mobile) found.push({ url: v.bg_url_mobile, label: `Fundo (telemóvel) — ${evLabel}` });
      if (v.bg_url_desktop) found.push({ url: v.bg_url_desktop, label: `Fundo (computador) — ${evLabel}` });
      if (v.final_photo_url) found.push({ url: v.final_photo_url, label: `Foto Final — ${evLabel}` });
      if (v.story_photo_url) found.push({ url: v.story_photo_url, label: `Nossa História — ${evLabel}` });
      if (v.dresscode_image_url) found.push({ url: v.dresscode_image_url, label: `Dress Code — ${evLabel}` });
    });

    (venueRows || []).forEach(v => {
      const ev = events.find(e => e.id === v.event_id);
      const evLabel = ev ? (ev.title || ev.id) : v.event_id;
      if (v.venue_ceremony_image) found.push({ url: v.venue_ceremony_image, label: `Local Cerimónia — ${evLabel}` });
      if (v.venue_civil_image) found.push({ url: v.venue_civil_image, label: `Local Civil — ${evLabel}` });
      if (v.venue_reception_image) found.push({ url: v.venue_reception_image, label: `Local Recepção — ${evLabel}` });
    });
  } catch(e) { console.warn('Falha ao reunir imagens antigas:', e); }
  return found;
}

function _parseBucketAndPathFromUrl(url) {
  // Espera o formato .../storage/v1/object/public/{bucket}/{path}
  const m = url && url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  return m ? { bucket: m[1], path: m[2] } : { bucket: null, path: null };
}

async function openMediaLibraryPicker(applyUrlFn) {
  const userId = Store.currentUser?.id;
  if (!userId) { toast('Inicia sessão para ver a tua biblioteca.'); return; }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'media-library-modal';
  modal.style.zIndex = '10700';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-5" style="max-width:620px;max-height:88vh;overflow-y:auto">
    <div class="flex items-center justify-between mb-1">
      <h3 class="text-base font-bold text-gray-800 flex items-center gap-2"><i data-lucide="images" class="w-5 h-5" style="color:#0ea5e9"></i> A Minha Biblioteca de Fotos</h3>
      <button onclick="this.closest('.modal-overlay').remove()" style="background:none;border:none;cursor:pointer;color:#9ca3af;padding:4px;line-height:0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <p class="text-xs text-gray-500 mb-3">Clica numa foto para a reaproveitar. Marca várias com a caixinha para descarregar ou eliminar de uma vez.</p>
    <div id="media-library-toolbar" class="hidden items-center gap-2 mb-2" style="display:none">
      <span id="media-library-selected-count" class="text-xs font-semibold text-gray-600">0 selecionadas</span>
      <button class="text-xs font-semibold text-teal-600" onclick="_downloadSelectedMediaLibraryItems()">⬇ Descarregar</button>
      <button class="text-xs font-semibold text-red-600 ml-auto" onclick="_deleteSelectedMediaLibraryItems()">🗑 Eliminar selecionadas</button>
    </div>
    <div class="flex items-center justify-between mb-2">
      <label class="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
        <input type="checkbox" id="media-library-select-all" onchange="_toggleSelectAllMediaLibrary(this.checked)"> Seleccionar tudo
      </label>
      <button class="text-xs font-semibold text-red-600" onclick="_deleteAllMediaLibraryItems()">🗑 Eliminar tudo</button>
    </div>
    <div id="media-library-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:0.6rem">
      <p style="grid-column:1/-1;text-align:center;color:#9ca3af;padding:1rem;font-size:0.85rem">A carregar...</p>
    </div>
  </div>`;
  document.body.appendChild(modal);
  lucide.createIcons();

  window._mediaLibraryApplyFn = applyUrlFn;
  window._mediaLibrarySelected = new Set();

  try {
    const [tracked, legacy] = await Promise.all([
      supabaseRequest(`media_library?user_id=eq.${userId}&select=*&order=created_at.desc&limit=300`).catch(() => []),
      _gatherLegacyImagesForUser(userId)
    ]);
    // Junta as duas listas, sem repetir URLs (as "tracked" têm prioridade —
    // já têm id/bucket/file_path prontos para eliminar).
    const seen = new Set();
    const merged = [];
    (tracked || []).forEach(t => { if (t.url && !seen.has(t.url)) { seen.add(t.url); merged.push(t); } });
    legacy.forEach(l => {
      if (!l.url || seen.has(l.url)) return;
      seen.add(l.url);
      const { bucket, path } = _parseBucketAndPathFromUrl(l.url);
      merged.push({ id: null, url: l.url, label: l.label, bucket, file_path: path, created_at: null });
    });
    window._mediaLibraryItems = merged;
    _renderMediaLibraryGrid(merged);
  } catch(e) {
    document.getElementById('media-library-grid').innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#ef4444;padding:1rem;font-size:0.85rem">Erro ao carregar a biblioteca.</p>';
  }
}

function _renderMediaLibraryGrid(items) {
  const grid = document.getElementById('media-library-grid');
  if (!grid) return;
  if (!items.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#9ca3af;padding:1.5rem;font-size:0.85rem">Ainda não tens fotos na biblioteca. As fotos que carregares vão aparecer aqui automaticamente.</p>';
    return;
  }
  grid.innerHTML = items.map((item, idx) => `
    <div style="position:relative;border-radius:0.6rem;overflow:hidden;border:1.5px solid #e5e7eb;aspect-ratio:1;background:#f8fafc;cursor:pointer" onclick="_useMediaLibraryItem('${item.url}')">
      <input type="checkbox" class="media-lib-checkbox" data-idx="${idx}" onclick="event.stopPropagation();_toggleMediaLibrarySelection(${idx}, this.checked)" style="position:absolute;top:4px;left:4px;width:18px;height:18px;z-index:2;cursor:pointer">
      <img src="${item.url}" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.opacity='0.35'">
      <span style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));color:#fff;font-size:0.6rem;padding:0.3rem 0.4rem;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(item.label || 'Imagem')}</span>
      <button onclick="event.stopPropagation();downloadFileFromUrl('${item.url}', (window._mediaLibraryItems[${idx}].label||'foto').replace(/[^a-z0-9]+/gi,'_')+'.jpg')" title="Descarregar" style="position:absolute;top:3px;right:29px;width:22px;height:22px;border-radius:50%;background:rgba(0,127,159,0.92);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.7rem;line-height:0">⬇</button>
      <button onclick="event.stopPropagation();_deleteMediaLibraryItem(${idx})" title="Eliminar" style="position:absolute;top:3px;right:3px;width:22px;height:22px;border-radius:50%;background:rgba(239,68,68,0.92);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.7rem;line-height:0">✕</button>
    </div>`).join('');
}

function _toggleMediaLibrarySelection(idx, checked) {
  if (checked) window._mediaLibrarySelected.add(idx); else window._mediaLibrarySelected.delete(idx);
  const n = window._mediaLibrarySelected.size;
  const toolbar = document.getElementById('media-library-toolbar');
  if (toolbar) toolbar.style.display = n > 0 ? 'flex' : 'none';
  const countEl = document.getElementById('media-library-selected-count');
  if (countEl) countEl.textContent = n + ' selecionada' + (n === 1 ? '' : 's');
}

function _toggleSelectAllMediaLibrary(checked) {
  const items = window._mediaLibraryItems || [];
  window._mediaLibrarySelected = checked ? new Set(items.map((_, i) => i)) : new Set();
  document.querySelectorAll('.media-lib-checkbox').forEach(cb => { cb.checked = checked; });
  _toggleMediaLibrarySelection(-1, false); // só para recalcular a contagem/toolbar
  const n = window._mediaLibrarySelected.size;
  const toolbar = document.getElementById('media-library-toolbar');
  if (toolbar) toolbar.style.display = n > 0 ? 'flex' : 'none';
  const countEl = document.getElementById('media-library-selected-count');
  if (countEl) countEl.textContent = n + ' selecionada' + (n === 1 ? '' : 's');
}

function _useMediaLibraryItem(url) {
  if (window._mediaLibraryApplyFn) window._mediaLibraryApplyFn(url);
  document.getElementById('media-library-modal')?.remove();
  toast('Foto seleccionada da biblioteca!');
}

async function _deleteMediaLibraryItemsByList(items) {
  let okCount = 0;
  for (const item of items) {
    try {
      if (item.bucket && item.file_path) {
        await fetch(`${SUPABASE_URL}/storage/v1/object/${item.bucket}/${item.file_path}`, {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        }).catch(() => {});
      }
      if (item.id) await supabaseRequest(`media_library?id=eq.${item.id}`, 'DELETE').catch(() => {});
      okCount++;
    } catch(e) {}
  }
  return okCount;
}

async function _deleteMediaLibraryItem(idx) {
  const item = (window._mediaLibraryItems || [])[idx];
  if (!item) return;
  if (!confirm(`Eliminar esta foto ("${item.label || 'Imagem'}") da biblioteca e do armazenamento?\n\nSe ainda estiver a ser usada em algum convite, deixará de aparecer lá.`)) return;
  toast('A eliminar...');
  await _deleteMediaLibraryItemsByList([item]);
  toast('Foto eliminada.');
  window._mediaLibraryItems.splice(idx, 1);
  window._mediaLibrarySelected = new Set();
  _renderMediaLibraryGrid(window._mediaLibraryItems);
  document.getElementById('media-library-toolbar').style.display = 'none';
}

async function _downloadSelectedMediaLibraryItems() {
  const idxs = Array.from(window._mediaLibrarySelected || []);
  if (!idxs.length) return;
  toast('A descarregar ' + idxs.length + ' foto(s)...');
  for (const i of idxs) {
    const item = window._mediaLibraryItems[i];
    if (!item) continue;
    const filename = (item.label || 'foto').replace(/[^a-z0-9]+/gi, '_') + '.jpg';
    await downloadFileFromUrl(item.url, filename);
    await new Promise(r => setTimeout(r, 400)); // espaça os downloads para o browser não bloquear
  }
}

async function _deleteSelectedMediaLibraryItems() {
  const idxs = Array.from(window._mediaLibrarySelected || []);
  if (!idxs.length) return;
  if (!confirm(`Eliminar ${idxs.length} foto(s) seleccionada(s) da biblioteca e do armazenamento? Esta acção não pode ser desfeita.`)) return;
  toast('A eliminar ' + idxs.length + ' foto(s)...');
  const items = idxs.map(i => window._mediaLibraryItems[i]).filter(Boolean);
  await _deleteMediaLibraryItemsByList(items);
  window._mediaLibraryItems = window._mediaLibraryItems.filter((_, i) => !idxs.includes(i));
  window._mediaLibrarySelected = new Set();
  _renderMediaLibraryGrid(window._mediaLibraryItems);
  document.getElementById('media-library-toolbar').style.display = 'none';
  toast('Fotos eliminadas.');
}

async function _deleteAllMediaLibraryItems() {
  const items = window._mediaLibraryItems || [];
  if (!items.length) return;
  if (!confirm(`Eliminar TODAS as ${items.length} fotos da biblioteca e do armazenamento? Esta acção não pode ser desfeita e pode afectar convites que ainda usem estas fotos.`)) return;
  toast('A eliminar tudo...');
  await _deleteMediaLibraryItemsByList(items);
  window._mediaLibraryItems = [];
  window._mediaLibrarySelected = new Set();
  _renderMediaLibraryGrid([]);
  document.getElementById('media-library-toolbar').style.display = 'none';
  toast('Biblioteca esvaziada.');
}


function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast-msg';
  t.textContent = msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ===================== LANDING: MOBILE NAV MENU =====================
function toggleLandingMenu() {
  const links = document.getElementById('landing-nav-links');
  const overlay = document.getElementById('landing-nav-overlay');
  const btn = document.getElementById('landing-nav-toggle');
  if (!links || !overlay || !btn) return;
  const open = links.classList.toggle('open');
  overlay.classList.toggle('open', open);
  btn.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}
function closeLandingMenu() {
  const links = document.getElementById('landing-nav-links');
  const overlay = document.getElementById('landing-nav-overlay');
  const btn = document.getElementById('landing-nav-toggle');
  if (!links || !overlay || !btn) return;
  links.classList.remove('open');
  overlay.classList.remove('open');
  btn.classList.remove('open');
  document.body.style.overflow = '';
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

// Limpa a foto de capa de volta para "sem foto" — a capa é sempre opcional;
// isto torna isso óbvio em vez de só "tecnicamente possível".
function removeCoverImageFromForm() {
  const img = document.getElementById('cover-img');
  img.src = '';
  img.classList.add('hidden');
  document.getElementById('cover-placeholder')?.classList.remove('hidden');
  document.getElementById('cover-remove-btn')?.classList.add('hidden');
  const input = document.getElementById('cover-input');
  if (input) input.value = '';
}

async function handleCoverVideoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    toast('Vídeo muito grande (máx. 10MB) — usa um vídeo curto ou comprime antes de carregar.');
    input.value = '';
    return;
  }
  toast('A carregar vídeo...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers', 'Vídeo de Capa');
    document.getElementById('evt-cover-video-url').value = url;
    const preview = document.getElementById('cover-video-preview');
    preview.src = url;
    document.getElementById('cover-video-preview-wrap').classList.remove('hidden');
    toast('Vídeo carregado!');
  } catch(e) {
    toast('Erro ao carregar o vídeo.');
    console.warn(e);
  }
}

function removeCoverVideoFromForm() {
  document.getElementById('evt-cover-video-url').value = '';
  document.getElementById('cover-video-input').value = '';
  document.getElementById('cover-video-preview').src = '';
  document.getElementById('cover-video-preview-wrap').classList.add('hidden');
}

async function previewCover(input) {
  const file = input.files[0];
  if (!file) return;
  const eventId = Store.currentEventId || Store._intakeEventId;
  const applyUrl = (url) => {
    const img = document.getElementById('cover-img');
    img.src = url; // URL existente — a gravação já trata "http" como "não re-enviar"
    img.classList.remove('hidden');
    document.getElementById('cover-placeholder').classList.add('hidden');
    document.getElementById('cover-remove-btn')?.classList.remove('hidden');
  };
  const proceed = await _confirmIfDuplicatePhoto(file, eventId, 'Foto de Capa', applyUrl);
  if (!proceed) { input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    const img = document.getElementById('cover-img');
    img.src = e.target.result;
    img.classList.remove('hidden');
    document.getElementById('cover-placeholder').classList.add('hidden');
    document.getElementById('cover-remove-btn')?.classList.remove('hidden');
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
  if (!d || !o) return;
  const isOpen = d.classList.contains('open');
  d.classList.toggle('open', !isOpen);
  o.classList.toggle('open', !isOpen);
  if (btn) btn.classList.toggle('open', !isOpen);
}
function closeDrawer() {
  document.getElementById('side-drawer')?.classList.remove('open');
  document.getElementById('drawer-overlay')?.classList.remove('open');
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
    { icon:'shopping-bag', label:'Encomendas',       action:"openOrdersManager()" },
    { icon:'bell',         label:'Notificar Todos',  action:"openSendNotificationModal()" },
    { icon:'bar-chart-3',  label:'Análise de Acessos', action:"openAnalyticsPanel()" },
    { icon:'file-text',  label:'Política e Termos', action:"openLegalPagesEditor()" },
    { icon:'monitor-play',  label:'Eventos de Demonstração', action:"adminEditDemoEvents()" },
    { icon:'image',  label:'Vitrine do Hero (Site Comercial)', action:"adminEditHeroShowcase()" },
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

// ── Ícone de som do Save the Date (junto à foto de capa) ────────────────
// ✅ Diferente do botão flutuante normal (que pausa/toca): este nunca pausa
// a música — apenas silencia/activa o som, mantendo a reprodução contínua.
// Pensado para um único ícone simples de "som", como pedido.
const VOLUME_ON_ICON  = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
const VOLUME_OFF_ICON = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
function toggleStdMusicMute() {
  const audio = document.getElementById('guest-audio');
  const ytFrame = document.getElementById('yt-music-frame');
  const icon = document.getElementById('std-mute-icon');
  const btn = document.getElementById('std-mute-btn');
  let nowMuted;

  if (audio && audio.src) {
    audio.muted = !audio.muted;
    nowMuted = audio.muted;
  } else if (ytFrame && ytFrame.src) {
    nowMuted = ytFrame.dataset.muted !== '1';
    ytFrame.dataset.muted = nowMuted ? '1' : '0';
    try {
      ytFrame.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: nowMuted ? 'mute' : 'unMute', args: [] }), '*'
      );
    } catch(e) {}
  } else {
    return; // nada a tocar ainda (autoplay pode estar bloqueado/a aguardar gesto)
  }

  if (icon) icon.innerHTML = nowMuted ? VOLUME_OFF_ICON : VOLUME_ON_ICON;
  if (btn) btn.title = nowMuted ? 'Som desligado — clique para activar' : 'Som ligado — clique para silenciar';
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
    // Tenta também imediatamente — útil quando isto corre pouco depois de
    // um gesto real do utilizador (ex: confirmar presença no Save the Date),
    // onde a autorização de autoplay do browser ainda pode estar "fresca".
    setTimeout(tryYtPlay, 400);
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
  // — funciona tanto para a galeria em grelha (.gallery-item img) como
  // para o carrossel 3D (.g3d-slide, que usa background-image em vez de
  // <img>, por isso precisa de ser lido de forma diferente).
  const gridUrls = Array.from(document.querySelectorAll('.gallery-item img'))
    .filter(i => !i.closest('.gallery-item').style.display.includes('none'))
    .map(i => i.dataset.url || i.src)
    .filter(u => u && u.startsWith('http'));
  const carouselUrls = Array.from(document.querySelectorAll('.g3d-slide'))
    .map(s => {
      const bg = s.style.backgroundImage || '';
      const m = bg.match(/url\(["']?(.*?)["']?\)/);
      return m ? m[1] : null;
    })
    .filter(u => u && u.startsWith('http'));
  window._galleryImages = gridUrls.length ? gridUrls : carouselUrls;
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

function changeBlessingCoupleSize(delta) {
  const inp = document.getElementById('evt-blessing-couple-size');
  const lbl = document.getElementById('blessing-couple-size-label');
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

async function handleStdIntroPhotoUpload(input, variant) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.includes('png') && !file.type.includes('jpeg') && !file.type.includes('jpg')) {
    toast('Seleciona um ficheiro PNG ou JPG.'); return;
  }
  if (file.size > 4 * 1024 * 1024) { toast('Imagem muito grande. Máx. 4 MB.'); return; }
  const eventId = Store.currentEventId || Store._intakeEventId;
  const label = variant === 'desktop' ? 'Foto de abertura (computador)' : 'Foto de abertura (telemóvel)';
  const applyUrl = (url) => {
    document.getElementById(`evt-std-intro-photo-${variant}-url`).value = url;
    const prev = document.getElementById(`std-intro-photo-${variant}-preview`);
    if (prev) prev.src = url;
    document.getElementById(`std-intro-photo-${variant}-preview-wrap`)?.classList.remove('hidden');
  };
  const proceed = await _confirmIfDuplicatePhoto(file, eventId, label, applyUrl);
  if (!proceed) { input.value = ''; return; }
  const prevWrap = document.getElementById(`std-intro-photo-${variant}-preview-wrap`);
  const prev = document.getElementById(`std-intro-photo-${variant}-preview`);
  if (prevWrap) prevWrap.classList.add('hidden');
  toast('A carregar foto...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers', label);
    applyUrl(url);
    toast('Foto de abertura carregada!');
  } catch(e) {
    toast('Erro ao carregar a foto.');
  }
}

function removeStdIntroPhoto(variant) {
  document.getElementById(`evt-std-intro-photo-${variant}-url`).value = '';
  document.getElementById(`evt-std-intro-photo-${variant}`).value = '';
  document.getElementById(`std-intro-photo-${variant}-preview-wrap`)?.classList.add('hidden');
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
  const eventId = Store.currentEventId || Store._intakeEventId;
  const label = 'Foto de capa do Save the Date';
  const applyUrl = (url) => {
    document.getElementById('evt-std-cover-url').value = url;
    const prev = document.getElementById('std-cover-preview');
    if (prev) prev.src = url;
    document.getElementById('std-cover-preview-wrap')?.classList.remove('hidden');
  };
  const proceed = await _confirmIfDuplicatePhoto(file, eventId, label, applyUrl);
  if (!proceed) { input.value = ''; return; }
  toast('A carregar foto de capa...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers', label);
    applyUrl(url);
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
  const eventId = Store.currentEventId || Store._intakeEventId;
  const label = 'Foto final dos noivos';
  const applyUrl = (url) => {
    document.getElementById('evt-final-photo-url').value = url;
    const prev = document.getElementById('final-photo-preview');
    if (prev) prev.src = url;
    document.getElementById('final-photo-preview-wrap')?.classList.remove('hidden');
  };
  const proceed = await _confirmIfDuplicatePhoto(file, eventId, label, applyUrl);
  if (!proceed) { input.value = ''; return; }
  toast('A carregar foto final...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers', label);
    applyUrl(url);
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
  const eventId = Store.currentEventId || Store._intakeEventId;
  const label = `Foto do local (${venueKey})`;
  const applyUrl = (url) => {
    document.getElementById(`evt-venue-${venueKey}-image`).value = url;
    const prev = document.getElementById(`venue-${venueKey}-image-preview`);
    if (prev) prev.src = url;
    document.getElementById(`venue-${venueKey}-image-wrap`)?.classList.remove('hidden');
  };
  const proceed = await _confirmIfDuplicatePhoto(file, eventId, label, applyUrl);
  if (!proceed) { input.value = ''; return; }
  toast('A carregar foto do local...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers', label);
    applyUrl(url);
    toast('Foto do local carregada!');
  } catch(e) { toast('Erro ao carregar a foto.'); }
}

function removeVenueImage(venueKey) {
  document.getElementById(`evt-venue-${venueKey}-image`).value = '';
  document.getElementById(`evt-venue-${venueKey}-image-input`).value = '';
  document.getElementById(`venue-${venueKey}-image-wrap`)?.classList.add('hidden');
  toast('Foto do local removida.');
}

async function handleStoryPhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { toast('Imagem muito grande. Máx. 5 MB.'); return; }
  const eventId = Store.currentEventId || Store._intakeEventId;
  const label = 'Foto da Nossa História';
  const applyUrl = (url) => {
    document.getElementById('evt-story-photo-url').value = url;
    const prev = document.getElementById('story-photo-preview');
    if (prev) prev.src = url;
    document.getElementById('story-photo-preview-wrap')?.classList.remove('hidden');
  };
  const proceed = await _confirmIfDuplicatePhoto(file, eventId, label, applyUrl);
  if (!proceed) { input.value = ''; return; }
  toast('A carregar foto...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers', label);
    applyUrl(url);
    toast('Foto carregada!');
  } catch(e) { toast('Erro ao carregar a foto.'); }
}

function removeStoryPhoto() {
  document.getElementById('evt-story-photo-url').value = '';
  document.getElementById('evt-story-photo-input').value = '';
  document.getElementById('story-photo-preview-wrap')?.classList.add('hidden');
  toast('Foto removida.');
}

function toggleScratchModeFields(mode) {
  document.getElementById('scratch-photo-fields')?.classList.toggle('hidden', mode !== 'photo');
  document.getElementById('scratch-heart-fields')?.classList.toggle('hidden', mode !== 'heart');
}

async function handleScratchPhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { toast('Imagem muito grande. Máx. 5 MB.'); return; }
  toast('A carregar foto...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers');
    document.getElementById('evt-scratch-photo-url').value = url;
    const prev = document.getElementById('scratch-photo-preview');
    if (prev) prev.src = url;
    document.getElementById('scratch-photo-preview-wrap')?.classList.remove('hidden');
    toast('Foto carregada!');
  } catch(e) { toast('Erro ao carregar a foto.'); }
}

function removeScratchPhoto() {
  document.getElementById('evt-scratch-photo-url').value = '';
  document.getElementById('evt-scratch-photo').value = '';
  document.getElementById('scratch-photo-preview-wrap')?.classList.add('hidden');
  toast('Foto removida.');
}

// ── Save the Date: campos "espelho" de data/prazo ──────────────────────────
// Estes campos dentro da secção do Save the Date são sincronizados com os
// campos principais do formulário (evt-date / evt-deadline), nas duas
// direções, para que o organizador possa configurar a data directamente
// nesta secção sem precisar de procurar noutro lado do formulário.
function syncStdDateMirror(which, value) {
  if (which === 'date') {
    const main = document.getElementById('evt-date');
    if (main) main.value = value;
    if (typeof validateDeadlineDate === 'function') validateDeadlineDate();
  } else if (which === 'deadline') {
    const main = document.getElementById('evt-deadline');
    if (main) main.value = value;
    if (typeof validateDeadlineDate === 'function') validateDeadlineDate();
  }
}

// Chamado sempre que os campos principais (evt-date/evt-deadline) mudam,
// para manter os espelhos da secção Save the Date sincronizados também.
function syncStdMirrorsFromMain() {
  const mainDate = document.getElementById('evt-date')?.value;
  const mainDeadline = document.getElementById('evt-deadline')?.value;
  const mirrorDate = document.getElementById('evt-std-date-mirror');
  const mirrorDeadline = document.getElementById('evt-std-deadline-mirror');
  if (mirrorDate && mainDate) mirrorDate.value = mainDate;
  if (mirrorDeadline && mainDeadline) mirrorDeadline.value = mainDeadline;
}
