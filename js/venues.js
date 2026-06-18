// ===================== EVENT VENUES (tabela dedicada) =====================
const VENUES_FIELDS = 'event_id,venue_ceremony,venue_ceremony_maps,venue_ceremony_date,venue_ceremony_time,venue_civil,venue_civil_maps,venue_civil_date,venue_civil_time,venue_reception,venue_reception_maps,venue_reception_time,show_venues,venues_title';

const _venuesCache = {};

async function loadEventVenues(eventId) {
  if (!eventId) return {};
  // BUGFIX: an empty object {} is truthy in JS, so the old check
  // `if (_venuesCache[eventId])` would permanently reuse a stale empty
  // cache entry even after real venue data was saved later in the same
  // session (e.g. guest page re-rendered after Save the Date unlocks).
  // Only skip the fetch if we have a cached entry with actual data.
  if (_venuesCache[eventId] && Object.keys(_venuesCache[eventId]).length > 1) {
    return _venuesCache[eventId];
  }
  try {
    const rows = await supabaseRequest(`event_venues?event_id=eq.${eventId}&select=${VENUES_FIELDS}&limit=1`);
    const v = (rows && rows[0]) ? rows[0] : {};
    _venuesCache[eventId] = v;
    return v;
  } catch(e) {
    console.warn('loadEventVenues error:', e);
    return {};
  }
}

async function saveEventVenues(eventId, data) {
  if (!eventId) return;
  delete _venuesCache[eventId];
  const payload = { event_id: eventId, updated_at: new Date().toISOString(), ...data };
  const patch = await supabaseRequest(`event_venues?event_id=eq.${eventId}`, 'PATCH', payload);
  if (!patch || (Array.isArray(patch) && patch.length === 0)) {
    await supabaseRequest('event_venues', 'POST', payload);
  }
  _venuesCache[eventId] = data;
}
