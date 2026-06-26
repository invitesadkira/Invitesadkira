function hexToRgba(hex, alpha) {
  try {
    const h = (hex||'#007f9f').replace('#','');
    const r=parseInt(h.substring(0,2),16),g=parseInt(h.substring(2,4),16),b=parseInt(h.substring(4,6),16);
    if(isNaN(r)||isNaN(g)||isNaN(b)) return `rgba(0,127,159,${alpha})`;
    return `rgba(${r},${g},${b},${alpha})`;
  } catch(e) { return `rgba(0,127,159,${alpha})`; }
}


// ===================== SAVE THE DATE MODE =====================
function buildSaveTheDateHero(ev) {
  const evColor = ev.event_color || '#007f9f';
  const d = ev.date ? new Date(ev.date + 'T12:00:00') : null;
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const days   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const dateStr = d ? `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}` : '';
  const names = [ev.groom_name, ev.bride_name].filter(Boolean).join(' & ');

  const container = document.getElementById('save-the-date-overlay');
  if (!container) return;
  container.style.display = 'flex';
  container.innerHTML = `
    <div style="text-align:center;color:#fff;padding:2rem 1.5rem;width:100%">
      <div style="font-size:0.85rem;font-weight:700;letter-spacing:0.25em;text-transform:uppercase;opacity:0.8;margin-bottom:1rem">Save the Date</div>
      ${names ? `<div style="font-size:2.5rem;font-weight:900;text-shadow:0 2px 16px rgba(0,0,0,0.5);margin-bottom:0.75rem;font-family:'${ev.custom_font_family||'Quicksand'}',sans-serif">${names}</div>` : ''}
      ${dateStr ? `<div style="font-size:1rem;font-weight:600;opacity:0.9;margin-bottom:2rem">${dateStr}</div>` : ''}
    </div>`;
}

// ===================== GUEST SECTIONS RENDER =====================

const DEFAULT_MANUAL_ITEMS = [
  { icon: 'users', text: 'Contamos com\na sua presença!' },
  { icon: 'clock', text: 'Seja\npontual!' },
  { icon: 'user-x', text: 'Convidado\nnão convida!' },
  { icon: 'heart', text: 'Comemore a\nnossa união!' },
  { icon: 'shirt', text: 'Branco é a cor\nexclusiva da noiva!' },
  { icon: 'camera', text: 'Faça fotos e Stories\nsem atrapalhar o fotógrafo!' },
  { icon: 'smile', text: 'Sorria e seja\nmuito feliz!' },
  { icon: 'baby', text: 'Não levar\ncriança' }
];

const DEFAULT_MANUAL_ITEMS_BIRTHDAY = [
  { icon: 'users', text: 'Contamos com\na sua presença!' },
  { icon: 'clock', text: 'Seja\npontual!' },
  { icon: 'gift', text: 'Presentes são\nopcionais, mas bem-vindos!' },
  { icon: 'camera', text: 'Faça fotos e Stories\ne marque-nos!' },
  { icon: 'smile', text: 'Venha com\nmuita energia!' },
  { icon: 'party-popper', text: 'Vamos celebrar\njuntos!' }
];

// Devolve a lista de itens padrão consoante o tipo de evento — chamar
// sempre com o event_type quando disponível, em vez de usar a constante
// directamente, para que aniversários não mostrem "noiva"/"casamento".
function getDefaultManualItems(eventType) {
  return eventType === 'birthday' ? DEFAULT_MANUAL_ITEMS_BIRTHDAY : DEFAULT_MANUAL_ITEMS;
}

const DEFAULT_SCHEDULE_ITEMS = [
  { icon: 'door-open',   time: '14h30', label: 'Chegada dos Convidados',   sub: 'Recepção e boas-vindas' },
  { icon: 'gem',        time: '15h00', label: 'Cerimónia',                sub: 'Troca de votos' },
  { icon: 'camera',      time: '15h45', label: 'Sessão de Fotos',          sub: 'Com os noivos' },
  { icon: 'utensils',    time: '17h00', label: 'Cocktail',                 sub: 'Petiscos e bebidas' },
  { icon: 'music',       time: '20h00', label: 'Jantar',                   sub: 'Mesa posta' },
  { icon: 'party-popper',time: '22h00', label: 'Festa',                    sub: 'Dança e celebração' }
];

// Store for per-event overrides (kept in memory, persisted via Supabase event JSON field)
Store.eventManualItems   = null;  // null = use defaults
Store.eventScheduleItems = null;

// ===================== MODELO SIMPLES: 1 SÓ BLOCO CONTÍNUO =====================
// Alternativa ao sistema normal de secções — pensado para quem quer algo
// "simples mas lindo": uma única página que flui sem divisores nem cartões
// separados, na sequência: capa com degradê → texto bíblico → bênção →
// nomes → convite → data/hora → local → confirmar presença → local +
// cronograma. Activa-se com invite_layout = 'simple'.
function buildSimpleInviteTemplate(ev) {
  const evColor = ev.event_color || '#007f9f';
  const isSingle = ev.event_type === 'birthday' || ev.event_type === 'other';

  // Nome do convidado, se já soubermos quem é (mesma lógica usada no resto do site)
  let guestName = null;
  if (Store._lockedGuestName) guestName = Store._lockedGuestName;
  if (!guestName) {
    const confirmed = rsvpCheckConfirmed(ev.id || Store.currentEventId);
    if (confirmed && confirmed.attending === true && confirmed.name) guestName = confirmed.name;
  }

  const coupleNames = isSingle
    ? escapeHTML(ev.groom_name || ev.title || '')
    : [ev.groom_name, ev.bride_name].filter(Boolean).map(escapeHTML).join(' & ');

  const eventNoun = isSingle ? 'celebração' : 'celebração do seu Casamento';
  const inviteLine = guestName
    ? `Convidam <strong>${escapeHTML(guestName)}</strong> para a ${eventNoun}`
    : `Convidam para a ${eventNoun}`;

  // Data por extenso (ex: 15 de Agosto de 2026)
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let longDate = '';
  if (ev.date) {
    const [y,m,d] = ev.date.split('-');
    longDate = `${parseInt(d,10)} de ${MONTHS[parseInt(m,10)-1]} de ${y}`;
  }

  const bibleBlock = ev.bible_text ? `
    <div style="max-width:480px;margin:0 auto;text-align:center;padding:0 1.5rem">
      ${ev.bible_text.split('\n').filter(Boolean).map(l => `<p style="font-style:italic;color:#4b5563;font-size:0.95rem;line-height:1.8;margin:0 0 0.4rem">${escapeHTML(l)}</p>`).join('')}
      ${ev.bible_ref ? `<p style="font-size:0.78rem;color:${evColor};font-weight:700;margin-top:0.5rem">${escapeHTML(ev.bible_ref)}</p>` : ''}
    </div>` : '';

  const blessingLine = (!isSingle && ev.invite_blessing !== '') ? `
    <p style="text-align:center;font-size:0.7rem;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;color:${evColor};margin:2rem 0 0.5rem">${escapeHTML(ev.invite_blessing || 'Com a bênção de Deus e seus pais')}</p>
  ` : '';

  // Primeiro local (cerimónia, ou recepção se não houver cerimónia definida)
  const venue1Label = ev.venue_ceremony ? 'Cerimónia' : (ev.venue_reception ? 'Local' : '');
  const venue1Name  = ev.venue_ceremony || ev.venue_reception || '';
  const venue1Maps  = ev.venue_ceremony ? ev.venue_ceremony_maps : ev.venue_reception_maps;

  // Segundo local (recepção, se diferente do primeiro)
  const hasSecondVenue = ev.venue_ceremony && ev.venue_reception;
  const venue2Name = hasSecondVenue ? ev.venue_reception : '';
  const venue2Maps = hasSecondVenue ? ev.venue_reception_maps : '';

  let scheduleItems = [];
  if (ev.schedule_items) { try { scheduleItems = JSON.parse(ev.schedule_items); } catch(e) {} }

  // Flor de canto sobre a capa — pedido explicitamente para este modelo
  const decorOn = _yesOrTrue(ev.show_decor);
  const decorSide = ev.decor_top_position === 'right' ? 'right:0.75rem' : 'left:0.75rem';
  const decorHtml = (decorOn && ev.decor_top_url)
    ? `<div style="position:absolute;top:0.75rem;${decorSide};width:clamp(100px,20vw,170px);height:clamp(100px,20vw,170px);background-image:url('${ev.decor_top_url}');background-size:contain;background-repeat:no-repeat;background-position:top ${ev.decor_top_position === 'right' ? 'right' : 'left'};pointer-events:none;z-index:1"></div>`
    : '';

  return `
    <div class="simple-invite" style="background:#fff;max-width:560px;margin:0 auto">
      <!-- 1. Capa com degradê branco por baixo -->
      <div style="position:relative;width:100%;height:62vh;min-height:340px;max-height:560px;overflow:hidden">
        ${ev.cover_image ? `<img src="${ev.cover_image}" style="width:100%;height:100%;object-fit:cover">` : `<div style="width:100%;height:100%;background:linear-gradient(135deg,${evColor},#1a1a2e)"></div>`}
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom, transparent 55%, #fff 98%)"></div>
        ${decorHtml}
      </div>

      <!-- 2. Texto bíblico -->
      ${bibleBlock}

      <!-- 3. Com a bênção de Deus e seus pais -->
      ${blessingLine}

      <!-- 4. Nomes do casal -->
      <h1 style="text-align:center;font-family:'Playfair Display',serif;font-style:italic;font-size:clamp(2.2rem,8vw,3.2rem);color:#1e293b;margin:0.25rem 0 1rem">${coupleNames}</h1>

      <!-- 5. Convidam ___ para a celebração -->
      <p style="text-align:center;font-size:0.98rem;color:#374151;line-height:1.7;max-width:380px;margin:0 auto 2.5rem;padding:0 1.5rem">${inviteLine}</p>

      <!-- 6. Data e horário -->
      <div style="text-align:center;margin-bottom:2.5rem">
        <p style="font-size:1.3rem;font-weight:800;color:${evColor};margin:0">${escapeHTML(longDate)}</p>
        ${ev.time ? `<p style="font-size:0.95rem;color:#6b7280;margin:0.2rem 0 0">às ${escapeHTML(ev.time)}</p>` : ''}
      </div>

      <!-- 7. Local do evento -->
      ${venue1Name ? `
      <div style="text-align:center;margin-bottom:2.5rem;padding:0 1.5rem">
        ${venue1Label ? `<p style="font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:${evColor};margin:0 0 0.3rem">${venue1Label}</p>` : ''}
        <p style="font-size:1rem;font-weight:700;color:#1e293b;margin:0">${escapeHTML(venue1Name)}</p>
        ${venue1Maps ? `<a href="${escapeHTML(venue1Maps)}" target="_blank" style="font-size:0.8rem;color:${evColor};font-weight:600;text-decoration:underline">Ver no mapa</a>` : ''}
      </div>` : ''}

      <!-- 8. Confirmar presença -->
      <div style="text-align:center;margin-bottom:3rem">
        <button onclick="openRsvpDrawer()" style="background:${evColor};color:#fff;border:none;border-radius:999px;padding:0.9rem 2.6rem;font-weight:800;font-size:0.95rem;cursor:pointer;font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,0.18)">Confirmar Presença</button>
      </div>

      <!-- 9. Local do evento (recepção, se diferente) + cronograma do dia -->
      ${venue2Name ? `
      <div style="text-align:center;margin-bottom:2.5rem;padding:0 1.5rem">
        <p style="font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:${evColor};margin:0 0 0.3rem">Recepção</p>
        <p style="font-size:1rem;font-weight:700;color:#1e293b;margin:0">${escapeHTML(venue2Name)}</p>
        ${venue2Maps ? `<a href="${escapeHTML(venue2Maps)}" target="_blank" style="font-size:0.8rem;color:${evColor};font-weight:600;text-decoration:underline">Ver no mapa</a>` : ''}
      </div>` : ''}

      ${scheduleItems.length ? `
      <div style="max-width:340px;margin:0 auto 3.5rem;padding:0 1.5rem">
        <p style="text-align:center;font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:${evColor};margin:0 0 1.25rem">Cronograma do Dia</p>
        ${scheduleItems.map(it => `
          <div style="display:flex;align-items:baseline;gap:0.9rem;margin-bottom:0.85rem">
            <span style="flex-shrink:0;font-weight:800;font-size:0.85rem;color:${evColor};width:58px">${escapeHTML(it.time || '')}</span>
            <span style="font-size:0.88rem;color:#374151;font-weight:600">${escapeHTML(it.label || '')}</span>
          </div>`).join('')}
      </div>` : ''}
    </div>`;
}

