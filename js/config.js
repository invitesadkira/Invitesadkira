// ===================== SUPABASE CONFIG =====================
const SUPABASE_URL = 'https://kdvgqjpwizplvvlggjtx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkdmdxanB3aXpwbHZ2bGdnanR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NDMyMTgsImV4cCI6MjA5NjUxOTIxOH0.E-uDSHQopiDBbRqSUd-fjnz-ONiQGuTOLhdj2uvmVes';

async function supabaseRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Accept': 'application/json'
  };
  // CRITICAL: force Supabase/PostgREST to return the affected row(s) in the body.
  // Without this, PATCH on zero matching rows returns an empty 204 response —
  // indistinguishable from "successfully updated". This caused silent data loss:
  // any UPSERT-style save (PATCH-then-INSERT-if-empty) never reached the INSERT
  // step because the empty response was treated as success.
  if (method === 'PATCH' || method === 'POST') {
    headers['Prefer'] = 'return=representation';
  }

  const options = { 
    method, 
    headers,
    mode: 'cors'
  };
  if (body) options.body = JSON.stringify(body);

  try {
    console.log(`📡 [${method}] Requisição ao Supabase:`, {
      url: `${SUPABASE_URL}/rest/v1/${endpoint}`,
      endpoint: endpoint,
      method: method,
      hasBody: !!body
    });
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
    
    console.log(`📡 [${method}] Resposta recebida:`, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length')
      }
    });
    
    if (!response.ok) {
      const text = await response.text();

      // ── PGRST204: unknown column ──────────────────────────────────────────
      if (response.status === 400 &&
          (text.includes('PGRST204') || text.includes('does not exist in the schema cache'))) {

        const colMatch = text.match(/'([^']+)' column of '[^']+' in the schema cache/);
        if (colMatch) {
          const badCol = colMatch[1];
          console.warn(`Coluna desconhecida: "${badCol}". A tentar sem ela...`);

          if (body) {
            const cleanBody = { ...body };
            delete cleanBody[badCol];
            return supabaseRequest(endpoint, method, cleanBody);
          } else {
            // Strip the bad column from select= — use simple string replace (no lookbehind)
            let clean = endpoint;
            clean = clean.replace(new RegExp(`,${badCol}(?=[,&]|$)`, 'g'), '');
            clean = clean.replace(new RegExp(`${badCol},`, 'g'), '');
            clean = clean.replace(new RegExp(`(select=)${badCol}(?=[,&]|$)`, 'g'), '$1');
            clean = clean.replace(/,+/g, ',').replace(/select=,/g, 'select=').replace(/,(?=&|$)/g, '');
            if (clean !== endpoint) return supabaseRequest(clean, method, body);
          }
        }
      }

      // ── owner_reply fallback ──────────────────────────────────────────────
      if (response.status === 400 && text.includes('owner_reply')) {
        const fallbackEndpoint = endpoint.replace(/,owner_reply/g, '').replace(/owner_reply,/g,'');
        if (fallbackEndpoint !== endpoint) return supabaseRequest(fallbackEndpoint, method, body);
      }

      // ── missing rsvps column ──────────────────────────────────────────────
      const missingRsvpColumn = text.match(/column\s+rsvps_\d+\.([a-zA-Z0-9_]+)\s+does not exist/i);
      if (response.status === 400 && method === 'GET' && missingRsvpColumn && endpoint.includes('rsvps(')) {
        const mc = missingRsvpColumn[1];
        const fallbackEndpoint = endpoint.replace(new RegExp(`,${mc}(?=[,)])`, 'g'), '');
        if (fallbackEndpoint !== endpoint) return supabaseRequest(fallbackEndpoint, method, body);
      }

      // ── Last resort for GET: strip ONLY truly optional columns (NOT event_color) ──
      if (response.status === 400 && method === 'GET' && endpoint.includes('select=')) {
        // IMPORTANT: event_color is now in Supabase — do NOT strip it
        // Only strip columns that may genuinely not exist yet
        const OPTIONAL_COLS = ['story_text','invite_blessing','decor_ornament_url','decor_side_url',
          'show_decor','save_the_date','show_countdown','event_message','show_story',
          'venue_ceremony','venue_ceremony_maps','venue_civil','venue_civil_maps',
          'venue_reception','venue_reception_maps',
          'std_name_size','std_title_size','std_intro_enabled','std_intro_text','std_intro_photo_url',
          'std_show_cover','personalized_links_enabled','bible_text_2','bible_ref_2','bible_size'];
        let safeEndpoint = endpoint;
        OPTIONAL_COLS.forEach(col => {
          safeEndpoint = safeEndpoint.replace(new RegExp(`,${col}(?=[,&]|$)`,'g'), '').replace(new RegExp(`${col},`,'g'),'');
        });
        safeEndpoint = safeEndpoint.replace(/,+/g,',').replace(/select=,/g,'select=').replace(/,(?=&|$)/g,'');
        if (safeEndpoint !== endpoint) {
          console.warn('A tentar sem colunas opcionais...');
          return supabaseRequest(safeEndpoint, method, body);
        }
      }

      // ── For POST/PATCH: strip unknown columns from body and retry ──
      if (response.status === 400 && (method === 'POST' || method === 'PATCH') && body) {
        // Only strip columns that may not exist — keep event_color
        const OPTIONAL_BODY_COLS = ['story_text','invite_blessing','decor_ornament_url','decor_side_url',
          'show_decor','save_the_date','show_countdown','event_message',
          'venue_ceremony','venue_ceremony_maps','venue_civil','venue_civil_maps',
          'venue_reception','venue_reception_maps',
          'std_name_size','std_title_size','std_intro_enabled','std_intro_text','std_intro_photo_url',
          'std_show_cover','personalized_links_enabled','bible_text_2','bible_ref_2','bible_size'];
        const cleanBody = { ...body };
        let changed = false;
        OPTIONAL_BODY_COLS.forEach(col => { if (col in cleanBody) { delete cleanBody[col]; changed = true; } });
        if (changed) {
          console.warn('A tentar sem colunas opcionais...');
          return supabaseRequest(endpoint, method, cleanBody);
        }
      }

      console.error(`Supabase error (${response.status}):`, { status: response.status, body: text.substring(0, 300) });
      return null;
    }
    
    const text = await response.text();
    if (!text) {
      console.log('✅ Operação bem-sucedida (resposta vazia esperada para INSERT/UPDATE/DELETE)');
      return [{ success: true }];
    }
    
    try {
      const parsed = JSON.parse(text);
      console.log(`✅ [${method}] Resposta parseada:`, {
        endpoint: endpoint,
        itemCount: Array.isArray(parsed) ? parsed.length : 1
      });
      return parsed;
    } catch (e) {
      console.error('❌ Erro ao parsear JSON:', text.substring(0, 100));
      return null;
    }
  } catch (error) {
    console.error('❌ Erro de rede:', {
      message: error.message,
      endpoint: endpoint,
      type: error.type
    });
    return null;
  }
}

