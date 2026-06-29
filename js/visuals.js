const VISUALS_FIELDS = 'event_id,show_dresscode,dresscode_text,dresscode_colors,dresscode_detail,dresscode_image_url,dresscode_image_urls,show_dress_gifts,show_couplemsg,couplemsg_text,parents_size,bible_text_2,bible_ref_2,bible_size,event_color,event_color_2,button_color_choice,button_color_choice_custom,color_hero_names,color_hero_names_custom,color_names,color_names_custom,color_countdown,color_countdown_custom,color_titles,color_titles_custom,color_message,color_message_custom,color_date,color_date_custom,cover_video_url,hero_subtitle,bible_ornament_url,bible_ornament_size,section_titles_size,couplemsg_size,story_size,std_music_continuous,countdown_style,show_youtube_video,youtube_video_url,youtube_video_title,metallic_animation,intake_color_notes,body_font_family,body_text_scale,bible_font_family,bible_bold,bible_italic,button_style,invite_layout,event_type,invert_names,show_story,groom_name,bride_name,couple_size,show_couple,bg_url,bg_url_mobile,bg_url_desktop,bg_overlay,show_bible,bible_text,bible_ref,show_invite,invite_text,invite_blessing,show_parents,groom_parents,bride_parents,show_gallery,gallery_urls,show_manual,manual_items,show_schedule,schedule_items,custom_font_family,section_order,story_text,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,show_venues,final_photo_url,show_final_photo,show_event_faq,event_faq_items,schedule_style,gallery_style,blessing_couple_size,date_style,manual_style,story_style,story_photo_url';
// Todas as configurações visuais do evento ficam na tabela event_visuals
// Nunca mais dependemos de colunas visuais na tabela events

// ✅ Tira uma "fotografia" de TODOS os campos que vivem em event_visuals,
// directamente do objecto em memória (não da base de dados). Usa-se antes
// de qualquer refresh genérico de `events` (select=*) para depois reaplicar
// estes valores por cima — porque a tabela `events` guarda uma cópia
// congelada destes campos desde a criação do evento, e um refresh "cego"
// sobrescrevia silenciosamente edições mais recentes feitas via
// event_visuals (já vimos isto acontecer com manual_items, schedule_items,
// e agora gallery_urls — esta função cobre TODOS os campos da lista de uma
// vez, para esta classe de bug nunca mais voltar a aparecer por faltar
// "mais um campo" na lista).
function _visualsPreserveSnapshot(obj) {
  const snap = {};
  VISUALS_FIELDS.split(',').forEach(key => {
    if (key === 'event_id') return;
    if (obj && obj[key] !== undefined) snap[key] = obj[key];
  });
  return snap;
}

// In-memory cache: eventId → visuals object
const _visualsCache = {};

async function loadEventVisuals(eventId) {
  if (!eventId) return {};
  // BUGFIX: an empty object {} is truthy in JS — only reuse the cache
  // if it actually contains data, otherwise we'd permanently serve a
  // stale empty result even after real visuals were saved later.
  if (_visualsCache[eventId] && Object.keys(_visualsCache[eventId]).length > 1) {
    return _visualsCache[eventId];
  }
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
  // CRITICAL: merge with whatever was already cached, never replace it
  // entirely. Before this fix, saving from a single dedicated editor (e.g.
  // the manual items editor, which only passes {manual_items, show_manual})
  // would blow away every OTHER cached visual field (event_color, bible_text,
  // etc.) from memory — not from the database, but the in-memory cache could
  // then be served as if it were complete on a subsequent read within the
  // same session, silently dropping fields that were never actually lost in
  // the database. Merging fixes this class of bug for good.
  _visualsCache[eventId] = { ...(_visualsCache[eventId] || {}), event_id: eventId, ...visuals };

  const payload = { event_id: eventId, updated_at: new Date().toISOString(), ...visuals };

  // Try PATCH (update existing row). With Prefer: return=representation set
  // globally in supabaseRequest, this now reliably returns [] when zero rows
  // matched (i.e. no event_visuals row exists yet for this event), or the
  // actual updated row(s) when it succeeded. Previously an empty-body 204
  // response was indistinguishable from success, so new events silently
  // never got their visuals saved — this is the fix for that.
  const patchResult = await supabaseRequest(
    `event_visuals?event_id=eq.${eventId}`,
    'PATCH',
    payload
  );

  const patchUpdatedZeroRows = !patchResult || (Array.isArray(patchResult) && patchResult.length === 0);

  if (patchUpdatedZeroRows) {
    const insertResult = await supabaseRequest('event_visuals', 'POST', payload);
    if (!insertResult || (Array.isArray(insertResult) && insertResult.length === 0)) {
      console.error('saveEventVisuals: PATCH matched 0 rows AND POST insert failed for event', eventId);
      return false;
    }
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