async function renderGuestSections(eventData) {
  // Load venues from dedicated table
  try {
    const venues = await loadEventVenues(eventData.id || Store.currentEventId);
    if (venues) Object.keys(venues).forEach(k => {
      if (k !== 'event_id' && k !== 'updated_at' && venues[k] !== null && venues[k] !== undefined) eventData[k] = venues[k];
    });
  } catch(e) { console.warn('loadEventVenues failed:', e); }
  const container = document.getElementById('guest-sections-container');
  if (!container) return;
  if (!eventData) { container.innerHTML = ''; return; }

  // ✅ Modelo "1 só bloco" — substitui TODO o sistema normal de secções por
  // um fluxo único e contínuo, na ordem exacta pedida (capa → bíblia →
  // bênção → nomes → convite → data → local → RSVP → local + cronograma).
  // Tem a sua própria capa (com degradê), por isso escondemos a hero normal.
  const heroBlock = document.getElementById('guest-hero');
  if (eventData.invite_layout === 'simple') {
    if (heroBlock) heroBlock.style.display = 'none';
    container.innerHTML = buildSimpleInviteTemplate(eventData);
    lucide.createIcons();
    return;
  } else if (heroBlock) {
    heroBlock.style.display = '';
  }

  // ── Personalize the invite text with the confirmed guest's name ──────────
  // Only active when the organiser has enabled "Mostrar nome do convidado no
  // convite" (show_guest_name_in_invite). When the column doesn't exist yet
  // in the DB it arrives as null/undefined — treat that as DEFAULT FALSE to
  // avoid unexpected name insertion until the organiser explicitly enables it.
  // The name appears in bold on its own line; if the guest added a companion,
  // their name also appears below.
  const guestNameEnabled = eventData.show_guest_name_in_invite === true;
  if (guestNameEnabled && eventData.invite_text) {
    const eventId = eventData.id || Store.currentEventId;
    let guestName = null;
    let companionNames = [];
    // Priority 1: personalized link lock (most specific — see guest_links)
    if (Store._lockedGuestName) guestName = Store._lockedGuestName;
    // Priority 2: this browser's own RSVP confirmation for this event
    if (!guestName) {
      const confirmed = rsvpCheckConfirmed(eventId);
      if (confirmed && confirmed.attending === true && confirmed.name) {
        guestName = confirmed.name;
        // Companion names are stored in confirmed.companions as JSON array or comma-separated
        if (confirmed.companions) {
          try {
            const parsed = typeof confirmed.companions === 'string'
              ? JSON.parse(confirmed.companions)
              : confirmed.companions;
            if (Array.isArray(parsed)) {
              companionNames = parsed.filter(n => n && n.toString().trim());
            } else if (typeof parsed === 'string' && parsed.trim()) {
              companionNames = parsed.split(',').map(n => n.trim()).filter(Boolean);
            }
          } catch(e) {
            if (typeof confirmed.companions === 'string' && confirmed.companions.trim()) {
              companionNames = [confirmed.companions.trim()];
            }
          }
        }
      }
    }
    if (guestName) {
      // Build the replacement: guest name (bold via span placeholder)
      // plus companion names each on their own line
      const namesBlock = [guestName, ...companionNames]
        .map(n => `__BOLD__${escapeHTML(n.trim())}__/BOLD__`)
        .join('\n');
      eventData.invite_text = eventData.invite_text.replace(
        /Exmo\.?\(a\)\s*Sr\.?\(a\)\.?/gi,
        `\n${namesBlock}`
      );
      // Tag so buildInviteSection/buildBibleSection can render the spans properly
      eventData._hasGuestNameInvite = true;
    }
  }

  // DEBUG: Log what data we have for each section
  console.group('renderGuestSections — section data check');
  dlog('bible_text:', eventData.bible_text ? '✓ '+String(eventData.bible_text).substring(0,30) : '✗ null');
  dlog('gallery_urls:', eventData.gallery_urls ? '✓ '+String(eventData.gallery_urls).substring(0,50) : '✗ null');
  dlog('groom_parents:', eventData.groom_parents ? '✓' : '✗');
  dlog('iban_number:', eventData.iban_number ? '✓' : '✗');
  dlog('invite_text:', eventData.invite_text ? '✓' : '✗');
  dlog('event_color:', eventData.event_color);
  dlog('section_order:', eventData.section_order ? JSON.parse(eventData.section_order) : 'default');
  dlog('show_manual:', eventData.show_manual, '| manual_items:', eventData.manual_items ? '✓ '+String(eventData.manual_items).substring(0,80) : '✗ null/vazio');
  dlog('show_schedule:', eventData.show_schedule, '| schedule_items:', eventData.schedule_items ? '✓' : '✗ null/vazio');
  console.groupEnd();

  applyGuestBackground(eventData);

  let html = '';
  const sections = getSectionOrder(eventData);

  sections.forEach(sec => {
    try {
      switch(sec) {
        case 'bible':    if (eventData.bible_text) html += buildBibleSection(eventData); break;
        case 'invite':
          // Only show standalone if bible section is NOT shown (invite merged into bible)
          if (eventData.invite_text && !eventData.bible_text) html += buildInviteSection(eventData);
          break;
        case 'date':     html += buildDateSection(eventData); break;
        case 'countdown':html += buildCountdownSection(eventData); break;
        case 'parents':
          // Only show standalone if bible section is NOT being shown (parents are merged into bible)
          if ((eventData.groom_parents || eventData.bride_parents) && !eventData.bible_text)
            html += buildParentsSection(eventData);
          break;
        case 'story':    if (eventData.story_text && _yesOrTrue(eventData.show_story)) html += buildStorySection(eventData); break;
        case 'iban':     if (eventData.iban_number) html += buildIbanSection(eventData); break;
        case 'gallery':  if (eventData.gallery_urls) html += buildGallerySection(eventData); break;
        case 'venues':   if (_yesOrTrue(eventData.show_venues) && (eventData.venue_ceremony || eventData.venue_civil || eventData.venue_reception)) html += buildVenueSection(eventData); break;
        case 'manual':   if (_yesOrTrue(eventData.show_manual)) html += buildManualSection(eventData); break;
        case 'schedule': if (_yesOrTrue(eventData.show_schedule)) html += buildScheduleSection(eventData); break;
        case 'dresscode': if (_yesOrTrue(eventData.show_dress_gifts ?? 'yes')) html += buildDressGiftsSection(eventData); break;
        case 'couplemsg': if (_yesOrTrue(eventData.show_couplemsg) && eventData.couplemsg_text) html += buildCoupleMsgSection(eventData); break;
        case 'final_photo': if (_yesOrTrue(eventData.show_final_photo) && eventData.final_photo_url) html += buildFinalPhotoSection(eventData); break;
        case 'event_faq': if (_yesOrTrue(eventData.show_event_faq) && eventData.event_faq_items) html += buildEventFaqSection(eventData); break;
        case 'rsvp':     break; // always last, separate element
      }
    } catch(sectionErr) {
      // CRITICAL: never let one broken section take down the entire page.
      // Previously an error here (e.g. a missing function) silently aborted
      // the whole forEach, so every section after the broken one in the
      // user's custom order would vanish with zero visible error.
      console.error(`Erro ao renderizar secção "${sec}" (a continuar com as restantes):`, sectionErr);
    }
  });

  // Wrap sections with subtle dividers
  const sectionParts = html.split('<!-- SECTION_DIVIDER -->').filter(Boolean);
  const sideUrl = eventData.decor_side_url || '';
  const decorOn = _yesOrTrue(eventData.show_decor);
  let bodyHtml = sectionParts.map((part, i) => {
    const div = i === 0 ? '' : `<div class="section-divider"><div class="section-divider-line"></div></div>`;
    if (sideUrl && decorOn) {
      return div + `<div class="decor-side-wrap" style="position:relative">
        <div class="decor-side-img left" style="background-image:url('${sideUrl}')"></div>
        <div class="decor-side-img right" style="background-image:url('${sideUrl}')"></div>
        ${part}
      </div>`;
    }
    return div + part;
  }).join('');

  // ── Zonas seguras de decoração: topo e os 2 cantos do fim ──
  // Posicionadas pelo CSS para nunca tocarem o texto (pointer-events:none,
  // atrás do conteúdo, com margem garantida) — não são arrastáveis de
  // propósito, para isso não depender do tamanho do ecrã do convidado.
  // ✅ decor_top_url agora é tratado como canto decorativo sobre a foto de
  // capa (ver applyGuestBackground/ guest-hero-decor), não como secção
  // própria — fazia pouco sentido visualmente ter uma secção vazia só para
  // a flor, separada do resto.
  if (decorOn && (eventData.decor_bottom_left_url || eventData.decor_bottom_right_url)) {
    bodyHtml += `<div class="decor-bottom-wrap">
      ${eventData.decor_bottom_left_url ? `<div class="decor-bottom-img left" style="background-image:url('${eventData.decor_bottom_left_url}')"></div>` : ''}
      ${eventData.decor_bottom_right_url ? `<div class="decor-bottom-img right" style="background-image:url('${eventData.decor_bottom_right_url}')"></div>` : ''}
    </div>`;
  }
  container.innerHTML = bodyHtml;

  lucide.createIcons();

  // ── Story node scroll animation (IntersectionObserver) ──
  setTimeout(() => {
    const nodes = container.querySelectorAll('.story-node');
    if (nodes.length > 0) {
      const storyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const node = entry.target;
          const card = node.closest('.story-row')?.querySelector('.story-card');
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            node.classList.add('active');
            if (card) card.classList.add('active');
          } else {
            node.classList.remove('active');
            if (card) card.classList.remove('active');
          }
        });
      }, { threshold: [0.5], rootMargin: '-10% 0px -10% 0px' });
      nodes.forEach(n => storyObserver.observe(n));
    }
  }, 300);

  // Apply alternating section backgrounds (event color vs white)
  const evColor = eventData.event_color || '#007f9f';
  const secEls = container.querySelectorAll('.event-section');
  secEls.forEach((s, i) => {
    if (i % 2 === 0) {
      // Odd sections: very light tint of event color
      s.style.background = hexToRgba(evColor, 0.04);
    } else {
      s.style.background = '#fff';
    }
  });

  // Lightbox for gallery
  container.querySelectorAll('.gallery-item img').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });

  // Start countdown interval if present
  if (eventData.date) startCountdownInterval(eventData.date, eventData.time);

  // Initialise scroll reveal
  initScrollReveal();
  // Init floating music button
  initFloatingMusicBtn();
  // Init any 3D gallery carousels (must run after their HTML is in the DOM)
  initGalleryCarousels();
}

function getSectionOrder(ev) {
  // ALWAYS start with all sections — never hide any based on order
  const allKeys = getDefaultSectionOrder();

  let saved = null;
  if (ev.section_order) { try { saved = JSON.parse(ev.section_order); } catch(e) {} }
  if (!saved && Store.eventSectionOrder) saved = Store.eventSectionOrder;
  if (!saved) return allKeys;

  // Apply saved ORDER to the keys that exist in both saved and allKeys
  // Keys in saved order come first (respecting user's arrangement)
  // Keys NOT in saved order are appended at the end
  const ordered = saved.filter(k => allKeys.includes(k));
  allKeys.forEach(k => { if (!ordered.includes(k)) ordered.push(k); });
  return ordered;
}

function applyGuestBackground(ev) {
  // Escolhe a variante mobile ou desktop consoante o ecrã do visitante,
  // com fallback ao campo antigo (bg_url) para eventos criados antes desta
  // funcionalidade existir.
  const bgUrl = (typeof _pickPhotoForDevice === 'function')
    ? _pickPhotoForDevice(ev.bg_url_mobile, ev.bg_url_desktop, ev.bg_url)
    : (ev.bg_url || '');
  const overlayPct = parseFloat(ev.bg_overlay ?? 35);
  const overlayAlpha = Math.min(Math.max(overlayPct, 0), 80) / 100;

  // Remove previous background elements
  document.querySelectorAll('.guest-bg-cover, .guest-bg-overlay-el').forEach(e => e.remove());

  const guestEl = document.getElementById('screen-guest');

  if (bgUrl) {
    // Fixed full-screen background div (works on all screen sizes)
    const bg = document.createElement('div');
    bg.className = 'guest-bg-cover';
    bg.style.backgroundImage = `url('${bgUrl}')`;
    document.body.insertBefore(bg, document.body.firstChild);

    const ov = document.createElement('div');
    ov.className = 'guest-bg-overlay-el';
    ov.style.background = `rgba(0,0,0,${overlayAlpha})`;
    document.body.insertBefore(ov, document.body.firstChild);

    if (guestEl) guestEl.style.background = 'transparent';
  } else {
    if (guestEl) guestEl.removeAttribute('style');
  }

  // Hero overlay (cover image already set in renderGuestView, just set overlay opacity)
  const heroOvEl = document.getElementById('guest-hero-overlay');
  if (heroOvEl) heroOvEl.style.background = `rgba(0,0,0,${overlayAlpha})`;

  // ── Flor/ornamento decorativo no canto da foto de capa ──
  // Substituiu a versão antiga (secção própria, separada) — agora fica
  // directamente sobre a foto de capa, num canto, sem ocupar espaço extra
  // nem se sobrepor aos nomes do casal.
  const decorEl = document.getElementById('guest-hero-decor');
  if (decorEl) {
    const decorOn = _yesOrTrue(ev.show_decor);
    if (decorOn && ev.decor_top_url) {
      decorEl.style.backgroundImage = `url('${ev.decor_top_url}')`;
      decorEl.classList.remove('hidden');
      decorEl.classList.toggle('decor-corner-right', ev.decor_top_position === 'right');
      decorEl.classList.toggle('decor-corner-left', ev.decor_top_position !== 'right');
    } else {
      decorEl.classList.add('hidden');
    }
  }
}

function buildBibleSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const bibleSize = parseFloat(ev.bible_size) || 0.92;
  const lines = (ev.bible_text || '').split('\n').filter(Boolean).map(l => `<p class="bible-verse" style="font-size:${bibleSize}rem;line-height:1.8;font-style:italic">${escapeHTML(l)}</p>`).join('');
  const lines2 = (ev.bible_text_2 || '').split('\n').filter(Boolean).map(l => `<p class="bible-verse" style="font-size:${bibleSize}rem;line-height:1.8;font-style:italic">${escapeHTML(l)}</p>`).join('');
  const hasParents = ev.groom_parents || ev.bride_parents;
  // ✅ CORRIGIDO: agora usa mesmo o campo editável (evt-invite-blessing),
  // que já existia no formulário mas estava a ser ignorado de propósito.
  // Semântica: campo vazio (admin limpou-o) = não mostra nada; campo nunca
  // tocado (eventos antigos) = mostra o texto padrão; texto próprio = usa
  // esse texto. Também já não depende de teres nomes dos pais preenchidos
  // — às vezes quem convida são os próprios noivos, ou os filhos, sem
  // listar nomes de pais nenhuns.
  const singleP_blessing = ev.event_type === 'birthday' || ev.event_type === 'other';
  const blessingLabel = ev.invite_blessing === ''
    ? ''
    : (ev.invite_blessing || (singleP_blessing ? 'Com a bênção de Deus e da família' : 'Com a bênção de Deus e de seus pais'));

  // Apply invert_names to parents in this section too
  const _invertNamesB = _yesOrTrue(ev.invert_names);
  let _groomParentsB = ev.groom_parents;
  let _brideParentsB = ev.bride_parents;
  if (_invertNamesB) { [_groomParentsB, _brideParentsB] = [_brideParentsB, _groomParentsB]; }

  const parentsHtml = (blessingLabel || hasParents) ? `
    <div class="reveal" style="margin-top:1.5rem">
      ${blessingLabel ? `<p class="invitation-text" style="margin-bottom:1rem;font-size:0.9rem">${escapeHTML(blessingLabel)}</p>` : ''}
      ${hasParents ? `<div style="display:flex;gap:1.5rem;justify-content:center;flex-wrap:wrap;text-align:center;max-width:380px;margin:0 auto">
        ${_groomParentsB ? (() => { return '<div>' + _groomParentsB.split('\n').filter(l=>l.trim()).map(l=>{ const hasCross=l.includes('✟'); const im=l.includes('(em memória)')||hasCross; let n=l.replace('(em memória)','').replace(/✟/g,'').trim(); const _pSize = ev.parents_size || '0.88'; return '<p style="font-weight:600;color:#1e293b;line-height:1.85;font-size:'+_pSize+'rem">'+escapeHTML(n)+(hasCross?' <span style="opacity:0.7">✟</span>':(im?' <span style="color:#6b7280;font-size:0.78rem;font-style:italic">(em memória)</span>':''))+'</p>'; }).join('') + '</div>'; })() : ''}
        ${_groomParentsB && _brideParentsB ? '<div style="width:1px;background:linear-gradient(to bottom,transparent,var(--ev-color,#007f9f) 20%,var(--ev-color,#007f9f) 80%,transparent);align-self:stretch;flex-shrink:0;min-height:60px"></div>' : ''}
        ${_brideParentsB ? (() => { return '<div>' + _brideParentsB.split('\n').filter(l=>l.trim()).map(l=>{ const hasCross=l.includes('✟'); const im=l.includes('(em memória)')||hasCross; let n=l.replace('(em memória)','').replace(/✟/g,'').trim(); const _pSize = ev.parents_size || '0.88'; return '<p style="font-weight:600;color:#1e293b;line-height:1.85;font-size:'+_pSize+'rem">'+escapeHTML(n)+(hasCross?' <span style="opacity:0.7">✟</span>':(im?' <span style="color:#6b7280;font-size:0.78rem;font-style:italic">(em memória)</span>':''))+'</p>'; }).join('') + '</div>'; })() : ''}
      </div>` : ''}
    </div>` : '';

  // Couple names shown inside the "Têm a honra de convidar" blessing block.
  // These use their OWN independent size (blessing_couple_size), separate
  // from the hero's couple_size — two visually distinct places that the
  // organiser should be able to size differently. Falls back to the hero
  // size only if the dedicated field was never explicitly set (keeps old
  // events looking the same as before this fix).
  const invertNames = _yesOrTrue(ev.invert_names);
  let groomName = ev.groom_name || '';
  let brideName = ev.bride_name || '';
  if (invertNames) { [groomName, brideName] = [brideName, groomName]; }
  const blessingCoupleSize = parseFloat(ev.blessing_couple_size || ev.couple_size || 2.4);
  const blessingCoupleFontSize = `${Math.max(1, blessingCoupleSize * 0.55)}rem`;
  const coupleFontFamily = ev.custom_font_family ? `'${ev.custom_font_family}', serif` : 'inherit';
  const coupleNamesHtml = (groomName || brideName) ? `
    <div class="reveal" style="margin-top:1.25rem;text-align:center">
      <p style="font-size:${blessingCoupleFontSize};font-weight:700;color:${ev.event_color||'#007f9f'};letter-spacing:0.01em;font-family:${coupleFontFamily}">
        ${escapeHTML(groomName)}${groomName && brideName ? ` <span style="font-weight:300;opacity:0.65">&amp;</span> ` : ''}${escapeHTML(brideName)}
      </p>
    </div>` : '';

  const _renderInviteLine = (line) => {
    if (line.trim() === '') return '<br>';
    // Replace bold markers (set by guest name substitution) with actual strong tags
    // The text inside markers was already escapeHTML'd when inserted
    const rendered = line.replace(/__BOLD__(.*?)__\/BOLD__/g, (_, name) =>
      `<strong style="font-size:1.1em;letter-spacing:0.01em">${name}</strong>`
    );
    // If the line already contains HTML (from our marker replacement), don't escape it again
    if (rendered !== line) return `<p class="invitation-text">${rendered}</p>`;
    return `<p class="invitation-text">${escapeHTML(line)}</p>`;
  };
  const inviteHtml = ev.invite_text ? `
    <div class="reveal" style="margin-top:1.5rem">
      ${ev.invite_text.split('\n').map(_renderInviteLine).join('')}
    </div>` : '';

  return _SD + `<div class="event-section" style="background:#fdfaf6;text-align:center">
    <div class="section-inner">
      <div class="reveal scale-in">
        ${lines}
        ${ev.bible_ref ? `<p class="bible-ref" style="margin-top:0.75rem">${escapeHTML(ev.bible_ref)}</p>` : ''}
        ${lines2 ? `<div style="margin-top:1rem">${lines2}${ev.bible_ref_2 ? `<p class="bible-ref" style="margin-top:0.75rem">${escapeHTML(ev.bible_ref_2)}</p>` : ''}</div>` : ''}
        <div style="font-size:1.2rem;color:${ev.event_color||'#c9a84c'};margin-top:0.75rem;letter-spacing:0.2em">✦</div>
      </div>
      ${parentsHtml}
      ${coupleNamesHtml}
      ${inviteHtml}
    </div>
  </div>`;
}

function buildInviteSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const lines = (ev.invite_text || '').split('\n').map(l => {
    if (l.trim() === '') return '<br>';
    const rendered = l.replace(/__BOLD__(.*?)__\/BOLD__/g, (_, name) =>
      `<strong style="font-size:1.1em">${name}</strong>`);
    if (rendered !== l) return `<p class="invitation-text">${rendered}</p>`;
    return `<p class="invitation-text">${escapeHTML(l)}</p>`;
  }).join('');
  return _SD + `<div class="event-section" style="background:#fff"><div class="section-inner reveal">${lines}</div></div>`;
}

function buildDateSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  if (!ev.date) return '';
  // Parse date safely - handle all formats
  let _dateStr = ev.date;
  if (!_dateStr) return '';
  // If it's an HTMLInputElement somehow, get its value
  if (typeof _dateStr === 'object' && _dateStr.value !== undefined) _dateStr = _dateStr.value;
  _dateStr = String(_dateStr).trim();
  // Extract YYYY-MM-DD part
  const _dateMatch = _dateStr.match(/(\d{4}-\d{2}-\d{2})/);
  if (!_dateMatch) return '';
  const _datePart = _dateMatch[1];
  const d = new Date(_datePart + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const days   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  const eventColor = ev.event_color || '#3a5a2a';
  // Build time string safely
  let _timeRaw = ev.time;
  if (typeof _timeRaw === 'object' && _timeRaw !== null && _timeRaw.value !== undefined) _timeRaw = _timeRaw.value;
  const _timeStr = _timeRaw ? String(_timeRaw).trim().substring(0, 5) : '';
  // Check show_time — accept both 'yes' string, boolean true, and showTime boolean
  const showTime = (_yesOrTrue(ev.show_time) || ev.showTime === true) && _timeStr;
  const timeLabel = showTime ? `Às ${_timeStr}` : '';
  const heart = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z"/></svg>`;
  const dateStyle = ev.date_style || 'classic';

  // ── Style: MINIMAL — just text, no boxes ──
  if (dateStyle === 'minimal') {
    return _SD + `<div class="event-section" style="background:#fff;padding:1.5rem 1rem;text-align:center">
      <div class="reveal">
        <p style="font-size:0.7rem;letter-spacing:0.15em;text-transform:uppercase;color:${eventColor};font-weight:700;margin-bottom:0.4rem">${days[d.getDay()]}</p>
        <p style="font-size:1.6rem;font-weight:800;color:#1e293b">${String(d.getDate()).padStart(2,'0')} de ${months[d.getMonth()]} de ${d.getFullYear()}</p>
        ${showTime ? `<p style="font-size:0.95rem;color:#6b7280;margin-top:0.3rem">${timeLabel}</p>` : ''}
      </div>
    </div>`;
  }

  // ── Style: CARD — centered card with shadow ──
  if (dateStyle === 'card') {
    return _SD + `<div class="event-section" style="background:#fff;padding:1.5rem 1rem">
      <div class="section-inner" style="display:flex;justify-content:center">
        <div class="reveal scale-in" style="background:${eventColor}0d;border:1.5px solid ${eventColor}33;border-radius:1.25rem;padding:1.75rem 2.5rem;text-align:center">
          <p style="font-size:0.68rem;letter-spacing:0.15em;text-transform:uppercase;color:${eventColor};font-weight:700;margin-bottom:0.5rem">${heart} ${days[d.getDay()]} ${heart}</p>
          <p style="font-size:2.4rem;font-weight:900;color:${eventColor};line-height:1">${String(d.getDate()).padStart(2,'0')}</p>
          <p style="font-size:1.1rem;font-weight:700;color:#1e293b;margin-top:0.2rem">${months[d.getMonth()]} ${d.getFullYear()}</p>
          ${showTime ? `<p style="font-size:0.85rem;color:#6b7280;margin-top:0.5rem">${timeLabel}</p>` : ''}
        </div>
      </div>
    </div>`;
  }

  // ── Style: CLASSIC (default) — month on the side + big day number ──
  return _SD + `<div class="event-section" style="background:#fff;padding:1.25rem 1rem">
    <div class="section-inner">
      <div class="date-display reveal scale-in" style="--ev-color:${eventColor}">
        <div class="date-weekday-top" style="color:${eventColor}">
          ${heart} ${days[d.getDay()]} ${heart}
        </div>
        <div class="date-row">
          <div class="date-side" style="--ec:${eventColor}">
            <span class="date-side-label">${months[d.getMonth()]}</span>
          </div>
          <div class="date-day-num" style="color:${eventColor}">${String(d.getDate()).padStart(2,'0')}</div>
          <div class="date-side" style="--ec:${eventColor}">
            <span class="date-side-label">${showTime ? timeLabel : ''}</span>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function buildCountdownSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  if (!ev.date) return '';
  return _SD + `<div class="event-section" style="background:linear-gradient(135deg,#f0f9fb,#e6f4f7)">
    <div class="section-inner" style="text-align:center">
      <div class="reveal">
        <span class="section-tag">Contagem Regressiva até ao Grande Dia</span>
        <div class="countdown-section-grid">
          <div class="countdown-section-box" style="background:${ev.event_color||'#007f9f'}"><div class="cdb-num" id="cd-days">--</div><div class="cdb-label">Dias</div></div>
          <div class="countdown-section-box" style="background:${ev.event_color||'#007f9f'}"><div class="cdb-num" id="cd-hours">--</div><div class="cdb-label">Horas</div></div>
          <div class="countdown-section-box" style="background:${ev.event_color||'#007f9f'}"><div class="cdb-num" id="cd-mins">--</div><div class="cdb-label">Min</div></div>
          <div class="countdown-section-box" style="background:${ev.event_color||'#007f9f'}"><div class="cdb-num" id="cd-secs">--</div><div class="cdb-label">Seg</div></div>
        </div>
      </div>
    </div>
  </div>`;
}

function startCountdownInterval(dateStr, timeStr) {
  if (window._countdownInterval) clearInterval(window._countdownInterval);
  function parseEventDate(d, t) {
    if (!d) return null;
    // Remove time if already embedded in date string
    const datePart = d.includes('T') ? d.split('T')[0] : d.split(' ')[0];
    // Build time part (strip seconds if present e.g. "20:33:00" -> "20:33")
    let timePart = (t || '00:00').trim();
    if (timePart.split(':').length > 2) timePart = timePart.split(':').slice(0,2).join(':');
    return new Date(datePart + 'T' + timePart + ':00');
  }
  function update() {
    const t = parseEventDate(dateStr, timeStr);
    if (!t || isNaN(t.getTime())) return;
    const diff = t - new Date();
    const dEl = document.getElementById('cd-days');
    if (!dEl) { clearInterval(window._countdownInterval); return; }
    if (diff <= 0) { ['cd-days','cd-hours','cd-mins','cd-secs'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='0';}); return; }
    document.getElementById('cd-days').textContent  = Math.floor(diff/86400000);
    document.getElementById('cd-hours').textContent = Math.floor((diff%86400000)/3600000);
    document.getElementById('cd-mins').textContent  = Math.floor((diff%3600000)/60000);
    document.getElementById('cd-secs').textContent  = Math.floor((diff%60000)/1000);
  }
  update();
  window._countdownInterval = setInterval(update, 1000);
}

function buildStorySection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  if (!ev.story_text) return '';
  const evColor = ev.event_color || '#007f9f';
  const storyStyle = ev.story_style || 'centered';

  // ── Style: PHOTO-SIDE — story text next to a photo ──
  if (storyStyle === 'photo-side' && ev.story_photo_url) {
    return _SD + `<div class="event-section story-section">
      <div class="section-inner">
        <h2 class="section-title reveal" style="text-align:center;margin-bottom:1.5rem">Nossa História</h2>
        <div class="reveal" style="display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap;max-width:560px;margin:0 auto">
          <div style="flex:1 1 220px;min-width:200px;border-radius:1rem;overflow:hidden;aspect-ratio:4/5">
            <img src="${ev.story_photo_url}" style="width:100%;height:100%;object-fit:cover" alt="">
          </div>
          <div style="flex:1 1 220px;min-width:200px">
            <p style="font-size:0.88rem;color:#4b5563;line-height:1.75;white-space:pre-line">${escapeHTML(ev.story_text)}</p>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── Style: QUOTE — large quotation mark, centered italic text ──
  if (storyStyle === 'quote') {
    return _SD + `<div class="event-section story-section" style="background:${evColor}08">
      <div class="section-inner" style="text-align:center;max-width:520px;margin:0 auto">
        <div class="reveal">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="${evColor}" style="opacity:0.35;margin-bottom:0.5rem"><path d="M9.983 3v7.391c0 5.704-3.731 9.57-8.983 10.609l-.995-2.151c2.432-.917 3.995-3.638 3.995-5.849h-4v-10h9.983zm14.017 0v7.391c0 5.704-3.748 9.57-9 10.609l-.996-2.151c2.433-.917 3.996-3.638 3.996-5.849h-3.983v-10h9.983z"/></svg>
          <h2 class="section-title" style="margin-bottom:1rem">Nossa História</h2>
          <p style="font-size:1rem;color:#374151;line-height:1.85;font-style:italic;white-space:pre-line">${escapeHTML(ev.story_text)}</p>
        </div>
      </div>
    </div>`;
  }

  // Parse story text: chapters separated by double newline
  // Each chapter: first line = date/title, rest = body text
  const chapters = ev.story_text.split(/\n\n+/).filter(c => c.trim());

  const heartSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="${evColor}" xmlns="http://www.w3.org/2000/svg"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

  if (chapters.length <= 1) {
    // Plain text fallback
    return _SD + `<div class="event-section story-section">
      <div class="section-inner" style="text-align:center">
        <div class="reveal">
          <h2 class="section-title">Nossa História</h2>
          <p class="story-text">${escapeHTML(ev.story_text)}</p>
        </div>
      </div>
    </div>`;
  }

  // Zigzag timeline
  const rows = chapters.map((ch, i) => {
    const lines = ch.trim().split('\n');
    const titleLine = lines[0] || '';
    const body = lines.slice(1).join(' ').trim();
    const isLeft = i % 2 === 0;

    const card = `<div class="story-card ${isLeft ? 'story-left' : 'story-right'} reveal" style="background:transparent;border:none;box-shadow:none;padding:0.5rem 0.9rem">
      <div class="story-date" style="font-size:0.65rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${evColor};margin-bottom:0.2rem">${escapeHTML(titleLine)}</div>
      ${body ? `<p class="story-body" style="font-size:0.78rem;color:#4b5563;line-height:1.55;margin:0">${escapeHTML(body)}</p>` : ''}
    </div>`;
    const node = `<div class="story-node" style="width:10px;height:10px;border-radius:50%;background:${evColor};flex-shrink:0;position:relative;z-index:3;box-shadow:0 0 0 3px #fff,0 0 0 4px color-mix(in srgb,${evColor} 30%,transparent);transition:width 0.3s ease,height 0.3s ease;"></div>`;
    const empty = `<div></div>`;

    return `<div class="story-row">
      ${isLeft ? card : empty}
      ${node}
      ${isLeft ? empty : card}
    </div>`;
  }).join('');

  return _SD + `<div class="event-section story-section">
    <div class="section-inner">
      <h2 class="section-title reveal" style="text-align:center;margin-bottom:2.5rem">Nossa História</h2>
      <div class="story-timeline" style="--ev-color:${evColor}">
        <div class="story-line"></div>
        ${rows}
      </div>
    </div>
  </div>`;
}

function buildParentsSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  // Invert groom/bride parents if invert_names is active
  const invertNames = _yesOrTrue(ev.invert_names);
  let groomParents = ev.groom_parents;
  let brideParents = ev.bride_parents;
  if (invertNames) { [groomParents, brideParents] = [brideParents, groomParents]; }
  // Use inverted parents
  const _ev = { ...ev, groom_parents: groomParents, bride_parents: brideParents };
  const singleP = ev.event_type === 'birthday' || ev.event_type === 'other';
  const groomSide = ev.side1_name || (singleP ? 'Família' : 'Família do Noivo');
  const brideSide = ev.side2_name || (singleP ? 'Outros Familiares' : 'Família da Noiva');
  const blessingHeader = ev.invite_blessing || (singleP ? 'Com a bênção de Deus e da família' : 'Com a bênção de Deus e de seus pais');
  function renderCol(name, text) {
    if (!text || !text.trim()) return '';
    const rows = text.split('\n').filter(l=>l.trim()).map(l=>{
      const hasCross = l.includes('✟');
      const im = l.includes('(em memória)') || hasCross;
      const n = l.replace('(em memória)','').replace(/✟/g,'').trim();
      const marker = hasCross ? '<span class="in-memoriam" style="opacity:0.7">✟</span>' : (im ? '<span class="in-memoriam">(em memória)</span>' : '');
      return `<p class="parent-name">${escapeHTML(n)}${marker}</p>`;
    }).join('');
    return `<div class="parents-col"><p class="parents-col-title">${escapeHTML(name)}</p><div class="parents-name-grid">${rows}</div></div>`;
  }
  // Helper without title
  function renderColNoTitle(text) {
    if (!text || !text.trim()) return '';
    const rows = text.split('\n').filter(l=>l.trim()).map(l=>{
      const hasCross = l.includes('✟');
      const im = l.includes('(em memória)') || hasCross;
      const n = l.replace('(em memória)','').replace(/✟/g,'').trim();
      const marker = hasCross ? ' <span class="in-memoriam" style="opacity:0.7">✟</span>' : (im ? ' <span class="in-memoriam">(em memória)</span>' : '');
      return `<p class="parent-name">${escapeHTML(n)}${marker}</p>`;
    }).join('');
    return `<div class="parents-col">${rows}</div>`;
  }
  return _SD + `<div class="event-section" style="background:transparent;text-align:center">
    <div class="section-inner reveal">
      <div class="parents-columns" style="gap:2rem;justify-content:center">
        ${renderColNoTitle(ev.groom_parents)}
        ${ev.groom_parents && ev.bride_parents ? '<div class="parents-divider" style="flex-shrink:0;width:1px;background:linear-gradient(to bottom,transparent,var(--ev-color,#007f9f) 20%,var(--ev-color,#007f9f) 80%,transparent);align-self:stretch;min-height:60px"></div>' : ''}
        ${renderColNoTitle(ev.bride_parents)}
      </div>
    </div>
  </div>`;
}

function buildIbanSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const evColor = ev.event_color || '#007f9f';
  const msgLines = (ev.iban_message || '').split('\n').map(l => `<p style="color:#374151;font-size:0.92rem;line-height:1.7;text-align:center">${escapeHTML(l)}</p>`).join('');
  return _SD + `<div class="event-section" style="background:#f0f9fb">
    <div class="section-inner reveal" style="text-align:center">
      <div style="background:#fff;border-radius:1rem;padding:1.5rem 1.25rem;max-width:480px;margin:0 auto;border:1.5px solid color-mix(in srgb,${evColor} 25%,transparent)">
        <div style="text-align:center;margin-bottom:1rem">
          <div class="iban-gift-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${evColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
          </div>
          <span style="font-size:1.1rem;font-weight:800;color:${evColor}">Gostaria de nos presentear?</span>
        </div>
        ${msgLines}
        <div class="bg-gray-50 rounded-lg px-3 py-2 mt-3 mb-1 border border-teal-100"><p class="text-xs text-gray-400 mb-0.5">IBAN</p><p class="iban-value" style="text-align:center;word-break:break-all;margin:0.25rem 0">${escapeHTML(ev.iban_number)}</p></div>
        ${ev.iban_holder ? `<div class="bg-gray-50 rounded-lg px-3 py-2 mb-2 border border-teal-100"><p class="text-xs text-gray-400 mb-0.5">Titular</p><p class="text-sm font-semibold text-gray-700">${escapeHTML(ev.iban_holder)}</p></div>` : ''}
        <button class="iban-copy-btn" id="iban-copy-btn" onclick="copyIban('${escapeHTML(ev.iban_number)}')">
          <span class="action-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
          <span class="action-btn-label">Copiar IBAN</span>
        </button>
        ${ev.iban_footer ? `<p class="text-xs text-gray-400 mt-3 text-right italic">${escapeHTML(ev.iban_footer)}</p>` : ''}
      </div>
    </div>
  </div>`;
}

function buildGallerySection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const urls = (ev.gallery_urls || '').split('\n').map(u => u.trim()).filter(Boolean);
  if (!urls.length) return '';
  const style = ev.gallery_style || 'grid';
  const evColor = ev.event_color || '#007f9f';

  // ── Style: CAROUSEL — 3D perspective cards, one centered + side peeks ──
  // Matches "Nossos Momentos" layout: side images partially visible, blurred
  // background fill, center card sharp with dot indicators below.
  if (style === 'carousel') {
    const galId = 'gal3d_' + Math.random().toString(36).substring(2, 8);
    const slides = urls.map((u, i) => `<div class="g3d-slide" data-idx="${i}" style="background-image:url('${u}')"></div>`).join('');
    const dots = urls.map((_, i) => `<span class="g3d-dot ${i===0?'active':''}" data-idx="${i}" style="background:${i===0?evColor:'#d1d5db'}"></span>`).join('');
    // NOTE: <script> tags inserted via innerHTML never execute in browsers —
    // so the carousel's behaviour must be initialised by a real JS function
    // called AFTER the HTML lands in the DOM (see initGalleryCarousels(),
    // called from renderGuestSections right after sections are inserted).
    if (!window._pendingCarousels) window._pendingCarousels = [];
    window._pendingCarousels.push({ id: galId, color: evColor });
    return _SD + `<div class="event-section" style="background:#fdfaf6;overflow:hidden">
      <div class="section-inner">
        <h3 class="section-title reveal" style="text-align:center">Nossos Momentos</h3>
        <div id="${galId}" class="g3d-wrap reveal">
          <div class="g3d-track">${slides}</div>
          ${urls.length > 1 ? `
          <button class="g3d-arrow prev" aria-label="Anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <button class="g3d-arrow next" aria-label="Seguinte"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>
          <span class="g3d-counter">1 / ${urls.length}</span>` : ''}
        </div>
        <div class="g3d-dots">${dots}</div>
      </div>
    </div>`;
  }

  // ── Style: MASONRY — irregular mosaic, varying heights ──
  if (style === 'masonry') {
    const items = urls.map((u, i) => `<div class="gmasonry-item" style="background-image:url('${u}')" onclick="openLightbox('${u}')"></div>`).join('');
    return _SD + `<div class="event-section" style="background:#f8fafc"><div class="section-inner">
      <h3 class="section-title reveal">Galeria</h3>
      <div class="gmasonry-grid reveal-stagger">${items}</div>
    </div></div>`;
  }

  // ── Style: GRID (default) — classic uniform mosaic ──
  const items = urls.map(u => `<div class="gallery-item"><img src="${u}" data-url="${u}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover" onerror="this.closest('.gallery-item').style.display='none'"></div>`).join('');
  return _SD + `<div class="event-section" style="background:#f8fafc"><div class="section-inner">
    <h3 class="section-title reveal">Galeria</h3>
    <div class="gallery-grid reveal-stagger">${items}</div>
  </div></div>`;
}

function buildManualSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  // Parse manual_items from event data (JSON string) or fall back to Store/defaults
  let items = getDefaultManualItems(ev.event_type);
  if (ev.manual_items) {
    try { items = JSON.parse(ev.manual_items); } catch(e) {}
  } else if (Store.eventManualItems) {
    items = Store.eventManualItems;
  }
  const evColor = ev.event_color || '#007f9f';
  const style = ev.manual_style || 'cards';

  // ── Style: LIST — vertical list with small icons, no card backgrounds ──
  if (style === 'list') {
    const rows = items.map(it => `
      <div class="reveal" style="display:flex;align-items:flex-start;gap:0.85rem;padding:0.75rem 0;border-bottom:1px solid #e5e7eb;max-width:480px;margin:0 auto">
        <div style="flex-shrink:0;width:34px;height:34px;border-radius:50%;background:color-mix(in srgb,${evColor} 14%,white);display:flex;align-items:center;justify-content:center">
          ${it.icon && it.icon.startsWith('http') ? `<img src="${it.icon}" style="width:16px;height:16px;object-fit:contain">` : `<i data-lucide="${it.icon}" style="width:15px;height:15px;color:${evColor}"></i>`}
        </div>
        <p style="font-size:0.85rem;color:#374151;line-height:1.5;padding-top:0.3rem">${it.text.replace(/\n/g, '<br>')}</p>
      </div>`).join('');
    return _SD + `<div class="event-section" style="background:#f8fafc"><div class="section-inner">
      <h3 class="section-title reveal" style="color:${evColor}">Manual do Bom Convidado</h3>
      <div>${rows}</div>
    </div></div>`;
  }

  // ── Style: NUMBERED — numbered list, sequential reading order ──
  if (style === 'numbered') {
    const rows = items.map((it, i) => `
      <div class="reveal" style="display:flex;align-items:flex-start;gap:0.85rem;margin-bottom:1rem;max-width:480px;margin-left:auto;margin-right:auto">
        <div style="flex-shrink:0;width:30px;height:30px;border-radius:50%;background:${evColor};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem">${i+1}</div>
        <p style="font-size:0.85rem;color:#374151;line-height:1.5;padding-top:0.35rem">${it.text.replace(/\n/g, '<br>')}</p>
      </div>`).join('');
    return _SD + `<div class="event-section" style="background:#f8fafc"><div class="section-inner">
      <h3 class="section-title reveal" style="color:${evColor}">Manual do Bom Convidado</h3>
      <div>${rows}</div>
    </div></div>`;
  }

  // ── Style: CARDS (default) — grid of icon cards ──
  const cards = items.map(it => `<div class="manual-item">
    <div class="mi-icon" style="background:color-mix(in srgb,${evColor} 15%,white)">${it.icon && it.icon.startsWith('http') ? `<img src="${it.icon}" style="width:20px;height:20px;object-fit:contain">` : `<i data-lucide="${it.icon}" style="color:${evColor}"></i>`}</div>
    <p class="mi-text">${it.text.replace(/\n/g, '<br>')}</p>
  </div>`).join('');
  return _SD + `<div class="event-section" style="background:#f8fafc">
    <div class="section-inner">
      <h3 class="section-title reveal" style="color:${evColor}">Manual do Bom Convidado</h3>
      <div class="manual-grid reveal-stagger">${cards}</div>
    </div>
  </div>`;
}

function buildScheduleSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  // Parse schedule_items from event data (JSON string) or fall back to Store/defaults
  let items = DEFAULT_SCHEDULE_ITEMS;
  if (ev.schedule_items) {
    try { items = JSON.parse(ev.schedule_items); } catch(e) {}
  } else if (Store.eventScheduleItems) {
    items = Store.eventScheduleItems;
  }
  const evColor = ev.event_color || '#007f9f';
  const style = ev.schedule_style || 'timeline';

  // ── Style: ZIGZAG — alternating left/right around a central vertical line ──
  if (style === 'zigzag') {
    const rows = items.map((it, i) => {
      const isLeft = i % 2 === 0;
      const timeLabel  = `<div style="font-size:0.72rem;font-weight:800;color:${evColor};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">${it.time}</div>`;
      const textLabel  = `<div><div style="font-weight:700;color:#1e293b;font-size:0.88rem">${escapeHTML(it.label)}</div>${it.sub?`<div style="font-size:0.72rem;color:#6b7280;margin-top:1px">${escapeHTML(it.sub)}</div>`:''}</div>`;
      const node = `<div style="flex-shrink:0;width:44px;height:44px;border-radius:50%;background:${evColor};display:flex;align-items:center;justify-content:center;position:relative;z-index:2;box-shadow:0 2px 8px rgba(0,0,0,0.15)">${it.icon && it.icon.startsWith('http') ? `<img src="${it.icon}" style="width:20px;height:20px;object-fit:contain;filter:brightness(0) invert(1)">` : `<i data-lucide="${it.icon}" style="width:18px;height:18px;color:#fff"></i>`}</div>`;
      if (isLeft) {
        return `<div class="reveal" style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-bottom:1.5rem;max-width:500px;margin-left:auto;margin-right:auto">
          <div style="text-align:right;padding-right:0.75rem">${timeLabel}${textLabel}</div>
          ${node}
          <div></div>
        </div>`;
      } else {
        return `<div class="reveal" style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;margin-bottom:1.5rem;max-width:500px;margin-left:auto;margin-right:auto">
          <div></div>
          ${node}
          <div style="text-align:left;padding-left:0.75rem">${timeLabel}${textLabel}</div>
        </div>`;
      }
    }).join('');
    return _SD + `<div class="event-section">
      <div class="section-inner" style="text-align:center">
        <h3 class="section-title reveal">Itinerário</h3>
        <div style="position:relative;max-width:500px;margin:0 auto">
          <div style="position:absolute;left:50%;top:8px;bottom:8px;width:2px;background:linear-gradient(to bottom,transparent,${evColor} 5%,${evColor} 95%,transparent);transform:translateX(-50%);z-index:1"></div>
          ${rows}
        </div>
      </div>
    </div>`;
  }

  // ── Style: COMPACT — simple list, no icons, minimal spacing ──
  if (style === 'compact') {
    const rows = items.map(it => `
      <div class="reveal" style="display:flex;align-items:baseline;gap:0.85rem;padding:0.6rem 0;border-bottom:1px solid #f1f5f9">
        <span style="font-size:0.82rem;font-weight:800;color:${evColor};min-width:52px">${it.time}</span>
        <div><span style="font-weight:700;color:#1e293b;font-size:0.85rem">${escapeHTML(it.label)}</span>${it.sub?` <span style="font-size:0.75rem;color:#9ca3af">— ${escapeHTML(it.sub)}</span>`:''}</div>
      </div>`).join('');
    return _SD + `<div class="event-section">
      <div class="section-inner" style="max-width:480px;margin:0 auto">
        <h3 class="section-title reveal" style="text-align:center">Itinerário</h3>
        <div>${rows}</div>
      </div>
    </div>`;
  }

  // ── Style: CARDS — each moment its own card, vertical stack ──
  if (style === 'cards') {
    const rows = items.map(it => `
      <div class="reveal" style="background:#fff;border-radius:0.85rem;padding:1rem 1.1rem;margin-bottom:0.75rem;border:1.5px solid color-mix(in srgb,${evColor} 18%,#e5e7eb);display:flex;align-items:center;gap:0.85rem;max-width:480px;margin-left:auto;margin-right:auto">
        <div style="flex-shrink:0;width:48px;height:48px;border-radius:0.65rem;background:color-mix(in srgb,${evColor} 12%,white);display:flex;align-items:center;justify-content:center">
          ${it.icon && it.icon.startsWith('http') ? `<img src="${it.icon}" style="width:22px;height:22px;object-fit:contain">` : `<i data-lucide="${it.icon}" style="width:20px;height:20px;color:${evColor}"></i>`}
        </div>
        <div>
          <div style="font-size:0.7rem;font-weight:800;color:${evColor};text-transform:uppercase;letter-spacing:0.05em">${it.time}</div>
          <div style="font-weight:700;color:#1e293b;font-size:0.92rem">${escapeHTML(it.label)}</div>
          ${it.sub?`<div style="font-size:0.75rem;color:#6b7280">${escapeHTML(it.sub)}</div>`:''}
        </div>
      </div>`).join('');
    return _SD + `<div class="event-section">
      <div class="section-inner">
        <h3 class="section-title reveal" style="text-align:center">Itinerário</h3>
        <div style="margin-top:1rem">${rows}</div>
      </div>
    </div>`;
  }

  // ── Style: TIMELINE (default) — vertical line on the left, dot + time/label to the right ──
  const rows = items.map(it => `
    <div class="reveal" style="display:flex;gap:1rem;margin-bottom:1.5rem;max-width:480px;margin-left:auto;margin-right:auto;position:relative">
      <div style="flex-shrink:0;width:70px;text-align:right">
        <span style="font-size:1.05rem;font-weight:800;color:#1e293b">${it.time}</span>
      </div>
      <div style="flex-shrink:0;position:relative;display:flex;flex-direction:column;align-items:center">
        <div style="width:12px;height:12px;border-radius:50%;background:${evColor};margin-top:6px;flex-shrink:0;box-shadow:0 0 0 4px color-mix(in srgb,${evColor} 15%,white)"></div>
      </div>
      <div style="flex:1;padding-bottom:0.25rem">
        <div style="font-weight:800;color:#1e293b;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.03em">${escapeHTML(it.label)}</div>
        ${it.sub?`<div style="font-size:0.82rem;color:#9ca3af;margin-top:1px">${escapeHTML(it.sub)}</div>`:''}
      </div>
    </div>`).join('');

  return _SD + `<div class="event-section">
    <div class="section-inner">
      <h3 class="section-title reveal" style="text-align:center">Itinerário</h3>
      <div style="position:relative;max-width:480px;margin:0 auto;text-align:left">
        <div style="position:absolute;left:76px;top:14px;bottom:14px;width:2px;background:linear-gradient(to bottom,transparent,${evColor}55 5%,${evColor}55 95%,transparent)"></div>
        ${rows}
      </div>
    </div>
  </div>`;
}