// ===================== SUPABASE: FETCH DATA (OTIMIZADO POR TIPO DE USUÁRIO) =====================

// 🎯 CONVIDADO: Puxar APENAS evento específico + RSVPs + presentes (SEM N+1, QUERY OTIMIZADA)
async function fetchEventForGuest(eventId) {
  try {
    console.log('👤 fetchEventForGuest iniciado para:', eventId);
    
    // ✅ CRÍTICO: SELECT apenas o que convidado precisa (sem informações sensíveis)
    // ✅ Usar event_code ou id com filtro EXATO
    const eventData = await supabaseRequest(
      `events?or=(event_code.eq.${eventId},id.eq.${eventId})&select=id,title,date,time,confirm_by_date,cover_image,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,allow_messages,show_guest_messages,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,groom_name,bride_name,couple_size,show_couple,bg_url,bg_overlay,bible_text,bible_ref,show_bible,invite_text,show_invite,groom_parents,bride_parents,show_parents,gallery_urls,show_gallery,show_manual,manual_items,show_schedule,schedule_items,custom_font_family,section_order,story_text,invite_blessing,event_color,rsvps(guest_name,attending,side,companions,kids,wants_gift,message,created_at,updated_at),gifts(id,name,category,reserved,reserved_by)&limit=1`
    );
    
    if (!eventData || eventData.length === 0) {
      console.error('❌ Evento não encontrado no Supabase');
      return null;
    }
    
    const event = eventData[0];
    
    console.log('📥 Dados brutos do Supabase (convidado):', {
      id: event.id,
      title: event.title,
      confirm_by_date: event.confirm_by_date,
      allow_companions: event.allow_companions,
      max_companions: event.max_companions,
      allow_kids: event.allow_kids,
      max_kids: event.max_kids,
      allow_sides: event.allow_sides,
      side1_name: event.side1_name,
      side2_name: event.side2_name
    });
    
    // ✅ CRÍTICO: Converter valores do Supabase com tipos corretos
    const maxComp = event.max_companions !== null && event.max_companions !== undefined 
      ? parseInt(event.max_companions) 
      : 2;
    
    const maxKds = event.max_kids !== null && event.max_kids !== undefined 
      ? parseInt(event.max_kids) 
      : 2;
    
    // ✅ DEADLINE: Remover espaços invisíveis e fallback correto
    let deadlineValue = event.confirm_by_date;
    if (deadlineValue) {
      deadlineValue = deadlineValue.trim();
    }
    if (!deadlineValue || deadlineValue === '') {
      deadlineValue = event.date;
    }
    
    console.log('✅ Valores processados (convidado):', {
      allow_companions: String(event.allow_companions).toLowerCase(),
      max_companions: maxComp,
      allow_kids: String(event.allow_kids).toLowerCase(),
      max_kids: maxKds,
      allow_sides: String(event.allow_sides).toLowerCase(),
      deadline: deadlineValue
    });
    
    return {
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time,
      deadline: deadlineValue,
      confirm_by_date: deadlineValue,
      eventCode: event.event_code || event.id,
      cover: event.cover_image || null,
      cover_image: event.cover_image,
      allowCompanions: String(event.allow_companions).toLowerCase() === 'yes',
      allow_companions: event.allow_companions,
      maxCompanions: maxComp,
      max_companions: maxComp,
      allowGifts: String(event.allow_gifts).toLowerCase() === 'yes',
      allow_gifts: event.allow_gifts,
      allowKids: String(event.allow_kids).toLowerCase() === 'yes',
      allow_kids: event.allow_kids,
      maxKids: maxKds,
      max_kids: maxKds,
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
      confirmations: (event.rsvps || []).map(rsvp => ({
        name: rsvp.guest_name,
        attending: rsvp.attending === true || rsvp.attending === 'yes',
        side: rsvp.side ?? null,
        companions: rsvp.companions ? rsvp.companions.split('|').filter(Boolean) : [],
        kids: rsvp.kids ? rsvp.kids.split('|').filter(Boolean) : [],
        wantsGift: rsvp.wants_gift === true || rsvp.wants_gift === 'yes',
        message: rsvp.message || ''
      })),
      // ✅ Presentes vêm diretamente do JOIN
      gifts: (event.gifts || []).map(g => ({
        id: g.id,
        name: g.name,
        category: g.category || 'Sem categoria',
        reserved: g.reserved || false,
        reservedBy: g.reserved_by || null
      }))
    };
  } catch (error) {
    console.error('❌ Erro ao buscar evento:', error);
    return null;
  }
}

