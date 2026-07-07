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
      ${ev.bible_text.split('\n').filter(Boolean).map(l => `<p style="font-style:var(--ev-bible-style,italic);font-weight:var(--ev-bible-weight,400);font-family:var(--ev-bible-font,inherit);color:#4b5563;font-size:0.95rem;line-height:1.8;margin:0 0 0.4rem">${_formatBibleText(l)}</p>`).join('')}
      ${ev.bible_ref ? `<p style="font-size:0.78rem;color:${evColor};font-weight:700;margin-top:0.5rem">${escapeHTML(ev.bible_ref)}</p>` : ''}
      ${ev.bible_ornament_url
        ? `<img src="${ev.bible_ornament_url}" alt="" class="bible-ornament-anim" style="height:${parseFloat(ev.bible_ornament_size)||28}px;width:auto;margin:0.75rem auto 0;display:block" onerror="this.style.display='none'">`
        : ''}
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
  if (ev.schedule_items) {
    try { scheduleItems = JSON.parse(ev.schedule_items); } catch(e) {}
  }
  // Sanitizar ícones com HTML por engano — impede que apareçam na tela
  if (Array.isArray(scheduleItems)) scheduleItems.forEach(it => { if (it.icon) it.icon = _sanitizeIconValue(it.icon); });

  // Flor de canto sobre a capa — pedido explicitamente para este modelo
  const decorOn = _yesOrTrue(ev.show_decor);
  const decorSide = ev.decor_top_position === 'right' ? 'right:0.75rem' : 'left:0.75rem';
  const decorHtml = (decorOn && ev.decor_top_url)
    ? `<div style="position:absolute;top:0.75rem;${decorSide};width:clamp(100px,20vw,170px);height:clamp(100px,20vw,170px);background-image:url('${ev.decor_top_url}');background-size:contain;background-repeat:no-repeat;background-position:top ${ev.decor_top_position === 'right' ? 'right' : 'left'};pointer-events:none;z-index:1"></div>`
    : '';

  return `
    <div class="simple-invite" style="background:#fff;max-width:560px;margin:0 auto">
      <!-- 1. Capa, com nomes (e frase opcional) sobrepostos em baixo, sobre a foto -->
      <div style="position:relative;width:100%;height:62vh;min-height:340px;max-height:560px;overflow:hidden">
        ${ev.cover_image ? `<img src="${ev.cover_image}" style="width:100%;height:100%;object-fit:cover">` : `<div style="width:100%;height:100%;background:linear-gradient(135deg,${evColor},#1a1a2e)"></div>`}
        ${decorHtml}
        <div style="position:absolute;left:0;right:0;bottom:1.5rem;text-align:center;padding:0 1rem;z-index:2">
          <h1 class="hero-couple-names-simple" style="font-family:'Playfair Display',serif;font-style:italic;font-size:clamp(2rem,8vw,3rem);margin:0;text-shadow:0 2px 18px rgba(0,0,0,0.65),0 0 4px rgba(0,0,0,0.5)">${coupleNames}</h1>
          ${ev.hero_subtitle ? `<span class="hero-subtitle-tagline" style="margin-top:0.5rem">${escapeHTML(ev.hero_subtitle)}</span>` : ''}
        </div>
      </div>

      <!-- 2. Texto bíblico -->
      ${bibleBlock}

      <!-- 3. Com a bênção de Deus e seus pais -->
      ${blessingLine}

      <!-- 4. Convidam ___ para a celebração -->
      <p style="text-align:center;font-size:calc(0.98rem * var(--ev-body-scale,1));color:#374151;line-height:1.7;max-width:380px;margin:0 auto 2.5rem;padding:0 1.5rem">${inviteLine}</p>

      <!-- Vídeo do YouTube (se activo) -->
      ${(_yesOrTrue(ev.show_youtube_video) && ev.youtube_video_url) ? buildYoutubeVideoSection(ev).replace('<!-- SECTION_DIVIDER -->','') : ''}

      <!-- Texto Personalizado (se activo para o convite) -->
      ${(_yesOrTrue(ev.custom_text_show_invite) && ev.custom_text_body) ? buildCustomTextSection(ev).replace('<!-- SECTION_DIVIDER -->','') : ''}

      <!-- 5. Data e horário -->
      <div style="text-align:center;margin-bottom:2.5rem">
        <p style="font-size:1.3rem;font-weight:800;color:${evColor};margin:0">${escapeHTML(longDate)}</p>
        ${ev.time ? `<p style="font-size:0.95rem;color:#6b7280;margin:0.2rem 0 0">às ${escapeHTML(ev.time)}</p>` : ''}
      </div>

      <!-- 6. Local do evento -->
      ${venue1Name ? `
      <div style="text-align:center;margin-bottom:2.5rem;padding:0 1.5rem">
        ${venue1Label ? `<p style="font-size:0.68rem;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:${evColor};margin:0 0 0.3rem">${venue1Label}</p>` : ''}
        <p style="font-size:1rem;font-weight:700;color:#1e293b;margin:0">${escapeHTML(venue1Name)}</p>
        ${venue1Maps ? `<a href="${escapeHTML(venue1Maps)}" target="_blank" style="font-size:0.8rem;color:${evColor};font-weight:600;text-decoration:underline">Ver no mapa</a>` : ''}
      </div>` : ''}

      <!-- 7. Confirmar presença -->
      <div style="text-align:center;margin-bottom:3rem">
        <button onclick="(function(){var u=window._evData&&window._evData.external_rsvp_url;if(u)window.open(u,'_blank','noopener');else if(typeof openRsvpDrawer==='function')openRsvpDrawer();})()" style="background:${evColor};color:#fff;border:none;border-radius:999px;padding:0.9rem 2.6rem;font-weight:800;font-size:0.95rem;cursor:pointer;font-family:inherit;box-shadow:0 8px 24px rgba(0,0,0,0.18)">Confirmar Presença</button>
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
            <span style="font-size:calc(0.88rem * var(--ev-body-scale,1));color:#374151;font-weight:600">${escapeHTML(it.label || '')}</span>
          </div>`).join('')}
      </div>` : ''}
    </div>`;
}