// ===================== MANUAL EDITOR =====================
async function openManualEditor() {
  // ✅ CORREÇÃO: a fonte de verdade é SEMPRE a tabela event_visuals (é onde
  // saveManualItems() grava). Antes, este editor confiava primeiro numa
  // variável em memória (Store.eventManualItems) que podia estar
  // desactualizada — isso fazia o organizador editar "por cima" de uma
  // versão antiga e perder itens que já tinha guardado, sem aviso nenhum.
  const eventId = Store.currentEventId || Store._intakeEventId;
  let items = null;

  if (eventId) {
    try {
      const visuals = await loadEventVisuals(eventId);
      if (visuals && visuals.manual_items) {
        items = JSON.parse(visuals.manual_items);
      }
    } catch (e) {
      console.warn('openManualEditor: falha ao carregar event_visuals, a usar fallback', e);
    }
  }

  // Ainda não há nada gravado em event_visuals (ex.: evento criado há pouco,
  // ou edição em curso nesta mesma sessão que ainda não recarregou) — usa o
  // que está em memória.
  if (!items && Store.eventManualItems) {
    items = JSON.parse(JSON.stringify(Store.eventManualItems));
  }

  // Último recurso: valor antigo gravado directamente na tabela events
  // (acontece em eventos criados antes desta correcção).
  if (!items) {
    const evFromStore = eventId ? Store.events.find(e => e.id === eventId) : null;
    if (evFromStore && evFromStore.manual_items) {
      try { items = JSON.parse(evFromStore.manual_items); }
      catch (e) { items = null; }
    }
  }

  if (!items) {
    const evForType = eventId ? Store.events.find(e => e.id === eventId) : null;
    items = JSON.parse(JSON.stringify(getDefaultManualItems(evForType && evForType.event_type)));
  }
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'manual-editor-modal';
  // CRITICAL: this modal can be opened from inside the intake form, which
  // itself sits at z-index:9999. .modal-overlay's default z-index:50 would
  // render this completely behind the intake form — invisible, looking
  // exactly like "nothing happens" when the button is clicked.
  modal.style.zIndex = '10500';

  function renderItems() {
    return items.map((it, i) => `
      <div class="flex items-center gap-2 mb-2" data-idx="${i}">
        <input class="input-field text-xs flex-1" value="${it.text.replace(/\n/g,' ')}" placeholder="Texto" id="mi-text-${i}">
        <input class="input-field text-xs w-28" value="${it.icon}" placeholder="Ícone lucide" id="mi-icon-${i}">
        <button type="button" class="text-red-400 px-1" onclick="removeManualItem(${i})"><i data-lucide="x" class="w-4 h-4"></i></button>
        ${i > 0 ? `<button type="button" class="text-gray-400 px-1" onclick="moveManualItem(${i},-1)"><i data-lucide="arrow-up" class="w-3 h-3"></i></button>` : ''}
        ${i < items.length-1 ? `<button type="button" class="text-gray-400 px-1" onclick="moveManualItem(${i},1)"><i data-lucide="arrow-down" class="w-3 h-3"></i></button>` : ''}
      </div>`).join('');
  }

  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl shadow-lg p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto">
    <h3 class="text-base font-bold text-gray-800 mb-1">Manual do Bom Convidado</h3>
    <p class="text-xs text-gray-400 mb-2">Os ícones são nomes do <a href="https://lucide.dev/icons/" target="_blank" class="text-teal-500 underline">Lucide Icons</a>. Escreve o nome e vê a pré-visualização ao lado.</p>
    <div id="manual-items-list">${renderItems()}</div>
    <div class="flex gap-3 mt-2">
      <button type="button" class="text-xs text-teal-600 font-semibold" onclick="addManualItem()">+ Adicionar item</button>
      <button type="button" class="text-xs text-teal-600 font-semibold" onclick="openBulkPasteModal('manual')">📋 Colar em bloco</button>
    </div>
    <div class="flex gap-2 mt-4">
      <button class="flex-1 btn-main" onclick="saveManualItems()">Guardar</button>
      <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      <button class="text-xs text-gray-400 px-2" onclick="resetManualItems()">Repor padrão</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  lucide.createIcons();

  window._manualEditorItems = items;
}

function addManualItem() {
  window._manualEditorItems.push({ icon: 'star', text: 'Novo item' });
  refreshManualEditorList();
}
function removeManualItem(i) {
  window._manualEditorItems.splice(i, 1);
  refreshManualEditorList();
}
function moveManualItem(i, dir) {
  const arr = window._manualEditorItems;
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  refreshManualEditorList();
}
function refreshManualEditorList() {
  const items = window._manualEditorItems;
  document.getElementById('manual-items-list').innerHTML = items.map((it, i) => `
    <div class="flex items-center gap-2 mb-2 p-1.5 bg-gray-50 rounded-lg">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgba(0,127,159,0.12)" id="mi-prev-${i}">
        ${it.icon && it.icon.startsWith('http') ? `<img src="${it.icon}" style="width:16px;height:16px;object-fit:contain">` : `<i data-lucide="${it.icon}" style="width:16px;height:16px;color:#007f9f"></i>`}
      </div>
      <input class="input-field text-xs flex-1" value="${it.text.replace(/\n/g,' ')}" placeholder="Texto" id="mi-text-${i}">
      <input class="input-field text-xs w-20" value="${it.icon}" placeholder="lucide icon" id="mi-icon-${i}"
        oninput="const p=document.getElementById('mi-prev-'+${i});if(p){p.innerHTML='<i data-lucide=\''+this.value+'\' style=\'width:16px;height:16px;color:#007f9f\'></i>';try{lucide.createIcons();}catch(e){}}">
      <button type="button" onclick="openIconPickerModal('manual', url => { const inp=document.getElementById('mi-icon-${i}'); if(inp) inp.value=url; const p=document.getElementById('mi-prev-${i}'); if(p) p.innerHTML='<img src=\\''+url+'\\' style=\\'width:16px;height:16px;object-fit:contain\\'>'; })" style="background:#f0f9fb;color:#007f9f;border:none;border-radius:0.4rem;padding:0.3rem;font-size:0.6rem;font-weight:700;cursor:pointer;flex-shrink:0" title="Escolher SVG da biblioteca">SVG</button>
      <button type="button" class="text-red-400" onclick="removeManualItem(${i})"><i data-lucide="x" class="w-4 h-4"></i></button>
      ${i > 0 ? `<button type="button" class="text-gray-400" onclick="moveManualItem(${i},-1)"><i data-lucide="arrow-up" class="w-3 h-3"></i></button>` : '<div class="w-5"></div>'}
      ${i < items.length-1 ? `<button type="button" class="text-gray-400" onclick="moveManualItem(${i},1)"><i data-lucide="arrow-down" class="w-3 h-3"></i></button>` : '<div class="w-5"></div>'}
    </div>`).join('');
  lucide.createIcons();
}
async function saveManualItems() {
  const items = window._manualEditorItems;
  items.forEach((it, i) => {
    it.text = (document.getElementById('mi-text-' + i)?.value || it.text).replace(/\\n/g, '\n');
    it.icon = document.getElementById('mi-icon-' + i)?.value || it.icon;
  });
  Store.eventManualItems = items;

  // Persist immediately to Supabase
  const eventId = Store.currentEventId || Store._intakeEventId;
  dlog('📝 saveManualItems — a guardar para eventId:', eventId, 'itens:', items);
  if (!eventId) {
    console.error('❌ saveManualItems: nenhum eventId disponível (Store.currentEventId e Store._intakeEventId estão ambos vazios). As alterações NÃO foram guardadas no Supabase, apenas em memória.');
    toast('Erro: não foi possível identificar o evento. As alterações podem não ter sido guardadas.');
  }
  if (eventId) {
    try {
      const saveResult = await saveEventVisuals(eventId, {
        manual_items: JSON.stringify(items),
        show_manual: 'yes'
      });
      dlog('📝 saveManualItems — resultado da gravação:', saveResult);
      const swManual = document.getElementById('sw-manual');
      if (swManual && !swManual.classList.contains('active')) swManual.classList.add('active');
      const ev2 = Store.events.find(e => e.id === eventId);
      if (ev2) { ev2.manual_items = JSON.stringify(items); ev2.show_manual = 'yes'; }
    } catch(e) {
      console.error('❌ Erro ao guardar manual:', e);
      toast('Erro ao guardar o manual. Verifica a consola.');
    }
  }

  document.getElementById('manual-editor-modal')?.remove();
  toast('Manual guardado com sucesso!');
}
function resetManualItems() {
  const eventId = Store.currentEventId || Store._intakeEventId;
  const evForType = eventId ? Store.events.find(e => e.id === eventId) : null;
  window._manualEditorItems = JSON.parse(JSON.stringify(getDefaultManualItems(evForType && evForType.event_type)));
  Store.eventManualItems = null;
  refreshManualEditorList();
}