// 👤 ORGANIZADOR: Puxar APENAS seus eventos + presentes + RSVPs (COM JOIN - SEM N+1)
async function fetchUserDataForOrganizer(userId) {
  try {
    // ✅ OTIMIZAÇÃO: Um único JOIN para trazer eventos + presentes + RSVPs
    // Selecionar TODOS os campos necessários incluindo cover_image, max_companions, max_kids, event_code
    const eventsData = await supabaseRequest(`events?user_id=eq.${userId}&select=id,title,date,time,user_id,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,allow_messages,show_guest_messages,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,groom_name,bride_name,couple_size,show_couple,bg_url,bg_overlay,bible_text,bible_ref,show_bible,invite_text,show_invite,groom_parents,bride_parents,show_parents,gallery_urls,show_gallery,show_manual,manual_items,show_schedule,schedule_items,custom_font_family,section_order,story_text,invite_blessing,event_color,confirm_by_date,cover_image,event_code,gifts(id,name,category,reserved,reserved_by),rsvps(guest_name,attending,side,companions,kids,wants_gift,message,created_at,updated_at)`);
    
    console.log('📥 fetchUserDataForOrganizer recebido:', eventsData);
    
    // 2. Puxar dados da conta (APENAS campos necessários)
    const accountData = await supabaseRequest(`accounts?id=eq.${userId}&select=id,phone,status`);
    
    // ✅ Normalizar nomes dos campos do Supabase para o frontend - COM VALIDAÇÕES RIGOROSAS
    const normalizedEvents = (eventsData || []).map(event => {
      const maxComp = event.max_companions !== null && event.max_companions !== undefined 
        ? parseInt(event.max_companions) 
        : 2;
      
      const maxKds = event.max_kids !== null && event.max_kids !== undefined 
        ? parseInt(event.max_kids) 
        : 2;
      
      // ✅ CRÍTICO: Validar deadline
      let deadlineValue = event.confirm_by_date;
      if (deadlineValue) {
        deadlineValue = deadlineValue.trim();
      }
      if (!deadlineValue || deadlineValue === '') {
        deadlineValue = event.date;
      }
      
      console.log('✅ Normalizando evento (organizador):', {
        id: event.id,
        title: event.title,
        confirm_by_date: event.confirm_by_date,
        max_companions: event.max_companions,
        max_kids: event.max_kids,
        parsed: { maxComp, maxKds, deadline: deadlineValue }
      });
      
      return {
        id: event.id,
        user_id: event.user_id,
        userId: event.user_id,
        title: event.title,
        date: event.date,
        time: event.time,
        eventCode: event.event_code || event.id,
        
        deadline: deadlineValue,
        confirm_by_date: deadlineValue,
        
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
          createdAt: rsvp.created_at || new Date().toISOString(),
          updatedAt: rsvp.updated_at || new Date().toISOString()
        }))
      };
    });
    
    return {
      user: accountData && accountData.length > 0 ? accountData[0] : null,
      events: normalizedEvents,
      totalEvents: normalizedEvents.length
    };
  } catch (error) {
    console.error('❌ Erro ao buscar dados do organizador:', error);
    return null;
  }
}

