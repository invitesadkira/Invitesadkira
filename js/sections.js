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
  console.log('bible_text:', eventData.bible_text ? '✓ '+String(eventData.bible_text).substring(0,30) : '✗ null');
  console.log('gallery_urls:', eventData.gallery_urls ? '✓ '+String(eventData.gallery_urls).substring(0,50) : '✗ null');
  console.log('groom_parents:', eventData.groom_parents ? '✓' : '✗');
  console.log('iban_number:', eventData.iban_number ? '✓' : '✗');
  console.log('invite_text:', eventData.invite_text ? '✓' : '✗');
  console.log('event_color:', eventData.event_color);
  console.log('section_order:', eventData.section_order ? JSON.parse(eventData.section_order) : 'default');
  console.log('show_manual:', eventData.show_manual, '| manual_items:', eventData.manual_items ? '✓ '+String(eventData.manual_items).substring(0,80) : '✗ null/vazio');
  console.log('show_schedule:', eventData.show_schedule, '| schedule_items:', eventData.schedule_items ? '✓' : '✗ null/vazio');
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
        case 'dresscode': if (_yesOrTrue(eventData.show_dresscode) && eventData.dresscode_text) html += buildDresscodeSection(eventData); break;
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
  container.innerHTML = sectionParts.map((part, i) => {
    const div = i === 0 ? '' : `<div class="section-divider"><div class="section-divider-line"></div></div>`;
    if (sideUrl && _yesOrTrue(eventData.show_decor)) {
      return div + `<div class="decor-side-wrap" style="position:relative">
        <div class="decor-side-img left" style="background-image:url('${sideUrl}')"></div>
        <div class="decor-side-img right" style="background-image:url('${sideUrl}')"></div>
        ${part}
      </div>`;
    }
    return div + part;
  }).join('');

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
}

function buildBibleSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const bibleSize = parseFloat(ev.bible_size) || 0.92;
  const lines = (ev.bible_text || '').split('\n').filter(Boolean).map(l => `<p class="bible-verse" style="font-size:${bibleSize}rem;line-height:1.8;font-style:italic">${escapeHTML(l)}</p>`).join('');
  const lines2 = (ev.bible_text_2 || '').split('\n').filter(Boolean).map(l => `<p class="bible-verse" style="font-size:${bibleSize}rem;line-height:1.8;font-style:italic">${escapeHTML(l)}</p>`).join('');
  const hasParents = ev.groom_parents || ev.bride_parents;
  // Always show the hardcoded blessing label — never use invite_blessing as the label
  const blessingLabel = 'Com a bênção de Deus e de seus pais';

  // Apply invert_names to parents in this section too
  const _invertNamesB = _yesOrTrue(ev.invert_names);
  let _groomParentsB = ev.groom_parents;
  let _brideParentsB = ev.bride_parents;
  if (_invertNamesB) { [_groomParentsB, _brideParentsB] = [_brideParentsB, _groomParentsB]; }

  const parentsHtml = hasParents ? `
    <div class="reveal" style="margin-top:1.5rem">
      <p class="invitation-text" style="margin-bottom:1rem;font-size:0.9rem">${blessingLabel}</p>
      <div style="display:flex;gap:1.5rem;justify-content:center;flex-wrap:wrap;text-align:center;max-width:380px;margin:0 auto">
        ${_groomParentsB ? (() => { return '<div>' + _groomParentsB.split('\n').filter(l=>l.trim()).map(l=>{ const hasCross=l.includes('✟'); const im=l.includes('(em memória)')||hasCross; let n=l.replace('(em memória)','').replace(/✟/g,'').trim(); const _pSize = ev.parents_size || '0.88'; return '<p style="font-weight:600;color:#1e293b;line-height:1.85;font-size:'+_pSize+'rem">'+escapeHTML(n)+(hasCross?' <span style="opacity:0.7">✟</span>':(im?' <span style="color:#6b7280;font-size:0.78rem;font-style:italic">(em memória)</span>':''))+'</p>'; }).join('') + '</div>'; })() : ''}
        ${_groomParentsB && _brideParentsB ? '<div style="width:1px;background:linear-gradient(to bottom,transparent,var(--ev-color,#007f9f) 20%,var(--ev-color,#007f9f) 80%,transparent);align-self:stretch;flex-shrink:0;min-height:60px"></div>' : ''}
        ${_brideParentsB ? (() => { return '<div>' + _brideParentsB.split('\n').filter(l=>l.trim()).map(l=>{ const hasCross=l.includes('✟'); const im=l.includes('(em memória)')||hasCross; let n=l.replace('(em memória)','').replace(/✟/g,'').trim(); const _pSize = ev.parents_size || '0.88'; return '<p style="font-weight:600;color:#1e293b;line-height:1.85;font-size:'+_pSize+'rem">'+escapeHTML(n)+(hasCross?' <span style="opacity:0.7">✟</span>':(im?' <span style="color:#6b7280;font-size:0.78rem;font-style:italic">(em memória)</span>':''))+'</p>'; }).join('') + '</div>'; })() : ''}
      </div>
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
  const groomSide = ev.side1_name || 'Família do Noivo';
  const brideSide = ev.side2_name || 'Família da Noiva';
  const blessingHeader = ev.invite_blessing || 'Com a bênção de Deus e de seus pais';
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
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copiar IBAN
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
    const dots = urls.map((_, i) => `<span class="g3d-dot" data-idx="${i}" style="background:${i===0?evColor:'#d1d5db'}"></span>`).join('');
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
  let items = DEFAULT_MANUAL_ITEMS;
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
function openManualEditor() {
  // Defensive fallback chain: prefer Store.eventManualItems (set when the
  // edit/intake form loaded), but if it's somehow null, try to recover the
  // REAL saved data from Store.events before ever falling back to defaults
  // — this prevents accidentally overwriting genuine saved items.
  let items;
  if (Store.eventManualItems) {
    items = JSON.parse(JSON.stringify(Store.eventManualItems));
  } else {
    const eventId = Store.currentEventId || Store._intakeEventId;
    const evFromStore = eventId ? Store.events.find(e => e.id === eventId) : null;
    if (evFromStore && evFromStore.manual_items) {
      try { items = JSON.parse(JSON.stringify(JSON.parse(evFromStore.manual_items))); }
      catch(e) { items = JSON.parse(JSON.stringify(DEFAULT_MANUAL_ITEMS)); }
    } else {
      items = JSON.parse(JSON.stringify(DEFAULT_MANUAL_ITEMS));
    }
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
    <button type="button" class="mt-2 text-xs text-teal-600 font-semibold" onclick="addManualItem()">+ Adicionar item</button>
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
  console.log('📝 saveManualItems — a guardar para eventId:', eventId, 'itens:', items);
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
      console.log('📝 saveManualItems — resultado da gravação:', saveResult);
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
  window._manualEditorItems = JSON.parse(JSON.stringify(DEFAULT_MANUAL_ITEMS));
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
    <button type="button" class="mt-2 text-xs text-teal-600 font-semibold" onclick="addScheduleItem(${clientMode})">+ Adicionar momento</button>
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
  console.log('📝 saveScheduleItems — a guardar para eventId:', eventId, 'itens (ordenados):', items);
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
      console.log('📝 saveScheduleItems — resultado da gravação:', saveResult);
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
  { key: 'dresscode',  label: 'Dress Code',                             icon: 'shirt' },
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
        ${v.maps ? `<a href="${v.maps}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:0.35rem;background:${evColor};color:#fff;font-size:0.72rem;font-weight:700;padding:0.35rem 0.85rem;border-radius:999px;text-decoration:none">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Ver no Mapa</a>` : ''}
      </div>
    </div>`).join('');

  return _SD + `<div class="event-section">
    <div class="section-inner reveal">
      <h3 class="section-title">${escapeHTML(ev.venues_title || 'Locais do Evento')}</h3>
      <div style="display:flex;gap:1rem;flex-wrap:wrap;justify-content:center">${cards}</div>
    </div>
  </div>`;
}