// ===================== SCHEDULE EDITOR =====================
function openScheduleEditor(clientMode) {
  clientMode = clientMode || (typeof Store._isClientIntakeContext !== 'undefined' && Store._isClientIntakeContext);
  let items;
  if (Store.eventScheduleItems) {
    items = JSON.parse(JSON.stringify(Store.eventScheduleItems));
  } else {
    const eventId = Store.currentEventId || Store._intakeEventId;
    const evFromStore = eventId ? Store.events.find(e => e.id === eventId) : null;
    if (evFromStore && evFromStore.schedule_items) {
      try { items = JSON.parse(JSON.stringify(JSON.parse(evFromStore.schedule_items))); }
      catch(e) { items = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_ITEMS)); }
    } else {
      items = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_ITEMS));
    }
  }
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'schedule-editor-modal';
  modal.style.zIndex = '10500';

  function renderRows() {
    if (clientMode) {
      // Simplified client view: only date/time + the moment description.
      // Icons stay admin-only — the client never sees or edits them, but
      // they're preserved underneath so the admin can assign them later.
      return items.map((it, i) => `
        <div class="flex items-start gap-2 mb-3 bg-gray-50 rounded-xl p-2">
          <div class="flex gap-2 flex-1">
            <input class="input-field text-xs w-24" value="${it.time}" placeholder="Hora (ex: 21h00)" id="sc-time-${i}">
            <input class="input-field text-xs flex-1" value="${it.label}" placeholder="Momento (ex: Entrada dos noivos)" id="sc-label-${i}">
          </div>
          <div class="flex flex-col gap-1 flex-shrink-0">
            <button type="button" class="text-red-400" onclick="removeScheduleItem(${i})"><i data-lucide="x" class="w-4 h-4"></i></button>
            ${i > 0 ? `<button type="button" class="text-gray-400" onclick="moveScheduleItem(${i},-1)"><i data-lucide="arrow-up" class="w-3 h-3"></i></button>` : ''}
            ${i < items.length-1 ? `<button type="button" class="text-gray-400" onclick="moveScheduleItem(${i},1)"><i data-lucide="arrow-down" class="w-3 h-3"></i></button>` : ''}
          </div>
        </div>`).join('');
    }
    return items.map((it, i) => `
      <div class="flex items-start gap-2 mb-3 bg-gray-50 rounded-xl p-2">
        <div class="flex flex-col gap-1 flex-1">
          <div class="flex gap-2">
            <input class="input-field text-xs w-20" value="${it.time}" placeholder="Hora" id="sc-time-${i}">
            <input class="input-field text-xs flex-1" value="${it.label}" placeholder="Momento" id="sc-label-${i}">
          </div>
          <div class="flex gap-2">
            <div style="display:flex;align-items:center;gap:4px">
        <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(0,127,159,0.12)" id="sc-prev-${i}"><i data-lucide="${it.icon}" style="width:13px;height:13px;color:#007f9f"></i></div>
        <input class="input-field text-xs" style="width:calc(100% - 2rem)" value="${it.icon}" placeholder="lucide icon" id="sc-icon-${i}" oninput="const p=document.getElementById('sc-prev-'+${i});if(p){p.innerHTML='<i data-lucide=\''+this.value+'\' style=\'width:13px;height:13px;color:#007f9f\'></i>';try{lucide.createIcons();}catch(e){}}">
      </div>
            <input class="input-field text-xs flex-1" value="${it.sub || ''}" placeholder="Subtítulo (opcional)" id="sc-sub-${i}">
          </div>
        </div>
        <div class="flex flex-col gap-1 flex-shrink-0">
          <button type="button" class="text-red-400" onclick="removeScheduleItem(${i})"><i data-lucide="x" class="w-4 h-4"></i></button>
          ${i > 0 ? `<button type="button" class="text-gray-400" onclick="moveScheduleItem(${i},-1)"><i data-lucide="arrow-up" class="w-3 h-3"></i></button>` : ''}
          ${i < items.length-1 ? `<button type="button" class="text-gray-400" onclick="moveScheduleItem(${i},1)"><i data-lucide="arrow-down" class="w-3 h-3"></i></button>` : ''}
        </div>
      </div>`).join('');
  }

  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl shadow-lg p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto">
    <h3 class="text-base font-bold text-gray-800 mb-1">Monograma do Dia</h3>
    <p class="text-xs text-gray-400 mb-2">${clientMode ? 'Coloca a hora e o momento de cada parte do dia. A ordem é organizada automaticamente.' : 'Os ícones são nomes do <a href="https://lucide.dev/icons/" target="_blank" class="text-teal-500 underline">Lucide Icons</a>. Escreve o nome e vê a pré-visualização.'}</p>
    <div id="schedule-items-list">${renderRows()}</div>
    <div class="flex gap-3 mt-2">
      <button type="button" class="text-xs text-teal-600 font-semibold" onclick="addScheduleItem(${clientMode})">+ Adicionar momento</button>
      <button type="button" class="text-xs text-teal-600 font-semibold" onclick="openBulkPasteModal('schedule')">📋 Colar em bloco</button>
    </div>
    <div class="flex gap-2 mt-4">
      <button class="flex-1 btn-main" onclick="saveScheduleItems()">Guardar</button>
      <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      ${!clientMode ? `<button class="text-xs text-gray-400 px-2" onclick="resetScheduleItems()">Repor padrão</button>` : ''}
    </div>
  </div>`;
  document.body.appendChild(modal);
  lucide.createIcons();
  window._scheduleEditorItems = items;
  window._scheduleEditorClientMode = clientMode;
}

// ===================== COLAR TEXTO INTELIGENTE =====================
// Permite ao admin (normalmente a impersonar um utilizador) colar um bloco
// de texto livre, com marcadores tipo "📖 Texto bíblico:", "👰 Nomes dos
// noivos:", etc — muito comum quando o cliente manda os dados todos de
// uma vez por WhatsApp — e o site distribui automaticamente cada parte
// para o campo certo do formulário.

function openSmartPasteModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'smart-paste-modal';
  modal.style.zIndex = '10700';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl shadow-lg p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto">
    <h3 class="text-base font-bold text-gray-800 mb-1">🪄 Colar Texto Inteligente</h3>
    <p class="text-xs text-gray-400 mb-3">Cola aqui o texto todo que o cliente mandou (com os marcadores tipo "📖 Texto bíblico:", "👰 Nomes dos noivos:", etc). O site tenta identificar cada parte e preencher os campos certos — revê sempre depois, por segurança.</p>
    <textarea id="smart-paste-textarea" class="input-field text-sm" rows="14" placeholder="Cola aqui o texto completo..."></textarea>
    <div class="flex gap-2 mt-4">
      <button class="flex-1 btn-main text-sm" onclick="applySmartPaste()">Analisar e Preencher</button>
      <button class="flex-1 btn-outline text-sm" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
    </div>
    <div id="smart-paste-report" class="mt-3 text-xs"></div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('smart-paste-textarea').focus();
}

function _activateSwitch(id, extraId) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('active');
  if (extraId) document.getElementById(extraId)?.classList.remove('hidden');
}

const MONTHS_PT = {
  'janeiro':1,'fevereiro':2,'março':3,'marco':3,'abril':4,'maio':5,'junho':6,
  'julho':7,'agosto':8,'setembro':9,'outubro':10,'novembro':11,'dezembro':12
};

function _parsePtDate(text) {
  const m = text.match(/(\d{1,2})\s*de\s*([a-zçã]+)(?:\s*de)?\s*(\d{4})/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = MONTHS_PT[m[2].toLowerCase()];
  const year = parseInt(m[3], 10);
  if (!month) return null;
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function _stripLabel(line) {
  // Remove prefixos comuns: "R:", "R :", parênteses como "(Noivo)", etc,
  // deixando só o conteúdo real.
  return line.replace(/^\s*R\s*:\s*/i, '').trim();
}

function applySmartPaste() {
  const raw = document.getElementById('smart-paste-textarea').value;
  if (!raw.trim()) { document.getElementById('smart-paste-modal')?.remove(); return; }

  // ── 1) Dividir o texto em secções, usando os marcadores conhecidos ──
  const SECTION_DEFS = [
    { key: 'bible',    test: /b[ií]blic/i },
    { key: 'couple',   test: /noivos|do casal|nome do anivers/i },
    { key: 'parents',  test: /nomes dos pais|dos pais/i },
    { key: 'date',     test: /data do evento|data:/i },
    { key: 'time',     test: /hor[áa]rio/i },
    { key: 'venue',    test: /local do evento|locais do evento/i },
    { key: 'maps',     test: /google maps|link do local|mapa/i },
    { key: 'schedule', test: /cronograma/i },
    { key: 'message',  test: /mensagem para os convidados|mensagem do casal|mensagem:/i },
  ];

  const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length);
  const sections = {};
  let current = null;

  lines.forEach(line => {
    // Tira emojis/símbolos do início (e quaisquer emojis a meio da linha)
    // — tanto para comparar o cabeçalho, como para nunca deixar emoji
    // entrar no conteúdo que vai para os campos do formulário.
    const noEmoji = line.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '').replace(/ {2,}/g, ' ').trim();
    const clean = noEmoji.replace(/^[^\p{L}]*/u, '').trim();
    const matched = SECTION_DEFS.find(s => s.test.test(clean));
    if (matched) {
      current = matched.key;
      if (!sections[current]) sections[current] = [];
      // Se houver texto depois da própria etiqueta na mesma linha (ex:
      // "Horário: Civil: 14:30"), guarda só essa parte como 1ª linha.
      const afterLabel = clean.replace(/^[^:]*:\s*/, '').trim();
      if (afterLabel && afterLabel !== clean) sections[current].push(afterLabel);
    } else if (current) {
      sections[current].push(noEmoji);
    }
  });

  const filled = [];

  // ── 2) Texto bíblico ──
  if (sections.bible && sections.bible.length) {
    const first = sections.bible[0];
    const looksLikeRef = /\d/.test(first) && first.length < 40;
    const ref = looksLikeRef ? _stripLabel(first) : '';
    const textLines = looksLikeRef ? sections.bible.slice(1) : sections.bible;
    const text = textLines.map(_stripLabel).join('\n').replace(/^["“]|["”]$/g, '');
    if (text) { document.getElementById('evt-bible-text').value = text; _activateSwitch('sw-bible','bible-extra'); filled.push('Texto bíblico'); }
    if (ref) { document.getElementById('evt-bible-ref').value = ref; }
  }

  // ── 3) Nomes dos noivos ──
  if (sections.couple && sections.couple.length) {
    const line = _stripLabel(sections.couple[0]);
    const parts = line.split(/\s+e\s+/i);
    if (parts.length >= 2) {
      document.getElementById('evt-groom-name').value = parts[0].trim();
      document.getElementById('evt-bride-name').value = parts[1].trim();
      filled.push('Nomes dos noivos');
    } else if (parts.length === 1) {
      document.getElementById('evt-groom-name').value = parts[0].trim();
      filled.push('Nome do aniversariante');
    }
  }

  // ── 4) Nomes dos pais ──
  if (sections.parents && sections.parents.length) {
    let groomP = '', brideP = '';
    sections.parents.forEach(line => {
      const clean = _stripLabel(line);
      if (/noivo\)/i.test(clean) || /^\(noivo/i.test(clean)) {
        groomP = clean.replace(/^\(noivo\)\s*:?\s*/i, '').replace(/\s+e\s+/gi, '\n').trim();
      } else if (/noiva\)/i.test(clean) || /^\(noiva/i.test(clean)) {
        brideP = clean.replace(/^\(noiva\)\s*:?\s*/i, '').replace(/\s+e\s+/gi, '\n').trim();
      }
    });
    if (groomP) { document.getElementById('evt-groom-parents').value = groomP; _activateSwitch('sw-parents','parents-extra'); filled.push('Pais do noivo'); }
    if (brideP) { document.getElementById('evt-bride-parents').value = brideP; filled.push('Pais da noiva'); }
  }

  // ── 5) Data do evento ──
  if (sections.date && sections.date.length) {
    const dateStr = _parsePtDate(sections.date.join(' '));
    if (dateStr) { document.getElementById('evt-date').value = dateStr; filled.push('Data'); }
  }

  // ── 6) Horário (primeiro horário encontrado vai para a hora principal) ──
  let timesFound = [];
  if (sections.time && sections.time.length) {
    sections.time.forEach(line => {
      const m = line.match(/(\d{1,2}[:h]\d{2})/);
      if (m) timesFound.push({ label: line.replace(m[0], '').replace(/[:\-–]+$/, '').trim(), time: m[1].replace('h',':') });
    });
    if (timesFound.length) { document.getElementById('evt-time').value = timesFound[0].time; filled.push('Hora'); }
  }

  // ── 7) Local do evento (cerimónia / civil / recepção) ──
  const venueMap = { ceremony: null, civil: null, reception: null };
  if (sections.venue && sections.venue.length) {
    sections.venue.forEach(line => {
      const clean = _stripLabel(line);
      let type = null;
      if (/civil/i.test(clean)) type = 'civil';
      else if (/cerim[óo]nia|religios/i.test(clean)) type = 'ceremony';
      else if (/recep[çc][ãa]o|copo de [áa]gua|festa/i.test(clean)) type = 'reception';
      if (type) {
        const name = clean.replace(/^\([^)]*\)\s*:?\s*/, '').replace(/^[^:]*:\s*/, '').trim();
        venueMap[type] = name;
      }
    });
    Object.keys(venueMap).forEach(type => {
      if (venueMap[type]) {
        const el = document.getElementById(`evt-venue-${type}`);
        if (el) { el.value = venueMap[type]; _activateSwitch('sw-venues','venues-extra'); filled.push('Local (' + type + ')'); }
      }
    });
  }

  // ── 8) Link do Google Maps — aplica a todos os locais já preenchidos ──
  if (sections.maps && sections.maps.length) {
    const mapsText = sections.maps.join(' ');
    const urls = mapsText.match(/https?:\/\/\S+/g) || [];
    if (urls.length) {
      Object.keys(venueMap).forEach(type => {
        if (venueMap[type]) {
          const el = document.getElementById(`evt-venue-${type}-maps`);
          if (el && !el.value) el.value = urls[0];
        }
      });
      filled.push('Link do mapa');
    }
  }

  // ── 9) Cronograma do dia ──
  if (sections.schedule && sections.schedule.length) {
    const items = [];
    sections.schedule.forEach((line, i) => {
      let m = line.match(/^(\d{1,2}[:h]\d{2})\s*[-–:]?\s*(.+)$/); // hora primeiro
      let time, label;
      if (m) { time = m[1].replace('h',':'); label = m[2].trim(); }
      else {
        m = line.match(/^(.+?)[\s,–-]+(\d{1,2}[:h]\d{2})\s*$/); // hora no fim
        if (m) { label = m[1].trim(); time = m[2].replace('h',':'); }
      }
      if (time && label) items.push({ icon: _BULK_PASTE_ICONS[i % _BULK_PASTE_ICONS.length], time, label, sub: '' });
    });
    if (items.length) {
      Store.eventScheduleItems = items;
      _activateSwitch('sw-schedule','schedule-extra');
      filled.push('Cronograma (' + items.length + ' momentos)');
    }
  }

  // ── 10) Mensagem para os convidados ──
  if (sections.message && sections.message.length) {
    const msg = sections.message.join('\n').trim();
    if (msg) {
      document.getElementById('evt-couplemsg-text').value = msg;
      _activateSwitch('sw-couplemsg','couplemsg-extra');
      filled.push('Mensagem para os convidados');
    }
  }

  // ── Relatório final ──
  const reportEl = document.getElementById('smart-paste-report');
  if (reportEl) {
    reportEl.innerHTML = filled.length
      ? `<p class="text-green-600 font-semibold mb-1">✅ Preenchido: ${filled.join(', ')}.</p><p class="text-gray-400">Revê os campos antes de guardar — a leitura é automática, pode não ser perfeita.</p>`
      : `<p class="text-amber-600 font-semibold">⚠️ Não consegui identificar nenhuma parte conhecida neste texto. Tenta manter os marcadores tipo "📖 Texto bíblico:", "👰 Nomes dos noivos:", etc.</p>`;
  }
  if (filled.length) toast('Texto analisado — ' + filled.length + ' secções preenchidas!');
  setTimeout(() => { document.getElementById('smart-paste-modal')?.remove(); }, filled.length ? 1800 : 0);
}


// Permite ao admin colar uma lista de texto simples e o site organiza
// automaticamente — sem precisar de preencher campo a campo. Funciona para
// o "Manual do Bom Convidado" (uma frase por linha) e para o "Monograma do
// Dia" (frase + hora no fim de cada linha, ex: "Corte do bolo 17:30").
const _BULK_PASTE_ICONS = ['check-circle','clock','users','shirt','baby','ban',
  'camera','heart','smile','music','party-popper','hand-heart','volume-x','door-open','sparkles'];

function openBulkPasteModal(target) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'bulk-paste-modal';
  modal.style.zIndex = '10600';
  const isSchedule = target === 'schedule';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl shadow-lg p-5 max-w-md w-full">
    <h3 class="text-base font-bold text-gray-800 mb-1">Colar em Bloco</h3>
    <p class="text-xs text-gray-400 mb-3">${isSchedule
      ? 'Uma linha por momento, com a hora no final. Ex: <br><code class="bg-gray-100 px-1 rounded">Corte do bolo 17:30</code>'
      : 'Uma frase por linha. Cada linha vira um item da lista.'}</p>
    <textarea id="bulk-paste-textarea" class="input-field text-sm" rows="10" placeholder="${isSchedule ? 'Cerimônia de alambamento 14h\nChegada dos convidados 16h\nEntrada dos noivos 17h' : 'Confirme a sua presença\nSeja pontual\nNão leve crianças'}"></textarea>
    <div class="flex gap-2 mt-4">
      <button class="flex-1 btn-main text-sm" onclick="applyBulkPaste('${target}', false)">Adicionar aos existentes</button>
      <button class="flex-1 btn-outline text-sm" onclick="applyBulkPaste('${target}', true)">Substituir tudo</button>
    </div>
    <button class="text-xs text-gray-400 mt-3 w-full text-center" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('bulk-paste-textarea').focus();
}

function applyBulkPaste(target, replace) {
  const raw = document.getElementById('bulk-paste-textarea').value;
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) { document.getElementById('bulk-paste-modal')?.remove(); return; }

  if (target === 'schedule') {
    // Extrai a hora do FIM de cada linha (ex: "14h", "17:30", "19h45") —
    // o resto da linha fica como o nome do momento.
    const newItems = lines.map((line, i) => {
      const m = line.match(/^(.*?)[\s,–-]+(\d{1,2}(?:[h:]\d{0,2})?)\s*h?\s*$/i);
      const label = m ? m[1].trim() : line;
      let time = m ? m[2].trim() : '';
      if (time && /^\d{1,2}$/.test(time)) time += 'h'; // só "14" → "14h"
      return { icon: _BULK_PASTE_ICONS[i % _BULK_PASTE_ICONS.length], time: time || '00h00', label, sub: '' };
    });
    window._scheduleEditorItems = replace ? newItems : [...window._scheduleEditorItems, ...newItems];
    refreshScheduleEditorList();
  } else {
    const newItems = lines.map((text, i) => ({ icon: _BULK_PASTE_ICONS[i % _BULK_PASTE_ICONS.length], text }));
    window._manualEditorItems = replace ? newItems : [...window._manualEditorItems, ...newItems];
    refreshManualEditorList();
  }
  toast(replace ? 'Lista substituída!' : 'Itens adicionados!');
  document.getElementById('bulk-paste-modal')?.remove();
}

function addScheduleItem(clientMode) {
  window._scheduleEditorItems.push({ icon: 'star', time: '00h00', label: 'Novo Momento', sub: '' });
  refreshScheduleEditorList();
}
function removeScheduleItem(i) { window._scheduleEditorItems.splice(i, 1); refreshScheduleEditorList(); }
function moveScheduleItem(i, dir) {
  const arr = window._scheduleEditorItems; const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]]; refreshScheduleEditorList();
}
function refreshScheduleEditorList() {
  const items = window._scheduleEditorItems;
  const clientMode = window._scheduleEditorClientMode;
  document.getElementById('schedule-items-list').innerHTML = items.map((it, i) => clientMode ? `
    <div class="flex items-start gap-2 mb-3 bg-gray-50 rounded-xl p-2">
      <div class="flex gap-2 flex-1">
        <input class="input-field text-xs w-24" value="${it.time}" placeholder="Hora (ex: 21h00)" id="sc-time-${i}">
        <input class="input-field text-xs flex-1" value="${it.label}" placeholder="Momento (ex: Entrada dos noivos)" id="sc-label-${i}">
      </div>
      <div class="flex flex-col gap-1 flex-shrink-0">
        <button type="button" class="text-red-400" onclick="removeScheduleItem(${i})"><i data-lucide="x" class="w-4 h-4"></i></button>
        ${i > 0 ? `<button type="button" class="text-gray-400" onclick="moveScheduleItem(${i},-1)"><i data-lucide="arrow-up" class="w-3 h-3"></i></button>` : ''}
        ${i < items.length-1 ? `<button type="button" class="text-gray-400" onclick="moveScheduleItem(${i},1)"><i data-lucide="arrow-down" class="w-3 h-3"></i></button>` : ''}
      </div>
    </div>` : `
    <div class="flex items-start gap-2 mb-3 bg-gray-50 rounded-xl p-2">
      <div class="flex flex-col gap-1 flex-1">
        <div class="flex gap-2">
          <input class="input-field text-xs w-20" value="${it.time}" placeholder="Hora" id="sc-time-${i}">
          <input class="input-field text-xs flex-1" value="${it.label}" placeholder="Momento" id="sc-label-${i}">
        </div>
        <div class="flex gap-2">
          <div style="display:flex;align-items:center;gap:4px;width:100%">
        <div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(0,127,159,0.12)" id="sc-prev-${i}">${it.icon && it.icon.startsWith('http') ? `<img src="${it.icon}" style="width:13px;height:13px;object-fit:contain">` : `<i data-lucide="${it.icon}" style="width:13px;height:13px;color:#007f9f"></i>`}</div>
        <input class="input-field text-xs flex-1" value="${it.icon}" placeholder="lucide icon" id="sc-icon-${i}" oninput="const p=document.getElementById('sc-prev-'+${i});if(p){p.innerHTML='<i data-lucide=\''+this.value+'\' style=\'width:13px;height:13px;color:#007f9f\'></i>';try{lucide.createIcons();}catch(e){}}">
        <button type="button" onclick="openIconPickerModal('schedule', url => { const inp=document.getElementById('sc-icon-${i}'); if(inp) inp.value=url; const p=document.getElementById('sc-prev-${i}'); if(p) p.innerHTML='<img src=\\''+url+'\\' style=\\'width:13px;height:13px;object-fit:contain\\'>'; })" style="background:#f0f9fb;color:#007f9f;border:none;border-radius:0.4rem;padding:0.25rem 0.35rem;font-size:0.58rem;font-weight:700;cursor:pointer;flex-shrink:0">SVG</button>
      </div>
          <input class="input-field text-xs flex-1" value="${it.sub || ''}" placeholder="Subtítulo" id="sc-sub-${i}">
        </div>
      </div>
      <div class="flex flex-col gap-1 flex-shrink-0">
        <button type="button" class="text-red-400" onclick="removeScheduleItem(${i})"><i data-lucide="x" class="w-4 h-4"></i></button>
        ${i > 0 ? `<button type="button" class="text-gray-400" onclick="moveScheduleItem(${i},-1)"><i data-lucide="arrow-up" class="w-3 h-3"></i></button>` : ''}
        ${i < items.length-1 ? `<button type="button" class="text-gray-400" onclick="moveScheduleItem(${i},1)"><i data-lucide="arrow-down" class="w-3 h-3"></i></button>` : ''}
      </div>
    </div>`).join('');
  lucide.createIcons();
}
// Parses flexible time formats like "14h30", "22h:00", "14:30", "9h", "9" into
// minutes-since-midnight for chronological sorting. Returns Infinity if unparseable
// (so malformed entries sort to the end rather than breaking the order).
function _parseScheduleTimeToMinutes(timeStr) {
  if (!timeStr) return Infinity;
  const clean = String(timeStr).trim().toLowerCase();
  // Match patterns: "14h30", "14h:30", "14:30", "14h", "14"
  const m = clean.match(/^(\d{1,2})\s*[h:]?\s*(\d{1,2})?/);
  if (!m) return Infinity;
  const hours = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  if (isNaN(hours) || hours > 23 || isNaN(mins) || mins > 59) return Infinity;
  return hours * 60 + mins;
}

async function saveScheduleItems() {
  const items = window._scheduleEditorItems;
  items.forEach((it, i) => {
    it.time  = document.getElementById('sc-time-' + i)?.value  || it.time;
    it.label = document.getElementById('sc-label-' + i)?.value || it.label;
    it.icon  = document.getElementById('sc-icon-' + i)?.value  || it.icon;
    it.sub   = document.getElementById('sc-sub-' + i)?.value   || '';
  });

  // ── Auto-sort chronologically by time, so guests always see the schedule
  // in the correct order even if the organiser/client typed entries out of
  // sequence (e.g. entering "22h00 sessão fotográfica" before "21h00 entrada
  // dos noivos" — the earlier time should always render first). ──
  items.sort((a, b) => _parseScheduleTimeToMinutes(a.time) - _parseScheduleTimeToMinutes(b.time));

  Store.eventScheduleItems = items;

  // Persist immediately to Supabase — don't wait for the main event form save
  const eventId = Store.currentEventId || Store._intakeEventId;
  dlog('📝 saveScheduleItems — a guardar para eventId:', eventId, 'itens (ordenados):', items);
  if (!eventId) {
    console.error('❌ saveScheduleItems: nenhum eventId disponível. As alterações NÃO foram guardadas no Supabase.');
    toast('Erro: não foi possível identificar o evento.');
  }
  if (eventId) {
    try {
      const saveResult = await saveEventVisuals(eventId, {
        schedule_items: JSON.stringify(items),
        show_schedule: 'yes'   // Always enable display once the user has customised it
      });
      dlog('📝 saveScheduleItems — resultado da gravação:', saveResult);
      // Keep the main form switch in sync so a subsequent full-form save doesn't wipe it
      const swSchedule = document.getElementById('sw-schedule');
      if (swSchedule && !swSchedule.classList.contains('active')) swSchedule.classList.add('active');
      // Update local cache too
      const ev2 = Store.events.find(e => e.id === eventId);
      if (ev2) { ev2.schedule_items = JSON.stringify(items); ev2.show_schedule = 'yes'; }
    } catch(e) {
      console.warn('Erro ao guardar monograma:', e);
    }
  }

  document.getElementById('schedule-editor-modal')?.remove();
  toast('Monograma guardado com sucesso!');
}
function resetScheduleItems() {
  window._scheduleEditorItems = JSON.parse(JSON.stringify(DEFAULT_SCHEDULE_ITEMS));
  Store.eventScheduleItems = null;
  refreshScheduleEditorList();
}


// ===================== SECTION ORDER EDITOR =====================
const ALL_SECTION_DEFS = [
  { key: 'bible',     label: 'Versículo Bíblico + Bênção dos Pais', icon: 'book-open' },
  { key: 'invite',    label: 'Texto de Convite',                     icon: 'mail' },
  { key: 'date',      label: 'Data do Evento',                       icon: 'calendar' },
  { key: 'countdown', label: 'Contagem Regressiva',                  icon: 'timer' },
  { key: 'story',     label: 'Nossa História',                       icon: 'heart' },
  { key: 'venues',    label: 'Locais do Evento',                     icon: 'map-pin' },
  { key: 'parents',   label: 'Nomes dos Pais',                       icon: 'users' },
  { key: 'iban',      label: 'Sugestão de Presente (IBAN)',           icon: 'credit-card' },
  { key: 'gallery',   label: 'Galeria de Fotos',                     icon: 'image' },
  { key: 'manual',    label: 'Manual do Bom Convidado',              icon: 'list-checks' },
  { key: 'schedule',  label: 'Itinerário',                           icon: 'clock' },
  { key: 'dresscode',  label: 'Dress Code + Sugestão de Presentes',     icon: 'shirt' },
  { key: 'couplemsg',   label: 'Mensagem dos Noivos',                   icon: 'message-circle' },
  { key: 'final_photo', label: 'Foto Final dos Noivos',                 icon: 'image' },
  { key: 'event_faq',   label: 'Perguntas Frequentes',                  icon: 'help-circle' },
];

function getDefaultSectionOrder() {
  return ALL_SECTION_DEFS.map(s => s.key);
}

// Store.eventSectionOrder persists for the current event editing session
// Saved to Supabase as section_order JSON column
Store.eventSectionOrder = null;

function openSectionOrderEditor() {
  // Start with the current saved order (from event or Store)
  let order = Store.eventSectionOrder
    ? [...Store.eventSectionOrder]
    : getDefaultSectionOrder();

  // Always add any missing sections (e.g. 'venues', 'story' added after event creation)
  const allKeys = getDefaultSectionOrder();
  allKeys.forEach(k => { if (!order.includes(k)) order.push(k); });
  // Remove any stale keys not in current definitions
  order = order.filter(k => allKeys.includes(k));

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'section-order-modal';

  function renderList() {
    return order.map((key, i) => {
      const def = ALL_SECTION_DEFS.find(d => d.key === key) || { label: key, icon: 'layout' };
      return `<div class="section-reorder-item" data-key="${key}">
        <span class="sr-handle"><i data-lucide="grip-vertical" class="w-4 h-4"></i></span>
        <span class="sr-label">${def.label}</span>
        <button type="button" class="text-gray-300 hover:text-gray-500 px-1" onclick="moveSectionUp(${i})" ${i===0?'disabled style="opacity:0.3"':''}>
          <i data-lucide="chevron-up" class="w-4 h-4"></i>
        </button>
        <button type="button" class="text-gray-300 hover:text-gray-500 px-1" onclick="moveSectionDown(${i})" ${i===order.length-1?'disabled style="opacity:0.3"':''}>
          <i data-lucide="chevron-down" class="w-4 h-4"></i>
        </button>
      </div>`;
    }).join('');
  }

  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl shadow-lg p-5 max-w-md w-full" style="max-height:85vh;overflow-y:auto">
    <h3 class="text-base font-bold text-gray-800 mb-1">Organizar Secções</h3>
    <p class="text-xs text-gray-400 mb-3">Use as setas para reordenar as secções da página do convidado.</p>
    <div id="section-order-list">${renderList()}</div>
    <div class="flex gap-2 mt-4">
      <button class="flex-1 btn-main" onclick="saveSectionOrder()">Guardar</button>
      <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      <button class="text-xs text-gray-400 px-2" onclick="resetSectionOrder()">Repor</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  lucide.createIcons();
  window._sectionOrderCurrent = order;
}

function moveSectionUp(i) {
  const order = window._sectionOrderCurrent;
  if (i > 0) { [order[i-1], order[i]] = [order[i], order[i-1]]; refreshSectionOrderList(); }
}
function moveSectionDown(i) {
  const order = window._sectionOrderCurrent;
  if (i < order.length-1) { [order[i+1], order[i]] = [order[i], order[i+1]]; refreshSectionOrderList(); }
}
function refreshSectionOrderList() {
  const order = window._sectionOrderCurrent;
  document.getElementById('section-order-list').innerHTML = order.map((key, i) => {
    const def = ALL_SECTION_DEFS.find(d => d.key === key) || { label: key, icon: 'layout' };
    return `<div class="section-reorder-item" data-key="${key}">
      <span class="sr-handle"><i data-lucide="grip-vertical" class="w-4 h-4"></i></span>
      <span class="sr-label">${def.label}</span>
      <button type="button" class="text-gray-300 hover:text-gray-500 px-1" onclick="moveSectionUp(${i})" ${i===0?'disabled style="opacity:0.3"':''}>
        <i data-lucide="chevron-up" class="w-4 h-4"></i>
      </button>
      <button type="button" class="text-gray-300 hover:text-gray-500 px-1" onclick="moveSectionDown(${i})" ${i===order.length-1?'disabled style="opacity:0.3"':''}>
        <i data-lucide="chevron-down" class="w-4 h-4"></i>
      </button>
    </div>`;
  }).join('');
  lucide.createIcons();
}
function saveSectionOrder() {
  Store.eventSectionOrder = [...window._sectionOrderCurrent];
  document.getElementById('section-order-modal')?.remove();
  toast('Ordem das secções guardada.');
}
function resetSectionOrder() {
  window._sectionOrderCurrent = getDefaultSectionOrder();
  refreshSectionOrderList();
  Store.eventSectionOrder = null;
}


// ── VENUES SECTION ──
function buildVenueSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const evColor = ev.event_color || '#007f9f';
  const venues = [];
  if (ev.venue_ceremony) venues.push({ icon: 'church',      title: 'Cerimónia Religiosa', name: ev.venue_ceremony, maps: ev.venue_ceremony_maps, image: ev.venue_ceremony_image });
  if (ev.venue_civil)    venues.push({ icon: 'file-text',   title: 'Cerimónia Civil',     name: ev.venue_civil,    maps: ev.venue_civil_maps,    image: ev.venue_civil_image });
  if (ev.venue_reception)venues.push({ icon: 'glass-water', title: "Copo d'Água",          name: ev.venue_reception,maps: ev.venue_reception_maps, image: ev.venue_reception_image });
  if (!venues.length) return '';

  const cards = venues.map(v => `
    <div style="background:#fff;border-radius:1rem;overflow:hidden;border:1.5px solid color-mix(in srgb,${evColor} 20%,#e5e7eb);text-align:center;flex:1;min-width:180px">
      ${v.image ? `<div style="width:100%;height:120px;overflow:hidden"><img src="${v.image}" style="width:100%;height:100%;object-fit:cover" alt="${escapeHTML(v.title)}"></div>` : ''}
      <div style="padding:1.25rem 1rem">
        ${!v.image ? `<div style="width:44px;height:44px;border-radius:50%;background:color-mix(in srgb,${evColor} 12%,white);display:flex;align-items:center;justify-content:center;margin:0 auto 0.6rem">
          <i data-lucide="${v.icon}" style="width:20px;height:20px;color:${evColor}"></i>
        </div>` : ''}
        <div style="font-size:0.7rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${evColor};margin-bottom:0.25rem">${escapeHTML(v.title)}</div>
        <div style="font-weight:700;color:#1e293b;font-size:0.9rem;margin-bottom:0.5rem">${escapeHTML(v.name)}</div>
        ${v.maps ? `<a href="${v.maps}" target="_blank" rel="noopener" class="venue-map-btn" style="display:inline-flex;align-items:center;gap:0.35rem;background:${evColor};color:#fff;font-size:0.72rem;font-weight:700;padding:0.35rem 0.85rem;border-radius:999px;text-decoration:none">
          <span class="action-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
          <span class="action-btn-label">Ver no Mapa</span></a>` : ''}
      </div>
    </div>`).join('');

  return _SD + `<div class="event-section">
    <div class="section-inner reveal">
      <h3 class="section-title">${escapeHTML(ev.venues_title || 'Locais do Evento')}</h3>
      <div style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:center">${cards}</div>
    </div>
  </div>`;
}

// ── DRESS CODE + SUGESTÃO DE PRESENTES (secção combinada com 2 cartões) ──
// Cada cartão tem título próprio + botão que abre uma tela (modal) só
// quando o convidado toca — não obriga a confirmar presença primeiro.
function buildDressGiftsSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const showDressBtn = _yesOrTrue(ev.show_dresscode) && !!ev.dresscode_text;
  const showGiftsBtn = !!ev.allowGifts && Array.isArray(ev.gifts) && ev.gifts.length > 0;

  if (!showDressBtn && !showGiftsBtn) return ''; // nada para mostrar — secção desaparece sozinha

  const dressCard = showDressBtn ? `
    <div class="dg-card">
      <h4 class="dg-card-title">Dress Code</h4>
      <p class="dg-card-sub">Qual o traje pedido para o evento</p>
      <button type="button" class="dg-card-btn" onclick="openGuestDresscodeModal()">
        <span class="action-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg></span>
        <span class="action-btn-label">Ver Dress Code</span>
      </button>
    </div>` : '';

  const singlePerson = ev.event_type === 'birthday' || ev.event_type === 'other';
  const giftsSub = singlePerson ? 'Escolhe um presente para oferecer' : 'Escolhe um presente para a noiva e o noivo';

  const giftsCard = showGiftsBtn ? `
    <div class="dg-card">
      <h4 class="dg-card-title">Sugestão de Presentes</h4>
      <p class="dg-card-sub">${escapeHTML(giftsSub)}</p>
      <button type="button" class="dg-card-btn" onclick="openGuestGiftsModal()">
        <span class="action-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg></span>
        <span class="action-btn-label">Ver Presentes</span>
      </button>
    </div>` : '';

  return _SD + `<div class="event-section">
    <div class="section-inner reveal">
      <h3 class="section-title" style="text-align:center">Informações Úteis</h3>
      <div class="dg-buttons-grid" style="grid-template-columns:${(showDressBtn && showGiftsBtn) ? 'repeat(2,1fr)' : '1fr'}">
        ${dressCard}${giftsCard}
      </div>
    </div>
  </div>`;
}


// Conteúdo do Dress Code, reaproveitado dentro do modal do convidado
// (ver openGuestDresscodeModal em guest.js).
function _buildDresscodeContentHTML(ev) {
  const evColor = ev.event_color || '#007f9f';
  return `<div style="text-align:center">
      ${ev.dresscode_image_url ? `
        <img src="${ev.dresscode_image_url}" style="width:100%;max-width:220px;border-radius:0.85rem;object-fit:cover;aspect-ratio:1;margin:0 auto 0.85rem;display:block">
      ` : `
      <div style="width:52px;height:52px;border-radius:50%;background:color-mix(in srgb,${evColor} 12%,white);display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${evColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>
      </div>`}
      ${ev.dresscode_text ? `<p style="font-size:1rem;font-weight:600;color:#1e293b;margin-bottom:0.5rem">${escapeHTML(ev.dresscode_text)}</p>` : ''}
      ${ev.dresscode_detail ? `<p style="font-size:0.85rem;color:#374151;line-height:1.6;max-width:420px;margin:0 auto 0.5rem">${escapeHTML(ev.dresscode_detail)}</p>` : ''}
      ${(() => {
        if (!ev.dresscode_colors) return '';
        const cols = ev.dresscode_colors.split(/\n|,/).map(c => c.trim()).filter(c => /^#[0-9a-fA-F]{3,6}$/.test(c)).slice(0,4);
        if (!cols.length) return '';
        return `<div style="display:flex;gap:0.75rem;justify-content:center;margin-top:0.75rem">
          ${cols.map(c => `<div title="${c}" style="width:36px;height:36px;border-radius:50%;background:${c};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.15)"></div>`).join('')}
        </div>`;
      })()}
    </div>`;
}

// Mensagem dos Noivos — a heartfelt note from the couple to their guests
// (ou "Mensagem para o Convidado de Honra" em aniversários/outros eventos)
function buildCoupleMsgSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const evColor = ev.event_color || '#007f9f';
  const singlePerson = ev.event_type === 'birthday' || ev.event_type === 'other';
  const title = singlePerson ? 'Mensagem para os Convidados' : 'Mensagem dos Noivos';
  return _SD + `<div class="event-section">
    <div class="section-inner reveal" style="text-align:center">
      <div style="width:52px;height:52px;border-radius:50%;background:color-mix(in srgb,${evColor} 12%,white);display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${evColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      </div>
      <h3 class="section-title">${escapeHTML(title)}</h3>
      <p style="font-size:0.95rem;color:#374151;line-height:1.75;max-width:460px;margin:0 auto;white-space:pre-wrap">${escapeHTML(ev.couplemsg_text || '')}</p>
    </div>
  </div>`;
}


// ===================== SHARED ICON LIBRARY (SVG uploads) =====================
// Icons uploaded by ANY user become available to ALL users (shared library)
async function uploadIconToLibrary(file, category) {
  if (!file) return null;
  if (file.type !== 'image/svg+xml' && !file.name.endsWith('.svg')) {
    toast('Apenas ficheiros SVG são permitidos.');
    return null;
  }
  if (file.size > 100 * 1024) {
    toast('Ícone muito grande. Máx. 100 KB.');
    return null;
  }
  try {
    const url = await uploadImageToStorage(file, 'event-covers');
    if (!url) return null;
    await supabaseRequest('icon_library', 'POST', {
      name: file.name.replace(/\.svg$/i, ''), url, category: category || 'manual',
      uploaded_by: Store.currentUser?.id || null
    });
    toast('Ícone adicionado à biblioteca partilhada!');
    return url;
  } catch(e) {
    toast('Erro ao carregar ícone.');
    return null;
  }
}

async function loadIconLibrary(category) {
  const rows = await supabaseRequest(`icon_library?category=eq.${category}&select=id,name,url&order=created_at.desc&limit=60`).catch(() => []);
  return rows || [];
}

async function openIconPickerModal(category, onSelect) {
  const icons = await loadIconLibrary(category);
  const modal = document.createElement('div');
  modal.id = '_icon-picker-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem';
  modal.innerHTML = `<div style="background:#fff;border-radius:1.25rem;padding:1.5rem;max-width:480px;width:100%;max-height:80vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h3 style="font-size:1rem;font-weight:800;color:#1e293b;margin:0">Escolher Ícone</h3>
      <button id="_icon-picker-close" style="background:#f3f4f6;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer">×</button>
    </div>
    <label style="display:block;background:#f0f9fb;border:1.5px dashed #007f9f;border-radius:0.75rem;padding:0.75rem;text-align:center;cursor:pointer;margin-bottom:1rem;font-size:0.82rem;color:#007f9f;font-weight:600">
      + Carregar novo ícone SVG (ficará disponível para todos)
      <input type="file" accept=".svg,image/svg+xml" style="display:none" id="_icon-upload-input">
    </label>
    <div id="_icon-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.6rem">
      ${icons.map(ic => `<div onclick="window._iconPickerSelect('${ic.url}')" style="aspect-ratio:1;border:1px solid #e5e7eb;border-radius:0.6rem;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0.5rem;background:#f8fafc" title="${escapeHTML(ic.name)}">
        <img src="${ic.url}" style="width:100%;height:100%;object-fit:contain" onerror="this.parentElement.style.display='none'">
      </div>`).join('') || '<p style="grid-column:1/-1;text-align:center;color:#9ca3af;font-size:0.8rem;padding:1rem">Nenhum ícone na biblioteca ainda. Sê o primeiro a carregar um!</p>'}
    </div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('_icon-picker-close').onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };

  window._iconPickerSelect = (url) => {
    onSelect(url);
    modal.remove();
  };

  document.getElementById('_icon-upload-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadIconToLibrary(file, category);
    if (url) {
      onSelect(url);
      modal.remove();
    }
  };
}