// ── Layout "Elegante": capa cheia + letra script, secções com cabeçalhos
//    cursivos (Ceremonia/Celebración/Regalos), contagem contínua com botão
//    de calendário, e Dress Code + Presentes juntos no final. Opção nova e
//    independente — usa a cor do evento, tal como "Completo" e "Simples". ──
function _buildGoogleCalendarUrl(ev) {
  try {
    if (!ev.date) return '#';
    const start = new Date(`${ev.date}T${ev.time || '00:00'}:00`);
    if (isNaN(start.getTime())) return '#';
    const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const title = encodeURIComponent([ev.groom_name, ev.bride_name].filter(Boolean).join(' & ') || ev.title || 'Evento');
    const location = encodeURIComponent(ev.venue_ceremony || ev.venue_reception || ev.venue_civil || '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&location=${location}`;
  } catch(e) { return '#'; }
}

function buildElegantInviteTemplate(ev) {
  const evColor = ev.event_color || '#007f9f';
  const coupleNames = [ev.groom_name, ev.bride_name].filter(Boolean).join(' & ') || escapeHTML(ev.title || '');
  const isBirthday = ev.event_type === 'birthday';
  const eventTypeLabel = isBirthday ? 'ANIVERSÁRIO' : (ev.event_type === 'engagement' ? 'NOIVADO' : 'CASAMOS-NOS');

  const coverPhoto = ev.cover_image || ev.bg_url_mobile || ev.bg_url;
  const coverBlock = coverPhoto ? `
    <div class="reveal" style="position:relative;width:100%;height:90vh;min-height:480px;max-height:760px;overflow:hidden;background:#1a1a2e">
      <img src="${coverPhoto}" style="width:100%;height:100%;object-fit:cover;display:block" alt="">
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.42) 100%)"></div>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 1.5rem">
        <p style="font-family:'Great Vibes',cursive;font-size:clamp(2.6rem,11vw,4rem);color:#fff;text-shadow:0 2px 16px rgba(0,0,0,0.5);margin:0;line-height:1">${escapeHTML(coupleNames)}</p>
        <p style="font-size:0.8rem;letter-spacing:0.35em;text-transform:uppercase;color:#fff;font-weight:700;margin-top:0.65rem;text-shadow:0 2px 8px rgba(0,0,0,0.5)">${eventTypeLabel}</p>
      </div>
      <div style="position:absolute;bottom:1.5rem;left:0;right:0;display:flex;justify-content:center">
        <svg class="elegant-scroll-hint" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </div>
    </div>` : '';

  const introBlock = `
    <div class="reveal" style="padding:3rem 1.5rem 2.5rem;text-align:center;max-width:480px;margin:0 auto">
      <p style="font-size:0.74rem;letter-spacing:0.25em;text-transform:uppercase;color:#9ca3af;font-weight:700;margin-bottom:0.5rem">Estás Convidado Para</p>
      <p style="font-family:'Great Vibes',cursive;font-size:clamp(1.9rem,8vw,2.5rem);color:${evColor};margin:0 0 1.1rem">${isBirthday ? 'o meu aniversário' : 'o nosso casamento'}</p>
      ${ev.invite_text ? `<p style="font-size:calc(0.9rem * var(--ev-body-scale,1));color:#374151;line-height:1.85">${ev.invite_text.split('\n').filter(Boolean).map(l=>escapeHTML(l)).join('<br>')}</p>` : ''}
    </div>`;

  // Contagem — reaproveita a secção já existente (mesmos 7 estilos, mesmo
  // motor de actualização a cada segundo), só com o título adaptado.
  const countdownBlock = ev.date ? buildCountdownSection({ ...ev, countdown_style: ev.countdown_style || 'continuous' })
    .replace('<!-- SECTION_DIVIDER -->', '')
    .replace('Contagem Regressiva até ao Grande Dia', 'Falta pouco para o grande dia') : '';

  // Agendar no calendário + data em destaque
  const dateObj = ev.date ? new Date(ev.date + 'T00:00:00') : null;
  const monthsPt = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
  const calendarBlock = dateObj ? `
    <div class="reveal" style="text-align:center;padding:0 1.5rem 3rem;background:linear-gradient(135deg,#f0f9fb,#e6f4f7)">
      <button onclick="window.open('${_buildGoogleCalendarUrl(ev)}','_blank')" style="background:#fff;color:${evColor};border:1.5px solid ${evColor};border-radius:999px;padding:0.65rem 1.4rem;font-weight:700;font-size:0.85rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.5rem;margin-bottom:2rem">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Agendar Recordatório
      </button><br>
      <p style="font-size:0.78rem;letter-spacing:0.2em;text-transform:uppercase;color:#6b7280;font-weight:700;margin:0">${monthsPt[dateObj.getMonth()]}</p>
      <p style="font-family:'Playfair Display',serif;font-size:3.2rem;font-weight:700;color:${evColor};margin:0.1rem 0;line-height:1">${dateObj.getDate()}</p>
      <p style="font-size:0.85rem;letter-spacing:0.15em;color:#9ca3af;margin:0">${dateObj.getFullYear()}</p>
    </div>` : '';

  // Locais — mesmos dados de sempre, com cabeçalhos cursivos
  const venueBlocks = [];
  if (ev.venue_ceremony) venueBlocks.push({ label: 'Ceremonia', name: ev.venue_ceremony, time: ev.time, maps: ev.venue_ceremony_maps });
  if (ev.venue_reception) venueBlocks.push({ label: 'Celebración', name: ev.venue_reception, time: null, maps: ev.venue_reception_maps });
  if (ev.venue_civil) venueBlocks.push({ label: ev.venue_civil_label || 'Cerimónia Civil', name: ev.venue_civil, time: null, maps: ev.venue_civil_maps });
  const venuesBlock = venueBlocks.length ? `
    <div class="reveal" style="padding:3rem 1.5rem;text-align:center;max-width:480px;margin:0 auto">
      ${venueBlocks.map(v => `
        <div style="margin-bottom:2.5rem">
          <p style="font-family:'Great Vibes',cursive;font-size:2.2rem;color:#1e293b;margin:0 0 0.6rem">${escapeHTML(v.label)}</p>
          <p style="font-size:calc(0.9rem * var(--ev-body-scale,1));color:#374151;line-height:1.7;margin-bottom:0.3rem">Te esperamos en<br><strong>${escapeHTML(v.name)}</strong></p>
          ${v.time ? `<p style="font-size:0.85rem;color:#6b7280;margin-bottom:1rem">às ${escapeHTML(v.time)}</p>` : ''}
          ${v.maps ? `<a href="${escapeHTML(v.maps)}" target="_blank" style="display:inline-block;background:${evColor};color:#fff;border-radius:999px;padding:0.55rem 1.5rem;font-size:0.78rem;font-weight:700;text-decoration:none;letter-spacing:0.05em">VER UBICACIÓN</a>` : ''}
        </div>`).join('')}
    </div>` : '';

  // Dress Code + Presentes, juntos numa só secção final
  const showDress = _yesOrTrue(ev.show_dresscode);
  const showGiftList = _yesOrTrue(ev.show_dress_gifts);
  const hasIban = !!(ev.iban_number && ev.iban_number.trim());
  const dressGiftsBlock = (showDress || showGiftList || hasIban) ? `
    <div class="reveal" style="padding:3rem 1.5rem;text-align:center;max-width:480px;margin:0 auto;background:#faf9f7">
      ${showDress ? `
        <div style="margin-bottom:2.5rem">
          <p style="font-size:0.78rem;letter-spacing:0.25em;text-transform:uppercase;color:#9ca3af;font-weight:700;margin-bottom:1rem">Dress Code</p>
          ${_buildDresscodeContentHTML(ev)}
        </div>` : ''}
      ${(showGiftList || hasIban) ? `
        <div>
          <p style="font-family:'Great Vibes',cursive;font-size:2.2rem;color:#1e293b;margin:0 0 0.75rem">Regalos</p>
          <p style="font-size:calc(0.88rem * var(--ev-body-scale,1));color:#374151;line-height:1.7;margin-bottom:1.25rem">Lo más importante es tu presencia,<br>pero si deseas hacernos un regalo aquí tienes nuestros datos.</p>
          <div style="display:flex;flex-direction:column;gap:0.7rem;align-items:center">
            ${hasIban ? `<button onclick="document.getElementById('elegant-iban-box').classList.toggle('hidden')" style="background:${evColor};color:#fff;border:none;border-radius:0.6rem;padding:0.75rem 2rem;font-weight:700;font-size:0.8rem;letter-spacing:0.04em;cursor:pointer;width:240px">VER DATOS BANCARIOS</button>` : ''}
            ${showGiftList ? `<button onclick="typeof openGuestGiftsModal==='function' && openGuestGiftsModal()" style="background:transparent;color:${evColor};border:1.5px solid ${evColor};border-radius:0.6rem;padding:0.75rem 2rem;font-weight:700;font-size:0.8rem;letter-spacing:0.04em;cursor:pointer;width:240px">LISTA DE REGALOS</button>` : ''}
          </div>
          ${hasIban ? `
          <div id="elegant-iban-box" class="hidden" style="margin-top:1.1rem;background:#fff;border-radius:0.6rem;padding:1rem;border:1px solid #e5e7eb;text-align:left;max-width:260px;margin-left:auto;margin-right:auto">
            ${ev.iban_holder ? `<p style="font-size:0.7rem;color:#9ca3af;margin-bottom:0.15rem">Titular</p><p style="font-size:0.85rem;font-weight:700;color:#1e293b;margin-bottom:0.5rem">${escapeHTML(ev.iban_holder)}</p>` : ''}
            <p style="font-size:0.7rem;color:#9ca3af;margin-bottom:0.15rem">IBAN</p>
            <p style="font-size:0.82rem;font-weight:700;color:#1e293b;word-break:break-all;margin-bottom:0.6rem">${escapeHTML(ev.iban_number)}</p>
            <button onclick="copyIban('${escapeHTML(ev.iban_number)}')" style="font-size:0.75rem;color:${evColor};font-weight:700;background:none;border:none;cursor:pointer;text-decoration:underline">Copiar IBAN</button>
          </div>` : ''}
        </div>` : ''}
    </div>` : '';

  return `<div class="elegant-invite" style="background:#fff">
    ${coverBlock}
    ${introBlock}
    ${countdownBlock}
    ${calendarBlock}
    ${(_yesOrTrue(ev.show_youtube_video) && ev.youtube_video_url) ? buildYoutubeVideoSection(ev).replace('<!-- SECTION_DIVIDER -->','') : ''}
    ${(_yesOrTrue(ev.custom_text_show_invite) && ev.custom_text_body) ? buildCustomTextSection(ev).replace('<!-- SECTION_DIVIDER -->','') : ''}
    ${venuesBlock}
    ${dressGiftsBlock}
  </div>`;
}

// ── Layout "Cartão" — uma só página, como um cartão físico. Fundo de
// imagem carregada pelo admin, tudo centrado numa única secção vertical.
// Elementos: bênção, texto bíblico, nomes, datas, locais, música. ──────
function buildCardInviteTemplate(ev) {
  const evColor = ev.event_color || '#7c3d52';
  const bgUrl   = ev.card_bg_url || ev.bg_url || '';
  const coupleNames = [ev.groom_name, ev.bride_name].filter(Boolean).join(' & ')
                      || escapeHTML(ev.title || '');
  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  let longDate = '';
  if (ev.date) {
    const d = new Date(ev.date + 'T00:00:00');
    longDate = `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
  }
  const venueRows = [];
  if (ev.venue_civil)     venueRows.push({ label:ev.venue_civil_label||'Cerimónia Civil',     name:ev.venue_civil,     time:ev.venue_civil_time,    maps:ev.venue_civil_maps     });
  if (ev.venue_ceremony)  venueRows.push({ label:ev.venue_ceremony_label||'Cerimónia Religiosa', name:ev.venue_ceremony,  time:ev.venue_ceremony_time, maps:ev.venue_ceremony_maps  });
  if (ev.venue_reception) venueRows.push({ label:ev.venue_reception_label||"Copo d'Água",         name:ev.venue_reception, time:ev.venue_reception_time,maps:ev.venue_reception_maps });
  const venuesHtml = venueRows.map(v => `
    <div style="margin-bottom:0.9rem">
      <p style="font-size:0.6rem;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:${evColor};margin-bottom:0.1rem">${escapeHTML(v.label)}</p>
      <p style="font-size:0.88rem;font-weight:700;color:#1e293b">${escapeHTML(v.name)}${v.time ? ` &nbsp;·&nbsp; ${escapeHTML(v.time)}` : ''}</p>
      ${v.maps ? `<a href="${escapeHTML(v.maps)}" target="_blank" style="font-size:0.72rem;color:${evColor};font-weight:600;text-decoration:underline">Ver no mapa</a>` : ''}
    </div>`).join('');

  return `<div class="card-invite" style="min-height:100vh;position:relative;overflow:hidden;background:#fdf8f4">
    ${bgUrl ? `<div style="position:fixed;inset:0;background-image:url('${bgUrl}');background-size:cover;background-position:center;z-index:0;pointer-events:none"></div><div style="position:fixed;inset:0;background:rgba(255,255,255,0.52);z-index:0;pointer-events:none"></div>` : ''}
    <div style="position:relative;z-index:1;max-width:480px;margin:0 auto;padding:4rem 2rem 5rem;text-align:center">
      ${ev.invite_blessing ? `<p class="reveal" style="font-size:0.78rem;color:#6b7280;font-style:italic;line-height:1.7;margin-bottom:2rem">${escapeHTML(ev.invite_blessing)}</p>` : ''}
      ${ev.bible_text ? `<div class="reveal" style="margin-bottom:2rem">
        <p style="font-size:0.75rem;font-weight:800;color:${evColor};margin-bottom:0.5rem">✦</p>
        ${ev.bible_text.split('\n').filter(Boolean).map(l=>`<p style="font-style:var(--ev-bible-style,italic);font-weight:var(--ev-bible-weight,400);font-family:var(--ev-bible-font,inherit);font-size:0.9rem;color:#374151;line-height:1.9;margin:0">${_formatBibleText(l)}</p>`).join('')}
        ${ev.bible_ref ? `<p style="font-size:0.7rem;color:#9ca3af;margin-top:0.5rem;font-weight:700">${escapeHTML(ev.bible_ref)}</p>` : ''}
      </div>` : ''}
      ${(ev.show_parents !== 'no' && (ev.groom_parents || ev.bride_parents)) ? `<div class="reveal" style="margin-bottom:1.5rem">
        ${ev.groom_parents ? `<p style="font-size:0.8rem;color:#6b7280;line-height:1.6">${ev.groom_parents.split('\n').filter(Boolean).map(l=>escapeHTML(l)).join(' &amp; ')}</p>` : ''}
        ${ev.bride_parents ? `<p style="font-size:0.8rem;color:#6b7280;line-height:1.6">${ev.bride_parents.split('\n').filter(Boolean).map(l=>escapeHTML(l)).join(' &amp; ')}</p>` : ''}
        <p style="font-size:0.7rem;color:#9ca3af;margin-top:0.3rem">convidam para o casamento de</p>
      </div>` : (ev.invite_text ? `<div class="reveal" style="margin-bottom:1.5rem"><p style="font-size:0.85rem;color:#4b5563;line-height:1.8">${ev.invite_text.split('\n').filter(Boolean).map(l=>escapeHTML(l)).join('<br>')}</p></div>` : '')}
      <div class="reveal" style="margin-bottom:2rem">
        <h2 style="font-family:'Great Vibes',cursive;font-size:clamp(2.4rem,10vw,3.2rem);color:${evColor};line-height:1.15;margin:0">${escapeHTML(coupleNames)}</h2>
      </div>
      <div class="reveal" style="display:flex;align-items:center;gap:0.75rem;margin-bottom:2rem;justify-content:center;opacity:0.35">
        <div style="height:1px;width:60px;background:${evColor}"></div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="${evColor}"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.27 2 8.5 2 5.41 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.08C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.41 22 8.5c0 3.77-3.4 6.86-8.55 11.53L12 21.35z"/></svg>
        <div style="height:1px;width:60px;background:${evColor}"></div>
      </div>
      ${longDate ? `<div class="reveal" style="margin-bottom:2rem">
        <p style="font-size:0.62rem;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:${evColor};margin-bottom:0.3rem">DATA</p>
        <p style="font-size:1.05rem;font-weight:700;color:#1e293b">${escapeHTML(longDate)}</p>
        ${ev.time ? `<p style="font-size:0.85rem;color:#6b7280">às ${escapeHTML(ev.time)}</p>` : ''}
      </div>` : ''}
      ${venueRows.length ? `<div class="reveal" style="margin-bottom:2rem;padding:1.25rem 1.5rem;background:rgba(255,255,255,0.65);border-radius:1rem;backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.8)">${venuesHtml}</div>` : ''}
      ${ev.music_url ? `<div class="reveal" style="margin-top:1rem;display:flex;align-items:center;gap:0.6rem;justify-content:center;opacity:0.65">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="${evColor}"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        <p style="font-size:0.75rem;color:#6b7280;margin:0">${escapeHTML(ev.music_title||'A tocar...')}</p>
        <button onclick="_cardToggleMute()" style="background:none;border:none;cursor:pointer;padding:0" title="Silenciar">
          <svg id="card-mute-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${evColor}" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
        </button>
        <audio id="card-audio" loop src="${escapeHTML(ev.music_url)}" autoplay></audio>
      </div>` : ''}
    </div>
  </div>`;
}
window._cardMuted = false;
window._cardToggleMute = function() {
  const a = document.getElementById('card-audio'); if (!a) return;
  window._cardMuted = !window._cardMuted; a.muted = window._cardMuted;
  const ic = document.getElementById('card-mute-icon');
  if (ic) ic.style.opacity = window._cardMuted ? '0.3' : '1';
};
function _initCardMusic(ev) {
  const a = document.getElementById('card-audio');
  if (a) a.play().catch(() => {});
}

// ── Layout "Calendário": tira de 3 fotos com a data sobreposta, calendário
//    real do mês com o dia do evento marcado, e secções de Cerimónia/
//    Banquete com ícone + botão de mapa. Opção nova e independente, usa a
//    cor do evento (mesma escolha já feita para o layout "Elegante"). ──
function _buildMonthCalendar(dateObj, evColor) {
  const monthsPt = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const year = dateObj.getFullYear(), month = dateObj.getMonth(), day = dateObj.getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Segunda = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dowLabels = ['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
  let cells = '';
  for (let i = 0; i < firstDow; i++) cells += `<span></span>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const isDay = d === day;
    cells += `<span style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:0.72rem;margin:0 auto;border-radius:50%;${isDay ? `background:${evColor};color:#fff;font-weight:800;` : 'color:#374151;'}">${d}</span>`;
  }
  return `<div style="max-width:280px;margin:0 auto">
    <p style="font-family:'Great Vibes',cursive;font-size:1.7rem;color:${evColor};text-align:center;margin-bottom:0.6rem">${monthsPt[month]}</p>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);margin-bottom:0.5rem">
      ${dowLabels.map(l => `<span style="font-size:0.58rem;color:#9ca3af;text-align:center;font-weight:700">${l}</span>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);row-gap:0.35rem">${cells}</div>
  </div>`;
}

function buildCalendarInviteTemplate(ev) {
  const evColor = ev.event_color || '#007f9f';
  const coupleNames = [ev.groom_name, ev.bride_name].filter(Boolean).join(' & ') || escapeHTML(ev.title || '');
  const isBirthday = ev.event_type === 'birthday';
  const subtitleLabel = isBirthday ? 'IT\'S MY BIRTHDAY' : (ev.event_type === 'engagement' ? 'WE GOT ENGAGED' : 'ARE GETTING MARRIED');
  const dateObj = ev.date ? new Date(ev.date + 'T00:00:00') : null;

  // Tira de 3 fotos com a data sobreposta (dia / mês / ano, a 2 dígitos)
  let photoStripBlock = '';
  if (dateObj) {
    const dd = String(dateObj.getDate()).padStart(2,'0');
    const mm = String(dateObj.getMonth()+1).padStart(2,'0');
    const yy = String(dateObj.getFullYear()).slice(-2);
    const galleryPhotos = (ev.gallery_urls || '').split('\n').map(u=>u.trim()).filter(Boolean);
    const photos = [galleryPhotos[0], galleryPhotos[1], galleryPhotos[2]].map(p => p || ev.cover_image || '');
    photoStripBlock = `
      <div class="reveal" style="display:flex;gap:0.15rem;margin:0 1.25rem 1.75rem">
        ${[dd,mm,yy].map((num,i) => `
          <div style="position:relative;flex:1;aspect-ratio:3/4;overflow:hidden;background:#1a1a2e;border-radius:0.3rem">
            ${photos[i] ? `<img src="${photos[i]}" style="width:100%;height:100%;object-fit:cover;display:block" alt="">` : ''}
            <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(0,0,0,0.6) 100%)"></div>
            <span style="position:absolute;bottom:0.35rem;left:0;right:0;text-align:center;font-size:1.7rem;font-weight:800;color:#fff;font-family:'Playfair Display',serif">${num}</span>
          </div>`).join('')}
      </div>`;
  }

  const headerBlock = `
    <div class="reveal" style="text-align:center;padding:2.5rem 1.5rem 1.5rem">
      <p style="font-family:'Great Vibes',cursive;font-size:clamp(2rem,9vw,2.6rem);color:#1e293b;margin:0">Save The Date</p>
    </div>
    ${photoStripBlock}
    <div class="reveal" style="text-align:center;padding:0 1.5rem 2.5rem">
      <p style="font-family:'Great Vibes',cursive;font-size:clamp(2.2rem,9vw,2.8rem);color:${evColor};margin:0">${escapeHTML(coupleNames)}</p>
      <p style="font-size:0.68rem;letter-spacing:0.3em;text-transform:uppercase;color:#9ca3af;font-weight:700;margin-top:0.5rem">${subtitleLabel}</p>
    </div>`;

  const introBlock = `
    <div class="reveal" style="padding:0 1.5rem 2.5rem;text-align:center;max-width:460px;margin:0 auto">
      <p style="font-size:1.15rem;font-weight:700;color:#1e293b;margin-bottom:0.9rem">Queridos convidados!</p>
      ${ev.invite_text ? `<p style="font-size:calc(0.9rem * var(--ev-body-scale,1));color:#374151;line-height:1.85">${ev.invite_text.split('\n').filter(Boolean).map(l=>escapeHTML(l)).join('<br>')}</p>` : ''}
    </div>`;

  const calendarBlock = dateObj ? `<div class="reveal" style="padding:0 1.5rem 2.75rem">${_buildMonthCalendar(dateObj, evColor)}</div>` : '';

  // Cerimónia + Banquete — ícone, data/hora, endereço, botão de mapa
  const venueRows = [];
  if (ev.venue_ceremony) venueRows.push({ icon:'church', label:'Cerimónia', name:ev.venue_ceremony, time:ev.time, maps:ev.venue_ceremony_maps });
  if (ev.venue_reception) venueRows.push({ icon:'glass-water', label:'Banquete', name:ev.venue_reception, time:null, maps:ev.venue_reception_maps });
  if (ev.venue_civil) venueRows.push({ icon:'file-text', label:ev.venue_civil_label||'Cerimónia Civil', name:ev.venue_civil, time:null, maps:ev.venue_civil_maps });
  const venuesBlock = venueRows.map(v => `
    <div class="reveal" style="text-align:center;padding:0 1.5rem 2.5rem;max-width:420px;margin:0 auto">
      <i data-lucide="${v.icon}" style="width:30px;height:30px;color:${evColor};margin-bottom:0.6rem"></i>
      <p style="font-size:1.2rem;font-weight:700;color:#1e293b;margin-bottom:0.7rem">${escapeHTML(v.label)}</p>
      ${(ev.date || v.time) ? `<p style="font-size:calc(0.95rem * var(--ev-body-scale,1));color:#374151;margin-bottom:0.5rem">${dateObj ? escapeHTML(String(dateObj.getDate()).padStart(2,'0')+'.'+String(dateObj.getMonth()+1).padStart(2,'0')) : ''}${v.time ? ` &nbsp;|&nbsp; ${escapeHTML(v.time)}` : ''}</p>` : ''}
      <p style="font-size:0.85rem;color:#6b7280;margin-bottom:1rem">${escapeHTML(v.name)}</p>
      ${v.maps ? `<a href="${escapeHTML(v.maps)}" target="_blank" style="display:inline-block;background:color-mix(in srgb,${evColor} 80%,#000);color:#fff;border-radius:0.5rem;padding:0.55rem 1.4rem;font-size:0.78rem;font-weight:700;text-decoration:none">VER NO MAPA</a>` : ''}
    </div>`).join('');

  // Dress code: paleta de cores (reaproveita dresscode_colors já existente)
  const showDress = _yesOrTrue(ev.show_dresscode);
  const dressColors = showDress && ev.dresscode_colors
    ? ev.dresscode_colors.split(/\n|,/).map(c=>c.trim()).filter(c=>/^#[0-9a-fA-F]{3,6}$/.test(c)).slice(0,8) : [];
  const dressBlock = showDress ? `
    <div class="reveal" style="text-align:center;padding:0 1.5rem 2.5rem;max-width:420px;margin:0 auto">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="${evColor}" stroke-width="1.3" style="margin-bottom:0.6rem"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>
      <p style="font-size:1.2rem;font-weight:700;color:#1e293b;margin-bottom:0.7rem">Dress Code</p>
      ${ev.dresscode_text ? `<p style="font-size:calc(0.9rem * var(--ev-body-scale,1));color:#374151;line-height:1.7;margin-bottom:1rem">${escapeHTML(ev.dresscode_text)}</p>` : ''}
      ${dressColors.length ? `<div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap">
        ${dressColors.map(c => `<div title="${c}" style="width:34px;height:34px;border-radius:50%;background:${c};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.18)"></div>`).join('')}
      </div>` : ''}
    </div>` : '';

  // Detalhes / presentes
  const hasIban = !!(ev.iban_number && ev.iban_number.trim());
  const detailsBlock = (hasIban || ev.iban_message) ? `
    <div class="reveal" style="text-align:center;padding:0 1.5rem 3rem;max-width:420px;margin:0 auto">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="${evColor}" stroke-width="1.5" style="margin-bottom:0.6rem"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      <p style="font-size:1.2rem;font-weight:700;color:#1e293b;margin-bottom:0.9rem">Detalhes</p>
      ${ev.iban_message ? `<p style="font-size:calc(0.88rem * var(--ev-body-scale,1));color:#374151;line-height:1.75;margin-bottom:1.1rem">${escapeHTML(ev.iban_message).split('\n').filter(Boolean).join('<br><br>')}</p>` : ''}
      ${hasIban ? `<button onclick="document.getElementById('cal-iban-box').classList.toggle('hidden')" style="background:${evColor};color:#fff;border:none;border-radius:0.5rem;padding:0.65rem 1.6rem;font-weight:700;font-size:0.8rem;cursor:pointer">Ver Dados Bancários</button>
      <div id="cal-iban-box" class="hidden" style="margin-top:1rem;background:#faf9f7;border-radius:0.6rem;padding:1rem;border:1px solid #e5e7eb;text-align:left">
        <p style="font-size:0.7rem;color:#9ca3af;margin-bottom:0.15rem">IBAN</p>
        <p style="font-size:0.82rem;font-weight:700;color:#1e293b;word-break:break-all;margin-bottom:0.6rem">${escapeHTML(ev.iban_number)}</p>
        <button onclick="copyIban('${escapeHTML(ev.iban_number)}')" style="font-size:0.75rem;color:${evColor};font-weight:700;background:none;border:none;cursor:pointer;text-decoration:underline">Copiar IBAN</button>
      </div>` : ''}
    </div>` : '';

  const closingBlock = `
    <div class="reveal" style="text-align:center;padding:1rem 1.5rem 3.5rem">
      <p style="font-size:0.85rem;color:#6b7280;margin-bottom:0.75rem">Esperamos por si com entusiasmo!</p>
      <p style="font-family:'Great Vibes',cursive;font-size:1.6rem;color:${evColor};margin:0">${escapeHTML(coupleNames)}</p>
    </div>`;

  return `<div class="calendar-invite" style="background:#fff">
    ${headerBlock}
    ${introBlock}
    ${(_yesOrTrue(ev.show_youtube_video) && ev.youtube_video_url) ? buildYoutubeVideoSection(ev).replace('<!-- SECTION_DIVIDER -->','') : ''}
    ${(_yesOrTrue(ev.custom_text_show_invite) && ev.custom_text_body) ? buildCustomTextSection(ev).replace('<!-- SECTION_DIVIDER -->','') : ''}
    ${calendarBlock}
    ${venuesBlock}
    ${dressBlock}
    ${detailsBlock}
    ${closingBlock}
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
  } else if (eventData.invite_layout === 'elegant') {
    if (heroBlock) heroBlock.style.display = 'none';
    container.innerHTML = buildElegantInviteTemplate(eventData);
    initScrollReveal();
    lucide.createIcons();
    return;
  } else if (eventData.invite_layout === 'calendar') {
    if (heroBlock) heroBlock.style.display = 'none';
    container.innerHTML = buildCalendarInviteTemplate(eventData);
    initScrollReveal();
    lucide.createIcons();
    return;
  } else if (eventData.invite_layout === 'card') {
    if (heroBlock) heroBlock.style.display = 'none';
    container.innerHTML = buildCardInviteTemplate(eventData);
    initScrollReveal();
    lucide.createIcons();
    _initCardMusic(eventData);
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
  // (debug logging removed — use browser devtools network tab for section data)

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
        case 'youtube_video': if (_yesOrTrue(eventData.show_youtube_video) && eventData.youtube_video_url) html += buildYoutubeVideoSection(eventData); break;
        case 'custom_text': if (_yesOrTrue(eventData.custom_text_show_invite) && eventData.custom_text_body) html += buildCustomTextSection(eventData); break;
        case 'iban':     if (eventData.iban_number) html += buildIbanSection(eventData); break;
        case 'gift_stores': if (eventData.gift_stores) html += buildGiftStoresSection(eventData); break;
        case 'gallery':  if (eventData.gallery_urls) html += buildGallerySection(eventData); break;
        case 'venues':   if (_yesOrTrue(eventData.show_venues) && (eventData.venue_ceremony || eventData.venue_civil || eventData.venue_reception)) html += buildVenueSection(eventData); break;
        case 'manual':   if (_yesOrTrue(eventData.show_manual)) html += buildManualSection(eventData); break;
        case 'schedule': if (_yesOrTrue(eventData.show_schedule)) html += buildScheduleSection(eventData); break;
        case 'dresscode': if (_yesOrTrue(eventData.show_dress_gifts ?? 'yes')) html += buildDressGiftsSection(eventData); break;
        case 'couplemsg': if (_yesOrTrue(eventData.show_couplemsg) && eventData.couplemsg_text) html += buildCoupleMsgSection(eventData); break;
        case 'final_photo': if (_yesOrTrue(eventData.show_final_photo) && eventData.final_photo_url) html += buildFinalPhotoSection(eventData); break;
        case 'couple_photo': if (eventData.couple_photo_url) html += buildCouplePhotoSection(eventData); break;
        case 'couple_video': if (eventData.couple_video_url) html += buildCoupleVideoSection(eventData); break;
        case 'event_faq': if (_yesOrTrue(eventData.show_event_faq) && eventData.event_faq_items) html += buildEventFaqSection(eventData); break;
        case 'messages':
          // ✅ Independente da confirmação de presença: aparece sempre que
          // "allow_messages" e/ou "show_guest_messages" estiverem activos,
          // mesmo que a secção/botão de RSVP esteja completamente escondida
          // (ex: rsvp_enabled=false, ou Save the Date activo sem "mostrar
          // também no convite completo"). Ver/Deixar Recado nunca deve
          // depender de a confirmação de presença estar visível.
          html += buildMessagesSection(eventData);
          break;
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
  // Apply section floral decorations
  if (typeof applySectionFlorals === 'function') applySectionFlorals(eventData.section_florals);
  // Apply section background images
  if (typeof applySectionBgs === 'function') applySectionBgs(eventData.section_bgs);
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

  // ✅ O hero JÁ tem o seu próprio degradê cuidado em CSS (escuro só na
  // base, para os nomes ficarem legíveis — transparente a partir de ~65%
  // da foto). Antes, esta função substituía esse degradê inteiro por um
  // tom escuro UNIFORME sobre toda a foto (rgba(0,0,0,overlayAlpha), por
  // defeito 35%) — isso é que estava a fazer qualquer foto de capa parecer
  // "coberta" por uma coisa preta. O "bg_overlay" é para o fundo fixo da
  // página (guest-bg-overlay-el, abaixo), não para o hero.

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

// Formatar texto bíblico — suporte a **negrito** e *linha inteira em negrito*
function _formatBibleText(line) {
  // Linha inteira entre ** → negrito total
  if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
    return '<strong>' + escapeHTML(line.slice(2,-2)) + '</strong>';
  }
  // Palavras/frases entre ** dentro da linha → negrito parcial
  // Ex: "A fé **move** montanhas"
  const escaped = escapeHTML(line);
  return escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function buildBibleSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  console.log('[ADK buildBibleSection] invite_order =', ev.invite_order, '| show_invite =', ev.show_invite, '| invite_text =', ev.invite_text ? '✓' : '✗');
  const bibleSize = parseFloat(ev.bible_size) || 0.92;
  const lines = (ev.bible_text || '').split('\n').filter(Boolean).map(l => `<p class="bible-verse" style="font-size:${bibleSize}rem;line-height:1.8;font-style:var(--ev-bible-style,italic);font-weight:var(--ev-bible-weight,400);font-family:var(--ev-bible-font,inherit)">${_formatBibleText(l)}</p>`).join('');
  const lines2 = (ev.bible_text_2 || '').split('\n').filter(Boolean).map(l => `<p class="bible-verse" style="font-size:${bibleSize}rem;line-height:1.8;font-style:var(--ev-bible-style,italic);font-weight:var(--ev-bible-weight,400);font-family:var(--ev-bible-font,inherit)">${_formatBibleText(l)}</p>`).join('');
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
      <p class="bible-couple-names" style="font-size:${blessingCoupleFontSize};font-weight:700;letter-spacing:0.01em;font-family:${coupleFontFamily}">
        ${escapeHTML(groomName)}${groomName && brideName ? ' & ' : ''}${escapeHTML(brideName)}
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

  // ✅ O ornamento decorativo fica SEMPRE imediatamente após o versículo bíblico,
  // independentemente de como os pais, os nomes ou o texto do convite estão ordenados.
  const ornamentHtml = ev.bible_ornament_url
    ? `<img src="${ev.bible_ornament_url}" alt="" class="bible-ornament-anim" style="height:${parseFloat(ev.bible_ornament_size)||28}px;width:auto;margin:0.75rem auto 0;display:block" onerror="this.style.display='none'">`
    : `<div style="font-size:1.2rem;color:${ev.event_color||'#c9a84c'};margin-top:0.75rem;letter-spacing:0.2em">✦</div>`;

  return _SD + `<div class="event-section" style="background:#fdfaf6;text-align:center">
    <div class="section-inner">
      <div class="reveal scale-in">
        ${lines}
        ${ev.bible_ref ? `<p class="bible-ref" style="margin-top:0.75rem">${escapeHTML(ev.bible_ref)}</p>` : ''}
        ${lines2 ? `<div style="margin-top:1rem">${lines2}${ev.bible_ref_2 ? `<p class="bible-ref" style="margin-top:0.75rem">${escapeHTML(ev.bible_ref_2)}</p>` : ''}</div>` : ''}
      </div>
      ${ornamentHtml}
      ${parentsHtml}
      ${ev.invite_order === 'before' ? inviteHtml + coupleNamesHtml : coupleNamesHtml + inviteHtml}
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
  const c = ev.event_color || '#007f9f';
  const style = ev.countdown_style || 'cards';
  const units = [['cd-days','Dias','DIAS'],['cd-hours','Horas','HORAS'],['cd-mins','Min','MIN'],['cd-secs','Seg','SEG']];

  let inner;
  if (style === 'continuous') {
    // ── Contínua: "13 : 06 : 40 : 57" numa só linha, com pontos a separar ──
    inner = `<div style="display:flex;align-items:flex-start;justify-content:center;gap:0.15rem">
      ${units.map(([id,,lbl], i) => `${i>0?`<span style="font-size:2.4rem;font-weight:300;color:${c};opacity:0.4;line-height:1;font-family:Georgia,serif;padding:0 0.05rem">:</span>`:''}
        <div style="display:flex;flex-direction:column;align-items:center">
          <span style="font-size:2.4rem;font-weight:300;color:${c};font-family:Georgia,serif;line-height:1" id="${id}">--</span>
          <span style="font-size:0.6rem;letter-spacing:0.15em;color:#6b7280;margin-top:0.4rem">${lbl}</span>
        </div>`).join('')}
    </div>`;
  } else if (style === 'circles') {
    // ── Círculos: cada unidade num círculo com contorno ──
    inner = `<div style="display:flex;gap:0.8rem;justify-content:center;flex-wrap:wrap">
      ${units.map(([id,,lbl]) => `<div style="width:64px;height:64px;border-radius:50%;border:2px solid ${c};display:flex;flex-direction:column;align-items:center;justify-content:center">
        <span style="font-size:1.25rem;font-weight:800;color:${c};line-height:1" id="${id}">--</span>
        <span style="font-size:0.48rem;letter-spacing:0.05em;color:#6b7280;margin-top:0.15rem">${lbl}</span>
      </div>`).join('')}
    </div>`;
  } else if (style === 'minimal') {
    // ── Minimalista: números finos, divididos por linhas finas ──
    inner = `<div style="display:flex;justify-content:center;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;max-width:380px;margin:0 auto">
      ${units.map(([id,,lbl], i) => `<div style="flex:1;text-align:center;padding:0.9rem 0.3rem;${i<3?'border-right:1px solid #e5e7eb':''}">
        <div style="font-size:1.7rem;font-weight:300;color:#1e293b;line-height:1" id="${id}">--</div>
        <div style="font-size:0.55rem;letter-spacing:0.15em;color:#9ca3af;margin-top:0.35rem">${lbl}</div>
      </div>`).join('')}
    </div>`;
  } else if (style === 'flip') {
    // ── Estilo "flip clock": cartões escuros com uma linha a meio ──
    inner = `<div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap">
      ${units.map(([id,,lbl]) => `<div style="text-align:center">
        <div style="background:linear-gradient(180deg,#1e293b,#334155);border-radius:0.45rem;padding:0.55rem 0.8rem;box-shadow:0 4px 10px rgba(0,0,0,0.25);position:relative;min-width:56px">
          <span style="font-size:1.6rem;font-weight:800;color:#fff;font-family:'Courier New',monospace" id="${id}">--</span>
          <div style="position:absolute;left:0;right:0;top:50%;height:1px;background:rgba(0,0,0,0.35)"></div>
        </div>
        <div style="font-size:0.55rem;letter-spacing:0.1em;color:#6b7280;margin-top:0.4rem">${lbl}</div>
      </div>`).join('')}
    </div>`;
  } else if (style === 'outline') {
    // ── Contorno: caixas só com borda, sem fundo ──
    inner = `<div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap">
      ${units.map(([id,,lbl]) => `<div style="border:2px solid ${c};border-radius:0.6rem;padding:0.55rem 0.85rem;min-width:58px">
        <div style="font-size:1.4rem;font-weight:800;color:${c};text-align:center;line-height:1" id="${id}">--</div>
        <div style="font-size:0.5rem;letter-spacing:0.1em;color:${c};opacity:0.8;text-align:center;margin-top:0.2rem">${lbl}</div>
      </div>`).join('')}
    </div>`;
  } else if (style === 'pills') {
    // ── Pílulas: cápsulas coloridas, número e legenda lado a lado ──
    inner = `<div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap">
      ${units.map(([id,lblFull]) => `<div style="background:${c};border-radius:999px;padding:0.45rem 1.1rem;display:inline-flex;align-items:baseline;gap:0.4rem">
        <span style="font-size:1.1rem;font-weight:800;color:#fff;line-height:1" id="${id}">--</span>
        <span style="font-size:0.6rem;color:#fff;opacity:0.9">${lblFull}</span>
      </div>`).join('')}
    </div>`;
  } else {
    // ── Cartões (padrão) ──
    inner = `<div class="countdown-section-grid">
      ${units.map(([id,lblFull]) => `<div class="countdown-section-box" style="background:${c}"><div class="cdb-num" id="${id}">--</div><div class="cdb-label">${lblFull}</div></div>`).join('')}
    </div>`;
  }

  return _SD + `<div class="event-section" style="background:linear-gradient(135deg,#f0f9fb,#e6f4f7)">
    <div class="section-inner" style="text-align:center">
      <div class="reveal">
        <span class="section-tag">Contagem Regressiva até ao Grande Dia</span>
        ${inner}
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

// ── Vídeo do YouTube — embutido no próprio convite, nunca a abrir o
//    YouTube directamente. Usa youtube-nocookie.com (modo "privacidade
//    melhorada" do próprio YouTube) + modestbranding/rel=0, para reduzir
//    ao mínimo possível a marca do YouTube visível — o pequeno logótipo no
//    canto do leitor é a única coisa que o YouTube nunca deixa remover,
//    mesmo com estas opções todas; o resto (vídeos relacionados de outros
//    canais, título grande, etc.) fica escondido. ──────────────────────
function buildYoutubeVideoSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const videoId = (typeof extractYouTubeId === 'function') ? extractYouTubeId(ev.youtube_video_url || '') : null;
  if (!videoId) return '';
  return _SD + `<div class="event-section" style="background:#0f172a">
    <div class="section-inner reveal" style="text-align:center;padding-top:2.5rem;padding-bottom:2.5rem">
      ${ev.youtube_video_title ? `<p style="font-size:1.05rem;font-weight:700;color:#fff;margin-bottom:1.1rem">${escapeHTML(ev.youtube_video_title)}</p>` : ''}
      <div style="position:relative;width:100%;max-width:520px;margin:0 auto;border-radius:0.85rem;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.4)">
        <div style="position:relative;width:100%;aspect-ratio:16/9;background:#000">
          <iframe src="https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0&iv_load_policy=3&playsinline=1" title="${escapeHTML(ev.youtube_video_title || 'Vídeo')}" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
        </div>
      </div>
    </div>
  </div>`;
}

