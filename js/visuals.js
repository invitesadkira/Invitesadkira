const VISUALS_FIELDS = 'event_id,show_dresscode,dresscode_text,dresscode_colors,event_color,event_type,invert_names,show_story,groom_name,bride_name,couple_size,show_couple,bg_url,bg_overlay,show_bible,bible_text,bible_ref,show_invite,invite_text,show_parents,groom_parents,bride_parents,show_gallery,gallery_urls,show_manual,manual_items,show_schedule,schedule_items,custom_font_family,section_order,story_text,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,show_venues';
// Todas as configurações visuais do evento ficam na tabela event_visuals
// Nunca mais dependemos de colunas visuais na tabela events

// In-memory cache: eventId → visuals object
const _visualsCache = {};

async function loadEventVisuals(eventId) {
  if (!eventId) return {};
  if (_visualsCache[eventId]) return _visualsCache[eventId];
  try {
    const rows = await supabaseRequest(
      `event_visuals?event_id=eq.${eventId}&select=${VISUALS_FIELDS}&limit=1`
    );
    const v = (rows && rows[0]) ? rows[0] : {};
    _visualsCache[eventId] = v;
    return v;
  } catch(e) {
    console.warn('loadEventVisuals error:', e);
    return {};
  }
}

async function saveEventVisuals(eventId, visuals) {
  if (!eventId) return;
  // Invalidate cache
  delete _visualsCache[eventId];
  // Update cache with new values
  _visualsCache[eventId] = { event_id: eventId, ...visuals };

  const payload = { event_id: eventId, updated_at: new Date().toISOString(), ...visuals };

  // Try PATCH (update existing row)
  const patchResult = await supabaseRequest(
    `event_visuals?event_id=eq.${eventId}`,
    'PATCH',
    payload
  );

  // If no row exists, INSERT
  if (!patchResult || (Array.isArray(patchResult) && patchResult.length === 0)) {
    await supabaseRequest('event_visuals', 'POST', payload);
  }
  return true;
}

// Merge visuals into an event object
function mergeVisualsIntoEvent(event, visuals) {
  if (!visuals || !event) return event;
  return { ...event, ...visuals };
}

// Get visuals for display (merge with event, prioritize visuals table)
async function getEventWithVisuals(event) {
  if (!event || !event.id) return event;
  const v = await loadEventVisuals(event.id);
  return mergeVisualsIntoEvent(event, v);
}

// ── Load date/time from dedicated event_dates table ──
async function loadEventDates(eventId) {
  if (!eventId) return {};
  try {
    const rows = await supabaseRequest(
      `event_dates?event_id=eq.${eventId}&select=event_date,event_time,show_time,confirm_by_date&limit=1`
    );
    return (rows && rows[0]) ? rows[0] : {};
  } catch(e) {
    console.warn('loadEventDates error:', e);
    return {};
  }
}

async function saveEventDates(eventId, dateData) {
  if (!eventId) return;
  const payload = { event_id: eventId, updated_at: new Date().toISOString(), ...dateData };
  const patch = await supabaseRequest(`event_dates?event_id=eq.${eventId}`, 'PATCH', payload);
  if (!patch || (Array.isArray(patch) && patch.length === 0)) {
    await supabaseRequest('event_dates', 'POST', payload);
  }
}