// ── Foto final dos noivos ──────────────────────────────────────────────────
function buildFinalPhotoSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  return _SD + `<div class="event-section" style="padding:0;overflow:hidden">
    <div class="reveal" style="width:100%;aspect-ratio:4/3;overflow:hidden;position:relative">
      <img src="${ev.final_photo_url}" alt="Foto dos Noivos"
        style="width:100%;height:100%;object-fit:cover;object-position:center"
        onerror="this.parentElement.parentElement.style.display='none'">
      <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.35) 0%,transparent 55%)"></div>
      ${(ev.groom_name || ev.bride_name) ? `<p style="position:absolute;bottom:1.25rem;left:0;right:0;text-align:center;color:#fff;font-size:1.05rem;font-weight:700;letter-spacing:0.05em;font-family:var(--event-font,'Playfair Display',serif)">${escapeHTML(ev.groom_name||'')}${ev.groom_name&&ev.bride_name?' & ':''}${escapeHTML(ev.bride_name||'')}</p>` : ''}
    </div>
  </div>`;
}

// ── Perguntas Frequentes (FAQ por evento) ──────────────────────────────────
function buildEventFaqSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  let items = [];
  try { items = JSON.parse(ev.event_faq_items || '[]'); } catch(e) { items = []; }
  items = items.filter(it => it && (it.q || it.a));
  if (!items.length) return '';
  return _SD + `<div class="event-section" style="background:#fdfaf6">
    <div class="section-inner reveal">
      <p style="text-align:center;font-size:0.7rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--ev-color);font-weight:700;margin-bottom:1.5rem">Perguntas Frequentes</p>
      <div id="event-faq-accordion" style="display:flex;flex-direction:column;gap:0.75rem;max-width:480px;margin:0 auto">
        ${items.map((it, i) => `
        <div class="event-faq-block" style="background:#fff;border-radius:0.75rem;border:1px solid #e5e7eb;overflow:hidden">
          <button type="button" onclick="_toggleEventFaqAnswer(this)" style="width:100%;text-align:left;padding:0.85rem 1rem;background:none;border:none;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-family:inherit">
            <span style="font-size:0.88rem;font-weight:700;color:#1e293b">${escapeHTML(it.q || '')}</span>
            <svg class="faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ev-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-left:0.5rem;transition:transform 0.2s"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="faq-answer hidden" style="padding:0 1rem 0.85rem;font-size:0.82rem;color:#6b7280;line-height:1.6">${escapeHTML(it.a || '')}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// Acordeão: abrir uma pergunta fecha automaticamente qualquer outra que