// ── Texto Personalizado — bloco livre, com título opcional, que o
// utilizador escreve e organiza onde quiser (Save the Date e/ou Convite,
// e a posição dentro do convite via o reordenador de secções). ──────────
function buildCustomTextSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  if (!ev.custom_text_body) return '';
  return _SD + `<div class="event-section">
    <div class="section-inner reveal" style="text-align:center;max-width:480px;margin:0 auto">
      ${ev.custom_text_title ? `<h3 class="section-title">${escapeHTML(ev.custom_text_title)}</h3>` : ''}
      <p style="font-size:calc(0.92rem * var(--ev-body-scale,1));color:#374151;line-height:1.85">${ev.custom_text_body.split('\n').filter(Boolean).map(l=>escapeHTML(l)).join('<br>')}</p>
    </div>
  </div>`;
}

function buildStorySection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  if (!ev.story_text) return '';
  const evColor = ev.event_color || '#007f9f';
  const storyStyle = ev.story_style || 'centered';
  const storySize  = parseFloat(ev.story_size) || 0.88;
  const storyTextColor = ev.story_text_color || '#4b5563';
  const storyDateColor = ev.story_date_color || evColor;  // ── Style: PHOTO-SIDE — story text next to a photo ──
  if (storyStyle === 'photo-side' && ev.story_photo_url) {
    return _SD + `<div class="event-section story-section">
      <div class="section-inner">
        <h2 class="section-title reveal" style="text-align:center;margin-bottom:1.5rem">Nossa História</h2>
        <div class="reveal" style="display:flex;gap:1.5rem;align-items:center;flex-wrap:wrap;max-width:560px;margin:0 auto">
          <div style="flex:1 1 220px;min-width:200px;border-radius:1rem;overflow:hidden;aspect-ratio:4/5">
            <img src="${ev.story_photo_url}" style="width:100%;height:100%;object-fit:cover" alt="">
          </div>
          <div style="flex:1 1 220px;min-width:200px">
            <p style="font-size:${storySize}rem;color:${storyTextColor};line-height:1.75;white-space:pre-line">${escapeHTML(ev.story_text)}</p>
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
          <p style="font-size:${storySize}rem;color:${storyTextColor};line-height:1.85;font-style:italic;white-space:pre-line">${escapeHTML(ev.story_text)}</p>
        </div>
      </div>
    </div>`;
  }

  // Parse story text — detectar capítulos mesmo sem parágrafos duplos.
  // Suporta separadores escritos numa só linha como "2020 - texto 2021 - texto"
  let rawText = ev.story_text;
  // Primeiro tentar por parágrafo duplo
  let chapters = rawText.split(/\n\n+/).filter(c => c.trim());

  // Se só tiver 1 bloco, tentar detectar padrão "ANO - texto" ou "ANO — texto"
  if (chapters.length <= 1) {
    // Dividir antes de dígitos (4) que aparecem após texto, ex: "...vidas 2023 - "
    const autoSplit = rawText.split(/(?=\b\d{4}\s*[-–—])/).filter(c => c.trim());
    if (autoSplit.length > 1) chapters = autoSplit;
  }

  const heartSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="${evColor}"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;

  // ✅ Estilo ZIGZAG — ativado pelo selector ou quando há múltiplos capítulos
  if (storyStyle === 'zigzag' || (storyStyle !== 'centered' && chapters.length > 1) || (storyStyle === 'centered' && chapters.length > 1)) {
    const rows = chapters.map((ch, i) => {
      const trimmed = ch.trim();
      const lines = trimmed.split('\n');
      // Se for uma linha só, tentar separar "ANO - Título" do resto
      let titleLine = lines[0] || '';
      let body = lines.slice(1).join(' ').trim();

      // Se o título for muito longo (toda a história numa linha), tentar separar pelo primeiro " - " ou " — "
      if (!body && titleLine.length > 60) {
        const sepMatch = titleLine.match(/^(.{4,40}?)\s*[-–—]\s*(.+)$/);
        if (sepMatch) { titleLine = sepMatch[1].trim(); body = sepMatch[2].trim(); }
      }
      const isLeft = i % 2 === 0;
      const card = `<div class="story-card ${isLeft ? 'story-left' : 'story-right'} reveal" style="background:transparent;border:none;box-shadow:none;padding:0.5rem 0.9rem">
        <div class="story-date" style="font-size:0.65rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${evColor};margin-bottom:0.2rem">${escapeHTML(titleLine)}</div>
        ${body ? `<p class="story-body" style="font-size:${(storySize*0.89).toFixed(2)}rem;color:${storyTextColor};line-height:1.55;margin:0">${escapeHTML(body)}</p>` : ''}
      </div>`;
      const node = `<div class="story-node" style="width:10px;height:10px;border-radius:50%;background:${evColor};flex-shrink:0;position:relative;z-index:3;box-shadow:0 0 0 3px #fff,0 0 0 4px color-mix(in srgb,${evColor} 30%,transparent)"></div>`;
      const empty = `<div></div>`;
      return `<div class="story-row">${isLeft ? card : empty}${node}${isLeft ? empty : card}</div>`;
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

  // Fallback: texto centrado simples
  return _SD + `<div class="event-section story-section">
    <div class="section-inner" style="text-align:center">
      <div class="reveal">
        <h2 class="section-title">Nossa História</h2>
        <p class="story-text" style="font-size:${storySize}rem">${escapeHTML(ev.story_text)}</p>
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


// Detecta se um URL é do Google Maps e escolhe o label certo
function _storeUrlLabel(url) {
  if (!url) return '';
  const isMaps = url.includes('maps.google') || url.includes('maps.app.goo') || 
                 url.includes('goo.gl/maps') || url.includes('google.com/maps');
  return isMaps 
    ? '📍 Localização no Google Maps'
    : '🏪 Visitar loja completa';
}

function buildGiftStoresHTML(ev, evColor) {
  let stores = [];
  try { stores = JSON.parse(ev.gift_stores || '[]'); } catch(e) {}
  const style   = ev.gift_stores_style || 'modal';
  const title   = escapeHTML(ev.gift_stores_title || 'Lojas sugeridas');
  const message = ev.gift_stores_message ? `<p style="font-size:calc(0.85rem * var(--ev-body-scale,1));color:#4b5563;line-height:1.7;margin-bottom:1rem">${escapeHTML(ev.gift_stores_message)}</p>` : '';

  if (!stores.length || style === 'hidden') return '';

  if (style === 'list') {
    // Lista simples inline
    return `<div style="margin-top:1.5rem">
      <p style="font-size:0.7rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${evColor};margin-bottom:0.6rem;text-align:center">${title}</p>
      ${message}
      <div style="display:flex;flex-direction:column;gap:0.6rem">
        ${stores.map(s => {
          const items = (s.items||[]).filter(it => it.name);
          return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.85rem;padding:0.85rem 1rem">
            <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:${items.length?'0.6rem':'0'}">
              ${s.logo_url ? `<img src="${escapeHTML(s.logo_url)}" style="width:36px;height:36px;object-fit:contain;border-radius:4px;flex-shrink:0">` : ''}
              <span style="font-weight:700;color:#1e293b;font-size:0.9rem">${escapeHTML(s.name||'')}</span>
              ${s.url ? `<a href="${escapeHTML(s.url)}" target="_blank" style="display:inline-flex;align-items:center;gap:0.3rem;font-size:0.75rem;color:${evColor};font-weight:700;text-decoration:none;background:color-mix(in srgb,${evColor} 8%,white);padding:0.3rem 0.65rem;border-radius:0.4rem">${_storeUrlLabel(s.url)}</a>` : ''}
            </div>
            ${items.map(it => `<div style="display:flex;justify-content:space-between;padding:0.3rem 0;border-bottom:1px solid #f3f4f6">
              ${it.url ? `<a href="${escapeHTML(it.url)}" target="_blank" style="font-size:0.82rem;color:#374151;text-decoration:none">${escapeHTML(it.name)}</a>` : `<span style="font-size:0.82rem;color:#374151">${escapeHTML(it.name)}</span>`}
              ${it.price ? `<span style="font-size:0.78rem;font-weight:700;color:${evColor};margin-left:0.5rem">${escapeHTML(it.price)}</span>` : ''}
            </div>`).join('')}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // Modo modal — botão que abre ecrã completo
  const storesJson = escapeHTML(JSON.stringify(stores));
  return `<div style="margin-top:1.5rem;text-align:center">
    <p style="font-size:0.7rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${evColor};margin-bottom:0.5rem">${title}</p>
    ${message}
    <button onclick="_openGiftStoresModal(this)"
      data-stores="${storesJson}"
      data-title="${escapeHTML(ev.gift_stores_title||'Lojas sugeridas')}"
      data-color="${evColor}"
      class="rsvp-cta-btn action-btn"
      style="background:${evColor};color:#fff;border:none;border-radius:0.85rem;padding:0.8rem 2rem;font-weight:700;font-size:0.9rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.5rem">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
      Ver lojas lojas de presentes
    </button>
  </div>`;
}

// Abre o ecrã de lojas em modo fullscreen (sobre o convite)
window._openGiftStoresModal = function(btn) {
  const stores  = JSON.parse(btn.dataset.stores || '[]');
  const title   = btn.dataset.title || 'Lojas sugeridas';
  const color   = btn.dataset.color || '#007f9f';

  const modal = document.createElement('div');
  modal.id = '_gift-stores-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:99999;overflow-y:auto;padding:1.5rem 1.25rem 4rem';
  modal.innerHTML = `
    <div style="max-width:520px;margin:0 auto">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem">
        <button onclick="document.getElementById('_gift-stores-modal').remove()"
          style="background:#f3f4f6;border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;font-size:1.2rem;flex-shrink:0">←</button>
        <h2 style="font-size:1.1rem;font-weight:800;color:#1e293b;margin:0">${escapeHTML(title)}</h2>
      </div>
      <div style="display:flex;flex-direction:column;gap:0.75rem">
        ${stores.map(s => {
          const items = (s.items||[]).filter(it => it.name);
          return `<div style="background:#fafafa;border:1px solid #e5e7eb;border-radius:1rem;overflow:hidden">
            <div style="display:flex;align-items:center;gap:0.75rem;padding:1rem">
              ${s.logo_url ? `<img src="${escapeHTML(s.logo_url)}" style="width:44px;height:44px;object-fit:contain;border-radius:0.5rem;flex-shrink:0;background:#fff;border:1px solid #f3f4f6">` : `<div style="width:44px;height:44px;background:color-mix(in srgb,${color} 10%,white);border-radius:0.5rem;flex-shrink:0;display:flex;align-items:center;justify-content:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg></div>`}
              <div style="flex:1">
                <p style="font-weight:800;color:#1e293b;font-size:1rem;margin:0">${escapeHTML(s.name||'')}</p>
                ${s.url ? `<a href="${escapeHTML(s.url)}" target="_blank" style="display:inline-flex;align-items:center;gap:0.35rem;font-size:0.78rem;color:${color};font-weight:700;text-decoration:none;background:color-mix(in srgb,${color} 10%,white);padding:0.4rem 0.85rem;border-radius:0.5rem;border:1px solid color-mix(in srgb,${color} 25%,transparent);margin-top:0.5rem">${_storeUrlLabel(s.url)}</a>` : ''}
              </div>
            </div>
            ${items.length ? `<div style="border-top:1px solid #f3f4f6;padding:0.5rem 1rem 0.75rem">
              ${items.map(it => `<div style="display:flex;justify-content:space-between;align-items:center;padding:0.45rem 0;border-bottom:1px solid #f9fafb">
                ${it.url ? `<a href="${escapeHTML(it.url)}" target="_blank" style="font-size:0.85rem;color:#374151;text-decoration:none;flex:1">${escapeHTML(it.name)}</a>` : `<span style="font-size:0.85rem;color:#374151;flex:1">${escapeHTML(it.name)}</span>`}
                ${it.price ? `<span style="font-size:0.82rem;font-weight:800;color:${color};margin-left:0.75rem;flex-shrink:0">${escapeHTML(it.price)}</span>` : ''}
              </div>`).join('')}
            </div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  document.body.appendChild(modal);
};

function buildIbanSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const evColor = ev.event_color || '#007f9f';
  const msgLines = (ev.iban_message || '').split('\n').map(l => `<p style="color:#374151;font-size:calc(0.92rem * var(--ev-body-scale,1));line-height:1.7;text-align:center">${escapeHTML(l)}</p>`).join('');
  return _SD + `<div class="event-section" style="background:#f0f9fb">
    <div class="section-inner reveal" style="text-align:center">
      <div style="background:#fff;border-radius:1rem;padding:1.5rem 1.25rem;max-width:480px;margin:0 auto;border:1.5px solid color-mix(in srgb,${evColor} 25%,transparent)">
        <div style="text-align:center;margin-bottom:1rem">
          <div class="iban-gift-icon">
            <svg class="gift-box-anim-svg" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${evColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible">
              <polyline points="20 12 20 22 4 22 4 12"/>
              <line x1="12" y1="22" x2="12" y2="12"/>
              <g class="gift-box-lid">
                <rect x="2" y="7" width="20" height="5"/>
                <line x1="12" y1="12" x2="12" y2="7"/>
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
              </g>
              <g class="gift-box-sparkle" stroke="none" fill="${evColor}">
                <circle cx="2.5" cy="3" r="0.55"/>
                <circle cx="21.5" cy="2.2" r="0.45"/>
                <circle cx="19.5" cy="5.5" r="0.4"/>
              </g>
            </svg>
          </div>
          <span style="font-size:1.1rem;font-weight:800;color:${evColor}">Gostaria de nos presentear?</span>
        </div>
        ${msgLines}
        ${!ev.iban_number_2 ? `
        <div class="bg-gray-50 rounded-lg px-3 py-2 mt-3 mb-1 border border-teal-100"><p class="text-xs text-gray-400 mb-0.5">IBAN</p><p class="iban-value" style="text-align:center;word-break:break-all;margin:0.25rem 0">${escapeHTML(ev.iban_number)}</p></div>
        ${ev.iban_holder ? `<div class="bg-gray-50 rounded-lg px-3 py-2 mb-2 border border-teal-100"><p class="text-xs text-gray-400 mb-0.5">Titular</p><p class="text-sm font-semibold text-gray-700">${escapeHTML(ev.iban_holder)}</p></div>` : ''}
        <button class="iban-copy-btn" id="iban-copy-btn" onclick="copyIban('${escapeHTML(ev.iban_number)}')">
          <span class="action-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
          <span class="action-btn-label">Copiar IBAN</span>
        </button>` : `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-top:0.75rem">
          <div>
            <div class="bg-gray-50 rounded-lg px-3 py-2 mb-1 border border-teal-100"><p class="text-xs text-gray-400 mb-0.5">IBAN 1</p><p class="iban-value" style="text-align:center;word-break:break-all;margin:0.25rem 0;font-size:0.8rem">${escapeHTML(ev.iban_number)}</p></div>
            ${ev.iban_holder ? `<div class="bg-gray-50 rounded-lg px-3 py-2 mb-2 border border-teal-100"><p class="text-xs text-gray-400 mb-0.5">Titular</p><p class="text-sm font-semibold text-gray-700">${escapeHTML(ev.iban_holder)}</p></div>` : ''}
            <button class="iban-copy-btn" onclick="copyIban('${escapeHTML(ev.iban_number)}')" style="width:100%;justify-content:center">
              <span class="action-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
              <span class="action-btn-label">Copiar</span>
            </button>
          </div>
          <div>
            <div class="bg-gray-50 rounded-lg px-3 py-2 mb-1 border border-teal-100"><p class="text-xs text-gray-400 mb-0.5">IBAN 2</p><p class="iban-value" style="text-align:center;word-break:break-all;margin:0.25rem 0;font-size:0.8rem">${escapeHTML(ev.iban_number_2)}</p></div>
            ${ev.iban_holder_2 ? `<div class="bg-gray-50 rounded-lg px-3 py-2 mb-2 border border-teal-100"><p class="text-xs text-gray-400 mb-0.5">Titular</p><p class="text-sm font-semibold text-gray-700">${escapeHTML(ev.iban_holder_2)}</p></div>` : ''}
            <button class="iban-copy-btn" onclick="copyIban('${escapeHTML(ev.iban_number_2)}')" style="width:100%;justify-content:center">
              <span class="action-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
              <span class="action-btn-label">Copiar</span>
            </button>
          </div>
        </div>`}
        ${ev.iban_footer ? `<p class="text-xs text-gray-400 mt-3 text-right italic">${escapeHTML(ev.iban_footer)}</p>` : ''}
      </div>
    </div>
  </div>`;
}

// Secção independente para as lojas de presentes
function buildGiftStoresSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  let stores = [];
  try { stores = JSON.parse(ev.gift_stores || '[]'); } catch(e) {}
  if (!stores.length || (ev.gift_stores_style||'modal') === 'hidden') return '';
  return _SD + `<div class="event-section">
    <div class="section-inner reveal" style="text-align:center">
      ${buildGiftStoresHTML(ev, ev.event_color||'#007f9f')}
    </div>
  </div>`;
}

function buildGallerySection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const rawUrls = (ev.gallery_urls || '').split('\n').map(u => u.trim()).filter(Boolean);

  // ✅ Filtrar fotos desactivadas (prefixo '!') — mantém a ordem manual do dono
  // Nota: não ordenamos por número de ficheiro aqui — o dono arrasta para definir a ordem
  // no editor. Se quiser ordem por número, deve nomear 1.jpg, 2.jpg... E arrastar nessa ordem.
  const urls = rawUrls.filter(u => !u.startsWith('!'));
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
        <h3 class="section-title reveal" style="text-align:center">Galeria de Fotos</h3>
        <div id="${galId}" class="g3d-wrap reveal">
          <div class="g3d-track">${slides}</div>
          ${urls.length > 1 ? `
          <button class="g3d-arrow prev" aria-label="Anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <button class="g3d-arrow next" aria-label="Seguinte"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>` : ''}
        </div>
        <div class="g3d-dots">${dots}</div>
      </div>
    </div>`;
  }

  // ── Style: MASONRY — irregular mosaic, varying heights ──
  if (style === 'masonry') {
    const items = urls.map((u, i) => `<div class="gmasonry-item" style="background-image:url('${u}')" onclick="openLightbox('${u}')"></div>`).join('');
    return _SD + `<div class="event-section" style="background:#f8fafc"><div class="section-inner">
      <h3 class="section-title reveal">Galeria de Fotos</h3>
      <div class="gmasonry-grid reveal-stagger">${items}</div>
    </div></div>`;
  }

  // ── Style: GRID (default) — classic uniform mosaic ──
  const items = urls.map(u => `<div class="gallery-item"><img src="${u}" data-url="${u}" alt="" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover" onerror="this.closest('.gallery-item').style.display='none'"></div>`).join('');
  return _SD + `<div class="event-section" style="background:#f8fafc"><div class="section-inner">
    <h3 class="section-title reveal">Galeria de Fotos</h3>
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
        <p style="font-size:calc(0.85rem * var(--ev-body-scale,1));color:#374151;line-height:1.5;padding-top:0.3rem">${it.text.replace(/\n/g, '<br>')}</p>
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
        <p style="font-size:calc(0.85rem * var(--ev-body-scale,1));color:#374151;line-height:1.5;padding-top:0.35rem">${it.text.replace(/\n/g, '<br>')}</p>
      </div>`).join('');
    return _SD + `<div class="event-section" style="background:#f8fafc"><div class="section-inner">
      <h3 class="section-title reveal" style="color:${evColor}">Manual do Bom Convidado</h3>
      <div>${rows}</div>
    </div></div>`;
  }

  // ── Style: CARDS (default) — grid of icon cards ──
  const noCircles = ev.manual_show_circles === 'no';
  const cards = items.map(it => `<div class="manual-item">
    <div class="mi-icon" style="${noCircles ? '' : `background:color-mix(in srgb,${evColor} 15%,white)`}">${it.icon && it.icon.startsWith('http') ? `<img src="${it.icon}" style="${noCircles ? 'width:42px;height:42px' : 'width:20px;height:20px'};object-fit:contain">` : `<i data-lucide="${it.icon}" style="color:${evColor}"></i>`}</div>
    <p class="mi-text">${it.text.replace(/\n/g, '<br>')}</p>
  </div>`).join('');
  return _SD + `<div class="event-section" style="background:#f8fafc">
    <div class="section-inner">
      <h3 class="section-title reveal" style="color:${evColor}">Manual do Bom Convidado</h3>
      <div class="manual-grid reveal-stagger${noCircles ? ' manual-no-circles' : ''}">${cards}</div>
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
      const timeLabel  = `<div style="font-size:calc(0.72rem * var(--ev-body-scale,1));font-weight:800;color:${evColor};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">${it.time}</div>`;
      const textLabel  = `<div><div style="font-weight:700;color:#1e293b;font-size:calc(0.88rem * var(--ev-body-scale,1))">${escapeHTML(it.label)}</div>${it.sub?`<div style="font-size:calc(0.72rem * var(--ev-body-scale,1));color:#6b7280;margin-top:1px">${escapeHTML(it.sub)}</div>`:''}</div>`;
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
        <span style="font-size:calc(0.82rem * var(--ev-body-scale,1));font-weight:800;color:${evColor};min-width:52px">${it.time}</span>
        <div><span style="font-weight:700;color:#1e293b;font-size:calc(0.85rem * var(--ev-body-scale,1))">${escapeHTML(it.label)}</span>${it.sub?` <span style="font-size:calc(0.75rem * var(--ev-body-scale,1));color:#9ca3af">— ${escapeHTML(it.sub)}</span>`:''}</div>
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
          <div style="font-size:calc(0.7rem * var(--ev-body-scale,1));font-weight:800;color:${evColor};text-transform:uppercase;letter-spacing:0.05em">${it.time}</div>
          <div style="font-weight:700;color:#1e293b;font-size:calc(0.92rem * var(--ev-body-scale,1))">${escapeHTML(it.label)}</div>
          ${it.sub?`<div style="font-size:calc(0.75rem * var(--ev-body-scale,1));color:#6b7280">${escapeHTML(it.sub)}</div>`:''}
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
    <div class="sc-item-reveal" style="display:flex;gap:1rem;margin-bottom:1.5rem;max-width:480px;margin-left:auto;margin-right:auto;position:relative">
      <div style="flex-shrink:0;width:70px;text-align:right">
        <span style="font-size:calc(1.05rem * var(--ev-body-scale,1));font-weight:800;color:#1e293b">${it.time}</span>
      </div>
      <div style="flex-shrink:0;position:relative;display:flex;flex-direction:column;align-items:center">
        <div style="width:12px;height:12px;border-radius:50%;background:${evColor};margin-top:6px;flex-shrink:0;position:relative;z-index:2;box-shadow:0 0 0 4px color-mix(in srgb,${evColor} 15%,white)"></div>
      </div>
      <div style="flex:1;padding-bottom:0.25rem">
        <div style="font-weight:800;color:#1e293b;font-size:calc(0.85rem * var(--ev-body-scale,1));text-transform:uppercase;letter-spacing:0.03em">${escapeHTML(it.label)}</div>
        ${it.sub?`<div style="font-size:calc(0.82rem * var(--ev-body-scale,1));color:#9ca3af;margin-top:1px">${escapeHTML(it.sub)}</div>`:''}
        ${it.icon && (it.icon.startsWith('http'))
          ? `<img src="${it.icon}" style="width:30px;height:30px;object-fit:contain;margin-top:0.4rem">`
          : (it.icon && it.icon !== 'star' ? `<i data-lucide="${it.icon}" style="width:18px;height:18px;color:${evColor};margin-top:0.4rem"></i>` : '')}
      </div>
    </div>`).join('');

  return _SD + `<div class="event-section">
    <div class="section-inner">
      <h3 class="section-title reveal" style="text-align:center">Itinerário</h3>
      <div data-sc-wrap="1" style="position:relative;max-width:480px;margin:0 auto;text-align:left">
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
  // Sanitizar ícones com HTML colado por engano
  items.forEach(it => { it.icon = _sanitizeIconValue(it.icon); });
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
        <div style="width:32px;height:32px;flex-shrink:0;border-radius:50%;background:#f3f4f6;display:flex;align-items:center;justify-content:center;overflow:hidden">
          ${it.icon && it.icon.startsWith('http') ? `<img src="${escapeHTML(it.icon)}" style="width:20px;height:20px;object-fit:contain">` : `<i data-lucide="${escapeHTML(it.icon||'circle')}" style="width:16px;height:16px;color:#6b7280"></i>`}
        </div>
        <input class="input-field text-xs flex-1" value="${escapeHTML(it.text.replace(/\n/g,' '))}" placeholder="Texto" id="mi-text-${i}">
        <div class="flex flex-col gap-0.5">
          <input class="input-field text-xs" style="width:100px" value="${it.icon&&!it.icon.startsWith('http')?escapeHTML(it.icon):''}" placeholder="Ícone lucide" id="mi-icon-${i}" oninput="(()=>{window._miTmp=${i};})()">
          <div class="flex gap-1">
            <input type="file" accept="image/png,image/svg+xml,image/jpeg" style="display:none" id="mi-icon-file-${i}" onchange="window._uploadManualIcon(${i},this)">
            <button type="button" class="text-xs text-teal-600" onclick="document.getElementById('mi-icon-file-${i}').click()">📤 PNG</button>
            ${it.icon && it.icon.startsWith('http') ? `<button type="button" class="text-xs text-red-400" onclick="(()=>{document.getElementById('mi-icon-${i}').value='';window._miItems[${i}].icon='circle';window._reRenderManual();})()">✕</button>` : ''}
          </div>
        </div>
        <button type="button" class="text-red-400 px-1" onclick="removeManualItem(${i})"><i data-lucide="x" class="w-4 h-4"></i></button>
        ${i > 0 ? `<button type="button" class="text-gray-400 px-1" onclick="moveManualItem(${i},-1)"><i data-lucide="arrow-up" class="w-3 h-3"></i></button>` : ''}
        ${i < items.length-1 ? `<button type="button" class="text-gray-400 px-1" onclick="moveManualItem(${i},1)"><i data-lucide="arrow-down" class="w-3 h-3"></i></button>` : ''}
      </div>`).join('');
  }

  window._miItems = items;
  window._reRenderManual = () => {
    document.getElementById('manual-items-list').innerHTML = renderItems();
    lucide.createIcons({ el: document.getElementById('manual-items-list') });
  };
  window._uploadManualIcon = async (idx, input) => {
    const file = input.files[0];
    if (!file) return;
    const btn = input.nextElementSibling;
    if (btn) btn.textContent = '...';
    const url = await uploadImageToStorage(file, 'event-covers', 'Ícone manual');
    if (url) {
      window._miItems[idx].icon = url;
      window._reRenderManual();
    }
    if (btn) btn.textContent = '📤 PNG';
  };

  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl shadow-lg p-5 max-w-lg w-full max-h-[85vh] overflow-y-auto">
    <h3 class="text-base font-bold text-gray-800 mb-1">Manual do Bom Convidado</h3>
    <p class="text-xs text-gray-400 mb-2">Os ícones são nomes do <a href="https://lucide.dev/icons/" target="_blank" class="text-teal-500 underline">Lucide Icons</a>. Escreve o nome e vê a pré-visualização ao lado.</p>
    <label class="flex items-center gap-2 mb-3 cursor-pointer p-2 bg-gray-50 rounded-lg">
      <input type="checkbox" id="mi-show-circles" ${(Store.guestEventData?.manual_show_circles !== false) ? 'checked' : ''} class="w-4 h-4 accent-teal-500">
      <span class="text-xs font-semibold text-gray-700">Mostrar círculos por trás dos ícones</span>
      <span class="text-xs text-gray-400">(desactivar deixa os ícones maiores)</span>
    </label>
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
      <input class="input-field text-xs w-20" value="${it.icon}" placeholder="nome ou URL" id="mi-icon-${i}"
        oninput="(function(inp,idx){
          let v=inp.value.trim();
          // ✅ Rejeitar HTML colado (ex: atribuição do Flaticon) — o campo
          // só aceita um nome de ícone Lucide ou um URL directo de imagem.
          if(v.includes('<')||v.includes('>')||v.includes('href=')){inp.value='';v='';toast('Cole apenas o URL directo da imagem, não o código HTML de atribuição.');}
          const p=document.getElementById('mi-prev-'+idx);
          if(!p)return;
          if(v.startsWith('http'))p.innerHTML='<img src=\\''+v+'\\' style=\\'width:16px;height:16px;object-fit:contain\\'>';
          else p.innerHTML='<i data-lucide=\\''+v+'\\' style=\\'width:16px;height:16px;color:#007f9f\\'></i>';
          try{lucide.createIcons();}catch(e){}
        })(this,${i})">
      <button type="button" onclick="openIconPickerModal('manual', url => { const inp=document.getElementById('mi-icon-${i}'); if(inp) inp.value=url; const p=document.getElementById('mi-prev-${i}'); if(p) p.innerHTML='<img src=\\''+url+'\\' style=\\'width:16px;height:16px;object-fit:contain\\'>'; })" style="background:#f0f9fb;color:#007f9f;border:none;border-radius:0.4rem;padding:0.3rem;font-size:0.6rem;font-weight:700;cursor:pointer;flex-shrink:0" title="Escolher ícone da biblioteca (SVG/PNG)">📁</button>
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
      const showCircles = document.getElementById('mi-show-circles')?.checked !== false;
      const saveResult = await saveEventVisuals(eventId, {
        manual_items: JSON.stringify(items),
        manual_show_circles: showCircles ? 'yes' : 'no',
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
function _sanitizeIconValue(v) {
  if (!v) return v;
  // ✅ Se contiver HTML (ex: código de atribuição do Flaticon colado por
  // engano), limpar em vez de guardar e mostrar o código na tela.
  if (v.includes('<') || v.includes('>') || v.includes('href=')) return 'star';
  return v;
}

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
  // Sanitizar ícones que possam ter HTML colado por engano
  items.forEach(it => { it.icon = _sanitizeIconValue(it.icon); });
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
function _scIconPreviewHtml(icon, size) {
  const s = size || '14px';
  if (!icon) return '';
  if (icon.startsWith('http')) return `<img src="${icon}" style="width:${s};height:${s};object-fit:contain" onerror="this.style.opacity='0.2'">`;
  return `<i data-lucide="${icon}" style="width:${s};height:${s};color:#007f9f"></i>`;
}
function refreshScheduleEditorList() {
  const items = window._scheduleEditorItems;
  const clientMode = window._scheduleEditorClientMode;
  document.getElementById('schedule-items-list').innerHTML = items.map((it, i) => `
    <div class="flex items-start gap-2 mb-3 bg-gray-50 rounded-xl p-2">
      <div class="flex flex-col gap-1 flex-1">
        <div class="flex gap-2">
          <input class="input-field text-xs w-24" value="${escapeHTML(it.time||'')}" placeholder="Hora (ex: 21h00)" id="sc-time-${i}">
          <input class="input-field text-xs flex-1" value="${escapeHTML(it.label||'')}" placeholder="Momento" id="sc-label-${i}">
        </div>
        <div style="display:flex;align-items:center;gap:4px;width:100%">
          <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style="background:rgba(0,127,159,0.12)" id="sc-prev-${i}">${_scIconPreviewHtml(it.icon,'14px')}</div>
          <input class="input-field text-xs flex-1" value="${escapeHTML(it.icon||'')}" placeholder="nome Lucide ou URL de imagem" id="sc-icon-${i}"
            oninput="(function(inp,idx){let v=inp.value.trim();if(v.includes('<')||v.includes('>')||v.includes('href=')){inp.value='';v='';toast('Cole o URL directo, não código HTML.');}const p=document.getElementById('sc-prev-'+idx);if(!p)return;p.innerHTML=v.startsWith('http')?'<img src=\''+v+'\' style=\'width:14px;height:14px;object-fit:contain\' onerror=\'this.style.opacity=0.2\'>':'<i data-lucide=\''+v+'\' style=\'width:14px;height:14px;color:#007f9f\'></i>';try{lucide.createIcons();}catch(e){};})(this,${i})">
          <button type="button"
            onclick="openIconPickerModal('schedule', url => { const inp=document.getElementById('sc-icon-${i}'); if(inp){inp.value=url;inp.dispatchEvent(new Event('input'));} })"
            style="background:#f0f9fb;color:#007f9f;border:1px solid #007f9f33;border-radius:0.4rem;padding:0.3rem 0.5rem;font-size:0.65rem;font-weight:700;cursor:pointer;flex-shrink:0"
            title="Escolher ícone da biblioteca (SVG/PNG)">📁</button>
        </div>
        ${!clientMode ? `<input class="input-field text-xs" value="${escapeHTML(it.sub||'')}" placeholder="Subtítulo (opcional)" id="sc-sub-${i}">` : ''}
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
  { key: 'youtube_video', label: 'Vídeo do YouTube',                 icon: 'play-circle' },
  { key: 'venues',    label: 'Locais do Evento',                     icon: 'map-pin' },
  { key: 'parents',   label: 'Nomes dos Pais',                       icon: 'users' },
  { key: 'iban',        label: 'Sugestão de Presente (IBAN)',         icon: 'credit-card' },
  { key: 'gift_stores', label: 'Lojas de Presentes',                  icon: 'shopping-bag' },
  { key: 'gallery',   label: 'Galeria de Fotos',                     icon: 'image' },
  { key: 'manual',    label: 'Manual do Bom Convidado',              icon: 'list-checks' },
  { key: 'schedule',  label: 'Itinerário',                           icon: 'clock' },
  { key: 'dresscode',  label: 'Dress Code + Sugestão de Presentes',     icon: 'shirt' },
  { key: 'couplemsg',   label: 'Mensagem dos Noivos',                   icon: 'message-circle' },
  { key: 'final_photo', label: 'Foto Final dos Noivos',                 icon: 'image' },
  { key: 'couple_photo', label: 'Foto de Fundo do Casal',               icon: 'heart' },
  { key: 'couple_video', label: 'Vídeo do Casal',                        icon: 'video' },
  { key: 'event_faq',   label: 'Perguntas Frequentes',                  icon: 'help-circle' },
  { key: 'messages',    label: 'Recados / Correio do Amor',             icon: 'message-square-heart' },
  { key: 'custom_text', label: 'Texto Personalizado',                   icon: 'file-text' },
];

function getDefaultSectionOrder() {
  return ALL_SECTION_DEFS.map(s => s.key);
}

// Store.eventSectionOrder persists for the current event editing session
// Saved to Supabase as section_order JSON column
Store.eventSectionOrder = null;

function openSectionOrderEditor() {
  // Detectar quais secções estão activas com base nos switches do editor
  const isSectionActive = (key) => {
    const checks = {
      'bible':       () => document.getElementById('sw-bible')?.classList.contains('active'),
      'invite':      () => document.getElementById('sw-invite')?.classList.contains('active'),
      'date':        () => true, // sempre visível
      'countdown':   () => true,
      'story':       () => document.getElementById('sw-story')?.classList.contains('active'),
      'youtube_video': () => document.getElementById('sw-show-youtube-video')?.classList.contains('active'),
      'venues':      () => document.getElementById('sw-venues')?.classList.contains('active'),
      'parents':     () => document.getElementById('sw-parents')?.classList.contains('active'),
      'iban':        () => document.getElementById('sw-iban')?.classList.contains('active'),
      'gift_stores': () => {
        // Verificar nos dados do evento actual (não no modal que pode não estar aberto)
        const ev = Store.events?.find(e => e.id === Store.currentEventId);
        if (ev?.gift_stores) { try { return JSON.parse(ev.gift_stores).length > 0; } catch(e) {} }
        // Fallback: tentar ler do input do modal se estiver aberto
        try { const s=JSON.parse(document.getElementById('dg2-gift-stores')?.value||'[]'); return s.length>0; } catch(e){ return false; }
      },
      'gallery':     () => document.getElementById('sw-gallery')?.classList.contains('active'),
      'manual':      () => document.getElementById('sw-manual')?.classList.contains('active'),
      'schedule':    () => document.getElementById('sw-schedule')?.classList.contains('active'),
      'dresscode':   () => document.getElementById('sw-dresscode')?.classList.contains('active'),
      'couplemsg':   () => document.getElementById('sw-couplemsg')?.classList.contains('active'),
      'final_photo': () => document.getElementById('sw-final-photo')?.classList.contains('active'),
      'couple_photo':() => !!document.getElementById('evt-couple-photo-url')?.value,
      'event_faq':   () => document.getElementById('sw-event-faq')?.classList.contains('active'),
      'messages':    () => document.getElementById('sw-messages')?.classList.contains('active'),
      'custom_text': () => !!(document.getElementById('evt-custom-text-title')?.value || document.getElementById('evt-custom-text-body')?.value),
    };
    const fn = checks[key];
    return fn ? (fn() ?? true) : true;
  };

  // Start with the current saved order (from event or Store)
  let order = Store.eventSectionOrder
    ? [...Store.eventSectionOrder]
    : getDefaultSectionOrder();

  // Always add any missing sections
  const allKeys = getDefaultSectionOrder();
  allKeys.forEach(k => { if (!order.includes(k)) order.push(k); });
  order = order.filter(k => allKeys.includes(k));

  // Separar em activas e inactivas
  const activeOrder   = order.filter(k => isSectionActive(k));
  const inactiveOrder = order.filter(k => !isSectionActive(k));

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'section-order-modal';

  // Guardar antes de renderizar
  window._sectionOrderCurrent = activeOrder;
  window._sectionOrderInactive = inactiveOrder;

  function renderList() {
    const active = window._sectionOrderCurrent;
    return active.map((key, i) => {
      const def = ALL_SECTION_DEFS.find(d => d.key === key) || { label: key, icon: 'layout' };
      return `<div class="section-reorder-item" data-key="${key}">
        <span class="sr-handle"><i data-lucide="grip-vertical" class="w-4 h-4"></i></span>
        <span class="sr-label">${def.label}</span>
        <button type="button" class="text-gray-300 hover:text-gray-500 px-1" onclick="moveSectionUp(${i})" ${i===0?'disabled style="opacity:0.3"':''}>
          <i data-lucide="chevron-up" class="w-4 h-4"></i>
        </button>
        <button type="button" class="text-gray-300 hover:text-gray-500 px-1" onclick="moveSectionDown(${i})" ${i===active.length-1?'disabled style="opacity:0.3"':''}>
          <i data-lucide="chevron-down" class="w-4 h-4"></i>
        </button>
      </div>`;
    }).join('');
  }

  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl shadow-lg p-5 max-w-md w-full" style="max-height:85vh;overflow-y:auto">
    <h3 class="text-base font-bold text-gray-800 mb-1">Organizar Secções</h3>
    <p class="text-xs text-gray-400 mb-1">Apenas as secções activas aparecem aqui. Active mais secções no editor para as adicionar.</p>
    ${inactiveOrder.length ? `<p class="text-xs text-gray-300 mb-3">Inactivas (não aparecem): ${inactiveOrder.map(k=>(ALL_SECTION_DEFS.find(d=>d.key===k)||{label:k}).label).join(', ')}</p>` : ''}
    <div id="section-order-list">${renderList()}</div>
    <div class="flex gap-2 mt-4">
      <button class="flex-1 btn-main" onclick="saveSectionOrder()">Guardar</button>
      <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      <button class="text-xs text-gray-400 px-2" onclick="resetSectionOrder()">Repor</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  lucide.createIcons();
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
  // Guardar activas primeiro (na nova ordem) + inactivas no fim (mantêm posição relativa)
  const combined = [...window._sectionOrderCurrent, ...(window._sectionOrderInactive || [])];
  Store.eventSectionOrder = combined;
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
  console.log('[ADK venues] ceremony_label=', ev.venue_ceremony_label, '| civil_label=', ev.venue_civil_label, '| reception_label=', ev.venue_reception_label);
  const evColor = ev.event_color || '#007f9f';
  const venues = [];
  if (ev.venue_ceremony) venues.push({ icon: ev.venue_ceremony_icon || 'church',      title: ev.venue_ceremony_label||'Cerimónia Religiosa', name: ev.venue_ceremony, maps: ev.venue_ceremony_maps, image: ev.venue_ceremony_image });
  if (ev.venue_civil)    venues.push({ icon: ev.venue_civil_icon || 'file-text',   title: ev.venue_civil_label||'Cerimónia Civil',     name: ev.venue_civil,    maps: ev.venue_civil_maps,    image: ev.venue_civil_image });
  if (ev.venue_reception)venues.push({ icon: ev.venue_reception_icon || 'glass-water', title: ev.venue_reception_label||"Copo d'Água",          name: ev.venue_reception,maps: ev.venue_reception_maps, image: ev.venue_reception_image });
  if (!venues.length) return '';

  const imgFit = ev.venue_image_fit === 'cover' ? 'cover' : 'contain';
  const cards = venues.map(v => `
    <div style="background:#fff;border-radius:1rem;overflow:hidden;border:1.5px solid color-mix(in srgb,${evColor} 20%,#e5e7eb);text-align:center;flex:1;min-width:180px">
      ${v.image ? `<div style="width:100%;height:170px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,${evColor} 6%,#fff)"><img src="${v.image}" style="width:100%;height:100%;object-fit:${imgFit}" alt="${escapeHTML(v.title)}"></div>` : ''}
      <div style="padding:1.25rem 1rem">
        ${!v.image ? `<div style="width:44px;height:44px;border-radius:50%;background:color-mix(in srgb,${evColor} 12%,white);display:flex;align-items:center;justify-content:center;margin:0 auto 0.6rem">
          ${v.icon && v.icon.startsWith('http') ? `<img src="${v.icon}" style="width:22px;height:22px;object-fit:contain">` : `<i data-lucide="${v.icon}" style="width:20px;height:20px;color:${evColor}"></i>`}
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
        <span class="action-btn-icon"><svg class="gift-box-anim-svg" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="overflow:visible">
          <polyline points="20 12 20 22 4 22 4 12"/>
          <line x1="12" y1="22" x2="12" y2="12"/>
          <g class="gift-box-lid">
            <rect x="2" y="7" width="20" height="5"/>
            <line x1="12" y1="12" x2="12" y2="7"/>
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
          </g>
          <g class="gift-box-sparkle" stroke="none" fill="currentColor">
            <circle cx="2.5" cy="3" r="0.55"/>
            <circle cx="21.5" cy="2.2" r="0.45"/>
            <circle cx="19.5" cy="5.5" r="0.4"/>
          </g>
        </svg></span>
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
  // ✅ Suporta várias imagens agora (dresscode_image_urls, uma por linha) —
  // mantém compatibilidade com eventos antigos que só tinham uma única
  // imagem guardada em dresscode_image_url.
  const dressImages = (ev.dresscode_image_urls || ev.dresscode_image_url || '')
    .split('\n').map(u => u.trim()).filter(Boolean);
  let imagesHtml;
  if (dressImages.length === 1) {
    imagesHtml = `<img src="${dressImages[0]}" style="width:100%;max-width:220px;border-radius:0.85rem;object-fit:cover;aspect-ratio:1;margin:0 auto 0.85rem;display:block">`;
  } else if (dressImages.length > 1) {
    imagesHtml = `<div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;max-width:340px;margin:0 auto 0.85rem">
      ${dressImages.map(url => `<img src="${url}" style="width:${dressImages.length===2?'140px':'100px'};height:${dressImages.length===2?'140px':'100px'};border-radius:0.7rem;object-fit:cover" loading="lazy">`).join('')}
    </div>`;
  } else {
    imagesHtml = `<div style="width:52px;height:52px;border-radius:50%;background:color-mix(in srgb,${evColor} 12%,white);display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${evColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>
      </div>`;
  }
  return `<div style="text-align:center">
      ${imagesHtml}
      ${ev.dresscode_text ? `<p style="font-size:calc(1rem * var(--ev-body-scale,1));font-weight:600;color:#1e293b;margin-bottom:0.5rem">${escapeHTML(ev.dresscode_text)}</p>` : ''}
      ${ev.dresscode_detail ? `<p style="font-size:calc(0.85rem * var(--ev-body-scale,1));color:#374151;line-height:1.6;max-width:420px;margin:0 auto 0.5rem">${escapeHTML(ev.dresscode_detail)}</p>` : ''}
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
  const title = _getSectionTitle(ev, 'couplemsg', singlePerson ? 'Mensagem para os Convidados' : 'Mensagem dos Noivos');

  // Fonte do corpo da mensagem
  const bodyFont = ev.couplemsg_body_font || '';
  const bodyIsUrl = bodyFont.startsWith('http');
  const bodyFontName = bodyIsUrl
    ? 'cmsgbody-' + bodyFont.split('/').pop().replace(/[^a-zA-Z0-9]/g,'-').slice(0,20)
    : bodyFont;
  let bodyFontInject = '';
  if (bodyIsUrl) {
    bodyFontInject = `<style>@font-face{font-family:'${bodyFontName}';src:url('${bodyFont}');}</style>`;
  } else if (['Great Vibes','Dancing Script','Playfair Display','Lora','Sacramento','Garamond'].includes(bodyFont)) {
    bodyFontInject = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(bodyFont)}&display=swap">`;
  }
  const bodyFontStyle = bodyFontName ? `font-family:'${bodyFontName}',serif;` : '';

  // Assinatura dos noivos
  const sig = ev.couplemsg_signature;
  const sigFont = ev.couplemsg_sig_font || '';
  const sigSize = parseFloat(ev.couplemsg_sig_size) || 1.6;

  // Detectar se é URL (fonte carregada pelo utilizador) ou nome de Google Font
  const isUrl = sigFont.startsWith('http');
  const googleFonts = ['Great Vibes','Dancing Script','Sacramento','Pacifico','Playfair Display'];
  const isGoogleFont = googleFonts.includes(sigFont);

  // Nome CSS da família — para URLs geramos um nome único a partir do URL
  const cssFontFamily = isUrl
    ? 'sig-font-' + sigFont.split('/').pop().replace(/[^a-zA-Z0-9]/g,'-').slice(0,20)
    : sigFont;

  // Injectar @font-face para fontes carregadas por URL
  let fontInjectHtml = '';
  if (sig && isUrl) {
    fontInjectHtml = `<style>@font-face{font-family:'${cssFontFamily}';src:url('${sigFont}');}</style>`;
  } else if (sig && isGoogleFont) {
    fontInjectHtml = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(sigFont)}&display=swap">`;
  }

  const sigHtml = sig ? `
    <div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid #f3f4f6">
      <p style="font-size:${sigSize}rem;color:${evColor};font-family:${cssFontFamily ? `'${cssFontFamily}',` : ''}serif;line-height:1.4">${escapeHTML(sig)}</p>
    </div>` : '';

  return bodyFontInject + fontInjectHtml + _SD + `<div class="event-section">
    <div class="section-inner reveal" style="text-align:center">
      <div style="width:52px;height:52px;border-radius:50%;background:color-mix(in srgb,${evColor} 12%,white);display:flex;align-items:center;justify-content:center;margin:0 auto 0.75rem">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${evColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
      </div>
      <h3 class="section-title">${escapeHTML(title)}</h3>
      <p style="font-size:${parseFloat(ev.couplemsg_size)||0.95}rem;color:#374151;line-height:1.75;max-width:460px;margin:0 auto;white-space:pre-wrap;${bodyFontStyle}">${escapeHTML(ev.couplemsg_text || '')}</p>
      ${sigHtml}
    </div>
  </div>`;
}


// ===================== SHARED ICON LIBRARY (SVG uploads) =====================
// Icons uploaded by ANY user become available to ALL users (shared library)
async function uploadIconToLibrary(file, category) {
  if (!file) return null;
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
  if (!isSvg && !isPng) {
    toast('Apenas ficheiros SVG ou PNG são permitidos.');
    return null;
  }
  if (file.size > 500 * 1024) {
    toast('Ícone muito grande. Máx. 500 KB.');
    return null;
  }
  try {
    // ✅ Carregar directamente com o Content-Type correcto — o SVG em
    // particular precisa de ser enviado como 'image/svg+xml' ou o Supabase
    // Storage serve-o como texto e os browsers recusam mostrá-lo numa <img>.
    const contentType = isSvg ? 'image/svg+xml' : 'image/png';
    const ext = isSvg ? 'svg' : 'png';
    const fileName = `icon_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/event-covers/${fileName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
        'Cache-Control': '3600',
      },
      body: file,
    });
    if (!res.ok) { const t = await res.text(); console.error('Erro upload ícone:', t); toast('Erro ao carregar ícone.'); return null; }
    const url = `${SUPABASE_URL}/storage/v1/object/public/event-covers/${fileName}`;
    await supabaseRequest('icon_library', 'POST', {
      name: file.name.replace(/\.(svg|png)$/i, ''), url, category: category || 'manual',
      uploaded_by: Store.currentUser?.id || null
    });
    toast('Ícone adicionado à biblioteca!');
    return url;
  } catch(e) {
    console.error('uploadIconToLibrary error:', e);
    toast('Erro ao carregar ícone.');
    return null;
  }
}

async function loadIconLibrary(category) {
  const rows = await supabaseRequest(`icon_library?category=eq.${category}&select=id,name,url&order=created_at.desc&limit=60`).catch(() => []);
  return rows || [];
}

async function openIconPickerModal(category, onSelect) {
  // ✅ Mostrar de imediato, com loading, em vez de não aparecer nada até
  // a biblioteca carregar (o que deixava só o fundo preto visível).
  const modal = document.createElement('div');
  modal.id = '_icon-picker-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1.25rem;box-sizing:border-box';
  modal.innerHTML = `<div style="background:#fff;border-radius:1.25rem;padding:1.5rem;max-width:480px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h3 style="font-size:1rem;font-weight:800;color:#1e293b;margin:0">Escolher Ícone</h3>
      <button id="_icon-picker-close" style="background:#f3f4f6;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:1.1rem;line-height:1">×</button>
    </div>
    <label style="display:block;background:#f0f9fb;border:1.5px dashed #007f9f;border-radius:0.75rem;padding:0.75rem;text-align:center;cursor:pointer;margin-bottom:1rem;font-size:0.82rem;color:#007f9f;font-weight:600">
      + Carregar novo ícone SVG ou PNG (ficará disponível para todos)
      <input type="file" accept=".svg,.png,image/svg+xml,image/png" style="display:none" id="_icon-upload-input">
    </label>
    <div id="_icon-grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.6rem">
      <p style="grid-column:1/-1;text-align:center;color:#9ca3af;font-size:0.8rem;padding:1rem">A carregar...</p>
    </div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('_icon-picker-close').onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };

  window._iconPickerSelect = (url) => { onSelect(url); modal.remove(); };

  document.getElementById('_icon-upload-input').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = await uploadIconToLibrary(file, category);
    if (url) { onSelect(url); modal.remove(); }
  };

  // Carregar a biblioteca em segundo plano
  const icons = await loadIconLibrary(category);
  const grid = document.getElementById('_icon-grid');
  if (!grid) return;
  if (!icons || !icons.length) {
    grid.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#9ca3af;font-size:0.8rem;padding:1rem">Nenhum ícone na biblioteca ainda. Carrega o primeiro!</p>';
    return;
  }
  grid.innerHTML = icons.map(ic => `<div onclick="window._iconPickerSelect('${ic.url}')" style="aspect-ratio:1;border:1px solid #e5e7eb;border-radius:0.6rem;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0.5rem;background:#f8fafc;transition:border-color 0.15s" title="${escapeHTML(ic.name)}" onmouseover="this.style.borderColor='#007f9f'" onmouseout="this.style.borderColor='#e5e7eb'">
    <img src="${ic.url}" style="width:100%;height:100%;object-fit:contain" onerror="this.parentElement.style.display='none'">
  </div>`).join('');
}

// ── Foto final dos noivos ──────────────────────────────────────────────────
function buildCouplePhotoSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  if (!ev.couple_photo_url) return '';
  return _SD + `<div class="event-section" style="padding:0;overflow:hidden">
    <div style="width:100%;height:280px;background-image:url('${ev.couple_photo_url}');background-size:cover;background-position:center;position:relative">
      <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.1),rgba(0,0,0,0.35))"></div>
    </div>
  </div>`;
}

function buildFinalPhotoSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const hasNames = !!(ev.groom_name || ev.bride_name);
  const namesHtml = `${escapeHTML(ev.groom_name||'')}${ev.groom_name&&ev.bride_name?' &amp; ':''}${escapeHTML(ev.bride_name||'')}`;
  // ✅ O wrapper é "inline-block" e do tamanho exacto da foto renderizada
  // (nunca maior) — por isso o nome sobreposto cai sempre dentro da própria
  // foto (nunca sobre espaço vazio à volta), mesmo que a foto não preencha
  // toda a largura/altura disponível. Fundo branco em vez do escuro anterior.
  return _SD + `<div class="event-section" style="padding:2.5rem 1rem;background:#fff;text-align:center">
    <div class="reveal" style="display:inline-block;position:relative;max-width:100%;line-height:0;border-radius:1.1rem;overflow:hidden">
      <img src="${ev.final_photo_url}" alt="Foto dos Noivos"
        style="display:block;width:auto;height:auto;max-width:100%;max-height:80vh;margin:0 auto"
        onerror="this.parentElement.parentElement.style.display='none'">
      ${hasNames ? `<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.5) 0%,transparent 40%)"></div>
      <p style="position:absolute;bottom:1.1rem;left:0;right:0;text-align:center;color:#fff;font-size:1.05rem;font-weight:700;letter-spacing:0.05em;font-family:var(--event-font,'Playfair Display',serif);margin:0;line-height:normal">${namesHtml}</p>` : ''}
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
            <span style="font-size:calc(0.88rem * var(--ev-body-scale,1));font-weight:700;color:#1e293b">${escapeHTML(it.q || '')}</span>
            <svg class="faq-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ev-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-left:0.5rem;transition:transform 0.2s"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="faq-answer hidden" style="padding:0 1rem 0.85rem;font-size:calc(0.82rem * var(--ev-body-scale,1));color:#6b7280;line-height:1.6">${escapeHTML(it.a || '')}</div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// ── Recados / Correio do Amor ───────────────────────────────────────────
// ✅ Secção independente da confirmação de presença: tanto "Ver Recados"
// como "Deixar Recado" reaproveitam o overlay/modal já existentes em
// rsvp.js (rsvpOpenFelicitacoes / rsvpLeaveFelicitacao), mas com um botão
// próprio aqui no corpo do convite — assim continuam acessíveis mesmo
// quando a secção/botão de RSVP está completamente escondida (rsvp_enabled
// desligado, ou Save the Date activo sem "mostrar também no convite
// completo"). Controlado pelos mesmos 2 interruptores de sempre:
// allow_messages (pode escrever) e show_guest_messages (pode ver).
function buildMessagesSection(ev) { const _SD = '<!-- SECTION_DIVIDER -->';
  const allowWrite = (ev.allowMessages === true) || (ev.allow_messages === 'yes') || (String(ev.allow_messages || '').toLowerCase() === 'yes');
  const allowView  = (ev.showGuestMessages === true) || (ev.show_guest_messages === 'yes') || (String(ev.show_guest_messages || '').toLowerCase() === 'yes');
  if (!allowWrite && !allowView) return '';
  const evColor = ev.event_color || '#007f9f';
  const count = (ev.confirmations || []).filter(c => c.message && String(c.message).trim()).length;
  const introText = allowWrite
    ? 'Deixe uma mensagem especial para este momento.'
    : 'Veja as mensagens deixadas por quem já passou por aqui.';
  return _SD + `<div class="event-section" style="text-align:center">
    <div class="section-inner reveal">
      <p style="font-size:0.65rem;font-weight:800;letter-spacing:0.15em;text-transform:uppercase;color:${evColor};margin-bottom:0.3rem">RECADOS</p>
      <h2 class="section-title" style="margin-bottom:0.5rem">Correio do Amor</h2>
      <p style="font-size:0.85rem;color:#6b7280;max-width:380px;margin:0 auto 1.25rem;line-height:1.6">${introText}</p>
      <div style="display:flex;gap:0.75rem;justify-content:center;flex-wrap:wrap">
        ${allowView ? `<button type="button" onclick="rsvpOpenFelicitacoes()" style="background:transparent;border:1.5px solid ${evColor};color:${evColor};border-radius:999px;padding:0.65rem 1.5rem;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit">Ver Recados${count ? ` (${count})` : ''}</button>` : ''}
        ${allowWrite ? `<button type="button" onclick="rsvpLeaveFelicitacao()" class="std-rsvp-btn-anim" style="border:none;border-radius:999px;padding:0.7rem 1.6rem;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit">Deixar Recado</button>` : ''}
      </div>
    </div>
  </div>`;
}


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
    let slides = Array.from(wrap.querySelectorAll('.g3d-slide'));
    const prevBtn = wrap.querySelector('.g3d-arrow.prev');
    const nextBtn = wrap.querySelector('.g3d-arrow.next');
    const dotsWrap = wrap.parentElement.querySelector('.g3d-dots');
    let dots = dotsWrap ? Array.from(dotsWrap.querySelectorAll('.g3d-dot')) : [];
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
      // ✅ Esconder a seta totalmente nos limites (não só esmaecer) — na
      // primeira foto não há "Anterior", na última não há "Seguinte".
      if (prevBtn) prevBtn.style.display = (idx === 0 || !slides.length) ? 'none' : 'flex';
      if (nextBtn) nextBtn.style.display = (idx >= slides.length - 1) ? 'none' : 'flex';
    }
    function go(newIdx) {
      idx = Math.max(0, Math.min(slides.length - 1, newIdx));
      render();
    }

    // ✅ Verificar se cada foto ainda existe — se tiver sido eliminada do
    // armazenamento depois de já estar na galeria, a faceta e o ponto
    // correspondente são removidos em vez de ficar um espaço em branco.
    function removeSlide(slideEl) {
      const i = slides.indexOf(slideEl);
      if (i === -1) return;
      const dotEl = dots[i];
      slideEl.remove();
      if (dotEl) dotEl.remove();
      slides.splice(i, 1);
      dots.splice(i, 1);
      if (idx >= slides.length) idx = Math.max(0, slides.length - 1);
      if (!slides.length) { wrap.closest('.event-section')?.remove(); return; }
      render();
    }
    slides.forEach((slideEl) => {
      const m = slideEl.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/);
      const url = m ? m[1] : null;
      if (!url) return;
      const probe = new Image();
      probe.onerror = () => removeSlide(slideEl);
      probe.src = url;
    });

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
    // navega o carrossel até ela. O índice é sempre recalculado no momento
    // do clique (não fixado de antemão), para continuar correcto mesmo se
    // alguma foto for removida (por já não existir) depois disto.
    slides.forEach((s) => {
      s.style.cursor = 'pointer';
      s.addEventListener('click', () => {
        if (dragging) return;
        const i = slides.indexOf(s);
        if (i === -1) return;
        if (i === idx) {
          const url = s.style.backgroundImage.slice(5, -2); // strip url("...")
          if (typeof openLightbox === 'function') openLightbox(url);
        } else {
          go(i);
        }
      });
    });
    dots.forEach((d) => { d.onclick = () => { const i = dots.indexOf(d); if (i !== -1) go(i); }; });
  });
  window._pendingCarousels = [];
}

// ── Editor de Títulos das Secções ─────────────────────────────────────────
const SECTION_TITLE_DEFAULTS = {
  bible:        'Palavra de Deus',
  invite:       'Convite',
  date:         'Data & Hora',
  story:        'A Nossa História',
  venues:       'Locais do Evento',
  gallery:      'Galeria de Fotos',
  manual:       'Manual do Bom Convidado',
  schedule:     'Programa do Dia',
  dresscode:    'Dress Code',
  couplemsg:    'Mensagem dos Noivos',
  iban:         'Gostaria de nos presentear?',
  gift_stores:  'Lojas Sugeridas',
  couple_photo: 'Foto do Casal',
  event_faq:    'Perguntas Frequentes',
  custom_text:  'Texto Livre',
};

function openSectionTitlesEditor() {
  const ev = Store.events?.find(e => e.id === Store.currentEventId);
  const savedTitles = (() => { try { return JSON.parse(ev?.section_titles || '{}'); } catch(e) { return {}; } })();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-5 max-w-md w-full" style="max-height:85vh;overflow-y:auto">
    <h3 class="text-base font-bold text-gray-800 mb-1">✏️ Editar Títulos das Secções</h3>
    <p class="text-xs text-gray-400 mb-3">Deixa vazio para usar o título padrão.</p>
    <div class="space-y-2">
      ${Object.entries(SECTION_TITLE_DEFAULTS).map(([key, def]) => `
        <div>
          <label class="text-xs font-semibold text-gray-500 block mb-0.5">${def}</label>
          <input type="text" data-section-title="${key}" class="input-field text-sm" placeholder="${def}" value="${escapeHTML(savedTitles[key]||'')}">
        </div>`).join('')}
    </div>
    <div class="flex gap-2 mt-4">
      <button class="flex-1 btn-main" onclick="saveSectionTitles(this.closest('.modal-overlay'))">Guardar</button>
      <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function saveSectionTitles(modal) {
  const inputs = modal.querySelectorAll('[data-section-title]');
  const titles = {};
  inputs.forEach(inp => { if (inp.value.trim()) titles[inp.dataset.sectionTitle] = inp.value.trim(); });
  const eventId = Store.currentEventId;
  await saveEventVisuals(eventId, { section_titles: JSON.stringify(titles) });
  // Actualizar Store
  const ev = Store.events?.find(e => e.id === eventId);
  if (ev) ev.section_titles = JSON.stringify(titles);
  modal.remove();
  toast('Títulos guardados!');
}

// Função auxiliar para obter o título de uma secção (usa custom ou padrão)
function _getSectionTitle(ev, key, defaultTitle) {
  try {
    const titles = JSON.parse(ev?.section_titles || '{}');
    return titles[key] || defaultTitle;
  } catch(e) { return defaultTitle; }
}

// ── Secção de Vídeo do Casal ──────────────────────────────────────────────
function buildCoupleVideoSection(ev) {
  const _SD = '<!-- SECTION_DIVIDER -->';
  console.log('[ADK video] couple_video_url =', ev.couple_video_url);
  if (!ev.couple_video_url) return '';

  const evColor     = ev.event_color || '#007f9f';
  const audioMode   = ev.video_audio_mode || 'pause_music';
  const replaceMusic= audioMode === 'replace_music';
  const title       = _getSectionTitle(ev, 'couple_video', 'O Nosso Momento');
  const isYouTube   = ev.couple_video_url.includes('youtube.com') || ev.couple_video_url.includes('youtu.be');

  let videoHtml;
  if (isYouTube) {
    const ytMatch = ev.couple_video_url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const ytId = ytMatch ? ytMatch[1] : '';
    videoHtml = ytId
      ? `<iframe src="https://www.youtube.com/embed/${ytId}?loop=1&playlist=${ytId}&rel=0&modestbranding=1"
          style="width:100%;aspect-ratio:16/9;border:none;border-radius:12px;display:block"
          allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`
      : '';
  } else {
    videoHtml = `<video
      id="couple-video-player"
      src="${escapeHTML(ev.couple_video_url)}"
      controls loop playsinline controlsList="nodownload" oncontextmenu="return false"
      style="width:100%;display:block;max-height:480px;object-fit:contain"
      onplay="window._coupleVideoPlay()"
      onpause="window._coupleVideoStop()"
      onended="window._coupleVideoStop()"
    ></video>`;
  }

  return _SD + `<div class="event-section" style="background:#000;padding:0">
    <div style="max-width:680px;margin:0 auto;padding:1.5rem">
      <h3 class="section-title" style="color:#fff;text-align:center;margin-bottom:1rem">${escapeHTML(title)}</h3>
      <div style="border-radius:12px;overflow:hidden;position:relative;background:#111">
        ${videoHtml}
      </div>
      ${replaceMusic && !isYouTube ? `<p style="text-align:center;color:rgba(255,255,255,0.5);font-size:11px;margin-top:8px">🎵 O áudio deste vídeo é a música do evento</p>` : ''}
    </div>
  </div>`;
}

// Coordenação de áudio — chamada pelos eventos do vídeo
window._coupleVideoPlay = function() {
  const ev = Store.guestEventData || window._evData;
  if (!ev || ev.video_audio_mode === 'replace_music') return;
  // Pausar música do evento (audio directo ou YouTube)
  const audio   = document.getElementById('guest-audio');
  const ytFrame = document.getElementById('yt-music-frame');
  if (audio && !audio.paused) { audio.pause(); window._coupleVideoPausedAudio = true; }
  if (ytFrame) {
    try { ytFrame.contentWindow?.postMessage(JSON.stringify({event:'command',func:'pauseVideo',args:[]}), '*'); window._coupleVideoPausedYt = true; } catch(e) {}
  }
};

window._coupleVideoStop = function() {
  const ev = Store.guestEventData || window._evData;
  if (!ev || ev.video_audio_mode === 'replace_music') return;
  // Retomar música do evento
  if (window._coupleVideoPausedAudio) {
    const audio = document.getElementById('guest-audio');
    if (audio) audio.play().catch(()=>{});
    window._coupleVideoPausedAudio = false;
  }
  if (window._coupleVideoPausedYt) {
    const ytFrame = document.getElementById('yt-music-frame');
    if (ytFrame) { try { ytFrame.contentWindow?.postMessage(JSON.stringify({event:'command',func:'playVideo',args:[]}), '*'); } catch(e) {} }
    window._coupleVideoPausedYt = false;
  }
};