// 📊 ADMIN: Puxar dados agregados APENAS para estatísticas gerais + paginação
async function fetchAdminStats() {
  try {
    // ✅ OTIMIZAÇÃO 1: Contar registros SEM trazer dados completos
    // Supabase retorna: [{ count: 123 }] quando usamos ?select=count
    const totalUsersResult = await supabaseRequest(`accounts?select=count`);
    const totalEventsResult = await supabaseRequest(`events?select=count`);
    const totalRsvpsResult = await supabaseRequest(`rsvps?select=count`);
    
    // Extrair o valor numérico corretamente do resultado
    const getTotalCount = (result) => {
      if (!result || result.length === 0) return 0;
      // O Supabase retorna [{ count: numero }]
      return result[0].count || 0;
    };
    
    // ✅ OTIMIZAÇÃO 2: Paginação - carregar APENAS 50 primeiras contas com campos essenciais
    const usersList = await supabaseRequest(`accounts?select=id,phone,status,created_at&limit=50&order=created_at.desc`);
    
    // ✅ OTIMIZAÇÃO 3: Paginação - carregar APENAS 50 primeiros eventos com campos essenciais
    const eventsList = await supabaseRequest(`events?select=id,title,date,user_id&limit=50&order=date.desc`);
    
    return {
      stats: {
        totalUsers: getTotalCount(totalUsersResult),
        totalEvents: getTotalCount(totalEventsResult),
        totalRsvps: getTotalCount(totalRsvpsResult)
      },
      users: usersList || [],
      events: eventsList || []
    };
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return null;
  }
}