// estivesse aberta na mesma secção (tanto no convite como no site comercial).
function _toggleEventFaqAnswer(btn) {
  const block = btn.parentElement;
  const answer = block.querySelector('.faq-answer');
  const chevron = btn.querySelector('.faq-chevron');
  const willOpen = answer.classList.contains('hidden');

  const accordion = block.closest('#event-faq-accordion');
  if (accordion) {
    accordion.querySelectorAll('.event-faq-block').forEach(otherBlock => {
      if (otherBlock === block) return;
      const otherAnswer = otherBlock.querySelector('.faq-answer');
      const otherChevron = otherBlock.querySelector('.faq-chevron');
      if (otherAnswer && !otherAnswer.classList.contains('hidden')) {
        otherAnswer.classList.add('hidden');
        if (otherChevron) otherChevron.style.transform = 'rotate(0deg)';
      }
    });
  }

  answer.classList.toggle('hidden', !willOpen);
  if (chevron) chevron.style.transform = willOpen ? 'rotate(180deg)' : 'rotate(0deg)';
}

// ── Initialise any pending 3D gallery carousels after their HTML has been
// inserted into the DOM. Must run as a real function call (not an inline
// <script> tag, which never executes when injected via innerHTML). ──
function initGalleryCarousels() {
  if (!window._pendingCarousels || !window._pendingCarousels.length) return;
  window._pendingCarousels.forEach(({ id, color }) => {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    const slides = wrap.querySelectorAll('.g3d-slide');
    const counter = wrap.querySelector('.g3d-counter');
    const prevBtn = wrap.querySelector('.g3d-arrow.prev');
    const nextBtn = wrap.querySelector('.g3d-arrow.next');
    const dotsWrap = wrap.parentElement.querySelector('.g3d-dots');
    const dots = dotsWrap ? dotsWrap.querySelectorAll('.g3d-dot') : [];
    let idx = 0;

    // ── Posicionamento com perspectiva 3D real (rotação + profundidade) ──
    function render() {
      slides.forEach((s, i) => {
        const offset = i - idx;
        const abs = Math.abs(offset);
        const dir = Math.sign(offset);
        if (abs > 2) {
          s.style.opacity = 0;
          s.style.transform = `translateX(${dir * 120}%) rotateY(0deg) translateZ(-300px) scale(0.5)`;
          s.style.pointerEvents = 'none';
          return;
        }
        const translateX = offset === 0 ? 0 : dir * (40 + abs * 22);
        const rotateY = offset === 0 ? 0 : dir * -32;
        const translateZ = offset === 0 ? 0 : -90 * abs;
        const scale = offset === 0 ? 1 : 1 - abs * 0.16;
        const opacity = offset === 0 ? 1 : (abs === 1 ? 0.82 : 0.45);
        s.style.transform = `translateX(${translateX}%) rotateY(${rotateY}deg) translateZ(${translateZ}px) scale(${scale})`;
        s.style.opacity = opacity;
        s.style.zIndex = 10 - abs;
        s.style.setProperty('--g3d-shade', offset === 0 ? '0' : '0.55');
        s.style.pointerEvents = 'auto';
      });
      dots.forEach((d, i) => {
        d.classList.toggle('active', i === idx);
        d.style.background = i === idx ? color : '#d1d5db';
      });
      if (counter) counter.textContent = `${idx + 1} / ${slides.length}`;
      if (prevBtn) prevBtn.style.opacity = idx === 0 ? '0.35' : '1';
      if (nextBtn) nextBtn.style.opacity = idx === slides.length - 1 ? '0.35' : '1';
    }
    function go(newIdx) {
      idx = Math.max(0, Math.min(slides.length - 1, newIdx));
      render();
    }
    render();

    // ── Arrastar: touch (telemóvel) e rato (computador) ──
    let startX = null, dragging = false;
    const onDragStart = (x) => { startX = x; dragging = true; };
    const onDragEnd = (x) => {
      if (startX === null) return;
      const dx = x - startX;
      if (dx > 40) go(idx - 1);
      else if (dx < -40) go(idx + 1);
      startX = null; dragging = false;
    };
    wrap.addEventListener('touchstart', (e) => onDragStart(e.touches[0].clientX), { passive: true });
    wrap.addEventListener('touchend', (e) => onDragEnd(e.changedTouches[0].clientX), { passive: true });
    wrap.addEventListener('mousedown', (e) => { e.preventDefault(); onDragStart(e.clientX); });
    window.addEventListener('mouseup', (e) => { if (dragging) onDragEnd(e.clientX); });
    wrap.style.cursor = 'grab';

    // ── Setas de navegação ──
    if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); go(idx - 1); };
    if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); go(idx + 1); };

    // ── Teclado (quando o carrossel está visível) ──
    const keyHandler = (e) => {
      const rect = wrap.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inView) return;
      if (e.key === 'ArrowLeft') go(idx - 1);
      else if (e.key === 'ArrowRight') go(idx + 1);
    };
    window.addEventListener('keydown', keyHandler);

    // Clicar na imagem centrada abre o lightbox; clicar numa imagem lateral
    // navega o carrossel até ela.
    slides.forEach((s, i) => {
      s.style.cursor = 'pointer';
      s.addEventListener('click', () => {
        if (dragging) return;
        if (i === idx) {
          const url = s.style.backgroundImage.slice(5, -2); // strip url("...")
          if (typeof openLightbox === 'function') openLightbox(url);
        } else {
          go(i);
        }
      });
    });
    dots.forEach((d, i) => { d.onclick = () => go(i); });
  });
  window._pendingCarousels = [];
}