// ── DRESS CODE SECTION ──
function buildDresscodeSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const evColor = ev.event_color || '#007f9f';
  return _SD + `<div class="event-section">
    <div class="section-inner reveal" style="text-align:center">
      <div style="width:52px;height:52px;border-radius:50%;background:color-mix(in srgb,${evColor} 12%,white);display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${evColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>
      </div>
      <h3 class="section-title">Dress Code</h3>
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
    </div>
  </div>`;
}

// Mensagem dos Noivos — a heartfelt note from the couple to their guests
function buildCoupleMsgSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const evColor = ev.event_color || '#007f9f';
  return _SD + `<div class="event-section">
    <div class="section-inner reveal" style="text-align:center">
      <div style="width:52px;height:52px;border-radius:50%;background:color-mix(in srgb,${evColor} 12%,white);display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${evColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      </div>
      <h3 class="section-title">Mensagem dos Noivos</h3>
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
      <div style="display:flex;flex-direction:column;gap:0.75rem;max-width:480px;margin:0 auto">
        ${items.map((it, i) => `
        <div style="background:#fff;border-radius:0.75rem;border:1px solid #e5e7eb;overflow:hidden">
          <button type="button" onclick="this.parentElement.querySelector('.faq-answer').classList.toggle('hidden');this.querySelector('.faq-chevron').style.transform=this.parentElement.querySelector('.faq-answer').classList.contains('hidden')?'rotate(0deg)':'rotate(180deg)'" style="width:100%;text-align:left;padding:0.85rem 1rem;background:none;border:none;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-family:inherit">
            <span style="font-size:0.88rem;font-weight:700;color:#1e293b">${escapeHTML(it.q || '')}</span>
            <svg class="faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ev-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-left:0.5rem;transition:transform 0.2s"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="faq-answer hidden" style="padding:0 1rem 0.85rem;font-size:0.82rem;color:#6b7280;line-height:1.6">${escapeHTML(it.a || '')}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
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
    const dotsWrap = wrap.parentElement.querySelector('.g3d-dots');
    const dots = dotsWrap ? dotsWrap.querySelectorAll('.g3d-dot') : [];
    let idx = 0;
    function render() {
      slides.forEach((s, i) => {
        const offset = i - idx;
        s.style.transform = `translateX(${offset * 78}%) scale(${offset === 0 ? 1 : 0.78})`;
        s.style.zIndex = offset === 0 ? 3 : 1;
        s.style.opacity = Math.abs(offset) > 1 ? 0 : (offset === 0 ? 1 : 0.55);
        s.style.filter = offset === 0 ? 'none' : 'blur(1px)';
      });
      dots.forEach((d, i) => { d.style.background = i === idx ? color : '#d1d5db'; });
    }
    render();
    let startX = null;
    wrap.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    wrap.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (dx > 40 && idx > 0) idx--;
      else if (dx < -40 && idx < slides.length - 1) idx++;
      startX = null; render();
    }, { passive: true });
    // Clicking the centered slide opens the lightbox (full view);
    // clicking a side-peek slide navigates the carousel to it instead.
    slides.forEach((s, i) => {
      s.style.cursor = 'pointer';
      s.addEventListener('click', () => {
        if (i === idx) {
          const url = s.style.backgroundImage.slice(5, -2); // strip url("...")
          if (typeof openLightbox === 'function') openLightbox(url);
        } else {
          idx = i; render();
        }
      });
    });
    dots.forEach((d, i) => { d.onclick = () => { idx = i; render(); }; });
  });
  window._pendingCarousels = [];
}
