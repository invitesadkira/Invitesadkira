// ===================== CREATE EVENT =====================
// ✅ Helper partilhado: a galeria guarda-se sempre com 1 URL por linha (é o
// que o textarea do editor usa, o que o botão "Escolher da Biblioteca"
// usa, e o que a página do convidado lê). Remove linhas vazias e fotos
// repetidas, mantendo a primeira ocorrência de cada uma.
function _dedupeGalleryUrls(text) {
  if (!text) return null;
  const urls = [...new Set(text.split('\n').map(u => u.trim()).filter(Boolean))];
  return urls.length ? urls.join('\n') : null;
}

async function handleCreateEvent(e) {
  e.preventDefault();
  
  // 🔒 Prevenir submissão dupla
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn.disabled) {
    dlog('⚠️ Submissão duplicada bloqueada');
    return;
  }
  
  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.6';
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Criando evento...';
  
  // Verificar limite de eventos — consulta DIRETA à base de dados, nunca o
  // cache em memória (Store.events), que pode estar desatualizado ou vazio
  // no momento da criação (ex: just-logged-in), permitindo bypass do limite.
  if (Store.currentUser.role === 'user') {
    const userEventLimit = Store.currentUser.eventLimit;
    if (userEventLimit !== null && userEventLimit !== undefined) {
      try {
        const countRows = await supabaseRequest(`events?user_id=eq.${Store.currentUser.id}&select=id`);
        const userEventCount = Array.isArray(countRows) ? countRows.length : 0;
        if (userEventCount >= userEventLimit) {
          toast(`Limite atingido: máximo ${userEventLimit} evento(s) permitido(s).`);
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.textContent = originalText;
          return;
        }
      } catch(err) {
        console.error('Erro ao verificar limite de eventos:', err);
        // On error, fail safe: block creation rather than risk bypassing the limit
        toast('Não foi possível verificar o limite de eventos. Tente novamente.');
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.textContent = originalText;
        return;
      }
    }
  }
  
  const title = document.getElementById('evt-title').value.trim();
  const date = document.getElementById('evt-date').value;
  const time = document.getElementById('evt-time').value;
  let deadline = document.getElementById('evt-deadline').value;
  const deadlineTime = document.getElementById('evt-deadline-time').value;
  
  // ✅ CRÍTICO: Se deadline estiver vazio, usar a data do evento
  if (!deadline || deadline.trim() === '') {
    deadline = date;
    dlog('⚠️ Deadline vazio, usando data do evento:', deadline);
  }
  
  // ✅ CRÍTICO: Combinar data + hora do deadline: "2026-03-15 23:59"
  let deadlineWithTime = deadline;
  if (deadline && deadlineTime) {
    deadlineWithTime = `${deadline} ${deadlineTime}`;
  }
  dlog('💾 Deadline salvo como:', deadlineWithTime);
  
  const allowComp = document.getElementById('sw-companions').classList.contains('active');
  const allowGifts = document.getElementById('sw-gifts').classList.contains('active');
  const allowKids = document.getElementById('sw-kids').classList.contains('active');
  const allowSides = document.getElementById('sw-sides').classList.contains('active');
  const allowMessages = document.getElementById('sw-messages').classList.contains('active');
  const showGuestMessages = document.getElementById('evt-show-messages').checked;
  const allowMusic = document.getElementById('sw-music').classList.contains('active');
  const musicUrl = document.getElementById('evt-music-url').value.trim();
  const musicTitle = document.getElementById('evt-music-title').value.trim();
  const allowIban = document.getElementById('sw-iban').classList.contains('active');
  const ibanMessage = allowIban ? (document.getElementById('evt-iban-message').value.trim() || null) : null;
  const ibanNumber  = allowIban ? (document.getElementById('evt-iban-number').value.trim() || null) : null;
  const ibanHolder  = allowIban ? (document.getElementById('evt-iban-holder').value.trim() || null) : null;
  const ibanFooter  = allowIban ? (document.getElementById('evt-iban-footer').value.trim() || null) : null;

  // Visual / sections
  const showCouple  = document.getElementById('sw-couple').classList.contains('active');
  const groomName   = document.getElementById('evt-groom-name').value.trim() || null;
  const brideName   = document.getElementById('evt-bride-name').value.trim() || null;
  const coupleSize  = parseFloat(document.getElementById('evt-couple-size').value) || 2.4;
  const bgUrlMobile  = document.getElementById('evt-bg-url-mobile')?.value?.trim() || null;
  const bgUrlDesktop = document.getElementById('evt-bg-url-desktop')?.value?.trim() || null;
  const bgUrl       = bgUrlMobile || bgUrlDesktop || null;
  const bgOverlay   = document.getElementById('evt-bg-overlay').value || 35;
  const showBible   = document.getElementById('sw-bible').classList.contains('active');
  const bibleText   = showBible ? (document.getElementById('evt-bible-text').value.trim() || null) : null;
  const bibleRef    = showBible ? (document.getElementById('evt-bible-ref').value.trim() || null) : null;
  const bibleText2  = showBible ? (document.getElementById('evt-bible-text-2')?.value.trim() || null) : null;
  const bibleRef2   = showBible ? (document.getElementById('evt-bible-ref-2')?.value.trim() || null) : null;
  const bibleSize   = document.getElementById('evt-bible-size')?.value || '0.92';
  const showInvite  = document.getElementById('sw-invite').classList.contains('active');
  const inviteText  = showInvite ? (document.getElementById('evt-invite-text').value.trim() || null) : null;
  const showParents = document.getElementById('sw-parents').classList.contains('active');
  const groomPar    = showParents ? (document.getElementById('evt-groom-parents').value.trim() || null) : null;
  const bridePar    = showParents ? (document.getElementById('evt-bride-parents').value.trim() || null) : null;
  const showGallery = document.getElementById('sw-gallery').classList.contains('active');
  const galleryUrls = showGallery ? _dedupeGalleryUrls(document.getElementById('evt-gallery-urls').value.trim()) : null;
  const showManual  = document.getElementById('sw-manual').classList.contains('active');
  const manualItems = showManual && Store.eventManualItems ? JSON.stringify(Store.eventManualItems) : null;
  const showSchedule= document.getElementById('sw-schedule').classList.contains('active');
  const schedItems  = showSchedule && Store.eventScheduleItems ? JSON.stringify(Store.eventScheduleItems) : null;
  const fontSel     = document.getElementById('evt-font-select');
  const customFont  = fontSel ? (fontSel.value || null) : null;

  const maxComp = parseInt(document.getElementById('evt-max-comp').value) || 2;
  const maxKids = parseInt(document.getElementById('evt-max-kids').value) || 2;
  
  // ✅ CRÍTICO: SEMPRE usar os valores dos inputs, mesmo que allowSides seja false
  const side1Name = document.getElementById('evt-side1-name').value.trim() || 'Grupo 1';
  const side2Name = document.getElementById('evt-side2-name').value.trim() || 'Grupo 2';

  const coverImg = document.getElementById('cover-img');
  const hasCover = !coverImg.classList.contains('hidden');
  const eventId = uid();
  
  toast('Preparando imagem...');
  
  if (hasCover && coverImg.src && coverImg.src.startsWith('http')) {
    // ✅ Já é um URL existente (ex: escolhido da Biblioteca de Fotos) — não
    // faz sentido reenviar/duplicar, usa directamente.
    toast('A criar evento...');
    submitBtn.textContent = 'Criando evento...';
    saveEventWithCover(eventId, title, date, time, deadlineWithTime, coverImg.src, allowComp, maxComp, allowGifts, allowKids, maxKids, allowSides, side1Name, side2Name, allowMessages, showGuestMessages, allowMusic ? musicUrl : null, musicTitle, ibanMessage, ibanNumber, ibanHolder, ibanFooter, {showCouple,groomName,brideName,coupleSize,bgUrl,bgUrlMobile,bgUrlDesktop,bgOverlay,showBible,bibleText,bibleRef,bibleText2,bibleRef2,bibleSize,showInvite,inviteText,showParents,groomPar,bridePar,showGallery,galleryUrls,showManual,manualItems,showSchedule,schedItems,customFont,sectionOrder:Store.eventSectionOrder,storyText:document.getElementById('evt-story-text')?.value.trim()||null,inviteBlessing:(document.getElementById('sw-invite-blessing')?.classList.contains('active') ? (document.getElementById('evt-invite-blessing')?.value.trim() || '') : ''),eventColor:document.getElementById('evt-event-color')?.value.trim()||null,buttonStyle:document.getElementById('evt-button-style')?.value||'rounded',inviteLayout:document.getElementById('evt-invite-layout')?.value||'sections',eventColor2:document.getElementById('evt-event-color-2-enabled')?.checked?(document.getElementById('evt-event-color-2')?.value||null):null,eventColor2Targets:(['names','countdown','titles','message','date'].filter(t=>document.getElementById('evt-color2-t-'+t)?.checked).join(',')),coverVideoUrl:document.getElementById('evt-cover-video-url')?.value||null,buttonColorChoice:document.getElementById('evt-button-color-choice')?.value||'primary',colorNames:document.getElementById('evt-color-names')?.value||'primary',colorCountdown:document.getElementById('evt-color-countdown')?.value||'primary',colorTitles:document.getElementById('evt-color-titles')?.value||'primary',colorMessage:document.getElementById('evt-color-message')?.value||'primary',colorDate:document.getElementById('evt-color-date')?.value||'primary'}, submitBtn, originalText);
  } else if (hasCover) {
    // Mostrar progresso
    submitBtn.textContent = 'Enviando imagem...';
    
    uploadCoverImageToSupabase(coverImg.src, eventId).then(coverImageURL => {
      dlog('✅ URL da imagem recebida:', coverImageURL);
      toast('Imagem recebida, criando evento...');
      submitBtn.textContent = 'Criando evento...';
      // Agora criar evento com URL da imagem no Supabase
      saveEventWithCover(eventId, title, date, time, deadlineWithTime, coverImageURL, allowComp, maxComp, allowGifts, allowKids, maxKids, allowSides, side1Name, side2Name, allowMessages, showGuestMessages, allowMusic ? musicUrl : null, musicTitle, ibanMessage, ibanNumber, ibanHolder, ibanFooter, {showCouple,groomName,brideName,coupleSize,bgUrl,bgUrlMobile,bgUrlDesktop,bgOverlay,showBible,bibleText,bibleRef,bibleText2,bibleRef2,bibleSize,showInvite,inviteText,showParents,groomPar,bridePar,showGallery,galleryUrls,showManual,manualItems,showSchedule,schedItems,customFont,sectionOrder:Store.eventSectionOrder,storyText:document.getElementById('evt-story-text')?.value.trim()||null,inviteBlessing:(document.getElementById('sw-invite-blessing')?.classList.contains('active') ? (document.getElementById('evt-invite-blessing')?.value.trim() || '') : ''),eventColor:document.getElementById('evt-event-color')?.value.trim()||null,buttonStyle:document.getElementById('evt-button-style')?.value||'rounded',inviteLayout:document.getElementById('evt-invite-layout')?.value||'sections',eventColor2:document.getElementById('evt-event-color-2-enabled')?.checked?(document.getElementById('evt-event-color-2')?.value||null):null,eventColor2Targets:(['names','countdown','titles','message','date'].filter(t=>document.getElementById('evt-color2-t-'+t)?.checked).join(',')),coverVideoUrl:document.getElementById('evt-cover-video-url')?.value||null,buttonColorChoice:document.getElementById('evt-button-color-choice')?.value||'primary',colorNames:document.getElementById('evt-color-names')?.value||'primary',colorCountdown:document.getElementById('evt-color-countdown')?.value||'primary',colorTitles:document.getElementById('evt-color-titles')?.value||'primary',colorMessage:document.getElementById('evt-color-message')?.value||'primary',colorDate:document.getElementById('evt-color-date')?.value||'primary'}, submitBtn, originalText);
    }).catch(error => {
      console.error('❌ ERRO upload imagem:', error);
      toast('Erro ao fazer upload da imagem. Criando evento sem capa...');
      submitBtn.textContent = 'Criando evento...';
      saveEventWithCover(eventId, title, date, time, deadlineWithTime, null, allowComp, maxComp, allowGifts, allowKids, maxKids, allowSides, side1Name, side2Name, allowMessages, showGuestMessages, allowMusic ? musicUrl : null, musicTitle, ibanMessage, ibanNumber, ibanHolder, ibanFooter, {showCouple,groomName,brideName,coupleSize,bgUrl,bgUrlMobile,bgUrlDesktop,bgOverlay,showBible,bibleText,bibleRef,bibleText2,bibleRef2,bibleSize,showInvite,inviteText,showParents,groomPar,bridePar,showGallery,galleryUrls,showManual,manualItems,showSchedule,schedItems,customFont,sectionOrder:Store.eventSectionOrder,storyText:document.getElementById('evt-story-text')?.value.trim()||null,inviteBlessing:(document.getElementById('sw-invite-blessing')?.classList.contains('active') ? (document.getElementById('evt-invite-blessing')?.value.trim() || '') : ''),eventColor:document.getElementById('evt-event-color')?.value.trim()||null,buttonStyle:document.getElementById('evt-button-style')?.value||'rounded',inviteLayout:document.getElementById('evt-invite-layout')?.value||'sections',eventColor2:document.getElementById('evt-event-color-2-enabled')?.checked?(document.getElementById('evt-event-color-2')?.value||null):null,eventColor2Targets:(['names','countdown','titles','message','date'].filter(t=>document.getElementById('evt-color2-t-'+t)?.checked).join(',')),coverVideoUrl:document.getElementById('evt-cover-video-url')?.value||null,buttonColorChoice:document.getElementById('evt-button-color-choice')?.value||'primary',colorNames:document.getElementById('evt-color-names')?.value||'primary',colorCountdown:document.getElementById('evt-color-countdown')?.value||'primary',colorTitles:document.getElementById('evt-color-titles')?.value||'primary',colorMessage:document.getElementById('evt-color-message')?.value||'primary',colorDate:document.getElementById('evt-color-date')?.value||'primary'}, submitBtn, originalText);
    });
  } else {
    saveEventWithCover(eventId, title, date, time, deadlineWithTime, null, allowComp, maxComp, allowGifts, allowKids, maxKids, allowSides, side1Name, side2Name, allowMessages, showGuestMessages, allowMusic ? musicUrl : null, musicTitle, ibanMessage, ibanNumber, ibanHolder, ibanFooter, {showCouple,groomName,brideName,coupleSize,bgUrl,bgUrlMobile,bgUrlDesktop,bgOverlay,showBible,bibleText,bibleRef,bibleText2,bibleRef2,bibleSize,showInvite,inviteText,showParents,groomPar,bridePar,showGallery,galleryUrls,showManual,manualItems,showSchedule,schedItems,customFont,sectionOrder:Store.eventSectionOrder,storyText:document.getElementById('evt-story-text')?.value.trim()||null,inviteBlessing:(document.getElementById('sw-invite-blessing')?.classList.contains('active') ? (document.getElementById('evt-invite-blessing')?.value.trim() || '') : ''),eventColor:document.getElementById('evt-event-color')?.value.trim()||null,buttonStyle:document.getElementById('evt-button-style')?.value||'rounded',inviteLayout:document.getElementById('evt-invite-layout')?.value||'sections',eventColor2:document.getElementById('evt-event-color-2-enabled')?.checked?(document.getElementById('evt-event-color-2')?.value||null):null,eventColor2Targets:(['names','countdown','titles','message','date'].filter(t=>document.getElementById('evt-color2-t-'+t)?.checked).join(',')),coverVideoUrl:document.getElementById('evt-cover-video-url')?.value||null,buttonColorChoice:document.getElementById('evt-button-color-choice')?.value||'primary',colorNames:document.getElementById('evt-color-names')?.value||'primary',colorCountdown:document.getElementById('evt-color-countdown')?.value||'primary',colorTitles:document.getElementById('evt-color-titles')?.value||'primary',colorMessage:document.getElementById('evt-color-message')?.value||'primary',colorDate:document.getElementById('evt-color-date')?.value||'primary'}, submitBtn, originalText);
  }
}

async function uploadCoverImageToSupabase(base64Image, eventId) {
  try {
    // Converter base64 para Blob
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    
    // ✅ Gerar nome do arquivo único - REMOVER ESPAÇOS E CARACTERES ESPECIAIS
    const sanitizedId = eventId.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `event_${sanitizedId}_${Date.now()}.jpg`;
    const bucketName = 'event-covers';
    
    dlog('📤 Iniciando upload para Supabase Storage');
    dlog('  Bucket:', bucketName);
    dlog('  Arquivo:', fileName);
    dlog('  Tamanho:', blob.size, 'bytes');
    
    // ✅ URL CORRETA para Supabase Storage Upload
    const uploadURL = `${SUPABASE_URL}/storage/v1/object/${bucketName}/${fileName}`;
    
    dlog('  Upload URL:', uploadURL);
    
    const response = await fetch(uploadURL, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': blob.type || 'image/jpeg'
      },
      body: blob
    });
    
    dlog('📡 Resposta do upload:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro no upload:', response.status, errorText);
      throw new Error(`Erro ${response.status}: ${errorText}`);
    }
    
    // ✅ URL PÚBLICA - usar formato CDN que tem CORS configurado
    const imageURL = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${fileName}`;
    dlog('✅ Imagem enviada com sucesso!');
    dlog('  URL Pública (CDN):', imageURL);
    
    // Testar se a URL é acessível
    const testResponse = await fetch(imageURL, { method: 'HEAD' });
    if (testResponse.ok) {
      dlog('✅ URL acessível e com CORS OK');
    } else {
      console.warn('⚠️ URL pode ter problemas CORS:', testResponse.status);
    }
    
    return imageURL;
  } catch (error) {
    console.error('❌ Erro ao fazer upload:', error);
    throw error;
  }
}

// ── Upload de MP3/áudio para Supabase Storage ──
async function uploadMusicFileToSupabase(file) {
  const bucketName = 'event-music';
  // Keep original filename (sanitise special chars only)
  const fileName = file.name.replace(/[^a-zA-Z0-9._\- ]/g, '_').replace(/\s+/g, '_');
  const uploadURL = `${SUPABASE_URL}/storage/v1/object/${bucketName}/${fileName}`;

  const uploadResponse = await fetch(uploadURL, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': file.type || 'audio/mpeg',
      'x-upsert': 'true'
    },
    body: file
  });

  if (!uploadResponse.ok) {
    const txt = await uploadResponse.text();
    throw new Error('Erro upload áudio: ' + txt);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${fileName}`;
}

async function handleMusicFileUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const maxSize = 10 * 1024 * 1024; // 10 MB
  if (file.size > maxSize) {
    toast('Ficheiro demasiado grande. Máximo 10 MB.');
    input.value = '';
    return;
  }

  const statusEl  = document.getElementById('music-upload-status');
  const nameEl    = document.getElementById('music-upload-filename');
  const uploadArea = document.getElementById('music-upload-area');
  const urlInput  = document.getElementById('evt-music-url');

  uploadArea.innerHTML = '<span class="text-xs text-teal-600 font-semibold">A carregar...</span>';

  try {
    const publicUrl = await uploadMusicFileToSupabase(file);
    urlInput.value = publicUrl;
    // Set title from filename if empty
    const titleInput = document.getElementById('evt-music-title');
    if (!titleInput.value) {
      titleInput.value = file.name.replace(/\.[^.]+$/, '');
    }
    if (statusEl) { statusEl.classList.remove('hidden'); }
    if (nameEl)   { nameEl.textContent = file.name; }
    uploadArea.innerHTML = `<i data-lucide="check-circle" style="width:20px;height:20px;color:#007f9f"></i><span class="text-xs text-teal-600 font-semibold mt-1">${file.name}</span>`;
    lucide.createIcons();
    toast('Música carregada com sucesso!');
  } catch (err) {
    toast('Erro ao carregar música. Verifique a sua ligação.');
    uploadArea.innerHTML = '<i data-lucide="music" class="w-6 h-6 text-gray-400 mb-1"></i><span class="text-xs text-gray-500 font-semibold">Carregar ficheiro MP3 / OGG</span>';
    lucide.createIcons();
    console.error(err);
  }
}

function saveEventWithCover(eventId, title, date, time, deadline, coverImageURL, allowComp, maxComp, allowGifts, allowKids, maxKids, allowSides, side1Name, side2Name, allowMessages, showGuestMessages, musicUrl, musicTitle, ibanMessage, ibanNumber, ibanHolder, ibanFooter, vis, submitBtn, originalText) {
  const finalDeadline = deadline && deadline.trim() !== '' ? deadline : date;
  const v = vis || {};
  const eventData = {
    id: eventId, user_id: Store.currentUser.id, title, date, time,
    confirm_by_date: finalDeadline,
    cover_image: coverImageURL ? String(coverImageURL) : null,
    event_code: eventId,
    allow_companions: allowComp ? 'yes' : 'no', max_companions: maxComp,
    allow_kids: allowKids ? 'yes' : 'no', max_kids: maxKids,
    allow_gifts: allowGifts ? 'yes' : 'no',
    allow_sides: allowSides ? 'yes' : 'no', side1_name: side1Name, side2_name: side2Name,
    show_time: document.getElementById('sw-show-time').classList.contains('active') ? 'yes' : 'no',
        rsvp_enabled: document.getElementById('sw-rsvp-enabled')?.classList.contains('active') ?? true,
        allow_edit_rsvp: document.getElementById('sw-allow-edit-rsvp')?.classList.contains('active') ?? true,
    personalized_links_enabled: document.getElementById('sw-personalized-links')?.classList.contains('active') || false,
    show_rsvp_in_full_invite: document.getElementById('sw-rsvp-in-full-invite')?.classList.contains('active') || false,
    show_guest_name_in_invite: document.getElementById('sw-guest-name-in-invite')?.classList.contains('active') ?? true,
    allow_messages: allowMessages ? 'yes' : 'no',
    show_guest_messages: showGuestMessages ? 'yes' : 'no',
    music_url: musicUrl || null, music_title: musicTitle || null,
    iban_message: ibanMessage || null, iban_number: ibanNumber || null,
    iban_holder: ibanHolder || null, iban_footer: ibanFooter || null,
    show_couple: v.showCouple ? 'yes' : 'no',
    groom_name: v.groomName || null, bride_name: v.brideName || null,
    couple_size: v.coupleSize || 2.4,
    bg_url: v.bgUrl || null, bg_overlay: v.bgOverlay !== undefined ? v.bgOverlay : 35,
    // bg_url_mobile/bg_url_desktop/bible_text_2/bible_ref_2/bible_size removidos
    // daqui — só existem em event_visuals (ver saveEventVisuals mais abaixo).
    show_bible: v.showBible ? 'yes' : 'no', bible_text: v.bibleText || null, bible_ref: v.bibleRef || null,
    show_invite: v.showInvite ? 'yes' : 'no', invite_text: v.inviteText || null,
    show_parents: v.showParents ? 'yes' : 'no',
    groom_parents: v.groomPar || null, bride_parents: v.bridePar || null,
    show_gallery: v.showGallery ? 'yes' : 'no', gallery_urls: v.galleryUrls || null,
    show_manual: v.showManual ? 'yes' : 'no', manual_items: v.manualItems || null,
    show_schedule: v.showSchedule ? 'yes' : 'no', schedule_items: v.schedItems || null,
    custom_font_family: v.customFont || null,
    section_order: v.sectionOrder ? JSON.stringify(v.sectionOrder) : null,
    story_text: v.storyText || null,
    invite_blessing: v.inviteBlessing ?? '',
    event_color: v.eventColor || null,
    decor_side_url: document.getElementById('evt-decor-side-url')?.value || null,
    decor_ornament_url: document.getElementById('evt-decor-ornament-url')?.value || null,
    decor_top_url: document.getElementById('evt-decor-top-url')?.value || null,
    decor_top_position: document.getElementById('evt-decor-top-position')?.value || 'left',
    decor_bottom_left_url: document.getElementById('evt-decor-bottom-left-url')?.value || null,
    decor_bottom_right_url: document.getElementById('evt-decor-bottom-right-url')?.value || null,
    show_decor: document.getElementById('sw-decor')?.classList.contains('active') ? 'yes' : 'no'
  };
  
  dlog('📤 Enviando ao Supabase:', eventData);
  dlog('  ✅ confirm_by_date será:', finalDeadline);
  
  supabaseRequest('events', 'POST', eventData).then(result => {
    // result may be null if Supabase columns don't exist yet (auto-retry stripped them)
    // but the event was still created — treat null as success for POST
    const success = result && result.length > 0;
    if (success || result === null || (Array.isArray(result) && result[0]?.success)) {
      // Increment permanent event counter (never decreases, even if event is later deleted)
      supabaseRequest('site_config?key=eq.total_events_ever&select=value&limit=1').then(rows => {
        const current = parseInt(rows?.[0]?.value || '0');
        supabaseRequest('site_config?key=eq.total_events_ever', 'PATCH', { value: String(current + 1) }).catch(() => {});
      }).catch(() => {});

      // Always add to Store so the event is visible immediately
      const newEvent = {
        id: eventId,
        user_id: Store.currentUser.id,
        userId: Store.currentUser.id,
        title, date, time,
        deadline: finalDeadline,
        confirm_by_date: finalDeadline,
        cover_image: coverImageURL || null,
        cover: coverImageURL || null,
        allow_companions: allowComp ? 'yes' : 'no', allowCompanions: allowComp,
        max_companions: maxComp, maxCompanions: maxComp,
        allow_kids: allowKids ? 'yes' : 'no', allowKids,
        max_kids: maxKids, maxKids,
        allow_gifts: allowGifts ? 'yes' : 'no', allowGifts,
        allow_sides: allowSides ? 'yes' : 'no', allowSides,
        side1_name: allowSides ? side1Name : null,
        side2_name: allowSides ? side2Name : null,
        allow_messages: allowMessages ? 'yes' : 'no', allowMessages,
        show_guest_messages: showGuestMessages ? 'yes' : 'no', showGuestMessages,
        show_time: document.getElementById('sw-show-time').classList.contains('active') ? 'yes' : 'no',
        rsvp_enabled: document.getElementById('sw-rsvp-enabled')?.classList.contains('active') ?? true,
        allow_edit_rsvp: document.getElementById('sw-allow-edit-rsvp')?.classList.contains('active') ?? true,
    personalized_links_enabled: document.getElementById('sw-personalized-links')?.classList.contains('active') || false,
    show_rsvp_in_full_invite: document.getElementById('sw-rsvp-in-full-invite')?.classList.contains('active') || false,
    show_guest_name_in_invite: document.getElementById('sw-guest-name-in-invite')?.classList.contains('active') ?? true,
        music_url: musicUrl || null,
        music_title: musicTitle || null,
        iban_message: ibanMessage || null,
        iban_number: ibanNumber || null,
        iban_holder: ibanHolder || null,
        iban_footer: ibanFooter || null,
        // ── Visual / Sections ──
        show_couple: v.showCouple ? 'yes' : 'no',
        groom_name: v.groomName || null,
        bride_name: v.brideName || null,
        couple_size: v.coupleSize || 2.4,
        bg_url: v.bgUrl || null, bg_url_mobile: v.bgUrlMobile || null, bg_url_desktop: v.bgUrlDesktop || null,
        bg_overlay: v.bgOverlay !== undefined ? v.bgOverlay : 35,
        show_bible: v.showBible ? 'yes' : 'no',
        bible_text: v.bibleText || null,
        bible_ref: v.bibleRef || null,
        show_invite: v.showInvite ? 'yes' : 'no',
        invite_text: v.inviteText || null,
        show_parents: v.showParents ? 'yes' : 'no',
        groom_parents: v.groomPar || null,
        bride_parents: v.bridePar || null,
        show_gallery: v.showGallery ? 'yes' : 'no',
        gallery_urls: v.galleryUrls || null,
        show_manual: v.showManual ? 'yes' : 'no',
        manual_items: v.manualItems || null,
        show_schedule: v.showSchedule ? 'yes' : 'no',
        schedule_items: v.schedItems || null,
        custom_font_family: v.customFont || null,
        event_color: v.eventColor || null,
        section_order: v.sectionOrder ? JSON.stringify(v.sectionOrder) : null,
        confirmations: [],
        gifts: []
      };
      
      Store.events.push(newEvent);
      
      // Cache visual data locally in case Supabase columns don't exist yet
      try {
        const visualCache = {
          music_url: musicUrl || null, music_title: musicTitle || null,
          iban_message: ibanMessage || null, iban_number: ibanNumber || null,
          iban_holder: ibanHolder || null, iban_footer: ibanFooter || null,
          show_couple: v.showCouple ? 'yes' : 'no',
          groom_name: v.groomName || null, bride_name: v.brideName || null, couple_size: v.coupleSize || 2.4,
          bg_url: v.bgUrl || null, bg_url_mobile: v.bgUrlMobile || null, bg_url_desktop: v.bgUrlDesktop || null, bg_overlay: v.bgOverlay !== undefined ? v.bgOverlay : 35,
          show_bible: v.showBible ? 'yes' : 'no', bible_text: v.bibleText || null, bible_ref: v.bibleRef || null, bible_text_2: v.bibleText2 || null, bible_ref_2: v.bibleRef2 || null, bible_size: v.bibleSize || '0.92',
          show_invite: v.showInvite ? 'yes' : 'no', invite_text: v.inviteText || null,
          show_parents: v.showParents ? 'yes' : 'no', groom_parents: v.groomPar || null, bride_parents: v.bridePar || null,
          show_gallery: v.showGallery ? 'yes' : 'no', gallery_urls: v.galleryUrls || null,
          show_manual: v.showManual ? 'yes' : 'no', manual_items: v.manualItems || null,
          show_schedule: v.showSchedule ? 'yes' : 'no', schedule_items: v.schedItems || null,
          custom_font_family: v.customFont || null,
        event_color: v.eventColor || null,
          section_order: v.sectionOrder ? JSON.stringify(v.sectionOrder) : null,
          story_text: v.storyText || null,
          invite_blessing: v.inviteBlessing ?? ''
        };
      } catch(e) {}
      
      // Save visual settings to event_visuals table
      const _visPayload = {
        event_color: v.eventColor || null,
        groom_name: v.groomName || null, bride_name: v.brideName || null,
        couple_size: v.coupleSize || 2.4, show_couple: v.showCouple ? 'yes' : 'no',
        bg_url: v.bgUrl || null, bg_url_mobile: v.bgUrlMobile || null, bg_url_desktop: v.bgUrlDesktop || null, bg_overlay: v.bgOverlay !== undefined ? v.bgOverlay : 35,
        show_bible: v.showBible ? 'yes' : 'no', bible_text: v.bibleText || null, bible_ref: v.bibleRef || null, bible_text_2: v.bibleText2 || null, bible_ref_2: v.bibleRef2 || null, bible_size: v.bibleSize || '0.92',
        show_invite: v.showInvite ? 'yes' : 'no', invite_text: v.inviteText || null,
        invite_blessing: v.inviteBlessing ?? '',
        show_parents: v.showParents ? 'yes' : 'no', groom_parents: v.groomPar || null, bride_parents: v.bridePar || null,
        show_gallery: v.showGallery ? 'yes' : 'no', gallery_urls: v.galleryUrls || null,
        show_manual: v.showManual ? 'yes' : 'no', manual_items: v.manualItems || null,
        show_schedule: v.showSchedule ? 'yes' : 'no', schedule_items: v.schedItems || null,
        custom_font_family: v.customFont || null,
        section_order: v.sectionOrder ? JSON.stringify(v.sectionOrder) : null,
        story_text: v.storyText || null,
        music_url: musicUrl || null, music_title: musicTitle || null,
        iban_message: ibanMessage || null, iban_number: ibanNumber || null,
        iban_holder: ibanHolder || null, iban_footer: ibanFooter || null,
      };
      // decor_side_url/decor_ornament_url/show_decor: NUNCA gravados aqui —
      // vivem na tabela events (ver eventData mais abaixo).
      _visPayload.show_story   = document.getElementById('sw-story')?.classList.contains('active') ? 'yes' : 'no';
      _visPayload.invert_names = document.getElementById('sw-invert-names')?.classList.contains('active') ? 'yes' : 'no';
      _visPayload.event_type   = document.getElementById('evt-event-type')?.value || 'wedding';
      _visPayload.button_style = document.getElementById('evt-button-style')?.value || 'rounded';
      _visPayload.invite_layout = document.getElementById('evt-invite-layout')?.value || 'sections';
      _visPayload.event_color_2 = document.getElementById('evt-event-color-2-enabled')?.checked ? (document.getElementById('evt-event-color-2')?.value || null) : null;
      _visPayload.event_color_2_targets = (['names','countdown','titles','message','date'].filter(t=>document.getElementById('evt-color2-t-'+t)?.checked).join(','));
      _visPayload.cover_video_url = document.getElementById('evt-cover-video-url')?.value || null;
      _visPayload.button_color_choice = document.getElementById('evt-button-color-choice')?.value || 'primary';
      _visPayload.color_names = document.getElementById('evt-color-names')?.value || 'primary';
      _visPayload.color_countdown = document.getElementById('evt-color-countdown')?.value || 'primary';
      _visPayload.color_titles = document.getElementById('evt-color-titles')?.value || 'primary';
      _visPayload.color_message = document.getElementById('evt-color-message')?.value || 'primary';
      _visPayload.color_date = document.getElementById('evt-color-date')?.value || 'primary';
      if (typeof saveEventVisuals !== 'undefined') saveEventVisuals(eventId, _visPayload);

      // Save venue/location fields to the DEDICATED event_venues table
      // (these do NOT belong in event_visuals — that table has no venue_* columns)
      if (typeof saveEventVenues !== 'undefined') saveEventVenues(eventId, {
        show_venues:          document.getElementById('sw-venues')?.classList.contains('active') ? 'yes' : 'no',
        venue_ceremony:       document.getElementById('evt-venue-ceremony')?.value?.trim() || null,
        venue_ceremony_maps:  document.getElementById('evt-venue-ceremony-maps')?.value?.trim() || null,
        venue_ceremony_image: document.getElementById('evt-venue-ceremony-image')?.value || null,
        venue_civil:          document.getElementById('evt-venue-civil')?.value?.trim() || null,
        venue_civil_maps:     document.getElementById('evt-venue-civil-maps')?.value?.trim() || null,
        venue_civil_image:    document.getElementById('evt-venue-civil-image')?.value || null,
        venue_reception:      document.getElementById('evt-venue-reception')?.value?.trim() || null,
        venue_reception_maps: document.getElementById('evt-venue-reception-maps')?.value?.trim() || null,
        venue_reception_image: document.getElementById('evt-venue-reception-image')?.value || null,
      });

      // Save dates to dedicated table
      if (typeof saveEventDates !== 'undefined') saveEventDates(eventId, {
        event_date: document.getElementById('evt-date')?.value || null,
        event_time: document.getElementById('evt-time')?.value || null,
        show_time: document.getElementById('sw-show-time')?.classList.contains('active') ? 'yes' : 'no',
        confirm_by_date: document.getElementById('evt-confirm-by')?.value || null,
      });
      // Set event expiry to 1 week after event date
      const _evDate = document.getElementById('evt-date')?.value;
      if (_evDate) {
        const _exp = new Date(_evDate + 'T23:59:59');
        _exp.setDate(_exp.getDate() + 7);
        supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', { expires_at: _exp.toISOString() });
      }
      toast('Evento criado com sucesso!'); if(typeof invalidateEventsCache!=='undefined') invalidateEventsCache();
      
      // Reset form
      document.getElementById('evt-title').value = '';
      document.getElementById('evt-date').value = '';
      document.getElementById('evt-time').value = '';
      document.getElementById('evt-deadline').value = '';
      document.getElementById('cover-img').classList.add('hidden');
      document.getElementById('cover-placeholder').classList.remove('hidden');
      document.querySelectorAll('#screen-create-event .switch').forEach(s => s.classList.remove('active'));
      document.getElementById('sw-gifts').classList.add('active');
      document.getElementById('sw-sides').classList.add('active');
      document.getElementById('sw-show-time').classList.add('active');
      document.getElementById('companions-extra').classList.add('hidden');
      document.getElementById('kids-extra').classList.add('hidden');
      document.getElementById('sides-extra').classList.remove('hidden');
      document.getElementById('messages-extra').classList.add('hidden');
      document.getElementById('evt-show-messages').checked = false;
      document.getElementById('music-extra').classList.add('hidden');
      const muUrl = document.getElementById('evt-music-url'); if (muUrl) muUrl.value = '';
      const muTitle = document.getElementById('evt-music-title'); if (muTitle) muTitle.value = '';
      document.getElementById('iban-extra').classList.add('hidden');
      const ibanMsg = document.getElementById('evt-iban-message'); if (ibanMsg) ibanMsg.value = '';
      const ibanNum = document.getElementById('evt-iban-number'); if (ibanNum) ibanNum.value = '';
      const ibanHol = document.getElementById('evt-iban-holder'); if (ibanHol) ibanHol.value = '';
      const ibanFoo = document.getElementById('evt-iban-footer'); if (ibanFoo) ibanFoo.value = '';
      
      Router.go('dashboard');
    } // end if success
    
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.textContent = originalText;
    }
  }).catch(error => {
    console.error('❌ Erro ao salvar evento:', error);
    toast(' Erro ao criar evento. Tente novamente.');
    
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.textContent = originalText;
    }
  });
}

function extractFileNameFromURL(url) {
  if (!url) return null;
  try {
    // Extrair nome do arquivo da URL
    // Ex: https://...../storage/v1/object/public/event-covers/ABC123_1234567.jpg -> ABC123_1234567.jpg
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    return fileName;
  } catch (e) {
    return null;
  }
}

async function deleteImageFromSupabase(fileName) {
  try {
    const bucketName = 'event-covers';
    const deleteURL = `${SUPABASE_URL}/storage/v1/object/${bucketName}/${fileName}`;
    
    dlog('🗑️ Deletando imagem:', fileName);
    
    const response = await fetch(deleteURL, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (response.ok) {
      dlog('✅ Imagem antiga deletada:', fileName);
      return true;
    } else {
      console.error('❌ Erro ao deletar imagem:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao deletar imagem:', error);
    return false;
  }
}

function saveEventWithUpdatedCover(eventId, title, date, time, finalDeadline, coverImageURL, allowComp, maxComp, allowGifts, allowKids, maxKids, allowSides, side1NameVal, side2NameVal, showTime, submitBtn, originalText) {
  // ✅ CRÍTICO: Procurar o evento no Store usando Store.currentEventId
  dlog('🔍 Procurando evento:', { eventId, currentEventId: Store.currentEventId });
  
  let ev = Store.events.find(e => e.id === Store.currentEventId);
  
  if (!ev) {
    console.error('❌ Erro: evento não encontrado! ID:', Store.currentEventId);
    toast(' Erro: evento não encontrado. Recarregue a página.');
    // ✅ SEGURO: verificar se submitBtn existe ANTES de acessar
    if (submitBtn && typeof submitBtn === 'object') {
      try {
        submitBtn.disabled = false;
        if (submitBtn.style) submitBtn.style.opacity = '1';
        submitBtn.textContent = originalText;
      } catch (e) {
        console.error('Erro ao restaurar botão:', e);
      }
    }
    return;
  }
  
  dlog('✅ Evento encontrado:', ev.title);

  // ✅ CRÍTICO: Ler DIRETAMENTE do formulário (não confiar em parâmetros)
  const side1NameInput = document.getElementById('evt-side1-name');
  const side2NameInput = document.getElementById('evt-side2-name');
  
  const finalSide1Name = side1NameInput && side1NameInput.value && side1NameInput.value.trim() 
    ? side1NameInput.value.trim() 
    : 'Grupo 1';
  
  const finalSide2Name = side2NameInput && side2NameInput.value && side2NameInput.value.trim() 
    ? side2NameInput.value.trim() 
    : 'Grupo 2';

  dlog('💾 Atualizando evento no Supabase:', {
    eventId,
    title,
    date,
    time,
    finalDeadline,
    coverImageURL,
    allowComp,
    maxComp,
    allowGifts,
    allowKids,
    maxKids,
    allowSides,
    side1Name: finalSide1Name,
    side2Name: finalSide2Name
  });

  const showTimeActive = document.getElementById('sw-show-time').classList.contains('active');
  const allowMessagesActive = document.getElementById('sw-messages').classList.contains('active');
  const showGuestMessagesChecked = document.getElementById('evt-show-messages').checked;
  const allowMusicActive = document.getElementById('sw-music') && document.getElementById('sw-music').classList.contains('active');
  const newMusicUrl = allowMusicActive ? (document.getElementById('evt-music-url').value.trim() || null) : null;
  const newMusicTitle = document.getElementById('evt-music-title') ? document.getElementById('evt-music-title').value.trim() || null : null;
  const allowIbanActive = document.getElementById('sw-iban') && document.getElementById('sw-iban').classList.contains('active');
  const newIbanMessage = allowIbanActive ? (document.getElementById('evt-iban-message').value.trim() || null) : null;
  const newIbanNumber  = allowIbanActive ? (document.getElementById('evt-iban-number').value.trim() || null) : null;
  const newIbanHolder  = allowIbanActive ? (document.getElementById('evt-iban-holder').value.trim() || null) : null;
  const newIbanFooter  = allowIbanActive ? (document.getElementById('evt-iban-footer').value.trim() || null) : null;

  const newShowCouple  = document.getElementById('sw-couple')?.classList.contains('active');
  const newGroomName   = document.getElementById('evt-groom-name')?.value.trim() || null;
  const newBrideName   = document.getElementById('evt-bride-name')?.value.trim() || null;
  const newCoupleSize  = parseFloat(document.getElementById('evt-couple-size')?.value) || 2.4;
  const newBgUrlMobile  = document.getElementById('evt-bg-url-mobile')?.value?.trim() || null;
  const newBgUrlDesktop = document.getElementById('evt-bg-url-desktop')?.value?.trim() || null;
  const newBgUrl       = newBgUrlMobile || newBgUrlDesktop || null;
  const newBgOverlay   = document.getElementById('evt-bg-overlay')?.value || 35;
  const newShowBible   = document.getElementById('sw-bible')?.classList.contains('active');
  const newBibleText   = newShowBible ? (document.getElementById('evt-bible-text')?.value.trim() || null) : null;
  const newBibleRef    = newShowBible ? (document.getElementById('evt-bible-ref')?.value.trim() || null) : null;
  const newBibleText2  = newShowBible ? (document.getElementById('evt-bible-text-2')?.value.trim() || null) : null;
  const newBibleRef2   = newShowBible ? (document.getElementById('evt-bible-ref-2')?.value.trim() || null) : null;
  const newBibleSize   = document.getElementById('evt-bible-size')?.value || '0.92';
  const newShowInvite  = document.getElementById('sw-invite')?.classList.contains('active');
  const newInviteText  = newShowInvite ? (document.getElementById('evt-invite-text')?.value.trim() || null) : null;
  const newShowParents = document.getElementById('sw-parents')?.classList.contains('active');
  const newGroomPar    = newShowParents ? (document.getElementById('evt-groom-parents')?.value.trim() || null) : null;
  const newBridePar    = newShowParents ? (document.getElementById('evt-bride-parents')?.value.trim() || null) : null;
  const newShowGallery = document.getElementById('sw-gallery')?.classList.contains('active');
  const newGalleryUrls = newShowGallery ? _dedupeGalleryUrls(document.getElementById('evt-gallery-urls')?.value.trim() || '') : null;
  const newShowManual  = document.getElementById('sw-manual')?.classList.contains('active');
  const newManualItems = newShowManual && Store.eventManualItems ? JSON.stringify(Store.eventManualItems) : null;
  const newShowSched   = document.getElementById('sw-schedule')?.classList.contains('active');
  const newSchedItems  = newShowSched && Store.eventScheduleItems ? JSON.stringify(Store.eventScheduleItems) : null;
  const newCustomFont  = document.getElementById('evt-font-select')?.value || null;

  supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', {
    title: title,
    date: date,
    time: time,
    confirm_by_date: finalDeadline,
    cover_image: coverImageURL,
    event_code: eventId,
    allow_companions: allowComp ? 'yes' : 'no',
    max_companions: maxComp,
    allow_kids: allowKids ? 'yes' : 'no',
    max_kids: maxKids,
    allow_gifts: allowGifts ? 'yes' : 'no',
    allow_sides: allowSides ? 'yes' : 'no',
    side1_name: finalSide1Name,
    side2_name: finalSide2Name,
    show_time: showTimeActive ? 'yes' : 'no',
    rsvp_enabled: document.getElementById('sw-rsvp-enabled')?.classList.contains('active') ?? true,
        allow_edit_rsvp: document.getElementById('sw-allow-edit-rsvp')?.classList.contains('active') ?? true,
    personalized_links_enabled: document.getElementById('sw-personalized-links')?.classList.contains('active') || false,
    show_rsvp_in_full_invite: document.getElementById('sw-rsvp-in-full-invite')?.classList.contains('active') || false,
    show_guest_name_in_invite: document.getElementById('sw-guest-name-in-invite')?.classList.contains('active') ?? true,
    save_the_date_enabled: document.getElementById('sw-std')?.classList.contains('active') || false,
    // release_type/release_date/is_invite_released/std_cover_url/std_show_cover/
    // std_scratch_*/std_date_style REMOVIDOS deste PATCH — são geridos
    // exclusivamente pelo editor dedicado (openStdEditor/saveStdEditor) agora,
    // para nunca mais serem apagados/sobrescritos por um guardar do formulário
    // geral que não tem esses campos visíveis.
    std_title: document.getElementById('evt-std-title')?.value?.trim() || 'Save the Date',
    std_subtitle: document.getElementById('evt-std-subtitle')?.value?.trim() || 'Nosso Casamento',
    std_font_family: document.getElementById('evt-std-font-select')?.value || null,
    std_name_size: document.getElementById('evt-std-name-size')?.value || '2.4',
    std_title_size: document.getElementById('evt-std-title-size')?.value || '0.78',
    std_intro_enabled: document.getElementById('sw-std-intro')?.classList.contains('active') || false,
    std_intro_text: document.getElementById('evt-std-intro-text')?.value?.trim() || 'Recebeu este convite porque é importante para nós',
    std_intro_photo_url: document.getElementById('evt-std-intro-photo-mobile-url')?.value || document.getElementById('evt-std-intro-photo-desktop-url')?.value || null,
    std_intro_photo_mobile_url: document.getElementById('evt-std-intro-photo-mobile-url')?.value || null,
    std_intro_photo_desktop_url: document.getElementById('evt-std-intro-photo-desktop-url')?.value || null,
    std_intro_on_invite: document.getElementById('sw-std-intro-on-invite')?.classList.contains('active') ?? true,
    allow_messages: allowMessagesActive ? 'yes' : 'no',
    show_guest_messages: showGuestMessagesChecked ? 'yes' : 'no',
    music_url: newMusicUrl, music_title: newMusicTitle,
    iban_message: newIbanMessage, iban_number: newIbanNumber,
    iban_holder: newIbanHolder, iban_footer: newIbanFooter,
    // ✅ CORREÇÃO: decor_side_url/decor_ornament_url/show_decor e as 3 zonas
    // novas vivem na tabela `events` (não em event_visuals) — estavam a ser
    // gravadas no sítio errado mais abaixo (saveEventVisuals), o que fazia
    // qualquer alteração à decoração, ao EDITAR um evento já criado, falhar
    // silenciosamente (a tabela event_visuals não tem estas colunas).
    decor_side_url: document.getElementById('evt-decor-side-url')?.value || null,
    decor_ornament_url: document.getElementById('evt-decor-ornament-url')?.value || null,
    decor_top_url: document.getElementById('evt-decor-top-url')?.value || null,
    decor_top_position: document.getElementById('evt-decor-top-position')?.value || 'left',
    decor_bottom_left_url: document.getElementById('evt-decor-bottom-left-url')?.value || null,
    decor_bottom_right_url: document.getElementById('evt-decor-bottom-right-url')?.value || null,
    show_decor: document.getElementById('sw-decor')?.classList.contains('active') ? 'yes' : 'no',
    show_couple: newShowCouple ? 'yes' : 'no',
    groom_name: newGroomName, bride_name: newBrideName, couple_size: newCoupleSize,
    bg_url: newBgUrl, bg_overlay: newBgOverlay,
    // bg_url_mobile/bg_url_desktop/bible_text_2/bible_ref_2/bible_size REMOVIDOS
    // deste PATCH: essas colunas só existem em event_visuals (nunca existiram
    // em events), causavam 5 erros 400 (PGRST204) em cada gravação — inofensivo
    // graças ao auto-retry, mas lento e ruidoso. Já são gravados correctamente
    // mais abaixo, na chamada a saveEventVisuals().
    show_bible: newShowBible ? 'yes' : 'no', bible_text: newBibleText, bible_ref: newBibleRef,
    show_invite: newShowInvite ? 'yes' : 'no', invite_text: newInviteText,
    show_parents: newShowParents ? 'yes' : 'no', groom_parents: newGroomPar, bride_parents: newBridePar,
    show_gallery: newShowGallery ? 'yes' : 'no', gallery_urls: newGalleryUrls,
    // manual_items/schedule_items removidos: vivem em event_visuals, nunca em events,
    // e são geridos exclusivamente pelos editores dedicados (saveManualItems/saveScheduleItems)
    custom_font_family: newCustomFont,
    section_order: Store.eventSectionOrder ? JSON.stringify(Store.eventSectionOrder) : null,
    story_text: document.getElementById('evt-story-text')?.value.trim() || null,
    event_color: document.getElementById('evt-event-color')?.value.trim() || null
    // button_style/invite_layout/invite_blessing REMOVIDOS deste PATCH: vivem em
    // event_visuals (nunca em events) — já são gravados correctamente mais
    // abaixo, na chamada a saveEventVisuals().
  }).then(result => {
    dlog('✅ Resposta do Supabase:', result);
    
    if (result) {
      if (ev) {
        ev.title = title; ev.date = date; ev.time = time;
        ev.deadline = finalDeadline; ev.confirm_by_date = finalDeadline;
        ev.cover_image = coverImageURL; ev.cover = coverImageURL;
        ev.allow_companions = allowComp ? 'yes' : 'no'; ev.allowCompanions = allowComp;
        ev.max_companions = maxComp; ev.maxCompanions = maxComp;
        ev.allow_kids = allowKids ? 'yes' : 'no'; ev.allowKids = allowKids;
        ev.max_kids = maxKids; ev.maxKids = maxKids;
        ev.allow_gifts = allowGifts ? 'yes' : 'no'; ev.allowGifts = allowGifts;
        ev.allow_sides = allowSides ? 'yes' : 'no'; ev.allowSides = allowSides;
        ev.side1_name = allowSides ? finalSide1Name : null;
        ev.side2_name = allowSides ? finalSide2Name : null;
        ev.show_time = showTimeActive ? 'yes' : 'no';
        ev.allowMessages = allowMessagesActive;
        ev.allow_messages = allowMessagesActive ? 'yes' : 'no';
        ev.showGuestMessages = showGuestMessagesChecked;
        ev.show_guest_messages = showGuestMessagesChecked ? 'yes' : 'no';
        ev.music_url = newMusicUrl; ev.music_title = newMusicTitle;
        ev.iban_message = newIbanMessage; ev.iban_number = newIbanNumber;
        ev.iban_holder = newIbanHolder; ev.iban_footer = newIbanFooter;
        // Visual fields
        ev.show_couple = newShowCouple ? 'yes' : 'no';
        ev.groom_name = newGroomName; ev.bride_name = newBrideName; ev.couple_size = newCoupleSize;
        ev.bg_url = newBgUrl; ev.bg_overlay = newBgOverlay;
        ev.show_bible = newShowBible ? 'yes' : 'no'; ev.bible_text = newBibleText; ev.bible_ref = newBibleRef;
        ev.show_invite = newShowInvite ? 'yes' : 'no'; ev.invite_text = newInviteText;
        ev.show_parents = newShowParents ? 'yes' : 'no'; ev.groom_parents = newGroomPar; ev.bride_parents = newBridePar;
        ev.show_gallery = newShowGallery ? 'yes' : 'no'; ev.gallery_urls = newGalleryUrls;
        ev.show_manual = newShowManual ? 'yes' : 'no';
        ev.show_schedule = newShowSched ? 'yes' : 'no';
        // manual_items/schedule_items NOT touched here — see comment above
        // where the actual save payload was fixed for the same reason.
        ev.custom_font_family = newCustomFont;
        ev.section_order = Store.eventSectionOrder ? JSON.stringify(Store.eventSectionOrder) : null;
        ev.story_text = document.getElementById('evt-story-text')?.value.trim() || null;
        ev.invite_blessing = (document.getElementById('sw-invite-blessing')?.classList.contains('active') ? (document.getElementById('evt-invite-blessing')?.value.trim() || '') : '');
        ev.event_color = document.getElementById('evt-event-color')?.value.trim() || null;
      }
      
      toast('Evento atualizado com sucesso!');

      // ── Refresh the in-memory Store.events entry with the real saved data ──
      // The manual field-by-field updates above only cover some fields and
      // have repeatedly missed others (rsvp_enabled, save_the_date_enabled,
      // std_* fields, personalized_links_enabled, venue fields, etc.) —
      // causing stale data to be shown in "ver como convidado" or anywhere
      // else that reads from Store.events without a full page reload. This
      // re-fetch is the single source of truth fix: always pull the fresh
      // row right after a successful save, no exceptions, no field lists to maintain.
      (async () => {
        try {
          const freshRows = await supabaseRequest(`events?id=eq.${eventId}&select=*`);
          if (freshRows && freshRows[0]) {
            const idx = Store.events.findIndex(e => e.id === eventId);
            if (idx > -1) {
              // ✅ CORREÇÃO: ver _visualsPreserveSnapshot em visuals.js —
              // protege TODOS os campos vindos de event_visuals (galeria,
              // manual, cronograma, dress code, etc.) de serem sobrescritos
              // pelo valor congelado da tabela `events`. Sem isto, qualquer
              // edição feita por um editor dedicado podia "voltar atrás"
              // silenciosamente ao guardar outra coisa no formulário
              // principal (foi o que aconteceu com fotos eliminadas da
              // galeria, que pareciam reaparecer).
              const preserved = _visualsPreserveSnapshot(Store.events[idx]);
              Store.events[idx] = { ...Store.events[idx], ...freshRows[0], ...preserved };
            }
          }
        } catch(e) { console.warn('Falha ao atualizar Store.events após guardar:', e); }
      })();

      // Save to event_visuals table (definitive storage for visual data)
      if (typeof saveEventVisuals !== 'undefined') {
        saveEventVisuals(eventId, {
          event_color: document.getElementById('evt-event-color')?.value?.trim() || null,
          button_style: document.getElementById('evt-button-style')?.value || 'rounded',
          event_color_2: document.getElementById('evt-event-color-2-enabled')?.checked ? (document.getElementById('evt-event-color-2')?.value || null) : null,
          event_color_2_targets: (['names','countdown','titles','message','date'].filter(t=>document.getElementById('evt-color2-t-'+t)?.checked).join(',')),
          cover_video_url: document.getElementById('evt-cover-video-url')?.value || null,
          button_color_choice: document.getElementById('evt-button-color-choice')?.value || 'primary',
          button_color_choice_custom: document.getElementById('evt-button-color-choice-custom')?.value || null,
          color_hero_names: document.getElementById('evt-color-hero-names')?.value || 'primary',
          color_hero_names_custom: document.getElementById('evt-color-hero-names-custom')?.value || null,
          color_names: document.getElementById('evt-color-names')?.value || 'primary',
          color_names_custom: document.getElementById('evt-color-names-custom')?.value || null,
          color_countdown: document.getElementById('evt-color-countdown')?.value || 'primary',
          color_countdown_custom: document.getElementById('evt-color-countdown-custom')?.value || null,
          color_titles: document.getElementById('evt-color-titles')?.value || 'primary',
          color_titles_custom: document.getElementById('evt-color-titles-custom')?.value || null,
          section_titles_size: document.getElementById('evt-titles-size')?.value || '1.6',
          color_message: document.getElementById('evt-color-message')?.value || 'primary',
          color_message_custom: document.getElementById('evt-color-message-custom')?.value || null,
          color_date: document.getElementById('evt-color-date')?.value || 'primary',
          color_date_custom: document.getElementById('evt-color-date-custom')?.value || null,
          invite_layout: document.getElementById('evt-invite-layout')?.value || 'sections',
          bible_ornament_url: document.getElementById('evt-bible-ornament-url')?.value || null,
          bible_ornament_size: document.getElementById('evt-bible-ornament-size')?.value || '28',
          couplemsg_size: document.getElementById('evt-couplemsg-size')?.value || '0.95',
          story_size: document.getElementById('evt-story-size')?.value || '0.88',
          groom_name: newGroomName, bride_name: newBrideName, couple_size: newCoupleSize,
          hero_subtitle: document.getElementById('evt-hero-subtitle')?.value?.trim() || null,
          show_couple: newShowCouple ? 'yes' : 'no',
          bg_url: newBgUrl, bg_url_mobile: newBgUrlMobile, bg_url_desktop: newBgUrlDesktop, bg_overlay: newBgOverlay,
          show_bible: newShowBible ? 'yes' : 'no', bible_text: newBibleText, bible_ref: newBibleRef, bible_text_2: newBibleText2, bible_ref_2: newBibleRef2, bible_size: newBibleSize,
          show_invite: newShowInvite ? 'yes' : 'no', invite_text: newInviteText,
          invite_blessing: (document.getElementById('sw-invite-blessing')?.classList.contains('active') ? (document.getElementById('evt-invite-blessing')?.value.trim() || '') : ''),
          show_parents: newShowParents ? 'yes' : 'no', groom_parents: newGroomPar, bride_parents: newBridePar,
          show_gallery: newShowGallery ? 'yes' : 'no', gallery_urls: newGalleryUrls,
          show_manual: newShowManual ? 'yes' : 'no',
          show_schedule: newShowSched ? 'yes' : 'no',
          // manual_items/schedule_items NUNCA gravados aqui — só pelos editores
          // dedicados (saveManualItems/saveScheduleItems), que sabem o valor real.
          // Gravar aqui com Store.eventManualItems/eventScheduleItems (que podem
          // estar vazios nesta sessão) apagava silenciosamente o que já existia.
          custom_font_family: newCustomFont,
          story_text: document.getElementById('evt-story-text')?.value?.trim() || null,
          music_url: newMusicUrl, music_title: newMusicTitle,
          iban_message: newIbanMessage, iban_number: newIbanNumber, iban_holder: newIbanHolder, iban_footer: newIbanFooter,
          // decor_side_url/decor_ornament_url/show_decor: NUNCA gravados aqui
          // — vivem na tabela events, já gravados correctamente acima.
          // show_dresscode / show_dress_gifts: NUNCA gravados aqui — geridos
          // exclusivamente por openDressGiftsEditor()/saveDressGiftsEditor(),
          // que já existem nesta altura na tabela event_visuals.
          show_couplemsg: document.getElementById('sw-couplemsg')?.classList.contains('active') ? 'yes' : 'no',
          couplemsg_text: document.getElementById('evt-couplemsg-text')?.value?.trim() || null,
          show_final_photo: document.getElementById('sw-final-photo')?.classList.contains('active') ? 'yes' : 'no',
          final_photo_url: document.getElementById('evt-final-photo-url')?.value || null,
          show_event_faq: document.getElementById('sw-event-faq')?.classList.contains('active') ? 'yes' : 'no',
          event_faq_items: (Store.eventFaqItems && Store.eventFaqItems.length) ? JSON.stringify(Store.eventFaqItems) : null,
          schedule_style: document.getElementById('evt-schedule-style')?.value || 'timeline',
          gallery_style: document.getElementById('evt-gallery-style')?.value || 'grid',
          blessing_couple_size: document.getElementById('evt-blessing-couple-size')?.value || null,
          date_style: document.getElementById('evt-date-style')?.value || 'classic',
          manual_style: document.getElementById('evt-manual-style')?.value || 'cards',
          story_style: document.getElementById('evt-story-style')?.value || 'centered',
          story_photo_url: document.getElementById('evt-story-photo-url')?.value || null,
          parents_size: document.getElementById('evt-parents-size')?.value || '0.88',
          dresscode_text:   document.getElementById('evt-dresscode-text')?.value?.trim() || null,
          dresscode_colors: document.getElementById('evt-dresscode-colors')?.value?.trim() || null,
          dresscode_detail: document.getElementById('evt-dresscode-detail')?.value?.trim() || null,
          show_story:    document.getElementById('sw-story')?.classList.contains('active') ? 'yes' : 'no',
          section_order: Store.eventSectionOrder ? JSON.stringify(Store.eventSectionOrder) : null,
          invert_names:  document.getElementById('sw-invert-names')?.classList.contains('active') ? 'yes' : 'no',
          event_type:    document.getElementById('evt-event-type')?.value || 'wedding',
          // venues saved separately below,
        });
        // Save venues to dedicated table
        if (typeof saveEventVenues !== 'undefined') saveEventVenues(eventId, {
          show_venues:          document.getElementById('sw-venues')?.classList.contains('active') ? 'yes' : 'no',
          venue_ceremony:       document.getElementById('evt-venue-ceremony')?.value?.trim() || null,
          venue_ceremony_maps:  document.getElementById('evt-venue-ceremony-maps')?.value?.trim() || null,
          venue_ceremony_date:  document.getElementById('evt-venue-ceremony-date')?.value?.trim() || null,
          venue_ceremony_image: document.getElementById('evt-venue-ceremony-image')?.value || null,
          venue_civil:          document.getElementById('evt-venue-civil')?.value?.trim() || null,
          venue_civil_maps:     document.getElementById('evt-venue-civil-maps')?.value?.trim() || null,
          venue_civil_date:     document.getElementById('evt-venue-civil-date')?.value?.trim() || null,
          venue_civil_image:    document.getElementById('evt-venue-civil-image')?.value || null,
          venue_reception:      document.getElementById('evt-venue-reception')?.value?.trim() || null,
          venue_reception_maps: document.getElementById('evt-venue-reception-maps')?.value?.trim() || null,
          venue_reception_image: document.getElementById('evt-venue-reception-image')?.value || null,
          venues_title: document.getElementById('evt-venues-title')?.value?.trim() || null,
        });
        // Save dates to dedicated table
        if (typeof saveEventDates !== 'undefined') saveEventDates(eventId, {
          event_date: document.getElementById('evt-date')?.value || null,
          event_time: document.getElementById('evt-time')?.value || null,
          show_time: showTimeActive ? 'yes' : 'no',
          confirm_by_date: document.getElementById('evt-confirm-by')?.value || null,
        });
      }
      
      // Update visual cache
      try {
        const visualCache = {
          music_url: newMusicUrl, music_title: newMusicTitle,
          iban_message: newIbanMessage, iban_number: newIbanNumber, iban_holder: newIbanHolder, iban_footer: newIbanFooter,
          show_couple: newShowCouple ? 'yes' : 'no', groom_name: newGroomName, bride_name: newBrideName, couple_size: newCoupleSize,
          bg_url: newBgUrl, bg_url_mobile: newBgUrlMobile, bg_url_desktop: newBgUrlDesktop, bg_overlay: newBgOverlay,
          show_bible: newShowBible ? 'yes' : 'no', bible_text: newBibleText, bible_ref: newBibleRef, bible_text_2: newBibleText2, bible_ref_2: newBibleRef2, bible_size: newBibleSize,
          show_invite: newShowInvite ? 'yes' : 'no', invite_text: newInviteText,
          show_parents: newShowParents ? 'yes' : 'no', groom_parents: newGroomPar, bride_parents: newBridePar,
          show_gallery: newShowGallery ? 'yes' : 'no', gallery_urls: newGalleryUrls,
          show_manual: newShowManual ? 'yes' : 'no',
          show_schedule: newShowSched ? 'yes' : 'no',
          // manual_items/schedule_items NUNCA gravados aqui — só pelos editores
          // dedicados (saveManualItems/saveScheduleItems), que sabem o valor real.
          // Gravar aqui com Store.eventManualItems/eventScheduleItems (que podem
          // estar vazios nesta sessão) apagava silenciosamente o que já existia.
          custom_font_family: newCustomFont,
          section_order: Store.eventSectionOrder ? JSON.stringify(Store.eventSectionOrder) : null
        };
      } catch(e) {}
      
      // Reset form
      document.getElementById('evt-title').value = '';
      document.getElementById('evt-date').value = '';
      document.getElementById('evt-time').value = '';
      document.getElementById('evt-deadline').value = '';
      document.getElementById('cover-img').classList.add('hidden');
      document.getElementById('cover-placeholder').classList.remove('hidden');
      document.querySelectorAll('#screen-create-event .switch').forEach(s => s.classList.remove('active'));
      document.getElementById('sw-gifts').classList.add('active');
      document.getElementById('sw-sides').classList.add('active');
      document.getElementById('companions-extra').classList.add('hidden');
      document.getElementById('kids-extra').classList.add('hidden');
      document.getElementById('sides-extra').classList.add('hidden');
      
      // Restaurar form para modo de criação
      const form = document.getElementById('screen-create-event').querySelector('form');
      form.onsubmit = handleCreateEvent;
      const btn = form.querySelector('button[type="submit"]');
      btn.textContent = 'Criar Evento';
      
      // 🔒 Re-habilitar botão ANTES de navegar - COM VERIFICAÇÃO SEGURA
      if (submitBtn && typeof submitBtn === 'object') {
        try {
          submitBtn.disabled = false;
          if (submitBtn.style) submitBtn.style.opacity = '1';
          submitBtn.textContent = originalText;
        } catch (e) {
          console.error('Erro ao restaurar botão:', e);
        }
      }
      
      // ✅ CRÍTICO: VOLTA PARA DETALHES (NÃO para dashboard)
      dlog('🔄 Navegando para event-details com eventId:', eventId);
      Store.currentEventId = eventId;
      Router.go('event-details');
    } else {
      console.error('❌ Resposta vazia do Supabase');
      toast(' Erro ao atualizar evento. Tente novamente.');
      
      // 🔒 Re-habilitar botão - COM VERIFICAÇÃO SEGURA
      if (submitBtn && typeof submitBtn === 'object') {
        try {
          submitBtn.disabled = false;
          if (submitBtn.style) submitBtn.style.opacity = '1';
          submitBtn.textContent = originalText;
        } catch (e) {
          console.error('Erro ao restaurar botão:', e);
        }
      }
    }
  }).catch(error => {
    console.error('❌ Erro ao atualizar evento:', error);
    toast(' Erro ao atualizar evento. Tente novamente.');
    
    // 🔒 Re-habilitar botão - COM VERIFICAÇÃO SEGURA
    if (submitBtn && typeof submitBtn === 'object') {
      try {
        submitBtn.disabled = false;
        if (submitBtn.style) submitBtn.style.opacity = '1';
        submitBtn.textContent = originalText;
      } catch (e) {
        console.error('Erro ao restaurar botão:', e);
      }
    }
  });
}


// ===================== EVENT DETAILS =====================
function renderEventDetails() {
  const event = Store.events.find(e => e.id === Store.currentEventId);
  if (!event) { Router.go('not-found'); return; }

  // Show intake link only for admin
  const intakeBtn = document.getElementById('btn-intake-link');
  if (intakeBtn) intakeBtn.style.display = (Store.currentUser?.role === 'admin') ? 'inline-flex' : 'none';

  // ✅ Sempre usar cover_image do Supabase (é a fonte única da verdade)
  const coverImage = event.cover_image;
  const coverEl = document.getElementById('detail-cover');
  
  dlog('🖼️ Renderizando capa do evento:');
  dlog('  Event ID:', event.id);
  dlog('  Cover Image:', coverImage);
  dlog('  É URL HTTP?', coverImage && coverImage.startsWith('http'));
  
  if (coverImage && coverImage.trim() !== '' && coverImage.startsWith('http')) {
    const img = document.createElement('img');
    img.src = coverImage;
    img.className = 'w-full h-full object-contain bg-white';
    img.loading = 'lazy';
    img.onerror = function() {
      console.error('❌ Erro ao carregar imagem:', this.src);
      this.parentElement.innerHTML = '<i data-lucide="calendar-heart" class="w-16 h-16 text-white/60"></i>';
      lucide.createIcons();
    };
    img.onload = function() {
      dlog('✅ Imagem carregada com sucesso!');
    };
    coverEl.innerHTML = '';
    coverEl.appendChild(img);
  } else {
    dlog('⚠️ Sem imagem de capa válida, usando ícone padrão');
    coverEl.innerHTML = '<i data-lucide="calendar-heart" class="w-16 h-16 text-white/60"></i>';
  }

  document.getElementById('detail-title').textContent = event.title;
  document.getElementById('detail-date').textContent = formatDate(event.date) + ' às ' + event.time;
  
  const eventCode = event.eventCode || event.id;
  const eventURL = (window.location.origin + window.location.pathname).replace(/\/$/, '') + '?event=' + eventCode;
  const giftsOnlyURL = eventURL + '&gifts=only';
  document.getElementById('detail-link').value = eventURL;
  document.getElementById('detail-gifts-link').value = giftsOnlyURL;

  const ownerUserId = event.userId || event.user_id;
  const isOwner = Store.currentUser && Store.currentUser.id === ownerUserId;
  const isAdmin = (Store.currentUser && Store.currentUser.role === 'admin') || Store.adminModeActive;

  document.getElementById('detail-rsvp-toggle').classList.toggle('hidden', !isOwner);
  
  if (!event.allowRSVP) {
    event.allowRSVP = true;
  }
  
  const rsvpSwitch = document.getElementById('sw-allow-rsvp');
  if (event.allowRSVP) {
    rsvpSwitch.classList.add('active');
  } else {
    rsvpSwitch.classList.remove('active');
  }

  document.getElementById('btn-manage-gifts').classList.toggle('hidden', !event.allowGifts);
  document.getElementById('btn-upload-gifts').classList.toggle('hidden', !event.allowGifts);
  document.getElementById('btn-download-gifts-pdf').classList.toggle('hidden', !event.allowGifts);
  document.getElementById('detail-gifts-link-wrap').classList.toggle('hidden', !event.allowGifts);
  
  const editBtn = document.querySelector('button:has(i[data-lucide="edit"])');
  if (editBtn) editBtn.parentElement.parentElement.querySelector('button:has(i[data-lucide="edit"])').classList.toggle('hidden', !(isOwner || isAdmin));
  
  const editURLBtn = document.querySelector('button:has(i[data-lucide="link"])');
  if (editURLBtn) editURLBtn.parentElement.parentElement.classList.toggle('hidden', !isAdmin);
  
  document.getElementById('btn-delete-event').classList.toggle('hidden', !(isOwner || isAdmin));

  // Botão "Marcar como Exemplo" — apenas o admin God autenticado directamente,
  // NUNCA durante impersonação de um utilizador (Store.adminModeActive), por
  // pedido explícito: só o admin real pode decidir quais eventos são exemplo.
  const isRealAdminGod = Store.currentUser && Store.currentUser.role === 'admin' && !Store.adminModeActive;
  const exampleBtn = document.getElementById('btn-example-event');
  if (exampleBtn) {
    exampleBtn.classList.toggle('hidden', !isRealAdminGod);
    const exampleLabel = document.getElementById('btn-example-event-label');
    if (exampleLabel) exampleLabel.textContent = event.is_example_event === true ? 'Remover de Exemplo' : 'Marcar como Exemplo';
  }

  const confirmations = event.confirmations || [];
  const confirmed = confirmations.filter(c => c.attending === true || c.attending === 'yes');
  const declined = confirmations.filter(c => c.attending === false || c.attending === 'no' || !c.attending);
  const totalPeople = confirmed.reduce((sum, c) => sum + 1 + (c.companions || []).length + (c.kids || []).length, 0);
  const hasSides = isSideSelectionEnabled(event);
  const sideNames = getEventSideNames(event);
  
  // ✅ CRÍTICO: Contar PESSOAS por lado (principal + acompanhantes) - NÃO apenas confirmações
  let side1Total = 0;
  let side2Total = 0;
  confirmed.forEach(c => {
    const sideBucket = getSideBucket(c.side, event);
    const isSide1 = sideBucket === 'side1';
    const isSide2 = sideBucket === 'side2';
    
    // Contar a pessoa principal
    if (isSide1) side1Total++;
    if (isSide2) side2Total++;
    
    // ✅ Contar acompanhantes do mesmo lado
    if (c.companions && c.companions.length > 0) {
      if (isSide1) side1Total += c.companions.length;
      if (isSide2) side2Total += c.companions.length;
    }
  });

  const stats = [];
  if (hasSides) {
    stats.push({ label: sideNames.side1, value: side1Total, color: 'bg-teal-50 text-teal-600', icon: 'users' });
    stats.push({ label: sideNames.side2, value: side2Total, color: 'bg-blue-50 text-blue-600', icon: 'users' });
  }
  stats.push(
    { label: 'Confirmados', value: confirmed.length, color: 'bg-green-50 text-green-600', icon: 'check-circle' },
    { label: 'Não Comparecem', value: declined.length, color: 'bg-red-50 text-red-600', icon: 'x-circle' },
    { label: 'Total de Pessoas', value: totalPeople, color: 'bg-indigo-50 text-indigo-600', icon: 'users' }
  );
  document.getElementById('detail-stats').innerHTML = stats.map(s => '<div class="stat-card ' + s.color + ' rounded-xl p-4 text-center"><i data-lucide="' + s.icon + '" class="w-5 h-5 mx-auto mb-1"></i><div class="text-2xl font-bold">' + s.value + '</div><div class="text-xs font-semibold mt-1">' + s.label + '</div></div>').join('');


  // ── Gallery & Cover management widget — removido do dashboard a pedido
  // (existia logo depois das estatísticas; a gestão de fotos já está
  // disponível, e fica melhor, dentro do editor do evento em "Editar").
  // Se já existir de uma sessão anterior (sem refresh), só escondê-lo.
  const _oldGalleryMgmtEl = document.getElementById('detail-gallery-mgmt');
  if (_oldGalleryMgmtEl) _oldGalleryMgmtEl.remove();

  const confContainer = document.getElementById('detail-confirmations');
  
  if (confirmations.length === 0) {
    confContainer.innerHTML = '<p class="text-gray-400 text-sm">Nenhuma confirmação ainda.</p>';
  } else {
    // 📌 Obter timestamp do último download
    const lastDownloadKey = `last_download_${Store.currentEventId}`;
    const lastDownloadTime = localStorage.getItem(lastDownloadKey);
    
    dlog('🔍 Renderizando confirmações:');
    dlog('  Último download:', lastDownloadTime);
    
    // 📌 Determinar se confirmação é nova
    const isNewConfirmation = (conf) => {
      if (!lastDownloadTime) {
        dlog('  ℹ️ Primeiro download - nenhuma é nova:', conf.name);
        return false; // Primeiro download, nenhuma é nova
      }
      
      const confTime = conf.updatedAt || conf.createdAt || new Date().toISOString();
      const confTimestamp = new Date(confTime).getTime();
      const isNew = confTimestamp > parseInt(lastDownloadTime);
      
      dlog(`  ${conf.name}: ${confTime} > ${lastDownloadTime}? ${isNew}`);
      
      return isNew;
    };
    
    confContainer.innerHTML = confirmations.map((c, idx) => {
      const isNew = isNewConfirmation(c);
      const newBadge = isNew ? '<span class="inline-block ml-2 text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">NOVO</span>' : '';
      
      // ✅ Verificar se este convidado tem presente reservado
      const guestKey = normalizeGuestName(c.name);
      const reservedGift = event.gifts && event.gifts.find(g => _giftClaimants(g).some(n => normalizeGuestName(n) === guestKey));
      const hasReservedGift = !!reservedGift;
      const reservedGiftNameEncoded = hasReservedGift ? encodeURIComponent(c.name) : '';
      
      let actionButtons = '';
      if (isOwner) {
        actionButtons = '<div class="flex gap-1">';
        if (hasReservedGift) {
          actionButtons += '<button class="text-yellow-500 hover:text-yellow-600 transition p-1" title="Remover presente" onclick="removeGiftReservation(\'' + reservedGift.id + '\', \'' + reservedGiftNameEncoded + '\')"><i data-lucide="gift" class="w-4 h-4"></i></button>';
        }
        actionButtons += '<button class="text-gray-400 hover:text-teal-500 transition p-1" onclick="editConfirmationModal(' + idx + ')"><i data-lucide="pencil" class="w-4 h-4"></i></button>';
        actionButtons += '<button class="text-gray-400 hover:text-red-500 transition p-1" onclick="deleteConfirmation(' + idx + ')"><i data-lucide="trash-2" class="w-4 h-4"></i></button>';
        actionButtons += '</div>';
      }
      
      let removeGiftBtn = '';
      if (hasReservedGift && isOwner) {
        removeGiftBtn = '<button class="text-yellow-500 hover:text-yellow-600 transition p-1" title="Remover presente reservado" onclick="removeGiftReservation(\'' + reservedGift.id + '\', \'' + reservedGiftNameEncoded + '\')"><i data-lucide="gift" class="w-5 h-5"></i></button>';
      }
      let replyMessageBtn = '';
      if (c.message && isOwner) {
        replyMessageBtn = '<button class="text-teal-500 hover:text-teal-600 transition p-1" title="Responder recado" onclick="replyToGuestMessage(' + idx + ')"><i data-lucide="message-square" class="w-4 h-4"></i></button>';
      }
      
      const sideLabel = getSideLabel(c.side, event);
      const safeName = escapeHTML(c.name);
      const safeCompanions = (c.companions || []).map(escapeHTML).join(', ');
      const safeKids = (c.kids || []).map(escapeHTML).join(', ');
      const safeGiftName = hasReservedGift ? escapeHTML(reservedGift.name) : '';
      const details = [
        sideLabel,
        ((c.companions || []).length ? 'Acomp: ' + safeCompanions : ''),
        ((c.kids || []).length ? 'Crianças: ' + safeKids : ''),
        (hasReservedGift ? safeGiftName : '')
      ].filter(Boolean).join(' · ');
      return '<div class="flex items-center gap-3 p-3 rounded-xl ' + (c.attending ? 'bg-green-50' : 'bg-red-50') + ' mb-2 ' + (isNew ? 'border-2 border-green-300' : '') + '"><div class="w-9 h-9 rounded-full ' + (c.attending ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-600') + ' flex items-center justify-center font-bold text-sm">' + escapeHTML((c.name || '?').charAt(0)) + '</div><div class="flex-1 min-w-0"><p class="font-semibold text-gray-800 text-sm truncate">' + safeName + newBadge + '</p><p class="text-xs text-gray-500">' + details + '</p></div><span class="text-xs font-semibold ' + (c.attending ? 'text-green-600' : 'text-red-500') + ' mr-2">' + (c.attending ? 'Vai' : 'Não vai') + '</span><div class="flex gap-1">' + removeGiftBtn + replyMessageBtn + (isOwner ? '<button class="text-gray-400 hover:text-teal-500 transition p-1" onclick="editConfirmationModal(' + idx + ')"><i data-lucide="pencil" class="w-4 h-4"></i></button><button class="text-gray-400 hover:text-red-500 transition p-1" onclick="deleteConfirmation(' + idx + ')"><i data-lucide="trash-2" class="w-4 h-4"></i></button>' : '') + '</div></div>';
    }).join('');
  }

  lucide.createIcons();
}

function copyEventLink(inputId = 'detail-link') {
  const link = document.getElementById(inputId).value;
  navigator.clipboard.writeText(link).then(() => toast('Link copiado!')).catch(() => {
    document.getElementById(inputId).select();
    toast('Selecione e copie o link.');
  });
}

function toggleRSVPAllowed() {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;
  
  ev.allowRSVP = !ev.allowRSVP;
  const rsvpSwitch = document.getElementById('sw-allow-rsvp');
  rsvpSwitch.classList.toggle('active');
  
  toast(ev.allowRSVP ? 'Confirmacao de presenca ativada' : 'Confirmacao de presenca desativada');
}

function viewAsGuest() {
  // Get the event from Store and merge localStorage cache
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (ev) {
// visual data comes from event_visuals table (loaded in renderGuestView)
    // Set as guestEventData so renderGuestView uses it directly
    Store.guestEventData = ev;
  }
  Store.viewingAsGuestFromOrganizer = true;
  Router.go('guest');
}

function downloadGiftsPDF() {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev || !ev.allowGifts || !ev.gifts || ev.gifts.length === 0) {
    toast('Este evento não tem presentes.');
    return;
  }

  // Agrupar presentes por categoria
  const categories = {};
  ev.gifts.forEach(g => {
    const cat = g.category || 'Sem categoria';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(g);
  });

  // Gerar HTML do PDF
  let htmlContent = `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Lista de Presentes</title>
      <style>
        * { font-family: 'Quicksand', Arial, sans-serif; }
        body { margin: 0; padding: 20px; background: white; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #007f9f; padding-bottom: 20px; }
        .header h1 { margin: 0 0 5px 0; color: #007f9f; font-size: 28px; }
        .header p { margin: 5px 0; color: #666; font-size: 14px; }
        .summary { background: #f0f9fb; border-left: 4px solid #007f9f; padding: 15px; margin-bottom: 30px; border-radius: 4px; }
        .summary-item { display: inline-block; margin-right: 30px; }
        .summary-item strong { color: #007f9f; }
        .category { margin-bottom: 30px; page-break-inside: avoid; }
        .category-header { background: #007f9f; color: white; padding: 10px 15px; border-radius: 4px 4px 0 0; font-weight: bold; font-size: 16px; }
        .gift-list { border: 1px solid #ddd; border-top: none; border-radius: 0 0 4px 4px; }
        .gift-item { padding: 12px 15px; border-bottom: 1px solid #eee; display: flex; align-items: center; }
        .gift-item:last-child { border-bottom: none; }
        .gift-status { width: 20px; height: 20px; border-radius: 50%; margin-right: 12px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
        .gift-status.reserved { background: #10b981; color: white; }
        .gift-status.available { background: #e5e7eb; color: #999; }
        .gift-name { flex: 1; font-weight: 500; }
        .gift-reserved-by { color: #10b981; font-size: 13px; font-weight: 500; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Lista de Presentes</h1>
        <p><strong>${ev.title}</strong></p>
        <p>${formatDate(ev.date)} às ${ev.time}</p>
        <p style="font-size: 12px; color: #999;">Relatório gerado em ${new Date().toLocaleDateString('pt-PT')} às ${new Date().toLocaleTimeString('pt-PT')}</p>
      </div>

      <div class="summary">
        <div class="summary-item">
          <strong>${ev.gifts.length}</strong> Total de Presentes
        </div>
        <div class="summary-item">
          <strong>${ev.gifts.filter(g => g.reserved).length}</strong> Escolhidos
        </div>
        <div class="summary-item">
          <strong>${ev.gifts.filter(g => !g.reserved).length}</strong> Disponíveis
        </div>
        <div class="summary-item">
          <strong>${((ev.gifts.filter(g => g.reserved).length / ev.gifts.length) * 100).toFixed(0)}%</strong> Percentual
        </div>
      </div>
  `;

  // Adicionar presentes por categoria
  Object.keys(categories).sort().forEach(cat => {
    htmlContent += `
      <div class="category">
        <div class="category-header">${cat}</div>
        <div class="gift-list">
    `;

    categories[cat].forEach(gift => {
      htmlContent += `
        <div class="gift-item">
          <div class="gift-status ${gift.reserved ? 'reserved' : 'available'}">
            ${gift.reserved ? 'Reservado' : 'Livre'}
          </div>
          <div class="gift-name">${escapeHTML(gift.name)}</div>
          ${gift.reserved || (gift.reservedBy) ? `<div class="gift-reserved-by">Escolhido por: ${escapeHTML((gift.reservedBy || '').split('|').filter(Boolean).join(', '))}</div>` : ''}
        </div>
      `;
    });

    htmlContent += `
        </div>
      </div>
    `;
  });

  htmlContent += `
      <div class="footer">
        <p> Evento: ${escapeHTML(ev.title)}</p>
        <p>© Created By AdKira 2026</p>
      </div>
    </body>
    </html>
  `;

  // Converter HTML para PDF
  const element = document.createElement('div');
  element.innerHTML = htmlContent;
  
  const opt = {
    margin: 10,
    filename: `${ev.title.replace(/\s+/g, '_')}_presentes_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (typeof html2pdf === 'undefined') {
    toast('A biblioteca de PDF não carregou. Verifica a tua ligação à internet e tenta novamente.');
    return;
  }

  html2pdf().set(opt).from(element).save();
  toast('PDF de presentes gerado com sucesso!');
}

function downloadPDF() {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;

  const confirmed = (ev.confirmations || []).filter(c => c.attending === true || c.attending === 'yes');
  if (confirmed.length === 0) {
    toast('Ainda nao ha convidados confirmados para exportar.');
    return;
  }

  const enumerated = confirm('Quer baixar a lista enumerada?\n\nOK = com numeros\nCancelar = apenas nomes');
  const generatedAt = new Date().toLocaleString('pt-PT');
  const hasSides = isSideSelectionEnabled(ev);
  const sideNames = getEventSideNames(ev);

  function sideKey(conf) {
    return getSideBucket(conf.side, ev);
  }

  function makeLines(list) {
    return list.map((conf, index) => {
      const name = formatGuestWithCompanions(conf);
      return enumerated ? `${index + 1}. ${name}` : name;
    });
  }

  const sections = [];
  if (hasSides) {
    const side1List = confirmed.filter(conf => sideKey(conf) === 'side1');
    const side2List = confirmed.filter(conf => sideKey(conf) === 'side2');
    const otherList = confirmed.filter(conf => sideKey(conf) === 'other');

    sections.push({ title: `Lista - ${sideNames.side1}`, lines: makeLines(side1List) });
    sections.push({ title: `Lista - ${sideNames.side2}`, lines: makeLines(side2List) });
    if (otherList.length > 0) sections.push({ title: 'Sem lado definido', lines: makeLines(otherList) });
  } else {
    sections.push({ title: '', lines: makeLines(confirmed) });
  }

  const textSections = sections.map(section => {
    const header = section.title ? `${section.title}\n` : '';
    const body = section.lines.length ? section.lines.join('\n') : 'Nenhum convidado confirmado nesta lista.';
    return header + body;
  });

  // ── Resumo (mesmo estilo da lista de presentes) ──
  const totalCompanions = confirmed.reduce((sum, c) => sum + (c.companions || []).length, 0);
  const totalKids = confirmed.reduce((sum, c) => sum + (c.kids || []).length, 0);
  const totalPeople = confirmed.length + totalCompanions + totalKids;

  let htmlContent = `
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="UTF-8">
      <title>Lista de Confirmações</title>
      <style>
        * { font-family: 'Quicksand', Arial, sans-serif; }
        body { margin: 0; padding: 20px; background: white; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #007f9f; padding-bottom: 20px; }
        .header h1 { margin: 0 0 5px 0; color: #007f9f; font-size: 28px; }
        .header p { margin: 5px 0; color: #666; font-size: 14px; }
        .summary { background: #f0f9fb; border-left: 4px solid #007f9f; padding: 15px; margin-bottom: 30px; border-radius: 4px; }
        .summary-item { display: inline-block; margin-right: 30px; }
        .summary-item strong { color: #007f9f; }
        .category { margin-bottom: 30px; page-break-inside: avoid; }
        .category-header { background: #007f9f; color: white; padding: 10px 15px; border-radius: 4px 4px 0 0; font-weight: bold; font-size: 16px; }
        .guest-list { border: 1px solid #ddd; border-top: none; border-radius: 0 0 4px 4px; }
        .guest-item { padding: 11px 15px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 10px; }
        .guest-item:last-child { border-bottom: none; }
        .guest-num { width: 22px; height: 22px; border-radius: 50%; background: #007f9f; color: #fff; font-size: 11px; font-weight: bold; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .guest-check { color: #10b981; font-weight: bold; flex-shrink: 0; }
        .guest-name { flex: 1; font-weight: 500; }
        .empty-note { padding: 14px 15px; color: #999; font-size: 13px; font-style: italic; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Lista de Confirmações</h1>
        <p><strong>${escapeHTML(ev.title || '')}</strong></p>
        <p>${formatDate(ev.date)} às ${escapeHTML(ev.time || '')}</p>
        <p style="font-size: 12px; color: #999;">Relatório gerado em ${generatedAt}</p>
      </div>
      <div class="summary">
        <div class="summary-item"><strong>${confirmed.length}</strong> Confirmados</div>
        <div class="summary-item"><strong>${totalCompanions}</strong> Acompanhantes</div>
        <div class="summary-item"><strong>${totalKids}</strong> Crianças</div>
        <div class="summary-item"><strong>${totalPeople}</strong> Total de Pessoas</div>
      </div>
  `;

  sections.forEach(section => {
    htmlContent += `<div class="category">`;
    if (section.title) htmlContent += `<div class="category-header">${escapeHTML(section.title)}</div>`;
    htmlContent += `<div class="guest-list">`;
    if (section.lines.length) {
      section.lines.forEach((line, i) => {
        const safeLine = escapeHTML(line.replace(/^\d+\.\s*/, ''));
        htmlContent += `<div class="guest-item">
          ${enumerated ? `<span class="guest-num">${i + 1}</span>` : `<span class="guest-check">✓</span>`}
          <span class="guest-name">${safeLine}</span>
        </div>`;
      });
    } else {
      htmlContent += `<div class="empty-note">Nenhum convidado confirmado nesta lista.</div>`;
    }
    htmlContent += `</div></div>`;
  });

  htmlContent += `
      <div class="footer">
        <p>Evento: ${escapeHTML(ev.title || '')}</p>
        <p>© Created By AdKira 2026</p>
      </div>
    </body>
    </html>
  `;

  const element = document.createElement('div');
  element.innerHTML = htmlContent;

  const opt = {
    margin: 10,
    filename: `${(ev.title || 'Convidados').replace(/\s+/g, '_')}_convidados_${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (typeof html2pdf === 'undefined') {
    // Salvaguarda: se a biblioteca não tiver carregado por algum motivo
    // (ex: sem internet num instante), continua a funcionar como texto.
    const text = `${ev.title}\nGerado em: ${generatedAt}\n\n${textSections.join('\n\n')}`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(ev.title || 'Convidados').replace(/\s+/g, '_')}_convidados_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Não foi possível gerar o PDF agora — lista exportada como texto.');
    return;
  }

  html2pdf().set(opt).from(element).save();
  toast('PDF de confirmações gerado com sucesso!');
}
function manageGifts() { Router.go('gifts'); }

// ── Edit with lock check: respects edit_locked flag (por conta) e
// global_edit_lock (todas as contas) — admin/impersonação sempre passa,
// porque está a ajudar o cliente.
async function _checkEditingAllowed() {
  const isAdminSession = Store.currentUser?.role === 'admin' || Store.adminModeActive;
  if (isAdminSession) return true;

  if (Store.currentUser && Store.currentUser.edit_locked === true) {
    toast('A edição está temporariamente bloqueada. Contacta a AdKira para mais informações.', 4000);
    return false;
  }

  try {
    const rows = await supabaseRequest('site_config?key=eq.global_edit_lock&select=value&limit=1');
    if (rows && rows[0] && rows[0].value === 'yes') {
      toast('A edição de eventos está temporariamente desligada para manutenção. Tenta novamente mais tarde.', 5000);
      return false;
    }
  } catch(e) { /* em caso de erro, não bloquear por causa disto */ }

  return true;
}

async function editEventWithLockCheck() {
  if (!(await _checkEditingAllowed())) return;
  editEvent();
}

async function editEvent() {
  const evStore = Store.events.find(e => e.id === Store.currentEventId);
  if (!evStore) return;

  const ownerUserId = evStore.userId || evStore.user_id;
  const isOwner = ownerUserId === Store.currentUser.id;
  const isAdmin = Store.currentUser.role === 'admin' || Store.adminModeActive;
  if (!isOwner && !isAdmin) {
    toast('Apenas o organizador ou admin pode editar o evento.');
    return;
  }

  const eventId = Store.currentEventId;

  // Load visuals from event_visuals table and merge into evStore
  try {
    const visuals = await loadEventVisuals(eventId);
    if (visuals) Object.keys(visuals).forEach(k => {
      if (k !== 'event_id' && k !== 'updated_at' && visuals[k] !== null && visuals[k] !== undefined) evStore[k] = visuals[k];
    });
  } catch(e) {}

  // Also load dates from event_dates table
  try {
    const dates = await loadEventDates(eventId);
    if (dates.event_date)      evStore.date            = dates.event_date;
    if (dates.event_time)      evStore.time            = dates.event_time;
    if (dates.show_time)       evStore.show_time       = dates.show_time;
    if (dates.confirm_by_date) evStore.confirm_by_date = dates.confirm_by_date;
  } catch(e) {}

  // Load venues from event_venues table
  try {
    const venues = await loadEventVenues(eventId);
    if (venues) Object.keys(venues).forEach(k => {
      if (k !== 'event_id' && k !== 'updated_at' && venues[k] !== null) evStore[k] = venues[k];
    });
  } catch(e) {}

  toast('A carregar dados do evento...');

  // Fetch fresh data from Supabase (no localStorage)
  try {
    const result = await supabaseRequest(
      `events?id=eq.${eventId}&select=id,title,date,time,confirm_by_date,cover_image,event_code,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,rsvp_enabled,allow_edit_rsvp,save_the_date_enabled,release_type,release_date,is_invite_released,std_title,std_subtitle,std_font_family,std_name_size,std_title_size,std_intro_enabled,std_intro_text,std_intro_photo_url,std_intro_photo_mobile_url,std_intro_photo_desktop_url,std_intro_on_invite,std_show_cover,std_cover_url,std_cover_mobile_url,std_cover_desktop_url,std_scratch_enabled,std_scratch_mode,std_scratch_photo_url,std_scratch_text,std_date_style,std_extra_phrase,std_extra_phrase_enabled,is_example_event,std_show_iban,personalized_links_enabled,show_rsvp_in_full_invite,show_guest_name_in_invite,allow_messages,show_guest_messages,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,show_couple,groom_name,bride_name,couple_size,bg_url,bg_overlay,show_bible,bible_text,bible_ref,show_invite,invite_text,show_parents,groom_parents,bride_parents,show_gallery,gallery_urls,show_schedule,schedule_items,custom_font_family,section_order,story_text,invite_blessing,event_color&limit=1`
    );
    const fresh = (result && result[0]) ? result[0] : evStore;
    // Load visual data from event_visuals table
    try {
      const visuals = await loadEventVisuals(eventId);
      if (visuals) Object.keys(visuals).forEach(k => {
        if (k !== 'event_id' && k !== 'updated_at' && visuals[k] !== null && visuals[k] !== undefined) fresh[k] = visuals[k];
      });
    } catch(e) {}
    // Load dates from event_dates table
    try {
      const dates = await loadEventDates(eventId);
      if (dates.event_date)      fresh.date            = dates.event_date;
      if (dates.event_time)      fresh.time            = dates.event_time;
      if (dates.show_time)       fresh.show_time       = dates.show_time;
      if (dates.confirm_by_date) fresh.confirm_by_date = dates.confirm_by_date;
    } catch(e) {}
    // Load venues from event_venues table
    try {
      const venues = await loadEventVenues(eventId);
      if (venues) Object.keys(venues).forEach(k => {
        if (k !== 'event_id' && k !== 'updated_at' && venues[k] !== null && venues[k] !== undefined) fresh[k] = venues[k];
      });
    } catch(e) {}
    _fillEditForm(fresh);
  } catch(e) {
    console.error('editEvent load error:', e);
    _fillEditForm(evStore);
  }
}

function _yesOrTrue(val) {
  return String(val).toLowerCase() === 'yes' || val === true;
}

function _setSwitch(swId, active, extraId) {
  const sw = document.getElementById(swId);
  const ex = extraId ? document.getElementById(extraId) : null;
  if (!sw) return;
  if (active) {
    sw.classList.add('active');
    if (ex) ex.classList.remove('hidden');
  } else {
    sw.classList.remove('active');
    if (ex) ex.classList.add('hidden');
  }
}

function _fillEditForm(ev) {
  // visual data comes from event_visuals table
  // Campos de texto base
  document.getElementById('evt-title').value = ev.title || '';
  document.getElementById('evt-date').value = ev.date || '';
  document.getElementById('evt-time').value = ev.time || '';

  // Deadline
  let deadlineValue = ev.confirm_by_date || ev.deadline || ev.date || '';
  if (deadlineValue && deadlineValue.includes(' ')) deadlineValue = deadlineValue.split(' ')[0];
  if (deadlineValue && deadlineValue.includes('T')) deadlineValue = deadlineValue.split('T')[0];
  document.getElementById('evt-deadline').value = deadlineValue !== ev.date ? deadlineValue : '';
  // Espelhos da secção Save the Date — mostram sempre o valor real da data/prazo,
  // mesmo quando o campo principal de prazo fica vazio (porque coincide com a data)
  { const dm = document.getElementById('evt-std-date-mirror'); if (dm) dm.value = ev.date || ''; }
  { const ddm = document.getElementById('evt-std-deadline-mirror'); if (ddm) ddm.value = deadlineValue || ''; }

  // Switches — ler directamente dos campos do Supabase (strings 'yes'/'no')
  _setSwitch('sw-companions', _yesOrTrue(ev.allow_companions), 'companions-extra');
  _setSwitch('sw-gifts',      _yesOrTrue(ev.allow_gifts));
  _setSwitch('sw-kids',       _yesOrTrue(ev.allow_kids), 'kids-extra');
  _setSwitch('sw-show-time',  _yesOrTrue(ev.show_time));
  _setSwitch('sw-rsvp-enabled', ev.rsvp_enabled !== false);
  _setSwitch('sw-allow-edit-rsvp', ev.allow_edit_rsvp !== false);
  _setSwitch('sw-personalized-links', ev.personalized_links_enabled === true);
  _setSwitch('sw-rsvp-in-full-invite', ev.show_rsvp_in_full_invite === true);
  _setSwitch('sw-guest-name-in-invite', ev.show_guest_name_in_invite !== false);
  _setSwitch('sw-std', ev.save_the_date_enabled === true || ev.save_the_date_enabled === 'yes', 'std-extra');
  { const rt = document.getElementById('evt-std-release-type'); if (rt) rt.value = ev.release_type || 'manual'; }
  { const rd = document.getElementById('evt-std-release-date'); if (rd && ev.release_date) { const d = new Date(ev.release_date); rd.value = d.toISOString().slice(0,16); } }
  _setSwitch('sw-std-released', ev.is_invite_released === true || ev.is_invite_released === 'yes');
  { const t = document.getElementById('evt-std-title'); if (t) t.value = ev.std_title || 'Save the Date'; }
  { const s = document.getElementById('evt-std-subtitle'); if (s) s.value = ev.std_subtitle || 'Nosso Casamento'; }
  { const sf = document.getElementById('evt-std-font-select'); if (sf) sf.value = ev.std_font_family || ''; }
  { const nsInp = document.getElementById('evt-std-name-size'); const nsLbl = document.getElementById('std-name-size-label'); const nsVal = ev.std_name_size || '2.4'; if (nsInp) nsInp.value = nsVal; if (nsLbl) nsLbl.textContent = nsVal + 'rem'; }
  { const tsInp = document.getElementById('evt-std-title-size'); const tsLbl = document.getElementById('std-title-size-label'); const tsVal = ev.std_title_size || '0.78'; if (tsInp) tsInp.value = tsVal; if (tsLbl) tsLbl.textContent = tsVal + 'rem'; }
  _setSwitch('sw-std-intro', ev.std_intro_enabled === true, 'std-intro-extra');
  _setSwitch('sw-std-intro-on-invite', ev.std_intro_on_invite !== false);
  { const itEl = document.getElementById('evt-std-intro-text'); if (itEl) itEl.value = ev.std_intro_text || 'Recebeu este convite porque é importante para nós'; }
  { const ipUrlM = document.getElementById('evt-std-intro-photo-mobile-url'); const ipPrevM = document.getElementById('std-intro-photo-mobile-preview');
    if (ev.std_intro_photo_mobile_url) { if (ipUrlM) ipUrlM.value = ev.std_intro_photo_mobile_url; if (ipPrevM) ipPrevM.src = ev.std_intro_photo_mobile_url; document.getElementById('std-intro-photo-mobile-preview-wrap')?.classList.remove('hidden'); } }
  { const ipUrlD = document.getElementById('evt-std-intro-photo-desktop-url'); const ipPrevD = document.getElementById('std-intro-photo-desktop-preview');
    if (ev.std_intro_photo_desktop_url) { if (ipUrlD) ipUrlD.value = ev.std_intro_photo_desktop_url; if (ipPrevD) ipPrevD.src = ev.std_intro_photo_desktop_url; document.getElementById('std-intro-photo-desktop-preview-wrap')?.classList.remove('hidden'); } }
  _setSwitch('sw-std-cover', ev.std_show_cover !== false, 'std-cover-extra');
  { const scUrl=document.getElementById('evt-std-cover-url'); const scPrev=document.getElementById('std-cover-preview'); const scWrap=document.getElementById('std-cover-preview-wrap');
    if(ev.std_cover_url){if(scUrl)scUrl.value=ev.std_cover_url;if(scPrev)scPrev.src=ev.std_cover_url;scWrap?.classList.remove('hidden');} }
  _setSwitch('sw-std-scratch', ev.std_scratch_enabled === true, 'std-scratch-extra');
  { const smEl = document.getElementById('evt-std-scratch-mode'); if (smEl) { smEl.value = ev.std_scratch_mode || 'photo'; toggleScratchModeFields(smEl.value); } }
  { const stEl = document.getElementById('evt-scratch-text'); if (stEl) stEl.value = ev.std_scratch_text || 'Raspa para desvendar'; }
  { const sdsEl = document.getElementById('evt-std-date-style'); if (sdsEl) sdsEl.value = ev.std_date_style || 'card'; }
  { const spUrl=document.getElementById('evt-scratch-photo-url'); const spPrev=document.getElementById('scratch-photo-preview'); const spWrap=document.getElementById('scratch-photo-preview-wrap');
    if(ev.std_scratch_photo_url){if(spUrl)spUrl.value=ev.std_scratch_photo_url;if(spPrev)spPrev.src=ev.std_scratch_photo_url;spWrap?.classList.remove('hidden');} }
  if (typeof toggleStdReleaseFields === 'function') toggleStdReleaseFields(ev.release_type || 'manual');
  _setSwitch('sw-messages',   _yesOrTrue(ev.allow_messages), 'messages-extra');
  _setSwitch('sw-sides',      _yesOrTrue(ev.allow_sides), 'sides-extra');

  // Show guest messages checkbox
  document.getElementById('evt-show-messages').checked = _yesOrTrue(ev.show_guest_messages);

  // Lados
  document.getElementById('evt-side1-name').value = (ev.side1_name && ev.side1_name.trim()) ? ev.side1_name.trim() : 'Grupo 1';
  document.getElementById('evt-side2-name').value = (ev.side2_name && ev.side2_name.trim()) ? ev.side2_name.trim() : 'Grupo 2';

  // Limites numéricos
  const maxComp = (ev.max_companions !== null && ev.max_companions !== undefined) ? Number(ev.max_companions) : 2;
  const maxKids = (ev.max_kids !== null && ev.max_kids !== undefined) ? Number(ev.max_kids) : 2;
  document.getElementById('evt-max-comp').value = isNaN(maxComp) || maxComp < 1 ? 2 : maxComp;
  document.getElementById('evt-max-kids').value = isNaN(maxKids) || maxKids < 1 ? 2 : maxKids;

  // Imagem de capa
  const coverImageURL = ev.cover_image || ev.cover || '';
  const coverImg = document.getElementById('cover-img');
  const coverPlaceholder = document.getElementById('cover-placeholder');
  // ✅ CORREÇÃO: protegido com verificação de existência — antes, se por
  // qualquer motivo estes elementos não estivessem disponíveis no momento
  // exacto desta chamada, o erro travava TODO o resto desta função (Dress
  // Code, Mensagem dos Noivos, Foto Final, etc. nunca chegavam a preencher).
  if (coverImageURL && coverImageURL.startsWith('http')) {
    if (coverImg) { coverImg.src = coverImageURL; coverImg.classList.remove('hidden'); }
    if (coverPlaceholder) coverPlaceholder.classList.add('hidden');
  } else {
    if (coverImg) coverImg.classList.add('hidden');
    if (coverPlaceholder) coverPlaceholder.classList.remove('hidden');
  }

  // Música
  const hasMusicUrl = ev.music_url && ev.music_url.trim() !== '';
  _setSwitch('sw-music', hasMusicUrl, 'music-extra');
  document.getElementById('evt-music-url').value  = ev.music_url   || '';
  document.getElementById('evt-music-title').value = ev.music_title || '';
  // Reset upload area
  const uploadArea = document.getElementById('music-upload-area');
  if (uploadArea) uploadArea.innerHTML = '<i data-lucide="music" class="w-6 h-6 text-gray-400 mb-1"></i><span class="text-xs text-gray-500 font-semibold">Carregar ficheiro MP3 / OGG</span><span class="text-xs text-gray-400 mt-0.5">Máx. 10 MB</span>';
  const uploadStatus = document.getElementById('music-upload-status');
  if (uploadStatus) uploadStatus.classList.add('hidden');

  // IBAN
  const hasIban = ev.iban_number && ev.iban_number.trim() !== '';
  _setSwitch('sw-iban', hasIban, 'iban-extra');
  document.getElementById('evt-iban-message').value = ev.iban_message || '';
  document.getElementById('evt-iban-number').value  = ev.iban_number  || '';
  document.getElementById('evt-iban-holder').value  = ev.iban_holder  || '';
  document.getElementById('evt-iban-footer').value  = ev.iban_footer  || '';

  // Visual / Sections
  _setSwitch('sw-couple', _yesOrTrue(ev.show_couple), 'couple-extra');
  document.getElementById('evt-groom-name').value = ev.groom_name || '';
  document.getElementById('evt-bride-name').value = ev.bride_name || '';
  const heroSubtitleEl = document.getElementById('evt-hero-subtitle');
  if (heroSubtitleEl) heroSubtitleEl.value = ev.hero_subtitle || '';
  const ornamentUrlEl = document.getElementById('evt-bible-ornament-url');
  const ornamentPreviewEl = document.getElementById('bible-ornament-preview');
  const ornamentRemoveBtn = document.getElementById('bible-ornament-remove-btn');
  if (ornamentUrlEl) {
    ornamentUrlEl.value = ev.bible_ornament_url || '';
    const ornSizeEl = document.getElementById('evt-bible-ornament-size');
    const ornSizeLbl = document.getElementById('ornament-size-label');
    const ornSizeVal = ev.bible_ornament_size || '28';
    if (ornSizeEl) ornSizeEl.value = ornSizeVal;
    if (ornSizeLbl) ornSizeLbl.textContent = ornSizeVal + 'px';
    if (ev.bible_ornament_url && ornamentPreviewEl) {
      ornamentPreviewEl.src = ev.bible_ornament_url;
      ornamentPreviewEl.style.display = '';
      if (ornamentRemoveBtn) ornamentRemoveBtn.style.display = '';
    } else {
      if (ornamentPreviewEl) ornamentPreviewEl.style.display = 'none';
      if (ornamentRemoveBtn) ornamentRemoveBtn.style.display = 'none';
    }
  }
  const sz = parseFloat(ev.couple_size || 2.4);
  document.getElementById('evt-couple-size').value = sz;
  const szLbl = document.getElementById('couple-size-label');
  if (szLbl) szLbl.textContent = sz + 'rem';
  const fsEl = document.getElementById('evt-font-select');
  if (fsEl) fsEl.value = ev.custom_font_family || '';

  _setSwitch('sw-bg', (ev.bg_url || ev.bg_url_mobile || ev.bg_url_desktop) ? true : false, 'bg-extra');
  { const bgUrlM = document.getElementById('evt-bg-url-mobile'); const bgPrevM = document.getElementById('bg-preview-mobile');
    if (ev.bg_url_mobile) { if (bgUrlM) bgUrlM.value = ev.bg_url_mobile; if (bgPrevM) bgPrevM.src = ev.bg_url_mobile; document.getElementById('bg-preview-mobile-wrap')?.classList.remove('hidden'); } }
  { const bgUrlD = document.getElementById('evt-bg-url-desktop'); const bgPrevD = document.getElementById('bg-preview-desktop');
    if (ev.bg_url_desktop) { if (bgUrlD) bgUrlD.value = ev.bg_url_desktop; if (bgPrevD) bgPrevD.src = ev.bg_url_desktop; document.getElementById('bg-preview-desktop-wrap')?.classList.remove('hidden'); } }
  // Compatibilidade: eventos antigos só têm bg_url (sem variantes) — mostra essa
  // foto como "mobile" por defeito, já que era a única que existia antes.
  if (ev.bg_url && !ev.bg_url_mobile && !ev.bg_url_desktop) {
    const bgUrlM = document.getElementById('evt-bg-url-mobile'); const bgPrevM = document.getElementById('bg-preview-mobile');
    if (bgUrlM) bgUrlM.value = ev.bg_url; if (bgPrevM) bgPrevM.src = ev.bg_url;
    document.getElementById('bg-preview-mobile-wrap')?.classList.remove('hidden');
  }
  const ovEl = document.getElementById('evt-bg-overlay');
  if (ovEl) { ovEl.value = ev.bg_overlay !== undefined ? ev.bg_overlay : 35; document.getElementById('bg-overlay-val').textContent = ovEl.value + '%'; }

  _setSwitch('sw-bible', _yesOrTrue(ev.show_bible), 'bible-extra');
  document.getElementById('evt-bible-text').value = ev.bible_text || '';
  document.getElementById('evt-bible-ref').value  = ev.bible_ref  || '';
  { const bt2 = document.getElementById('evt-bible-text-2'); if (bt2) bt2.value = ev.bible_text_2 || ''; }
  { const br2 = document.getElementById('evt-bible-ref-2'); if (br2) br2.value = ev.bible_ref_2 || ''; }
  { const bsInp = document.getElementById('evt-bible-size'); const bsLbl = document.getElementById('bible-size-label'); const bsVal = ev.bible_size || '0.92'; if (bsInp) bsInp.value = bsVal; if (bsLbl) bsLbl.textContent = bsVal + 'rem'; }
  { const tsInp = document.getElementById('evt-titles-size'); const tsLbl = document.getElementById('titles-size-label'); const tsVal = ev.section_titles_size || '1.6'; if (tsInp) tsInp.value = tsVal; if (tsLbl) tsLbl.textContent = tsVal + 'rem'; }
  { const cmInp = document.getElementById('evt-couplemsg-size'); const cmLbl = document.getElementById('couplemsg-size-label'); const cmVal = ev.couplemsg_size || '0.95'; if (cmInp) cmInp.value = cmVal; if (cmLbl) cmLbl.textContent = cmVal + 'rem'; }
  { const stInp = document.getElementById('evt-story-size'); const stLbl = document.getElementById('story-size-label'); const stVal = ev.story_size || '0.88'; if (stInp) stInp.value = stVal; if (stLbl) stLbl.textContent = stVal + 'rem'; }

  _setSwitch('sw-invite', _yesOrTrue(ev.show_invite), 'invite-extra');
  document.getElementById('evt-invite-text').value = ev.invite_text || '';

  _setSwitch('sw-parents', _yesOrTrue(ev.show_parents), 'parents-extra');
  document.getElementById('evt-groom-parents').value = ev.groom_parents || '';
  document.getElementById('evt-bride-parents').value = ev.bride_parents || '';

  _setSwitch('sw-gallery', _yesOrTrue(ev.show_gallery), 'gallery-extra');
  document.getElementById('evt-gallery-urls').value = ev.gallery_urls || '';
  if (typeof renderGalleryOrderPreview === 'function') renderGalleryOrderPreview();

  _setSwitch('sw-manual', _yesOrTrue(ev.show_manual), 'manual-extra');
  // ✅ CORREÇÃO: protegido com try/catch — um JSON inválido aqui travava
  // tudo o que vinha depois nesta função (Dress Code, Mensagem dos Noivos,
  // Foto Final, Local, etc. ficavam todos vazios sem nenhum aviso visível).
  try { Store.eventManualItems = ev.manual_items ? JSON.parse(ev.manual_items) : null; }
  catch(e) { console.error('Falha ao interpretar manual_items, a ignorar:', e); Store.eventManualItems = null; }

  _setSwitch('sw-schedule', _yesOrTrue(ev.show_schedule), 'schedule-extra');
  try { Store.eventScheduleItems = ev.schedule_items ? JSON.parse(ev.schedule_items) : null; }
  catch(e) { console.error('Falha ao interpretar schedule_items, a ignorar:', e); Store.eventScheduleItems = null; }

  // Section order
  Store.eventSectionOrder = ev.section_order ? JSON.parse(ev.section_order) : null;
  // Story & blessing
  const storyEl = document.getElementById('evt-story-text');
  const blessEl = document.getElementById('evt-invite-blessing');
  if (storyEl) storyEl.value = ev.story_text || '';
  if (blessEl) blessEl.value = ev.invite_blessing || '';
  const blessSwitchEl = document.getElementById('sw-invite-blessing');
  if (blessSwitchEl) {
    const blessingIsOff = ev.invite_blessing === '';
    blessSwitchEl.classList.toggle('active', !blessingIsOff);
    document.getElementById('invite-blessing-extra')?.classList.toggle('hidden', blessingIsOff);
  }
  const colEl = document.getElementById('evt-event-color');
  if (colEl) colEl.value = ev.event_color || '#007f9f';
  const colHexEl = document.getElementById('evt-event-color-hex');
  if (colHexEl) colHexEl.value = ev.event_color || '#007f9f';
  const col2El = document.getElementById('evt-event-color-2');
  const col2HexEl = document.getElementById('evt-event-color-2-hex');
  const col2EnabledEl = document.getElementById('evt-event-color-2-enabled');
  if (col2El) col2El.value = ev.event_color_2 || '#c9a84c';
  if (col2HexEl) col2HexEl.value = ev.event_color_2 || '';
  if (col2EnabledEl) col2EnabledEl.checked = !!ev.event_color_2;
  const _color2Targets = (ev.event_color_2_targets || 'buttons').split(',');
  ['names','countdown','titles','message','date'].forEach(t => {
    const el = document.getElementById('evt-color2-t-' + t);
    if (el) el.checked = _color2Targets.includes(t);
  });
  if (ev.cover_video_url) {
    document.getElementById('evt-cover-video-url').value = ev.cover_video_url;
    const preview = document.getElementById('cover-video-preview');
    if (preview) { preview.src = ev.cover_video_url; document.getElementById('cover-video-preview-wrap')?.classList.remove('hidden'); }
  }
  const _validColorChoices = ['primary','secondary','black','silver','custom'];
  const btnColorChoiceEl = document.getElementById('evt-button-color-choice');
  if (btnColorChoiceEl) {
    btnColorChoiceEl.value = _validColorChoices.includes(ev.button_color_choice) ? ev.button_color_choice : 'primary';
    const customEl = document.getElementById('evt-button-color-choice-custom');
    if (customEl) {
      if (ev.button_color_choice_custom) customEl.value = ev.button_color_choice_custom;
      customEl.style.display = btnColorChoiceEl.value === 'custom' ? 'inline-block' : 'none';
    }
  }
  ['hero-names','names','countdown','titles','message','date'].forEach(t => {
    const el = document.getElementById('evt-color-' + t);
    if (el) {
      const field = t === 'hero-names' ? 'color_hero_names' : ('color_' + t);
      el.value = _validColorChoices.includes(ev[field]) ? ev[field] : 'primary';
      const customEl = document.getElementById('evt-color-' + t + '-custom');
      if (customEl) {
        if (ev[field + '_custom']) customEl.value = ev[field + '_custom'];
        customEl.style.display = el.value === 'custom' ? 'inline-block' : 'none';
      }
    }
  });
  const btnStyleEl = document.getElementById('evt-button-style');
  if (btnStyleEl) btnStyleEl.value = ev.button_style === 'round' ? 'round' : 'rounded';
  const layoutEl = document.getElementById('evt-invite-layout');
  if (layoutEl) layoutEl.value = ev.invite_layout === 'simple' ? 'simple' : 'sections';
  _setSwitch('sw-story', _yesOrTrue(ev.show_story) || (ev.story_text ? true : false), 'story-extra');
  // Restore saved section order into Store.eventSectionOrder
  if (ev.section_order) {
    try { Store.eventSectionOrder = JSON.parse(ev.section_order); } catch(e) { Store.eventSectionOrder = null; }
  } else {
    Store.eventSectionOrder = null;
  }

  // Decor
  // ✅ Bloco protegido: do Dress Code até aos Locais, tudo dentro de um
  // try/catch — assim, mesmo que apareça aqui um erro imprevisto no futuro,
  // o botão "Guardar Alterações" no fim da função continua a ser religado
  // correctamente (sem isto, um erro nesta zona deixava o botão a apontar
  // para "criar evento novo" em vez de "guardar alterações").
  try {
  _setSwitch('sw-decor', _yesOrTrue(ev.show_decor), 'decor-extra');
  _setSwitch('sw-couplemsg', _yesOrTrue(ev.show_couplemsg), 'couplemsg-extra');
  { const ct = document.getElementById('evt-couplemsg-text'); if(ct) ct.value = ev.couplemsg_text || ''; }
  _setSwitch('sw-final-photo', _yesOrTrue(ev.show_final_photo), 'final-photo-extra');
  { const fpUrl=document.getElementById('evt-final-photo-url'); const fpPrev=document.getElementById('final-photo-preview'); const fpWrap=document.getElementById('final-photo-preview-wrap');
    if(ev.final_photo_url){if(fpUrl)fpUrl.value=ev.final_photo_url;if(fpPrev)fpPrev.src=ev.final_photo_url;fpWrap?.classList.remove('hidden');} }
  _setSwitch('sw-event-faq', _yesOrTrue(ev.show_event_faq), 'event-faq-extra');
  try { Store.eventFaqItems = ev.event_faq_items ? JSON.parse(ev.event_faq_items) : []; } catch(e) { Store.eventFaqItems = []; }
  renderEventFaqList();
  { const ssEl = document.getElementById('evt-schedule-style'); if (ssEl) ssEl.value = ev.schedule_style || 'timeline'; }
  { const gsEl = document.getElementById('evt-gallery-style'); if (gsEl) gsEl.value = ev.gallery_style || 'grid'; }
  { const bcsInp = document.getElementById('evt-blessing-couple-size'); const bcsLbl = document.getElementById('blessing-couple-size-label');
    const bcsVal = ev.blessing_couple_size || ev.couple_size || '2.4'; if (bcsInp) bcsInp.value = bcsVal; if (bcsLbl) bcsLbl.textContent = bcsVal + 'rem'; }
  { const dsEl = document.getElementById('evt-date-style'); if (dsEl) dsEl.value = ev.date_style || 'classic'; }
  { const msEl = document.getElementById('evt-manual-style'); if (msEl) msEl.value = ev.manual_style || 'cards'; }
  { const stEl = document.getElementById('evt-story-style'); if (stEl) { stEl.value = ev.story_style || 'centered';
      document.getElementById('story-photo-wrap')?.classList.toggle('hidden', stEl.value !== 'photo-side'); } }
  { const spUrl=document.getElementById('evt-story-photo-url'); const spPrev=document.getElementById('story-photo-preview'); const spWrap=document.getElementById('story-photo-preview-wrap');
    if(ev.story_photo_url){if(spUrl)spUrl.value=ev.story_photo_url;if(spPrev)spPrev.src=ev.story_photo_url;spWrap?.classList.remove('hidden');} }
  { const psInp = document.getElementById('evt-parents-size'); const psLbl = document.getElementById('parents-size-label'); const psVal = ev.parents_size || '0.88'; if (psInp) psInp.value = psVal; if (psLbl) psLbl.textContent = psVal + 'rem'; }
  _setSwitch('sw-invert-names', _yesOrTrue(ev.invert_names));
  const evTypeEl = document.getElementById('evt-event-type');
  if (evTypeEl) { evTypeEl.value = ev.event_type || 'wedding'; updateLabelsForEventType(evTypeEl.value); }
  const decorSideUrl = document.getElementById('evt-decor-side-url');
  if (decorSideUrl) decorSideUrl.value = ev.decor_side_url || '';
  const decorOrnUrl = document.getElementById('evt-decor-ornament-url');
  if (decorOrnUrl) decorOrnUrl.value = ev.decor_ornament_url || '';
  ['top','bottom-left','bottom-right'].forEach(slot => {
    const urlInput = document.getElementById(`evt-decor-${slot}-url`);
    const prev = document.getElementById(`decor-${slot}-preview`);
    const url = ev[`decor_${slot.replace('-','_')}_url`];
    if (urlInput) urlInput.value = url || '';
    if (prev && url) { prev.src = url; prev.style.display = ''; }
  });
  const decorTopPos = document.getElementById('evt-decor-top-position');
  if (decorTopPos) decorTopPos.value = ev.decor_top_position === 'right' ? 'right' : 'left';

  // Venues
  _setSwitch('sw-venues', _yesOrTrue(ev.show_venues), 'venues-extra');
  const _sv = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  _sv('evt-venue-ceremony',       ev.venue_ceremony);
  _sv('evt-venue-ceremony-maps',  ev.venue_ceremony_maps);
  _sv('evt-venue-ceremony-date',  ev.venue_civil_date);
  _sv('evt-venue-civil',          ev.venue_civil);
  _sv('evt-venue-civil-maps',     ev.venue_civil_maps);
  _sv('evt-venue-civil-date',     ev.venue_relig_date);
  _sv('evt-venue-reception',      ev.venue_reception);
  _sv('evt-venues-title',          ev.venues_title);
  _sv('evt-venue-reception-maps', ev.venue_reception_maps);
  { const _vImg = (key, url) => {
      if (!url) return;
      const inp = document.getElementById(`evt-venue-${key}-image`); if (inp) inp.value = url;
      const prev = document.getElementById(`venue-${key}-image-preview`); if (prev) prev.src = url;
      document.getElementById(`venue-${key}-image-wrap`)?.classList.remove('hidden');
    };
    _vImg('ceremony', ev.venue_ceremony_image);
    _vImg('civil', ev.venue_civil_image);
    _vImg('reception', ev.venue_reception_image);
  }
  } catch (e) {
    console.error('Erro ao preencher secções avançadas do formulário (Dress Code/Mensagem/Foto Final/Locais) — o resto do formulário continua a funcionar:', e);
  }

  lucide.createIcons();
  
  // Mudar o form para modo de edição
  const form = document.getElementById('screen-create-event').querySelector('form');
  form.onsubmit = (e) => {
    e.preventDefault();
    
    // 🔒 Prevenir submissão dupla
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn.disabled) {
      dlog('⚠️ Submissão duplicada bloqueada');
      return;
    }
    
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.6';
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Guardando...';
    
    const title = document.getElementById('evt-title').value.trim();
    const date = document.getElementById('evt-date').value;
    const time = document.getElementById('evt-time').value;
    let deadline = document.getElementById('evt-deadline').value;
    const deadlineTime = document.getElementById('evt-deadline-time').value;
    
    // ✅ CRÍTICO: Se deadline estiver vazio, usar a data do evento
    if (!deadline || deadline.trim() === '') {
      deadline = date;
      dlog('⚠️ Deadline vazio, usando data do evento:', deadline);
    }
    
    // ✅ CRÍTICO: Combinar data + hora do deadline
    let deadlineWithTime = deadline;
    if (deadline && deadlineTime) {
      deadlineWithTime = `${deadline} ${deadlineTime}`;
    }
    
    const allowComp = document.getElementById('sw-companions').classList.contains('active');
    const allowGifts = document.getElementById('sw-gifts').classList.contains('active');
    const allowKids = document.getElementById('sw-kids').classList.contains('active');
    const allowSides = document.getElementById('sw-sides').classList.contains('active');
    const maxComp = parseInt(document.getElementById('evt-max-comp').value) || 2;
    const maxKids = parseInt(document.getElementById('evt-max-kids').value) || 2;

    // ✅ CRÍTICO: Definir side1Name e side2Name AQUI dentro do formulário
    const side1NameVal = document.getElementById('evt-side1-name').value.trim() || 'Grupo 1';
    const side2NameVal = document.getElementById('evt-side2-name').value.trim() || 'Grupo 2';
    
    // ✅ CRÍTICO: Definir coverImg AQUI dentro do formulário
    const coverImgEdit = document.getElementById('cover-img');
    const hasCoverEdit = coverImgEdit && !coverImgEdit.classList.contains('hidden');
    
    toast('Preparando alteracoes...');
    
    if (hasCoverEdit && coverImgEdit.src && coverImgEdit.src.includes('data:')) {
      // Nova imagem em base64 - fazer upload
      submitBtn.textContent = 'Enviando imagem...';
      
      uploadCoverImageToSupabase(coverImgEdit.src, ev.id).then(coverImageURL => {
        dlog('✅ URL da imagem recebida:', coverImageURL);
        toast('Imagem recebida, guardando alterações...');
        submitBtn.textContent = 'Guardando...';
        // ✅ CRÍTICO: Ler valores AQUI dentro do formulário
        const finalSide1Name = document.getElementById('evt-side1-name').value.trim() || 'Grupo 1';
        const finalSide2Name = document.getElementById('evt-side2-name').value.trim() || 'Grupo 2';
        saveEventWithUpdatedCover(ev.id, title, date, time, deadlineWithTime, coverImageURL, allowComp, maxComp, allowGifts, allowKids, maxKids, allowSides, finalSide1Name, finalSide2Name, document.getElementById('sw-show-time')?.classList.contains('active'), submitBtn, originalText);
      }).catch(error => {
        console.error('❌ ERRO upload imagem:', error);
        toast('Erro ao fazer upload da imagem. Guardando sem capa...');
        submitBtn.textContent = 'Guardando...';
        // ✅ CRÍTICO: Passar side1NameVal e side2NameVal AQUI
        saveEventWithUpdatedCover(ev.id, title, date, time, deadlineWithTime, null, allowComp, maxComp, allowGifts, allowKids, maxKids, allowSides, side1NameVal, side2NameVal, document.getElementById('sw-show-time')?.classList.contains('active'), submitBtn, originalText);
      });
    } else {
      // Usar imagem existente ou nenhuma
      const coverImageURL = coverImgEdit.src && coverImgEdit.src.startsWith('http') ? coverImgEdit.src : ev.cover_image;
      // ✅ CRÍTICO: Passar side1NameVal e side2NameVal AQUI
      saveEventWithUpdatedCover(ev.id, title, date, time, deadlineWithTime, coverImageURL, allowComp, maxComp, allowGifts, allowKids, maxKids, allowSides, side1NameVal, side2NameVal, document.getElementById('sw-show-time')?.classList.contains('active'), submitBtn, originalText);
    }
  };
  
  // ✅ CRÍTICO: Re-habilitar o botão (estava ficando desabilitado na segunda edição)
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = false;
  btn.style.opacity = '1';
  btn.textContent = 'Guardar Alterações';
  
  Router.go('create-event');
  if (typeof switchEventTab === 'function') switchEventTab('geral');
}


// ===================== DELETE EVENT =====================
function deleteEventModal() {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev) return;
  
  const confirmCount = (ev.confirmations || []).length;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-red-600 mb-2">Eliminar Evento?</h3>
      <p class="text-sm text-gray-600 mb-2">Evento: <strong>${ev.title}</strong></p>
      <p class="text-sm text-gray-600 mb-4">Confirmações: <strong>${confirmCount}</strong></p>
      
      <p class="text-xs text-red-600 font-semibold mb-4">Esta ação não pode ser desfeita. Todos os dados do evento serão permanentemente eliminados.</p>
      
      <div class="flex gap-2">
        <button class="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 px-4 font-semibold transition" onclick="confirmDeleteEvent(this.closest('.modal-overlay'))">
          Eliminar Evento
        </button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function confirmDeleteEvent(modal) {
  const eventIndex = Store.events.findIndex(e => e.id === Store.currentEventId);
  if (eventIndex !== -1) {
    const deletedEvent = Store.events[eventIndex];
    const eventId = deletedEvent.id;
    
    // ✅ Primeiro: Deletar RSVPS (confirmações) do evento
    supabaseRequest(`rsvps?event_id=eq.${eventId}`, 'DELETE', {}).then(() => {
      // ✅ Segundo: Deletar PRESENTES do evento
      supabaseRequest(`gifts?event_id=eq.${eventId}`, 'DELETE', {}).then(() => {
        // ✅ Terceiro: Deletar o EVENTO
        supabaseRequest(`events?id=eq.${eventId}`, 'DELETE', {}).then(() => {
          Store.events.splice(eventIndex, 1);
          modal.remove();
          toast(`Evento "${deletedEvent.title}" eliminado com sucesso!`);
          Router.go('dashboard');
        });
      });
    });
  }
}


// ===================== ADMIN EDIT EVENT URL =====================
function adminEditEventURL(eventId) {
  const event = Store.events.find(e => e.id === eventId);
  if (!event) return;

  const currentCode = event.eventCode || event.id;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Alterar URL do Evento</h3>
      <p class="text-sm text-gray-500 mb-3">Evento: <strong>${event.title}</strong></p>
      
      <div class="bg-blue-50 border-l-3 border-blue-500 p-3 rounded mb-4 text-xs text-blue-700">
        <p class="font-semibold mb-1">URL Atual:</p>
        <code id="event-url-display" class="block bg-white p-2 rounded border border-blue-200 break-all">${(window.location.origin + window.location.pathname).replace(/\/+$/, "") + "?event=" + currentCode}</code>
      </div>
      
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Novo Código do Evento</label>
          <input id="event-url-input" type="text" value="${currentCode}" class="input-field uppercase" placeholder="Ex: ABC123XYZ" maxlength="20">
          <p class="text-xs text-gray-400 mt-1">Apenas letras e números. Este código será usado na URL.</p>
        </div>
      </div>
      
      <div class="bg-amber-50 border-l-3 border-amber-500 p-3 rounded mb-4 text-xs text-amber-700">
        Aviso: Links antigos deixarão de funcionar após a alteração.
      </div>
      
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="adminSaveEventURL('${eventId}', this.closest('.modal-overlay'))">Guardar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('event-url-input').focus();
}

function adminSaveEventURL(eventId, modal) {
  const input = document.getElementById('event-url-input');
  const newCode = input.value.trim().toUpperCase();
  
  if (!newCode) {
    toast('Digite um código válido!');
    return;
  }

  // Validar: apenas letras e números
  if (!/^[A-Z0-9]+$/.test(newCode)) {
    toast('Use apenas letras (A-Z) e números (0-9)!');
    return;
  }

  // Verificar se o código já existe em outro evento
  const codeExists = Store.events.some(e => 
    e.id !== eventId && (e.eventCode === newCode || e.id === newCode)
  );

  if (codeExists) {
    toast('Este código já está em uso!');
    return;
  }

  const event = Store.events.find(e => e.id === eventId);
  if (!event) return;

  const oldCode = event.eventCode || event.id;
  event.eventCode = newCode;
  
  // ✅ Sincronizar com Supabase
  supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', { event_code: newCode });
  
  modal.remove();
  toast(`URL alterada de "${oldCode}" para "${newCode}"`);
}


// ===================== ADMIN DELETE EVENT =====================
function adminDeleteEvent(eventId, parentModal) {
  const event = Store.events.find(e => e.id === eventId);
  if (!event) return;

  const confirmModal = document.createElement('div');
  confirmModal.className = 'modal-overlay';
  confirmModal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-red-600 mb-2">Eliminar Evento?</h3>
      <p class="text-sm text-gray-600 mb-2">Evento: <strong>${event.title}</strong></p>
      <p class="text-sm text-gray-600 mb-4">Confirmações: <strong>${event.confirmations.length}</strong></p>
      
      <p class="text-xs text-red-600 font-semibold mb-4">Esta ação não pode ser desfeita. Todos os dados do evento serão permanentemente eliminados.</p>
      
      <div class="flex gap-2">
        <button class="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-2 px-4 font-semibold transition" onclick="confirmAdminDeleteEvent('${eventId}', this.closest('.modal-overlay'), document.querySelector('[data-parent-modal]'))">
          Eliminar Evento
        </button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  
  confirmModal.setAttribute('data-parent-modal', 'true');
  document.body.appendChild(confirmModal);
}

function confirmAdminDeleteEvent(eventId, confirmModal, parentModal) {
  const eventIndex = Store.events.findIndex(e => e.id === eventId);
  if (eventIndex !== -1) {
    const deletedEvent = Store.events[eventIndex];
    
    // ✅ Primeiro: Deletar RSVPS (confirmações) do evento
    supabaseRequest(`rsvps?event_id=eq.${eventId}`, 'DELETE', {}).then(() => {
      // ✅ Segundo: Deletar PRESENTES do evento
      supabaseRequest(`gifts?event_id=eq.${eventId}`, 'DELETE', {}).then(() => {
        // ✅ Terceiro: Deletar o EVENTO
        supabaseRequest(`events?id=eq.${eventId}`, 'DELETE', {}).then(() => {
          Store.events.splice(eventIndex, 1);
          confirmModal.remove();
          if (parentModal) parentModal.remove();
          toast(`Evento "${deletedEvent.title}" eliminado com sucesso!`);
          renderAdmin();
        });
      });
    });
  }
}


// ===================== SHOW USER EVENT OPTIONS =====================
function showUserEventOptions(userId) {
  const user = Store.users.find(u => u.id === userId);
  if (!user) return;

  const userEvents = Store.events.filter(e => e.userId === userId);
  
  if (userEvents.length === 0) {
    toast('Este utilizador não tem eventos.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  
  let content = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full mx-4 max-h-96 overflow-y-auto">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Gerir Eventos</h3>
      <p class="text-sm text-gray-500 mb-4">Utilizador: <strong>${user.phone}</strong></p>
      
      <div class="space-y-3">
  `;

  userEvents.forEach(event => {
    content += `
      <div class="bg-gray-50 rounded-lg p-4 border-l-4 border-teal-500">
        <div class="flex items-start justify-between gap-3 mb-2">
          <div class="flex-1 min-w-0">
            <h4 class="font-semibold text-gray-800 truncate">${event.title}</h4>
            <p class="text-xs text-gray-500">${formatDate(event.date)} às ${event.time}</p>
            <p class="text-xs text-gray-400 mt-1">ID: <code class="bg-white px-1 py-0.5 rounded">${event.id}</code></p>
          </div>
        </div>
        
        <div class="flex gap-2">
          <button class="flex-1 text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg py-1 px-2 font-semibold transition" onclick="adminEditEventURL('${event.id}')">
            Alterar URL
          </button>
          <button class="flex-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg py-1 px-2 font-semibold transition" onclick="adminDeleteEvent('${event.id}', this.closest('.modal-overlay'))">
            Eliminar
          </button>
        </div>
      </div>
    `;
  });

  content += `
      </div>
      <div class="flex gap-2 mt-4">
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
      </div>
    </div>
  `;

  modal.innerHTML = content;
  document.body.appendChild(modal);
}


// ===================== SEARCH =====================
async function searchEvent() {
  const query = document.getElementById('home-search').value.trim().toUpperCase();
  if (!query) return;
  
  dlog('🔍 Buscando evento com query:', query);
  
  try {
    // ✅ PASSO 1: Carregar eventos do Supabase COM JOIN para trazer RSVPS e GIFTS
    dlog('📥 Buscando evento DIRETO do Supabase...');
    
    const allEvents = await supabaseRequest(`events?select=id,title,date,time,confirm_by_date,cover_image,event_code,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,rsvp_enabled,allow_edit_rsvp,save_the_date_enabled,release_type,release_date,is_invite_released,std_title,std_subtitle,std_font_family,std_name_size,std_title_size,std_intro_enabled,std_intro_text,std_intro_photo_url,std_intro_photo_mobile_url,std_intro_photo_desktop_url,std_intro_on_invite,std_show_cover,std_cover_url,std_cover_mobile_url,std_cover_desktop_url,std_scratch_enabled,std_scratch_mode,std_scratch_photo_url,std_scratch_text,std_date_style,std_extra_phrase,std_extra_phrase_enabled,is_example_event,std_show_iban,personalized_links_enabled,show_rsvp_in_full_invite,show_guest_name_in_invite,allow_messages,show_guest_messages,rsvps(guest_name,attending,side,companions,kids,wants_gift,message,created_at,updated_at),gifts(id,name,category,reserved,reserved_by,quantity,image_url)`);
    
    dlog(' Total de eventos no Supabase:', allEvents?.length || 0);
    dlog('🔍 Query de busca (uppercase):', query);
    
    if (!allEvents || allEvents.length === 0) {
      dlog('❌ Nenhum evento encontrado no Supabase');
      Router.go('not-found');
      return;
    }
    
    // ✅ PASSO 2: Debug - mostrar TODOS os codes
    dlog('🔎 Debug - Primeiros 5 eventos:');
    allEvents.slice(0, 5).forEach((e, i) => {
      dlog(`  ${i}. ID: "${e.id}" | event_code: "${e.event_code}" | title: ${e.title}`);
    });
    
    // ✅ PASSO 3: Procurar com múltiplas estratégias
    let found = null;
    
    // Estratégia 1: Procurar por event_code EXATO
    dlog('🔍 Estratégia 1: Procurando por event_code EXATO...');
    found = allEvents.find(e => {
      if (!e.event_code) return false;
      const code = String(e.event_code).trim().toUpperCase();
      dlog(`  Comparando: "${code}" === "${query}"`);
      const match = code === query;
      if (match) dlog('  ✅ MATCH ENCONTRADO!');
      return match;
    });
    
    if (found) {
      dlog('✅ Sucesso na estratégia 1 (event_code):', found.title);
    } else {
      // Estratégia 2: Procurar por ID EXATO
      dlog('🔍 Estratégia 2: Procurando por ID EXATO...');
      found = allEvents.find(e => {
        if (!e.id) return false;
        const id = String(e.id).trim().toUpperCase();
        dlog(`  Comparando: "${id}" === "${query}"`);
        const match = id === query;
        if (match) dlog('  ✅ MATCH ENCONTRADO!');
        return match;
      });
      
      if (found) {
        dlog('✅ Sucesso na estratégia 2 (ID):', found.title);
      } else {
        // Estratégia 3: Procurar por TÍTULO (parcial)
        dlog('🔍 Estratégia 3: Procurando por TÍTULO...');
        found = allEvents.find(e => {
          if (!e.title) return false;
          const match = e.title.toUpperCase().includes(query);
          if (match) dlog('  ✅ MATCH ENCONTRADO:', e.title);
          return match;
        });
        
        if (found) {
          dlog('✅ Sucesso na estratégia 3 (título):', found.title);
        }
      }
    }
    
    if (!found) {
      dlog('❌ Evento não encontrado em nenhuma estratégia');
      Router.go('not-found');
      return;
    }
    
    dlog('✅✅ EVENTO ENCONTRADO:', found.title);
    
    // ✅ PASSO 4: Normalizar dados do Supabase
    const maxComp = found.max_companions !== null && found.max_companions !== undefined 
      ? parseInt(found.max_companions) 
      : 2;
    
    const maxKds = found.max_kids !== null && found.max_kids !== undefined 
      ? parseInt(found.max_kids) 
      : 2;
    
    let deadlineValue = found.confirm_by_date;
    if (deadlineValue) {
      deadlineValue = deadlineValue.trim();
    }
    if (!deadlineValue || deadlineValue === '') {
      deadlineValue = found.date;
    }
    
    const eventData = {
      id: found.id,
      title: found.title,
      date: found.date,
      time: found.time,
      deadline: deadlineValue,
      confirm_by_date: deadlineValue,
      eventCode: found.event_code || found.id,
      cover: found.cover_image || null,
      cover_image: found.cover_image,
      allowCompanions: String(found.allow_companions).toLowerCase() === 'yes',
      allow_companions: found.allow_companions,
      maxCompanions: maxComp,
      max_companions: maxComp,
      allowGifts: String(found.allow_gifts).toLowerCase() === 'yes',
      allow_gifts: found.allow_gifts,
      allowKids: String(found.allow_kids).toLowerCase() === 'yes',
      allow_kids: found.allow_kids,
      maxKids: maxKds,
      max_kids: maxKds,
      allowSides: String(found.allow_sides).toLowerCase() === 'yes',
      allow_sides: found.allow_sides,
      side1_name: found.side1_name,
      side2_name: found.side2_name,
      show_time: found.show_time,
      showTime: String(found.show_time).toLowerCase() === 'yes' || found.show_time === true,
      allow_messages: found.allow_messages,
      allowMessages: String(found.allow_messages).toLowerCase() === 'yes' || found.allow_messages === true,
      show_guest_messages: found.show_guest_messages,
      showGuestMessages: String(found.show_guest_messages).toLowerCase() === 'yes' || found.show_guest_messages === true,
      confirmations: (found.rsvps || []).map(rsvp => ({
        name: rsvp.guest_name,
        attending: rsvp.attending === true || rsvp.attending === 'yes',
        side: rsvp.side ?? null,
        companions: rsvp.companions ? rsvp.companions.split('|').filter(Boolean) : [],
        kids: rsvp.kids ? rsvp.kids.split('|').filter(Boolean) : [],
        wantsGift: rsvp.wants_gift === true || rsvp.wants_gift === 'yes',
        message: rsvp.message || ''
      })),
      gifts: (found.gifts || []).map(g => ({
        id: g.id,
        name: g.name,
        category: g.category || 'Sem categoria',
        reserved: g.reserved || false,
        reservedBy: g.reserved_by || null,
        quantity: g.quantity || 1,
        imageUrl: g.image_url || null
      }))
    };
    
    // Guardar evento do convidado em Store
    Store.currentEventId = found.id;
    Store.guestEventData = eventData;
    
    dlog('✅ Evento carregado e pronto para guest view');
    Router.go('guest');
    
  } catch (error) {
    console.error('❌ Erro ao buscar evento:', error);
    toast('Erro ao buscar evento. Tente novamente.');
    Router.go('not-found');
  }
}


// ===================== URL DETECTION =====================
// ✅ FUNÇÃO AUXILIAR: Limpar IDs com prefixo "id. "
function cleanId(id) {
  if (!id) return id;
  let str = String(id).trim();
  
  // ✅ CRÍTICO: Remover prefixo "id. " se existir
  if (str.startsWith('id. ')) {
    dlog('🧹 Limpando ID com prefixo "id. ":', str);
    str = str.replace(/^id\.\s*/, '').trim();
    dlog('   Resultado:', str);
  }
  
  return str.toUpperCase();
}

// ✅ FUNÇÃO CRÍTICA: Reparar dados corrompidos no Supabase
async function repairCorruptedData() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') {
    toast('Apenas admin pode reparar dados.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full mx-4 max-h-96 overflow-y-auto">
      <h3 class="text-lg font-bold text-gray-800 mb-3">Reparar Dados Corrompidos</h3>
      <p class="text-sm text-gray-600 mb-4">Esta função irá:</p>
      <ul class="text-sm text-gray-600 mb-4 list-disc list-inside space-y-1">
        <li>Limpar campos corrompidos (side1_name, side2_name com JSON ou objetos)</li>
        <li>Remover prefixo "id. " dos IDs de eventos</li>
        <li>Remover espaços extras em nomes e URLs</li>
        <li>Restaurar valores padrão quando necessário</li>
      </ul>
      
      <div class="bg-red-50 border-l-3 border-red-500 p-3 rounded mb-4 text-xs text-red-700">
        <strong>Aviso:</strong> Isto pode levar VÁRIOS MINUTOS. Não feche a página ou o navegador!
      </div>
      
      <div id="repair-status" class="mb-4 text-sm text-gray-600 hidden">
        <p class="font-semibold mb-2">Status da Reparação:</p>
        <p id="repair-log" class="text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded max-h-48 overflow-y-auto"></p>
      </div>
      
      <div class="flex gap-2">
        <button id="repair-btn" class="flex-1 btn-main" onclick="executeRepairCorruptedData(this.closest('.modal-overlay'))">Iniciar Reparação</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ✅ Executar reparação
async function executeRepairCorruptedData(modal) {
  const statusDiv = modal.querySelector('#repair-status');
  const logDiv = modal.querySelector('#repair-log');
  const btn = modal.querySelector('#repair-btn');
  
  btn.disabled = true;
  btn.textContent = 'Processando...';
  statusDiv.classList.remove('hidden');
  
  let log = [];
  let fixed = 0;
  let errors = 0;
  
  const addLog = (msg) => {
    dlog(msg);
    log.push(msg);
    logDiv.textContent = log.join('\n');
    logDiv.parentElement.parentElement.scrollTop = logDiv.parentElement.parentElement.scrollHeight;
  };
  
  try {
    addLog('🔍 Fase 1: Buscando TODOS os eventos...');
    
    // Carregar TODOS os eventos do Supabase (sem limite)
    const allEventsData = await supabaseRequest('events?select=*&limit=1000');
    
    if (!allEventsData || allEventsData.length === 0) {
      addLog('✅ Nenhum evento para reparar.');
      setTimeout(() => {
        modal.remove();
        toast('Nenhum evento para reparar.');
      }, 1000);
      return;
    }
    
    addLog(` Total de eventos encontrados: ${allEventsData.length}`);
    addLog('');
    
    // Analisar e reparar CADA evento
    for (let i = 0; i < allEventsData.length; i++) {
      const event = allEventsData[i];
      const eventId = event.id;
      const eventTitle = event.title || 'Sem título';
      
      addLog(`⏳ [${i + 1}/${allEventsData.length}] Analisando: "${eventTitle}"`);
      
      let needsUpdate = false;
      const updateData = {};
      
      // ✅ VERIFICAR 1: ID corrompido (começa com "id. ")
      if (eventId && String(eventId).trim().startsWith('id. ')) {
        addLog(`  ❌ ID CORROMPIDO: "${eventId}"`);
        
        const cleanedId = String(eventId).trim().replace(/^id\.\s*/, '').trim();
        if (cleanedId && cleanedId.length > 2) {
          addLog(`  ✅ Novo ID: "${cleanedId}"`);
          // ✅ CRÍTICO: Precisamos deletar o registo antigo e criar novo com ID correto
          // Por enquanto, apenas logar (não é possível alterar PK diretamente)
          addLog(`  ⚠️ ID é chave primária - requer migração manual no Supabase`);
          errors++;
        }
      }
      
      // ✅ VERIFICAR 2: side1_name com JSON ou objeto
      if (event.side1_name && typeof event.side1_name === 'string' && event.side1_name.startsWith('{')) {
        addLog(`  ❌ side1_name CORROMPIDO (JSON): ${event.side1_name.substring(0, 50)}...`);
        updateData.side1_name = 'Grupo 1';
        needsUpdate = true;
        fixed++;
        addLog(`  ✅ Restaurado para: "Grupo 1"`);
      }
      
      // ✅ VERIFICAR 3: side2_name com JSON ou objeto
      if (event.side2_name && typeof event.side2_name === 'string' && event.side2_name.startsWith('{')) {
        addLog(`  ❌ side2_name CORROMPIDO (JSON): ${event.side2_name.substring(0, 50)}...`);
        updateData.side2_name = 'Grupo 2';
        needsUpdate = true;
        fixed++;
        addLog(`  ✅ Restaurado para: "Grupo 2"`);
      }
      
      // ✅ VERIFICAR 4: cover_image com espaços extras ou "id. " no filename
      if (event.cover_image && event.cover_image.includes('event_id. ')) {
        addLog(`  ❌ cover_image com prefixo corrupto`);
        // Remover espaços extras do filename
        const cleanedUrl = event.cover_image.replace(/event_id\.\s*/g, 'event_').replace(/\s+/g, '');
        updateData.cover_image = cleanedUrl;
        needsUpdate = true;
        fixed++;
        addLog(`  ✅ URL limpo`);
      }
      
      // ✅ VERIFICAR 5: event_code inválido (começa com "id. ")
      if (event.event_code && String(event.event_code).trim().startsWith('id. ')) {
        addLog(`  ❌ event_code CORROMPIDO: "${event.event_code}"`);
        const cleanedCode = String(event.event_code).trim().replace(/^id\.\s*/, '').trim().toUpperCase();
        if (cleanedCode && cleanedCode.length > 2) {
          updateData.event_code = cleanedCode;
          needsUpdate = true;
          fixed++;
          addLog(`  ✅ Novo event_code: "${cleanedCode}"`);
        }
      }
      
      // ✅ Executar UPDATE se necessário
      if (needsUpdate) {
        try {
          addLog(`  📤 Salvando alterações no Supabase...`);
          
          const updateResult = await supabaseRequest(
            `events?id=eq.${eventId}`,
            'PATCH',
            updateData
          );
          
          if (updateResult) {
            addLog(`  ✅ EVENTO REPARADO com sucesso`);
          } else {
            addLog(`  ⚠️ Resposta vazia - possível sucesso`);
          }
        } catch (updateError) {
          addLog(`  ❌ ERRO ao salvar: ${updateError.message}`);
          errors++;
        }
      } else {
        addLog(`  ✅ Evento OK - nenhuma reparação necessária`);
      }
      
      addLog('');
      
      // Pausa entre requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    addLog('═════════════════════════════════════════');
    addLog('📊 RESUMO FINAL DA REPARAÇÃO:');
    addLog(`  ✅ Campos reparados: ${fixed}`);
    addLog(`  ❌ Erros encontrados: ${errors}`);
    addLog(`   Total de eventos processados: ${allEventsData.length}`);
    addLog('═════════════════════════════════════════');
    
    if (errors > 0) {
      addLog('');
      addLog('⚠️ NOTA: Alguns eventos têm IDs corrompidos (chave primária)');
      addLog('Será necessário reparação manual no Supabase ou migração de dados.');
    }
    
    addLog('');
    addLog('✅ Reparação concluída!');
    
    setTimeout(() => {
      modal.remove();
      toast(` Reparação concluída! ${fixed} campo(s) corrigido(s)`);
      if (errors > 0) {
        toast(` ${errors} problema(s) requer(em) atenção manual`);
      }
      renderAdmin();
    }, 2000);
    
  } catch (error) {
    addLog(`❌ ERRO CRÍTICO: ${error.message}`);
    setTimeout(() => {
      modal.remove();
      toast(' Erro durante reparação. Verifique a consola.');
    }, 2000);
  }
}

// ✅ FUNÇÃO AUXILIAR: Validar se código é válido (apenas letras e números, sem prefixo)
function isValidEventCode(code) {
  if (!code) return false;
  const str = String(code).trim();
  
  // ✅ CRÍTICO: NÃO pode ter prefixo "id. "
  if (str.startsWith('id.')) {
    dlog('  ❌ Código inválido (tem prefixo "id."):', str);
    return false;
  }
  
  // Deve ser apenas letras e números, comprimento mínimo 6
  const isValid = /^[A-Z0-9]{6,}$/.test(str);
  
  if (!isValid) {
    dlog('  ❌ Código inválido (não é alphanummérico ou muito curto):', str);
  }
  
  return isValid;
}

async function checkURLForEvent() {
  // Detectar parâmetro 'event' na URL
  // Funciona com: [seudominio.com]?event=CODIGO
  // ✅ NOVO: Suporta ?event=ABC&gifts=only para ir DIRETO para presentes
  const params = new URLSearchParams(window.location.search);
  let eventCode = params.get('event');
  const giftsOnly = params.get('gifts') === 'only';

  // ── Personalized guest link detection ───────────────────────────────
  // A personalized link looks like the base event code with a short suffix
  // appended (e.g. base "XY5EFFRA" + suffix "SSDOSAC" = "XY5EFFRASSDOSAC").
  // If this URL's code doesn't match an event directly, check whether it's
  // a base-code-plus-suffix combination registered in guest_links.
  Store._lockedGuestName = null;
  Store._guestLinkCode = null;
  if (eventCode) {
    const linkRow = await supabaseRequest(
      `guest_links?code=eq.${encodeURIComponent(eventCode)}&select=code,event_id,guest_name&limit=1`
    ).catch(() => []);
    if (linkRow && linkRow[0]) {
      Store._guestLinkCode = linkRow[0].code;
      Store._lockedGuestName = linkRow[0].guest_name;
      // Resolve the real event by its id (guest_links.event_id), not the
      // personalized code, since the events table doesn't know this suffix.
      const evByIdRows = await supabaseRequest(
        `events?id=eq.${linkRow[0].event_id}&select=event_code,id&limit=1`
      ).catch(() => []);
      if (evByIdRows && evByIdRows[0]) {
        eventCode = evByIdRows[0].event_code || evByIdRows[0].id;
      }

      // ── Security check: does THIS browser own this personalized link? ──
      // The ONLY place a claim is ever written is in rsvp.js, at the exact
      // moment a guest confirms their own attendance — never here. Opening
      // a personalized link must NEVER silently grant ownership to whoever
      // happens to open it first; that would defeat the entire purpose
      // (anyone the link gets forwarded to would just "become" the owner).
      // We only READ the claim here to decide whether to show the lock
      // screen later in guest.js — we never WRITE one.
    }
  }

  dlog('🔗 URL Detection iniciado. Event code:', eventCode, 'Gifts only:', giftsOnly);
  
  if (eventCode) {
    dlog('📍 Event code encontrado na URL:', eventCode);
    
    // ✅ PASSO 1: Buscar APENAS ESTE EVENTO específico do Supabase (NÃO todos!)
    // CRÍTICO: Usar query otimizada para evitar carregar todo o banco de dados
    dlog('📥 Buscando evento ESPECÍFICO do Supabase...');
    dlog('🔍 Procurando por event_code=', eventCode);
    
    // ✅ Query otimizada: procurar por event_code OU id, com LIMIT 1
    const _eventLookupQuery = `events?or=(event_code.eq.${eventCode},id.eq.${eventCode})&select=id,user_id,title,date,time,confirm_by_date,cover_image,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,rsvp_enabled,allow_edit_rsvp,save_the_date_enabled,release_type,release_date,is_invite_released,std_title,std_subtitle,std_font_family,std_name_size,std_title_size,std_intro_enabled,std_intro_text,std_intro_photo_url,std_intro_photo_mobile_url,std_intro_photo_desktop_url,std_intro_on_invite,std_show_cover,std_cover_url,std_cover_mobile_url,std_cover_desktop_url,std_scratch_enabled,std_scratch_mode,std_scratch_photo_url,std_scratch_text,std_date_style,std_extra_phrase,std_extra_phrase_enabled,is_example_event,std_show_iban,personalized_links_enabled,show_rsvp_in_full_invite,show_guest_name_in_invite,allow_messages,show_guest_messages,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,groom_name,bride_name,couple_size,show_couple,bg_url,bg_overlay,bible_text,bible_ref,show_bible,invite_text,show_invite,groom_parents,bride_parents,show_parents,gallery_urls,show_gallery,show_manual,manual_items,show_schedule,schedule_items,custom_font_family,section_order,story_text,invite_blessing,event_color,show_decor,decor_side_url,decor_ornament_url,decor_top_url,decor_top_position,decor_bottom_left_url,decor_bottom_right_url,rsvps(guest_name,attending,side,companions,kids,wants_gift,message,created_at,updated_at),gifts(id,name,category,reserved,reserved_by,quantity,image_url)&limit=1`;

    let eventsData = await supabaseRequest(_eventLookupQuery).catch(() => null);

    // ✅ NOVO: antes de assumir "não encontrado", tenta mais uma vez — uma
    // falha momentânea de rede ou um pico de tráfego no Supabase pode fazer
    // o PRIMEIRO pedido falhar mesmo que o evento exista. Em vez de mostrar
    // logo "Evento Não Encontrado" a um convidado real, espera um instante
    // e repete a mesma busca pelo código antes de desistir.
    if (!eventsData || eventsData.length === 0) {
      dlog('⚠️ Evento não encontrado à primeira — a tentar novamente em 700ms...');
      await new Promise(r => setTimeout(r, 700));
      eventsData = await supabaseRequest(_eventLookupQuery).catch(() => null);
    }
    
    dlog('📥 Resultado da busca:', eventsData?.length === 1 ? 'Encontrado' : 'Não encontrado');
    
    if (eventsData && eventsData.length > 0) {
      dlog('✅ Evento encontrado no Supabase!');
      const eventData = eventsData[0];
      dlog('🔖 STD — valores brutos recebidos da query principal:', {
        save_the_date_enabled: eventData.save_the_date_enabled,
        release_type: eventData.release_type,
        is_invite_released: eventData.is_invite_released,
        std_scratch_enabled: eventData.std_scratch_enabled,
        std_cover_url: eventData.std_cover_url,
        std_show_cover: eventData.std_show_cover,
      });

      // ── Evento exemplar: renovar datas automaticamente se necessário ──
      // Fire-and-forget — nunca bloqueia o carregamento da página do convidado.
      if (eventData.is_example_event === true && typeof _autoRenewExampleEventDates === 'function') {
        _autoRenewExampleEventDates(eventData).catch(() => {});
      }
      
      const maxComp = eventData.max_companions !== null && eventData.max_companions !== undefined 
        ? parseInt(eventData.max_companions) 
        : 2;
      
      const maxKds = eventData.max_kids !== null && eventData.max_kids !== undefined 
        ? parseInt(eventData.max_kids) 
        : 2;
      
      let deadlineValue = eventData.confirm_by_date;
      if (deadlineValue) {
        deadlineValue = deadlineValue.trim();
      }
      if (!deadlineValue || deadlineValue === '') {
        deadlineValue = eventData.date;
      }
      
      let finalEventCode = eventData.event_code || eventData.id;
      
      dlog('✅ Event code final:', finalEventCode);
      
      const normalizedEvent = {
        // ── CRÍTICO: herdar automaticamente TODOS os campos vindos da query ──
        // Isto existe porque, durante meses, este objecto era construído à
        // mão, campo a campo. Cada vez que uma nova funcionalidade adicionava
        // uma coluna nova (ex: std_cover_url, std_scratch_enabled, release_type,
        // rsvp_enabled, personalized_links_enabled...), ela tinha de ser
        // lembrada e adicionada aqui manualmente — e isso falhou repetidamente,
        // fazendo campos genuinamente gravados na BD desaparecerem em silêncio
        // só porque ninguém os tinha listado nesta construção. O spread abaixo
        // garante que QUALQUER coluna pedida na query SELECT chega sempre ao
        // convidado, sem excepção — só os campos que precisam mesmo de
        // transformação (strings 'yes'/'no' → boolean, renomes, defaults)
        // são explicitamente sobrepostos depois.
        ...eventData,

        id: eventData.id,
        userId: eventData.user_id,
        user_id: eventData.user_id,
        title: eventData.title,
        date: eventData.date,
        time: eventData.time,
        deadline: deadlineValue,
        confirm_by_date: deadlineValue,
        eventCode: finalEventCode,
        cover: eventData.cover_image || null,
        cover_image: eventData.cover_image,
        allowCompanions: String(eventData.allow_companions).toLowerCase() === 'yes',
        allow_companions: eventData.allow_companions,
        maxCompanions: maxComp,
        max_companions: maxComp,
        allowGifts: String(eventData.allow_gifts).toLowerCase() === 'yes',
        allow_gifts: eventData.allow_gifts,
        allowKids: String(eventData.allow_kids).toLowerCase() === 'yes',
        allow_kids: eventData.allow_kids,
        maxKids: maxKds,
        max_kids: maxKds,
        allowSides: String(eventData.allow_sides).toLowerCase() === 'yes',
        allow_sides: eventData.allow_sides,
        side1_name: eventData.side1_name,
        side2_name: eventData.side2_name,
        show_time: eventData.show_time,
        showTime: String(eventData.show_time).toLowerCase() === 'yes' || eventData.show_time === true,
        allow_messages: eventData.allow_messages,
        allowMessages: String(eventData.allow_messages).toLowerCase() === 'yes' || eventData.allow_messages === true,
        show_guest_messages: eventData.show_guest_messages,
        showGuestMessages: String(eventData.show_guest_messages).toLowerCase() === 'yes' || eventData.show_guest_messages === true,
        music_url: eventData.music_url || null,
        music_title: eventData.music_title || null,
        iban_message: eventData.iban_message || null,
        iban_number: eventData.iban_number || null,
        iban_holder: eventData.iban_holder || null,
        iban_footer: eventData.iban_footer || null,
        groom_name: eventData.groom_name || null,
        bride_name: eventData.bride_name || null,
        couple_size: eventData.couple_size || 2.4,
        show_couple: eventData.show_couple || null,
        bg_url: eventData.bg_url || null,
        bg_overlay: eventData.bg_overlay !== undefined ? eventData.bg_overlay : 35,
        bible_text: eventData.bible_text || null,
        bible_ref: eventData.bible_ref || null,
        show_bible: eventData.show_bible || null,
        invite_text: eventData.invite_text || null,
        show_invite: eventData.show_invite || null,
        groom_parents: eventData.groom_parents || null,
        bride_parents: eventData.bride_parents || null,
        show_parents: eventData.show_parents || null,
        gallery_urls: eventData.gallery_urls || null,
        show_gallery: eventData.show_gallery || null,
        show_manual: eventData.show_manual || null,
        manual_items: eventData.manual_items || null,
        show_schedule: eventData.show_schedule || null,
        schedule_items: eventData.schedule_items || null,
        custom_font_family: eventData.custom_font_family || null,
        section_order: eventData.section_order || null,
        event_color: eventData.event_color || null,
        story_text: eventData.story_text || null,
        invite_blessing: eventData.invite_blessing ?? '',
        confirmations: (eventData.rsvps || []).map(rsvp => ({
          name: rsvp.guest_name,
          attending: rsvp.attending === true || rsvp.attending === 'yes',
          side: rsvp.side ?? null,
          companions: rsvp.companions ? rsvp.companions.split('|').filter(Boolean) : [],
          kids: rsvp.kids ? rsvp.kids.split('|').filter(Boolean) : [],
          wantsGift: rsvp.wants_gift === true || rsvp.wants_gift === 'yes',
          message: rsvp.message || '',
          ownerReply: rsvp.owner_reply || '',
        })),
        gifts: (eventData.gifts || []).map(g => ({
          id: g.id,
          name: g.name,
          category: g.category || 'Sem categoria',
          reserved: g.reserved || false,
          reservedBy: g.reserved_by || null,
          quantity: g.quantity || 1,
          imageUrl: g.image_url || null
        }))
      };
      
      Store.currentEventId = eventData.id;
      Store.guestEventData = normalizedEvent;
      dlog('✅ Evento carregado do Supabase e pronto para guest view:', normalizedEvent.title);
      dlog('  Código final do evento:', finalEventCode);
      dlog('  Allow Sides:', normalizedEvent.allowSides);
      dlog('🔬 TRACE std_cover_url logo após normalizedEvent:', normalizedEvent.std_cover_url);
      if (giftsOnly && normalizedEvent.allowGifts) {
        return 'gifts';
      }
      return 'guest';
    }
    
    dlog('❌ Evento não encontrado no Supabase');
    return 'not-found';
  }
  return null;
}

// Mostrar modal para gerenciar compatibilidade de URLs antigos
function showLegacyURLManager() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') {
    toast('Apenas admin pode acessar isso.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full mx-4 max-h-96 overflow-y-auto">
      <h3 class="text-lg font-bold text-gray-800 mb-4">Gerenciar Compatibilidade de URLs Antigos</h3>
      <p class="text-sm text-gray-500 mb-4">Cole o link antigo para obter o código do evento. O sistema irá encontrar e vinculá-lo automaticamente.</p>
      
      <textarea id="legacy-url" class="input-field w-full h-20 mb-4 p-2" placeholder="Cole aqui o link antigo completo&#10;Ex: https://antigo-site.com/?event=ABC123" style="resize: vertical;"></textarea>
      
      <div class="flex gap-2 mb-4">
        <button class="flex-1 btn-main" onclick="extractLegacyEventCode()">Extrair Código</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
      
      <hr class="my-4">
      
      <h4 class="font-bold text-gray-700 mb-3">Eventos Atuais com Código Legado</h4>
      <div id="legacy-events-list" class="space-y-2 max-h-48 overflow-y-auto">
        ${Store.events.length === 0 
          ? '<p class="text-sm text-gray-400">Nenhum evento encontrado</p>'
          : Store.events.map(e => `
              <div class="bg-gray-50 rounded-lg p-3 flex items-center justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-sm text-gray-800 truncate">${e.title}</p>
                  <p class="text-xs text-gray-500">Código: <code class="bg-gray-200 px-1 py-0.5 rounded">${e.eventCode || e.id}</code></p>
                </div>
                <input type="text" class="w-24 input-field text-xs" value="${e.eventCode || e.id}" data-event-code="${e.id}" placeholder="Código">
              </div>
            `).join('')
        }
      </div>
      
      <div class="flex gap-2 mt-4">
        <button class="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-lg py-2 px-4 font-semibold transition" onclick="saveLegacyEventCodes()">Guardar Alterações</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function extractLegacyEventCode() {
  const urlText = document.getElementById('legacy-url').value.trim();
  if (!urlText) {
    toast('Cole um URL!');
    return;
  }

  // Tentar extrair código da URL
  // Formatos possíveis: ?event=ABC123, /event/ABC123, #event=ABC123
  let code = null;
  
  const patterns = [
    /[\?&]event=([A-Za-z0-9]+)/,  // ?event=ABC123
    /\/event\/([A-Za-z0-9]+)/,    // /event/ABC123
    /#event=([A-Za-z0-9]+)/,      // #event=ABC123
    /event[=\/]([A-Za-z0-9]+)/    // Fallback genérico
  ];

  for (let pattern of patterns) {
    const match = urlText.match(pattern);
    if (match) {
      code = match[1];
      break;
    }
  }

  if (!code) {
    toast('Não foi possível extrair o código da URL. Formato: ?event=ABC123');
    return;
  }

  // Procurar evento com esse código legado
  const found = Store.events.find(e => 
    e.eventCode === code || e.id === code
  );

  if (found) {
    toast('Evento encontrado: ' + found.title);
  } else {
    toast('Nenhum evento encontrado com o código: ' + code);
  }

  document.getElementById('legacy-url').value = code;
}

function saveLegacyEventCodes() {
  // Recolher todos os inputs com data-event-code
  const inputs = document.querySelectorAll('[data-event-code]');
  let saved = 0;

  inputs.forEach(input => {
    const eventId = input.getAttribute('data-event-code');
    const newCode = input.value.trim();
    const event = Store.events.find(e => e.id === eventId);

    if (event && newCode) {
      event.eventCode = newCode;
      saved++;
    }
  });

  document.querySelector('.modal-overlay').remove();
  toast(`${saved} evento(s) atualizado(s)!`);
}

// ✅ NOVA FUNÇÃO: Limpar todos os event_codes inválidos (com prefixo "id. ")
async function cleanupEventCodes() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') {
    toast('Apenas admin pode fazer isso.');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-3">Limpar Códigos Inválidos</h3>
      <p class="text-sm text-gray-600 mb-4">Esta função irá encontrar e corrigir TODOS os event_codes inválidos (aqueles com prefixo "id. " ou mal formatados).</p>
      
      <div class="bg-amber-50 border-l-3 border-amber-500 p-3 rounded mb-4 text-xs text-amber-700">
         Isto pode levar alguns segundos. Não feche a página durante o processo.
      </div>
      
      <div id="cleanup-status" class="mb-4 text-sm text-gray-600 hidden">
        <p class="font-semibold mb-2">Status:</p>
        <p id="cleanup-log" class="text-xs text-gray-500 font-mono bg-gray-100 p-2 rounded max-h-32 overflow-y-auto"></p>
      </div>
      
      <div class="flex gap-2">
        <button id="cleanup-btn" class="flex-1 btn-main" onclick="executeCleanupEventCodes(this.closest('.modal-overlay'))">Iniciar Limpeza</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// ✅ Função que executa a limpeza
async function executeCleanupEventCodes(modal) {
  const statusDiv = modal.querySelector('#cleanup-status');
  const logDiv = modal.querySelector('#cleanup-log');
  const btn = modal.querySelector('#cleanup-btn');
  
  btn.disabled = true;
  btn.textContent = 'Processando...';
  statusDiv.classList.remove('hidden');
  
  let log = [];
  let fixed = 0;
  let skipped = 0;
  
  const addLog = (msg) => {
    dlog(msg);
    log.push(msg);
    logDiv.textContent = log.join('\n');
    logDiv.parentElement.scrollTop = logDiv.parentElement.scrollHeight;
  };
  
  try {
    addLog('🔍 Buscando todos os eventos no Supabase...');
    
    // ✅ Carregar TODOS os eventos do Supabase
    const allEventsData = await supabaseRequest('events?select=id,title,event_code');
    
    if (!allEventsData || allEventsData.length === 0) {
      addLog('✅ Nenhum evento encontrado.');
      setTimeout(() => {
        modal.remove();
        toast('Nenhum evento para limpar.');
      }, 2000);
      return;
    }
    
    addLog(` Total de eventos encontrados: ${allEventsData.length}`);
    
    // ✅ Analisar cada evento
    for (let i = 0; i < allEventsData.length; i++) {
      const event = allEventsData[i];
      const currentCode = event.event_code;
      
      // Limpar o código (remover prefixo "id. ")
      const cleanCode = cleanId(currentCode);
      
      // Verificar se é válido
      const isValid = isValidEventCode(cleanCode);
      
      if (!isValid) {
        addLog(`❌ Evento "${event.title}": código inválido "${currentCode}"`);
        
        // Gerar novo código válido
        const newCode = generateValidEventCode();
        addLog(`   → Gerando novo código: ${newCode}`);
        
        // Atualizar no Supabase
        const updateResult = await supabaseRequest(
          `events?id=eq.${event.id}`,
          'PATCH',
          { event_code: newCode }
        );
        
        if (updateResult) {
          addLog(`   ✅ Atualizado no Supabase`);
          fixed++;
          
          // Atualizar também no Store local
          const storeEvent = Store.events.find(e => e.id === event.id);
          if (storeEvent) {
            storeEvent.eventCode = newCode;
          }
        } else {
          addLog(`   ❌ Erro ao atualizar`);
        }
      } else {
        addLog(`✅ Evento "${event.title}": código válido "${cleanCode}"`);
        skipped++;
      }
      
      // Pequena pausa entre requests para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    addLog('');
    addLog(`📊 RESUMO:`);
    addLog(`   Corrigidos: ${fixed}`);
    addLog(`   Válidos: ${skipped}`);
    addLog(`   Total: ${fixed + skipped}`);
    addLog('');
    addLog('✅ Limpeza concluída com sucesso!');
    
    setTimeout(() => {
      modal.remove();
      if (fixed > 0) {
        toast(` ${fixed} evento(s) foi/foram corrigido(s)!`);
        renderAdmin();
      } else {
        toast(' Todos os códigos estão válidos!');
      }
    }, 2000);
    
  } catch (error) {
    addLog(`❌ Erro durante limpeza: ${error.message}`);
    setTimeout(() => {
      modal.remove();
      toast(' Erro ao limpar códigos. Verifique a consola.');
    }, 2000);
  }
}


// ===================== CLIENT INTAKE FORM =====================
// Admin sends a link: ?intake=EVENT_ID
// Client fills in their info, it patches the event in Supabase

async function checkForIntakeMode() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('intake_token');
  const directId = params.get('intake');

  if (token) {
    // Validate token — check expiry and lock status
    const rows = await supabaseRequest(
      `intake_tokens?token=eq.${token}&select=event_id,used,locked,expires_at,use_count&limit=1`
    );
    const tkn = rows && rows[0];

    if (!tkn) {
      _showIntakeError('Link inválido', 'Este link não existe. Verifica com o teu organizador.');
      return true;
    }
    if (tkn.locked) {
      _showIntakeError('Link desactivado', 'Este link foi desactivado pelo administrador. Contacta o organizador para o reactivar.');
      return true;
    }
    if (tkn.expires_at && new Date(tkn.expires_at) < new Date()) {
      _showIntakeError('Link expirado', 'Este link expirou. O administrador pode reactivá-lo se necessário.');
      return true;
    }

    Store._intakeToken = token;
    Store._intakeEventId = tkn.event_id;
    openIntakeForm(tkn.event_id);
    return true;
  }

  if (directId) {
    Store._intakeEventId = directId;
    openIntakeForm(directId);
    return true;
  }

  return false;
}

function _showIntakeError(title, msg) {
  const d = document.createElement('div');
  d.style.cssText = 'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem;text-align:center;background:#f8fafc;font-family:Quicksand,sans-serif';
  d.innerHTML = `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:1rem"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    <h2 style="font-size:1.3rem;font-weight:800;color:#1e293b;margin-bottom:0.5rem">${title}</h2>
    <p style="color:#6b7280;max-width:380px">${msg}</p>`;
  document.body.innerHTML = '';
  document.body.appendChild(d);
}

async function openIntakeForm(eventId) {
  const result = await supabaseRequest(`events?id=eq.${eventId}&select=id,title,date&limit=1`);
  const ev = result && result[0] ? result[0] : {};

  // Store eventId for the continue button
  window._intakeEventId = eventId;

  const privacyPrompt = document.createElement('div');
  privacyPrompt.id = 'intake-privacy-prompt';
  privacyPrompt.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.7);z-index:9998;display:flex;align-items:center;justify-content:center;padding:1rem';

  const inner = document.createElement('div');
  inner.style.cssText = 'background:#fff;border-radius:1.25rem;padding:2rem 1.75rem;max-width:420px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.2)';

  inner.innerHTML = [
    '<div style="display:flex;justify-content:center;margin-bottom:0.75rem">',
    '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#007f9f" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">',
    '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>',
    '<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
    '</svg></div>',
    '<h2 style="font-size:1.2rem;font-weight:800;color:#1e293b;margin-bottom:0.5rem">Antes de começar</h2>',
    '<p style="color:#6b7280;font-size:0.9rem;line-height:1.6;margin-bottom:1.5rem">Este formulário é exclusivo para o preenchimento dos dados do seu evento. A informação que partilha connosco é tratada com total confidencialidade.</p>',
    '<div style="display:flex;flex-direction:column;gap:0.6rem;margin-bottom:1.5rem">',
    '<button id="btn-read-privacy" style="display:flex;align-items:center;gap:0.6rem;background:#f0f9fb;color:#007f9f;font-weight:700;padding:0.75rem;border-radius:0.75rem;border:1.5px solid rgba(0,127,159,0.2);cursor:pointer;width:100%;font-family:inherit;font-size:0.9rem">',
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
    'Política de Privacidade</button>',
    '<button id="btn-read-terms" style="display:flex;align-items:center;gap:0.6rem;background:#f0f9fb;color:#007f9f;font-weight:700;padding:0.75rem;border-radius:0.75rem;border:1.5px solid rgba(0,127,159,0.2);cursor:pointer;width:100%;font-family:inherit;font-size:0.9rem">',
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>',
    'Termos de Uso</button>',
    '</div>',
    '<button id="btn-intake-accept" style="background:#007f9f;color:#fff;border:none;border-radius:999px;padding:0.85rem 2rem;font-weight:800;font-size:1rem;cursor:pointer;width:100%;font-family:inherit">Aceito — Continuar</button>',
    '<p style="font-size:0.72rem;color:#9ca3af;margin-top:0.75rem">Ao clicar em "Aceito", confirmas que leste e concordas com os nossos termos.</p>',
  ].join('');

  privacyPrompt.appendChild(inner);
  document.body.appendChild(privacyPrompt);

  // Wire up buttons after appending
  document.getElementById('btn-read-privacy').onclick = () => showPrivacyModal();
  document.getElementById('btn-read-terms').onclick   = () => showTermsModal();
  document.getElementById('btn-intake-accept').onclick = () => {
    privacyPrompt.remove();
    openIntakeFormMain(eventId);
  };
}

async function openIntakeFormMain(eventId) {
  // CRITICAL: set currentEventId so Manual/Schedule editors can save directly to Supabase
  Store.currentEventId = eventId;

  // Load full event data including visuals to pre-fill existing values
  // Select ALL relevant fields from events table as fallback (in case event_visuals row is incomplete)
  const result = await supabaseRequest(
    `events?id=eq.${eventId}&select=id,title,date,time,confirm_by_date,cover_image,groom_name,bride_name,music_url,iban_number,iban_holder,bible_text,bible_ref,groom_parents,bride_parents,gallery_urls,invite_text,story_text,schedule_items,show_schedule&limit=1`
  );
  const evBase = (result && result[0]) ? result[0] : {};
  const visuals = await loadEventVisuals(eventId).catch(() => ({}));
  const venues  = await loadEventVenues(eventId).catch(() => ({}));
  // Merge carefully — never overwrite a real value with null
  const ev = { ...evBase };
  // Apply visuals: only set if value is not null/undefined
  Object.keys(visuals).forEach(k => {
    if (k !== 'event_id' && k !== 'updated_at' && visuals[k] !== null && visuals[k] !== undefined) ev[k] = visuals[k];
  });
  Object.keys(venues).forEach(k => {
    if (k !== 'event_id' && k !== 'updated_at' && venues[k] !== null && venues[k] !== undefined) ev[k] = venues[k];
  });
  // cover_image always from events table
  ev.cover_image = evBase.cover_image || null;

  const modal = document.createElement('div');
  modal.id = 'intake-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:#f8fafc;z-index:9999;overflow-y:auto;padding:2rem 1rem';
  modal.innerHTML = `
    <div style="max-width:560px;margin:0 auto">
      <div style="text-align:center;margin-bottom:2rem">
        <div style="font-size:1.5rem;font-weight:900;color:#007f9f">Invites Web-Convites</div>
        <h1 style="font-size:1.2rem;font-weight:700;color:#1e293b;margin-top:0.5rem">Preencha os detalhes do seu evento</h1>
        ${ev.title ? `<p style="color:#6b7280;font-size:0.88rem">Evento: <strong>${escapeHTML(ev.title)}</strong></p>` : ''}
      </div>
      <div style="background:#fff;border-radius:1.25rem;padding:1.75rem;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <form id="intake-form" style="display:flex;flex-direction:column;gap:1.25rem">

          <!-- FOTO DE CAPA -->
          <div>
            <label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.5rem">Foto de Capa do Convite</label>
            <div id="int-cover-area" onclick="document.getElementById('int-cover-file').click()" style="border:2px dashed #cbd5e1;border-radius:0.75rem;padding:1.5rem;text-align:center;cursor:pointer;background:#f8fafc;transition:border-color 0.2s" onmouseover="this.style.borderColor='#007f9f'" onmouseout="this.style.borderColor='#cbd5e1'">
              <div id="int-cover-preview-wrap" style="display:none;margin-bottom:0.5rem">
                <img id="int-cover-preview" style="max-height:140px;border-radius:0.5rem;object-fit:cover;width:100%">
              </div>
              <div id="int-cover-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 0.5rem"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <p style="color:#64748b;font-size:0.85rem;font-weight:600">Clica para escolher a foto de capa</p>
                <p style="color:#94a3b8;font-size:0.75rem">JPG ou PNG · Máx. 5 MB</p>
              </div>
            </div>
            <input type="file" id="int-cover-file" accept="image/jpeg,image/png,image/jpg" style="display:none" onchange="intakePreviewCover(this)">
            <input type="hidden" id="int-cover-url">
          </div>

          <!-- GALERIA (máx. 8 fotos) -->
          <div>
            <label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.25rem">Galeria de Fotos <span style="font-weight:400;color:#6b7280">(máx. 8 fotos)</span></label>
            <p style="font-size:0.75rem;color:#94a3b8;margin-bottom:0.5rem">Selecciona até 4 fotos para mostrar no convite.</p>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;margin-bottom:0.5rem" id="int-gallery-grid">
              ${[0,1,2,3,4,5,6,7].map(i => `
                <div id="int-gal-slot-${i}" onclick="document.getElementById('int-gal-file-${i}').click()" style="aspect-ratio:1;border:2px dashed #cbd5e1;border-radius:0.6rem;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#f8fafc;overflow:hidden;position:relative" onmouseover="this.style.borderColor='#007f9f'" onmouseout="this.style.borderColor=(document.getElementById('int-gal-preview-${i}').style.display?'#007f9f':'#cbd5e1')">
                  <img id="int-gal-preview-${i}" style="display:none;width:100%;height:100%;object-fit:cover;position:absolute;inset:0">
                  <svg id="int-gal-icon-${i}" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <button type="button" id="int-gal-remove-${i}" onclick="event.stopPropagation(); intakeRemoveGalleryPhoto(${i})" style="display:none;position:absolute;top:2px;right:2px;background:rgba(239,68,68,0.9);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;z-index:2;line-height:1;align-items:center;justify-content:center">×</button>
                </div>
                <input type="file" id="int-gal-file-${i}" accept="image/jpeg,image/png,image/jpg" style="display:none" onchange="intakePreviewGallery(this,${i})">`).join('')}
            </div>
            <input type="hidden" id="int-gallery-urls">
          </div>

          <div><label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.4rem">Nome do Noivo</label>
          <input class="input-field" id="int-groom" placeholder="Nome completo do noivo"></div>

          <div><label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.4rem">Nome da Noiva</label>
          <input class="input-field" id="int-bride" placeholder="Nome completo da noiva"></div>

          <div><label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.4rem">Versículo Bíblico <span style="font-weight:400;color:#6b7280">(opcional)</span></label>
          <textarea class="input-field" id="int-bible" rows="3" placeholder="Ex: O amor é paciente, o amor é bondoso..."></textarea>
          <input class="input-field" id="int-bibleref" placeholder="Referência (ex: 1 Coríntios 13:4)" style="margin-top:0.5rem"></div>

          <div><label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.4rem">Pais do Noivo <span style="font-weight:400;color:#6b7280">(um por linha)</span></label>
          <textarea class="input-field" id="int-groom-parents" rows="2" placeholder="Pai do Noivo&#10;Mãe do Noivo (em memória)"></textarea></div>

          <div><label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.4rem">Pais da Noiva <span style="font-weight:400;color:#6b7280">(um por linha)</span></label>
          <textarea class="input-field" id="int-bride-parents" rows="2" placeholder="Pai da Noiva&#10;Mãe da Noiva"></textarea></div>

          <div><label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.4rem">Data do Casamento</label>
          <input class="input-field" id="int-date" type="date"></div>

          <div><label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.4rem">Hora</label>
          <input class="input-field" id="int-time" type="time"></div>

          <div style="border:1.5px solid #e5e7eb;border-radius:0.75rem;padding:1rem;background:#fafafa">
            <p style="font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.75rem">Locais das Cerimónias <span style="font-weight:400;color:#6b7280">(preenche apenas os que se aplicam)</span></p>
            <label style="font-size:0.75rem;font-weight:600;color:#6b7280;display:block;margin-bottom:0.25rem">Cerimónia Civil</label>
            <input class="input-field" id="int-civil-loc" placeholder="Local" style="margin-bottom:0.5rem">
            <input class="input-field" id="int-civil-time" type="time" style="margin-bottom:0.75rem">
            <label style="font-size:0.75rem;font-weight:600;color:#6b7280;display:block;margin-bottom:0.25rem">Cerimónia Religiosa</label>
            <input class="input-field" id="int-relig-loc" placeholder="Local" style="margin-bottom:0.5rem">
            <input class="input-field" id="int-relig-time" type="time" style="margin-bottom:0.75rem">
            <label style="font-size:0.75rem;font-weight:600;color:#6b7280;display:block;margin-bottom:0.25rem">Copo d'Água</label>
            <input class="input-field" id="int-copa-loc" placeholder="Local" style="margin-bottom:0.5rem">
            <input class="input-field" id="int-copa-time" type="time">
          </div>

          <div><label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.4rem">Música desejada <span style="font-weight:400;color:#6b7280">(link YouTube ou nome)</span></label>
          <input class="input-field" id="int-music" placeholder="Ex: https://youtu.be/... ou nome da música"></div>

          <div><label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.4rem">Data limite para confirmação de presença</label>
          <input class="input-field" id="int-deadline" type="date"></div>

          <div><label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.4rem">Mensagem dos Noivos <span style="font-weight:400;color:#6b7280">(opcional)</span></label>
          <textarea class="input-field" id="int-couplemsg" rows="3" placeholder="Uma mensagem especial para os vossos convidados..."></textarea></div>

          <div><label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.4rem">Dress Code <span style="font-weight:400;color:#6b7280">(opcional)</span></label>
          <input class="input-field" id="int-dresscode" placeholder="Ex: Traje social ou Roupa a rigor" style="margin-bottom:0.5rem">
          <textarea class="input-field" id="int-dresscode-detail" rows="2" placeholder="Detalhe adicional (opcional)"></textarea></div>

          <div style="border:1.5px solid #e5e7eb;border-radius:0.75rem;padding:1rem;background:#fafafa">
            <p style="font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.25rem">Manual do Bom Convidado <span style="font-weight:400;color:#6b7280">(opcional)</span></p>
            <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:0.6rem">Os itens por omissão já são partilhados com todos os convidados. Podes personalizar para o teu evento.</p>
            <button type="button" onclick="openManualEditor()" style="background:#007f9f;color:#fff;border:none;border-radius:0.6rem;padding:0.6rem 1rem;font-size:0.82rem;font-weight:700;cursor:pointer">Editar Manual do Bom Convidado</button>
          </div>

          <div style="border:1.5px solid #e5e7eb;border-radius:0.75rem;padding:1rem;background:#fafafa">
            <p style="font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.25rem">Monograma do Dia <span style="font-weight:400;color:#6b7280">(opcional)</span></p>
            <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:0.6rem">Define os momentos especiais do teu grande dia.</p>
            <button type="button" onclick="openScheduleEditor(true)" style="background:#007f9f;color:#fff;border:none;border-radius:0.6rem;padding:0.6rem 1rem;font-size:0.82rem;font-weight:700;cursor:pointer">Editar Monograma</button>
          </div>


          <div style="border:1.5px solid #e5e7eb;border-radius:0.75rem;padding:1rem;background:#fafafa">
            <label style="display:block;font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.6rem">IBAN para presente <span style="font-weight:400;color:#6b7280">(opcional)</span></label>
            <input class="input-field" id="int-iban" placeholder="Ex: AO06 0040 0000..." style="margin-bottom:0.5rem">
            <input class="input-field" id="int-iban-holder" placeholder="Titular da conta">
          </div>

          <div id="int-upload-progress" style="display:none;text-align:center;color:#007f9f;font-weight:600;font-size:0.9rem;padding:0.5rem">
            A carregar imagens... aguarde.
          </div>

          <button type="submit" id="int-submit-btn" style="background:#007f9f;color:#fff;border:none;border-radius:999px;padding:1rem;font-weight:800;font-size:1rem;cursor:pointer">
            Enviar Informações
          </button>
        </form>
        <div id="intake-success" style="display:none;text-align:center;padding:3rem 2rem">
          <div style="margin-bottom:1rem"><svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
          <h2 style="font-size:1.3rem;font-weight:800;color:#1e293b;margin-bottom:0.5rem">Informações enviadas!</h2>
          <p style="color:#6b7280;font-size:0.9rem">O organizador irá completar os restantes detalhes.<br>Obrigado!</p>
        </div>
      </div>
      <p style="text-align:center;font-size:0.72rem;color:#9ca3af;margin-top:1.5rem">
        <button onclick="showPrivacyModal()" style="background:none;border:none;color:#007f9f;cursor:pointer;font-size:0.72rem;padding:0;font-family:inherit">Política de Privacidade</button>
        &nbsp;·&nbsp;
        <button onclick="showTermsModal()" style="background:none;border:none;color:#007f9f;cursor:pointer;font-size:0.72rem;padding:0;font-family:inherit">Termos de Uso</button>
      </p>
    </div>`;
  document.body.appendChild(modal);

  // ── Pre-fill fields with existing event data ──
  const _pf = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  _pf('int-groom',         ev.groom_name);
  _pf('int-bride',         ev.bride_name);
  _pf('int-bible',         ev.bible_text);
  _pf('int-bibleref',      ev.bible_ref);
  _pf('int-groom-parents', ev.groom_parents);
  _pf('int-bride-parents', ev.bride_parents);
  _pf('int-date',          ev.date ? String(ev.date).split('T')[0] : '');
  _pf('int-time',          ev.time ? String(ev.time).substring(0,5) : '');
  _pf('int-deadline',      ev.confirm_by_date ? String(ev.confirm_by_date).split(/[T ]/)[0] : '');
  _pf('int-music',         ev.music_url);
  _pf('int-iban',          ev.iban_number);
  _pf('int-iban-holder',   ev.iban_holder);
  _pf('int-civil-loc',     ev.venue_civil);
  _pf('int-civil-time',    ev.venue_civil_time);
  _pf('int-relig-loc',     ev.venue_ceremony);
  _pf('int-relig-time',    ev.venue_ceremony_time);
  _pf('int-copa-loc',      ev.venue_reception);
  _pf('int-copa-time',     ev.venue_reception_time);
  _pf('int-couplemsg',         ev.couplemsg_text);
  _pf('int-dresscode',         ev.dresscode_text);
  _pf('int-dresscode-detail',  ev.dresscode_detail);

  // ── Load existing manual/schedule items into Store so editors show current data ──
  Store.eventManualItems   = ev.manual_items   ? (() => { try { return JSON.parse(ev.manual_items); } catch(e) { return null; } })() : null;
  Store.eventScheduleItems = ev.schedule_items ? (() => { try { return JSON.parse(ev.schedule_items); } catch(e) { return null; } })() : null;

  // ── Pre-fill gallery with existing photos ──
  if (ev.gallery_urls) {
    const existingUrls = ev.gallery_urls.split('\n').map(u => u.trim()).filter(Boolean);
    existingUrls.slice(0, 8).forEach((url, i) => {
      const preview = document.getElementById(`int-gal-preview-${i}`);
      const icon = document.getElementById(`int-gal-icon-${i}`);
      const removeBtn = document.getElementById(`int-gal-remove-${i}`);
      if (preview) {
        preview.src = url;
        preview.style.display = 'block';
        preview.dataset.existingUrl = url;
      }
      if (icon) icon.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'flex';
    });
    // Store existing URLs so they're preserved if user doesn't change that slot
    window._intakeExistingGalleryUrls = existingUrls;
  }


  // ── Pre-fill existing cover photo ──
  const existingCover = ev.cover_image || null;
  if (existingCover) {
    const prevWrap = document.getElementById('int-cover-preview-wrap');
    const prevImg  = document.getElementById('int-cover-preview');
    const placeholder = document.getElementById('int-cover-placeholder');
    const coverUrl = document.getElementById('int-cover-url');
    if (prevImg) { prevImg.src = existingCover; }
    if (prevWrap) prevWrap.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    if (coverUrl) coverUrl.value = existingCover;
    // Add delete button
    const coverArea = document.getElementById('int-cover-area');
    if (coverArea) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.style.cssText = 'display:block;width:100%;margin-top:0.4rem;background:#fee2e2;color:#991b1b;border:none;border-radius:0.5rem;padding:0.4rem;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit';
      delBtn.textContent = 'Remover foto de capa';
      delBtn.onclick = () => {
        if (prevImg) prevImg.src = '';
        if (prevWrap) prevWrap.style.display = 'none';
        if (placeholder) placeholder.style.display = '';
        if (coverUrl) coverUrl.value = '__DELETE__';
        delBtn.remove();
      };
      coverArea.after(delBtn);
    }
  }

  // ── Pre-fill existing gallery photos ──
  const galleryStr = ev.gallery_urls || '';
  const existingGallery = galleryStr.split('|').filter(u => u && u.trim() !== '' && u !== '__DELETE__');
  dlog('[Intake] gallery_urls:', galleryStr, '→', existingGallery);
  existingGallery.slice(0, 4).forEach((url, i) => {
    const prev = document.getElementById(`int-gal-preview-${i}`);
    const icon = document.getElementById(`int-gal-icon-${i}`);
    const slot = document.getElementById(`int-gal-slot-${i}`);
    if (!slot) return;

    // Hidden input to track existing URL
    const urlInput = document.createElement('input');
    urlInput.type = 'hidden';
    urlInput.id = `int-gal-existing-${i}`;
    urlInput.value = url;
    slot.appendChild(urlInput);

    // Show preview
    if (prev) {
      prev.src = url;
      prev.style.display = 'block';
      prev.onerror = () => {
        // URL broken — treat as no image
        prev.style.display = 'none';
        if (icon) icon.style.display = '';
        urlInput.value = '__DELETE__';
      };
    }
    if (icon) icon.style.display = 'none';

    // Delete button
    slot.style.position = 'relative';
    const xBtn = document.createElement('button');
    xBtn.type = 'button';
    xBtn.style.cssText = 'position:absolute;top:3px;right:3px;background:rgba(239,68,68,0.9);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;line-height:1;font-family:inherit';
    xBtn.textContent = '×';
    xBtn.onclick = (e) => {
      e.stopPropagation();
      if (prev) { prev.src = ''; prev.style.display = 'none'; }
      if (icon) icon.style.display = '';
      urlInput.value = '__DELETE__';
      xBtn.remove();
    };
    slot.appendChild(xBtn);
  });

  // ── Auto-save intake form to sessionStorage (persist on tab close/reopen) ──
  const _intakeKey = `intake_draft_${eventId}`;
  const _savedDraft = sessionStorage.getItem(_intakeKey);
  if (_savedDraft) {
    try {
      const draft = JSON.parse(_savedDraft);
      Object.keys(draft).forEach(id => {
        const el = document.getElementById(id);
        if (el && el.tagName !== 'INPUT' || (el && el.type !== 'file')) {
          el.value = draft[id];
        }
      });
      toast('Rascunho restaurado!');
    } catch(e) {}
  }

  // Auto-save on any input change
  const _intakeFields = ['int-groom','int-bride','int-bible','int-bibleref','int-groom-parents','int-bride-parents','int-invite','int-date','int-time','int-deadline','int-music','int-iban','int-iban-holder','int-civil-loc','int-civil-time','int-relig-loc','int-relig-time','int-copa-loc','int-copa-time','int-story'];
  const _autoSave = () => {
    const draft = {};
    _intakeFields.forEach(id => { const el = document.getElementById(id); if (el) draft[id] = el.value; });
    sessionStorage.setItem(_intakeKey, JSON.stringify(draft));
  };
  _intakeFields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', _autoSave);
  });
  // Clear draft on successful submit
  const _origSubmit = window._intakeSubmitFn;
  window._intakeDraftKey = _intakeKey;

  // ── Gallery slot state ──
  const _galleryUploaded = [null, null, null, null];

  // ── Submit handler ──
  document.getElementById('intake-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('int-submit-btn');
    const progress = document.getElementById('int-upload-progress');

    // Basic validation
    const groom = document.getElementById('int-groom')?.value?.trim();
    const bride = document.getElementById('int-bride')?.value?.trim();
    if (!groom && !bride) {
      toast('Por favor preenche pelo menos o nome do noivo ou da noiva.');
      return;
    }

    btn.disabled = true; btn.textContent = 'A enviar...';

    const g = id => document.getElementById(id)?.value?.trim() || null;

    try {
      progress.style.display = 'block';

      // Upload cover photo if selected, or keep/delete existing
      let coverUrl = document.getElementById('int-cover-url')?.value || null;
      if (coverUrl === '__DELETE__') coverUrl = null;
      const coverFile = document.getElementById('int-cover-file').files[0];
      if (coverFile) {
        progress.textContent = 'A carregar foto de capa...';
        coverUrl = await uploadImageToStorage(coverFile, 'event-covers');
      }

      // Upload gallery photos — merge with existing, respect deletions (8 slots max)
      const galleryUrls = [];
      for (let i = 0; i < 8; i++) {
        const preview = document.getElementById(`int-gal-preview-${i}`);
        const existingUrl = preview?.dataset?.existingUrl || null;
        const newFile = document.getElementById(`int-gal-file-${i}`)?.files[0];
        const wasDeleted = preview?.dataset?.deleted === 'true';
        if (newFile) {
          progress.textContent = `A carregar foto da galeria ${i+1} de 8...`;
          const url = await uploadImageToStorage(newFile, 'event-covers');
          if (url) galleryUrls.push(url);
        } else if (existingUrl && !wasDeleted) {
          galleryUrls.push(existingUrl);
        }
      }

      progress.textContent = 'A guardar dados...';

      // Patch events table (core fields)
      const patches = {};
if (g('int-groom'))        patches.groom_name    = g('int-groom');
      if (g('int-bride'))        patches.bride_name    = g('int-bride');
      if (g('int-date'))         patches.date          = g('int-date');
      if (g('int-time'))         patches.time          = g('int-time');
      if (g('int-deadline'))     patches.confirm_by_date = g('int-deadline');
      if (g('int-music'))        patches.music_url     = g('int-music');
      if (coverUrl)              patches.cover_image   = coverUrl;

      if (Object.keys(patches).length > 0) {
        await supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', patches);
      }

      // Save visual fields to event_visuals
      const visualPatches = {};
      if (g('int-groom'))        visualPatches.groom_name    = g('int-groom');
      if (g('int-bride'))        visualPatches.bride_name    = g('int-bride');
      if (g('int-bible'))        visualPatches.bible_text    = g('int-bible');
      if (g('int-bibleref'))     visualPatches.bible_ref     = g('int-bibleref');
      if (g('int-groom-parents')) visualPatches.groom_parents = g('int-groom-parents');
      if (g('int-bride-parents')) visualPatches.bride_parents = g('int-bride-parents');
      if (g('int-iban'))         visualPatches.iban_number   = g('int-iban');
      if (g('int-iban-holder'))  visualPatches.iban_holder   = g('int-iban-holder');
      if (g('int-music'))        visualPatches.music_url     = g('int-music');
      if (galleryUrls.length)    visualPatches.gallery_urls  = _dedupeGalleryUrls(galleryUrls.join('\n'));
      if (g('int-couplemsg')) { visualPatches.couplemsg_text = g('int-couplemsg'); visualPatches.show_couplemsg = 'yes'; }
      if (g('int-dresscode')) { visualPatches.dresscode_text = g('int-dresscode'); visualPatches.show_dresscode = 'yes'; }
      if (g('int-dresscode-detail')) visualPatches.dresscode_detail = g('int-dresscode-detail');

      // Venue/ceremony locations — saved to event_venues table (NOT schedule_items,
      // which is reserved for the Monograma editor's custom moments)
      const venuePatches = {};
      if (g('int-civil-loc'))  venuePatches.venue_civil          = g('int-civil-loc');
      if (g('int-civil-time')) venuePatches.venue_civil_time     = g('int-civil-time');
      if (g('int-relig-loc'))  venuePatches.venue_ceremony       = g('int-relig-loc');
      if (g('int-relig-time')) venuePatches.venue_ceremony_time  = g('int-relig-time');
      if (g('int-copa-loc'))   venuePatches.venue_reception      = g('int-copa-loc');
      if (g('int-copa-time'))  venuePatches.venue_reception_time = g('int-copa-time');
      if (Object.keys(venuePatches).length > 0) {
        venuePatches.show_venues = 'yes';
        await saveEventVenues(eventId, venuePatches).catch(() => {});
      }

      if (Object.keys(visualPatches).length > 0) {
        await saveEventVisuals(eventId, visualPatches);
      }

      // Mark token as used (link is now invalid)
      if (Store._intakeToken) await markIntakeTokenUsed(Store._intakeToken);

      // Increment use_count on the token
      if (Store._intakeToken) {
        supabaseRequest(`intake_tokens?token=eq.${Store._intakeToken}`, 'PATCH', {
          use_count: ((await supabaseRequest(`intake_tokens?token=eq.${Store._intakeToken}&select=use_count&limit=1`))?.[0]?.use_count || 0) + 1,
          used_at: new Date().toISOString()
        });
      }

      progress.style.display = 'none';
      document.getElementById('intake-form').style.display = 'none';

      // Show success with preview button
      const successDiv = document.getElementById('intake-success');
      successDiv.style.display = 'block';
    } catch(err) {
      console.error('Intake submit error:', err);
      progress.textContent = 'Erro ao enviar. Verifica a tua ligação e tenta novamente.';
      btn.disabled = false; btn.textContent = 'Enviar Informações';
    }
  };
}

function generateIntakeLink(eventId) {
  const base = window.location.origin + window.location.pathname;
  return base + '?intake=' + eventId;
}

function showIntakeLink(eventId) {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') {
    toast('Apenas o administrador pode gerar este link.');
    return;
  }
  const link = generateIntakeLink(eventId);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl p-6" style="max-width:480px">
      <h3 class="text-base font-bold text-gray-800 mb-2">Link de Preenchimento pelo Cliente</h3>
      <p class="text-xs text-gray-500 mb-3">Envia este link ao cliente. Ele preencherá os detalhes do evento sem precisar de conta.</p>
      <div id="intake-link-display" style="background:#f1f5f9;border-radius:0.5rem;padding:0.75rem;font-size:0.75rem;font-family:monospace;word-break:break-all;color:#1e293b;margin-bottom:1rem">${link}</div>
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="navigator.clipboard.writeText(document.getElementById('intake-link-display').textContent.trim()).then(()=>toast('Link copiado!'))">Copiar Link</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}


// ===================== DECOR PNG UPLOAD =====================
const DECOR_SLOT_LABELS = {
  top: 'Decoração — Topo do convite',
  side: 'Decoração — Laterais',
  'bottom-left': 'Decoração — Canto inferior esquerdo',
  'bottom-right': 'Decoração — Canto inferior direito'
};
async function handleDecorSlotUpload(input, slot) {
  const file = input.files[0];
  if (!file || !file.type.includes('png')) { toast('Selecciona um ficheiro PNG.'); return; }
  if (file.size > 3 * 1024 * 1024) { toast('PNG muito grande. Máx. 3 MB.'); return; }
  const eventId = Store.currentEventId || Store._intakeEventId;
  const label = DECOR_SLOT_LABELS[slot] || 'Decoração';
  const area = document.getElementById(`decor-${slot}-upload-area`);
  const applyUrl = (url) => {
    document.getElementById(`evt-decor-${slot}-url`).value = url;
    const prev = document.getElementById(`decor-${slot}-preview`);
    if (prev) { prev.src = url; prev.style.display = ''; }
    if (area) area.innerHTML = '<span class="text-xs text-teal-600 font-semibold">✓ Carregada</span>';
  };
  const proceed = await _confirmIfDuplicatePhoto(file, eventId, label, applyUrl);
  if (!proceed) { input.value = ''; return; }
  if (area) area.innerHTML = '<span class="text-xs text-teal-600">A carregar...</span>';
  try {
    const url = await uploadImageToStorage(file, 'event-covers', label);
    applyUrl(url);
    toast('Imagem de decoração carregada!');
  } catch(e) {
    if (area) area.innerHTML = '<i data-lucide="image" class="w-5 h-5 mb-1 text-gray-400"></i> PNG';
    toast('Erro ao carregar imagem.');
  }
}

async function handleDecorSideUpload(input) {
  const file = input.files[0];
  if (!file || !file.type.includes('png')) { toast('Selecciona um ficheiro PNG.'); return; }
  if (file.size > 3 * 1024 * 1024) { toast('PNG muito grande. Máx. 3 MB.'); return; }
  const area = document.getElementById('decor-side-upload-area');
  if (area) area.innerHTML = '<span class="text-xs text-teal-600">A carregar...</span>';
  try {
    const url = await uploadImageToStorage(file, 'event-covers');
    document.getElementById('evt-decor-side-url').value = url;
    const prev = document.getElementById('decor-side-preview');
    if (prev) { prev.src = url; prev.style.display = ''; }
    document.getElementById('decor-preview')?.classList.remove('hidden');
    if (area) area.innerHTML = '<span class="text-xs text-teal-600 font-semibold">✓ Carregada</span>';
    toast('Imagem de flores carregada!');
  } catch(e) {
    if (area) area.innerHTML = '<i data-lucide="image" class="w-5 h-5 mb-1 text-gray-400"></i> PNG flores laterais';
    toast('Erro ao carregar imagem.');
  }
}

async function handleDecorOrnamentUpload(input) {
  const file = input.files[0];
  if (!file || !file.type.includes('png')) { toast('Selecciona um ficheiro PNG.'); return; }
  if (file.size > 2 * 1024 * 1024) { toast('PNG muito grande. Máx. 2 MB.'); return; }
  const area = document.getElementById('decor-ornament-upload-area');
  if (area) area.innerHTML = '<span class="text-xs text-teal-600">A carregar...</span>';
  try {
    const url = await uploadImageToStorage(file, 'event-covers');
    document.getElementById('evt-decor-ornament-url').value = url;
    const prev = document.getElementById('decor-ornament-preview');
    if (prev) { prev.src = url; prev.style.display = ''; }
    document.getElementById('decor-preview')?.classList.remove('hidden');
    if (area) area.innerHTML = '<span class="text-xs text-teal-600 font-semibold">✓ Carregada</span>';
    toast('Ornamento carregado!');
  } catch(e) {
    if (area) area.innerHTML = '<i data-lucide="sparkles" class="w-5 h-5 mb-1 text-gray-400"></i> PNG ornamento';
    toast('Erro ao carregar ornamento.');
  }
}

// ── Intake form helpers ──
function intakePreviewCover(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Foto muito grande. Máx. 5 MB.'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('int-cover-preview');
    const wrap = document.getElementById('int-cover-preview-wrap');
    const placeholder = document.getElementById('int-cover-placeholder');
    if (prev) { prev.src = e.target.result; }
    if (wrap) wrap.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function intakePreviewGallery(input, idx) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) { toast('Foto muito grande. Máx. 3 MB.'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById(`int-gal-preview-${idx}`);
    const icon = document.getElementById(`int-gal-icon-${idx}`);
    const removeBtn = document.getElementById(`int-gal-remove-${idx}`);
    if (prev) { prev.src = e.target.result; prev.style.display = 'block'; prev.dataset.deleted = 'false'; delete prev.dataset.existingUrl; }
    if (icon) icon.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'flex';
  };
  reader.readAsDataURL(file);
}

function intakeRemoveGalleryPhoto(idx) {
  const prev = document.getElementById(`int-gal-preview-${idx}`);
  const icon = document.getElementById(`int-gal-icon-${idx}`);
  const removeBtn = document.getElementById(`int-gal-remove-${idx}`);
  const fileInput = document.getElementById(`int-gal-file-${idx}`);
  if (prev) { prev.style.display = 'none'; prev.src = ''; prev.dataset.deleted = 'true'; }
  if (icon) icon.style.display = 'block';
  if (removeBtn) removeBtn.style.display = 'none';
  if (fileInput) fileInput.value = '';
}

// ── Intake token management ──
async function generateIntakeToken(eventId) {
  // Mark any existing tokens for this event as used (invalidate old links)
  await supabaseRequest(`intake_tokens?event_id=eq.${eventId}&used=eq.false`, 'PATCH', { used: true });
  // Create new token
  const result = await supabaseRequest('intake_tokens', 'POST', { event_id: eventId, used: false });
  if (result && result[0]) return result[0].token;
  // Fallback: use event_id directly
  return null;
}

async function getIntakeTokenEventId(token) {
  if (!token) return null;
  const rows = await supabaseRequest(`intake_tokens?token=eq.${token}&used=eq.false&select=event_id,used&limit=1`);
  if (!rows || !rows[0]) return null; // Token not found or already used
  return rows[0].event_id;
}

async function markIntakeTokenUsed(token) {
  if (!token) return;
  await supabaseRequest(`intake_tokens?token=eq.${token}`, 'PATCH', { used: true, used_at: new Date().toISOString() });
}

// ── Delete cover/gallery photos ──
async function deleteCoverPhoto(eventId) {
  if (!confirm('Remover a foto de capa?')) return;
  await supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', { cover_image: null });
  const el = Store.events.find(e => e.id === eventId);
  if (el) el.cover_image = null;
  renderEventDetails();
  toast('Foto de capa removida.');
}

async function deleteCoverPhoto(eventId) {
  if (!confirm('Remover a foto de capa? A secção de capa ficará sem imagem.')) return;
  await supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', { cover_image: null });
  const ev2 = Store.events.find(e => e.id === eventId);
  if (ev2) ev2.cover_image = null;
  // Also update event_visuals
  await saveEventVisuals(eventId, { bg_url: null }).catch(() => {});
  renderEventDetails();
  toast('Foto de capa removida.');
}

async function deleteGalleryPhoto(eventId, urlToRemove) {
  if (!confirm('Remover esta foto da galeria?')) return;
  const ev2 = Store.events.find(e => e.id === eventId);
  if (!ev2) return;
  const visuals = await loadEventVisuals(eventId);
  // ✅ CORREÇÃO: o separador real usado em todo o resto do sistema (textarea
  // do editor, "Escolher da Biblioteca", e a própria página do convidado)
  // é uma quebra de linha — nunca "|". Como esse caractere nunca aparece no
  // texto real, o split antigo devolvia a string inteira como um único
  // "URL", a comparação nunca encontrava a foto a remover, e nada era
  // mesmo eliminado (apesar da mensagem de sucesso a dizer o contrário).
  const rawUrls = (visuals.gallery_urls || ev2.gallery_urls || '').split('\n').map(u => u.trim()).filter(Boolean);
  const urls = [...new Set(rawUrls)].filter(u => u !== urlToRemove);
  const newGalleryStr = urls.join('\n') || null;
  // ✅ gallery_urls existe TANTO em event_visuals COMO em events (herança
  // histórica). Só atualizar event_visuals deixava a cópia da tabela events
  // congelada com a foto "eliminada" — e como o painel, ao recarregar a
  // página, lê essa cópia antiga em vários sítios, a foto parecia
  // reaparecer sozinha. Agora actualiza as duas, sempre.
  await Promise.all([
    saveEventVisuals(eventId, { gallery_urls: newGalleryStr }),
    supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', { gallery_urls: newGalleryStr }).catch(() => {})
  ]);
  ev2.gallery_urls = newGalleryStr;
  renderEventDetails();
  toast('Foto removida da galeria.');
}

// ── Download guest list as CSV ──
function downloadGuestListCSV() {
  const ev = Store.events.find(e => e.id === Store.currentEventId);
  if (!ev || !ev.confirmations || ev.confirmations.length === 0) {
    toast('Nenhuma confirmação para exportar.');
    return;
  }
  const rows = [['Nome','Presença','Grupo','Acompanhantes','Crianças','Mensagem']];
  ev.confirmations.forEach(c => {
    rows.push([
      sanitizeCSVCell(c.name),
      c.attending ? 'Confirmado' : 'Não confirmado',
      sanitizeCSVCell(c.side || ''),
      sanitizeCSVCell((c.companions || []).join('; ')),
      sanitizeCSVCell((c.kids || []).join('; ')),
      sanitizeCSVCell((c.message || '').replace(/"/g, '""'))
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `convidados_${ev.title || 'evento'}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('Lista exportada!');
}

// ── Intake Preview Mode ──────────────────────────────────────────────────
async function openIntakePreview(eventId) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:#f8fafc;z-index:99999;overflow-y:auto;font-family:Quicksand,sans-serif';
  overlay.innerHTML = `
    <div style="position:sticky;top:0;background:rgba(15,23,42,0.92);color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0.75rem 1.25rem;z-index:10">
      <div>
        <p style="font-size:0.65rem;opacity:0.6;margin:0;letter-spacing:0.1em;text-transform:uppercase">Pré-visualização · Apenas leitura</p>
        <p style="font-weight:700;margin:0;font-size:0.95rem" id="preview-title">A carregar...</p>
      </div>
      <button id="preview-close-btn" style="background:rgba(255,255,255,0.15);border:1.5px solid rgba(255,255,255,0.3);color:#fff;border-radius:999px;padding:0.35rem 0.85rem;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit">Fechar</button>
    </div>
    <div id="preview-body" style="max-width:700px;margin:0 auto;padding-bottom:3rem">
      <div style="text-align:center;padding:3rem;color:#9ca3af">
        <p>A carregar pré-visualização...</p>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('preview-close-btn').onclick = () => {
    overlay.remove();
    // Restore guest-sections-container to original parent
    const sec = document.getElementById('guest-sections-container');
    const guestSec = document.getElementById('screen-guest');
    if (sec && guestSec && !guestSec.contains(sec)) guestSec.appendChild(sec);
  };

  try {
    const result = await supabaseRequest(
      `events?id=eq.${eventId}&select=id,title,date,time,confirm_by_date,cover_image,event_code,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,rsvp_enabled,allow_edit_rsvp,save_the_date_enabled,release_type,release_date,is_invite_released,std_title,std_subtitle,std_font_family,std_name_size,std_title_size,std_intro_enabled,std_intro_text,std_intro_photo_url,std_intro_photo_mobile_url,std_intro_photo_desktop_url,std_intro_on_invite,std_show_cover,std_cover_url,std_cover_mobile_url,std_cover_desktop_url,std_scratch_enabled,std_scratch_mode,std_scratch_photo_url,std_scratch_text,std_date_style,std_extra_phrase,std_extra_phrase_enabled,is_example_event,std_show_iban,personalized_links_enabled,show_rsvp_in_full_invite,show_guest_name_in_invite,allow_messages,show_guest_messages,groom_name,bride_name,couple_size,show_couple,bg_url,bg_overlay,show_bible,bible_text,bible_ref,show_invite,invite_text,show_parents,groom_parents,bride_parents,show_gallery,gallery_urls,show_schedule,schedule_items,custom_font_family,section_order,story_text,event_color,iban_message,iban_number,iban_holder,iban_footer,music_url,music_title,rsvps(guest_name,attending,side,companions,kids,wants_gift,message),gifts(id,name,category,reserved,reserved_by,quantity,image_url)&limit=1`
    );
    if (!result || !result[0]) throw new Error('not found');

    const evBase = result[0];
    const visuals = await loadEventVisuals(eventId).catch(() => ({}));
    const venues  = await loadEventVenues(eventId).catch(() => ({}));
    const dates   = await loadEventDates(eventId).catch(() => ({}));

    const evData = { ...evBase };
    [visuals, venues].forEach(src => {
      Object.keys(src).forEach(k => {
        if (k !== 'event_id' && k !== 'updated_at' && src[k] !== null && src[k] !== undefined) evData[k] = src[k];
      });
    });
    evData.cover_image = evBase.cover_image || null;
    if (dates.event_date) evData.date = dates.event_date;
    if (dates.event_time) evData.time = dates.event_time;
    if (dates.show_time)  evData.show_time = dates.show_time;
    if (dates.confirm_by_date) evData.confirm_by_date = dates.confirm_by_date;

    evData.confirmations = (evBase.rsvps || []).map(r => ({
      name: r.guest_name, attending: r.attending, side: r.side,
      companions: r.companions ? r.companions.split('|').filter(Boolean) : [],
      kids: r.kids ? r.kids.split('|').filter(Boolean) : [],
      wantsGift: r.wants_gift, message: r.message || ''
    }));
    evData.gifts = evBase.gifts || [];
    evData.allowCompanions = String(evData.allow_companions || '').toLowerCase() === 'yes';
    evData.allowSides      = String(evData.allow_sides      || '').toLowerCase() === 'yes';
    evData.allowKids       = String(evData.allow_kids       || '').toLowerCase() === 'yes';
    evData.allowGifts      = String(evData.allow_gifts      || '').toLowerCase() === 'yes';
    evData.allowMessages   = String(evData.allow_messages   || '').toLowerCase() === 'yes';
    evData.showGuestMessages = String(evData.show_guest_messages || '').toLowerCase() === 'yes';

    document.getElementById('preview-title').textContent = evData.title || 'Convite';
    document.documentElement.style.setProperty('--ev-color', evData.event_color || '#007f9f');
    Store.guestEventData  = evData;
    Store.currentEventId  = eventId;

    const body = document.getElementById('preview-body');
    body.innerHTML = '';

    // Cover image
    if (evData.cover_image) {
      const hero = document.createElement('div');
      hero.style.cssText = `width:100%;height:280px;background:url('${evData.cover_image}') center/cover no-repeat;position:relative;display:flex;align-items:flex-end;justify-content:center;padding-bottom:2rem`;
      const ov2 = document.createElement('div');
      ov2.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.4)';
      const nm = document.createElement('h1');
      nm.style.cssText = 'position:relative;color:#fff;font-size:clamp(1.5rem,5vw,2.2rem);font-weight:800;text-align:center;z-index:1;padding:0 1rem';
      const g = (evData.groom_name || '').split(' ')[0];
      const b = (evData.bride_name || '').split(' ')[0];
      nm.innerHTML = escapeHTML(g) + (g && b ? ' <span style="opacity:0.6;font-weight:300">&amp;</span> ' : '') + escapeHTML(b);
      hero.appendChild(ov2); hero.appendChild(nm);
      body.appendChild(hero);
    }

    // Sections — render into a temp container and move
    const tempSec = document.createElement('div');
    tempSec.id = 'guest-sections-container';
    document.body.appendChild(tempSec);
    await renderGuestSections(evData);
    tempSec.remove();
    body.appendChild(tempSec);

    // Footer
    const foot = document.createElement('div');
    foot.style.cssText = 'text-align:center;padding:2rem 1rem;color:#9ca3af;font-size:0.75rem;border-top:1px solid #e5e7eb;margin-top:1rem';
    foot.innerHTML = '— Fim da pré-visualização —';
    body.appendChild(foot);

    // Disable all interactive elements except close button
    overlay.querySelectorAll('a, button:not(#preview-close-btn)').forEach(el => {
      el.style.pointerEvents = 'none'; el.style.opacity = '0.6';
      el.onclick = (e) => e.preventDefault();
    });

  } catch(e) {
    console.error('Preview error:', e);
    const body = document.getElementById('preview-body');
    if (body) body.innerHTML = '<div style="text-align:center;padding:3rem;color:#ef4444">Erro ao carregar. Tenta novamente.</div>';
  }
}




// ===================== EVENT FAQ EDITOR =====================
function renderEventFaqList() {
  const container = document.getElementById('event-faq-list');
  if (!container) return;
  const items = Store.eventFaqItems || [];
  container.innerHTML = items.map((item, i) => `
    <div style="background:#f8fafc;border-radius:0.6rem;padding:0.6rem;border:1px solid #e5e7eb">
      <input class="input-field text-sm mb-1" placeholder="Pergunta" value="${escapeHTML(item.q || '')}" onchange="updateEventFaqItem(${i},'q',this.value)">
      <textarea class="input-field text-sm" rows="2" placeholder="Resposta" onchange="updateEventFaqItem(${i},'a',this.value)">${escapeHTML(item.a || '')}</textarea>
      <button type="button" onclick="removeEventFaqItem(${i})" class="text-xs text-red-500 font-semibold mt-1">Remover</button>
    </div>`).join('') || '<p class="text-xs text-gray-400">Nenhuma pergunta ainda.</p>';
}

function addEventFaqItem() {
  if (!Store.eventFaqItems) Store.eventFaqItems = [];
  Store.eventFaqItems.push({ q: '', a: '' });
  renderEventFaqList();
}

function updateEventFaqItem(idx, field, value) {
  if (!Store.eventFaqItems || !Store.eventFaqItems[idx]) return;
  Store.eventFaqItems[idx][field] = value;
}

function removeEventFaqItem(idx) {
  if (!Store.eventFaqItems) return;
  Store.eventFaqItems.splice(idx, 1);
  renderEventFaqList();
}

// ===================== ABA DEDICADA: SAVE THE DATE =====================
// Editor isolado, com o seu próprio PATCH exclusivo para os campos do Save
// the Date. Construído porque o formulário geral de edição tem dezenas de
// campos de secções completamente diferentes, e qualquer falha num desses
// campos (coluna em falta, etc.) podia bloquear silenciosamente a gravação
// de TUDO, incluindo o Save the Date. Isolar isto num PATCH próprio elimina
// esse risco por completo: este editor só toca nos campos do Save the Date.
async function openStdEditor() {
  if (!(await _checkEditingAllowed())) return;
  const eventId = Store.currentEventId;
  const ev = Store.events.find(e => e.id === eventId);
  if (!ev) { toast('Evento não encontrado.'); return; }

  toast('A carregar dados do Save the Date...');
  let fresh;
  try {
    fresh = await supabaseRequest(`events?id=eq.${eventId}&select=date,confirm_by_date,save_the_date_enabled,release_type,release_date,is_invite_released,std_title,std_subtitle,std_name_size,std_title_size,std_show_cover,std_cover_url,std_cover_mobile_url,std_cover_desktop_url,std_date_style,std_scratch_enabled,std_scratch_mode,std_scratch_photo_url,std_scratch_text,std_show_iban,event_color&limit=1`);
  } catch(e) { fresh = null; }
  const d = (fresh && fresh[0]) ? fresh[0] : ev;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'std-editor-modal';
  modal.style.zIndex = '10600';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-5" style="max-width:480px;max-height:88vh;overflow-y:auto">
    <h3 class="text-base font-bold mb-1 flex items-center gap-2"><i data-lucide="heart" class="w-5 h-5" style="color:#fbbf24"></i> Save the Date</h3>
    <p class="text-xs text-gray-500 mb-4">Tudo o que precisas para configurar a tela de Save the Date, num só sítio. Guardar aqui não afecta nada do resto do convite.</p>

    <div class="flex items-center justify-between mb-3 pb-3" style="border-bottom:1px solid #e5e7eb">
      <span class="text-sm font-semibold text-gray-700">Activar Save the Date</span>
      <div id="std2-sw-enabled" class="switch ${d.save_the_date_enabled === true ? 'active' : ''}" onclick="toggleSwitch(this)"></div>
    </div>

    <div class="grid grid-cols-2 gap-3 mb-3">
      <div>
        <label class="text-xs font-semibold text-gray-600 block mb-1">Data do evento</label>
        <input id="std2-date" type="date" class="input-field text-sm" value="${(d.date||'').split('T')[0]}">
      </div>
      <div>
        <label class="text-xs font-semibold text-gray-600 block mb-1">Prazo de confirmação</label>
        <input id="std2-deadline" type="date" class="input-field text-sm" value="${(d.confirm_by_date||'').split(/[T ]/)[0]}">
      </div>
    </div>

    <label class="text-xs font-semibold text-gray-600 block mb-1">Título (acima dos nomes)</label>
    <input id="std2-title" class="input-field text-sm mb-2" value="${escapeHTML(d.std_title || 'Save the Date')}">

    <label class="text-xs font-semibold text-gray-600 block mb-1">Subtítulo (abaixo dos nomes)</label>
    <input id="std2-subtitle" class="input-field text-sm mb-3" value="${escapeHTML(d.std_subtitle || 'Nosso Casamento')}">

    <div class="flex items-center justify-between mb-1">
     <span class="text-xs font-semibold text-gray-600">Frase extra (entre o subtítulo e a data)</span>
     <div id="std2-sw-extra-phrase" class="switch ${_yesOrTrue(d.std_extra_phrase_enabled) ? 'active' : ''}" onclick="toggleSwitch(this,'std2-extra-phrase-wrap')"></div>
    </div>
    <div id="std2-extra-phrase-wrap" class="${_yesOrTrue(d.std_extra_phrase_enabled) ? '' : 'hidden'} mb-3">
      <input id="std2-extra-phrase" class="input-field text-sm" placeholder="Ex: Guarda este dia no teu coração" value="${escapeHTML(d.std_extra_phrase || '')}">
    </div>

    <label class="text-xs font-semibold text-gray-600 block mb-1">Estilo visual da data</label>
    <select id="std2-date-style" class="input-field text-sm mb-3">
      <option value="card" ${d.std_date_style==='card'||!d.std_date_style?'selected':''}>Cartão (clássico)</option>
      <option value="minimal" ${d.std_date_style==='minimal'?'selected':''}>Minimalista</option>
      <option value="bignum" ${d.std_date_style==='bignum'?'selected':''}>Número grande em destaque</option>
    </select>

    <div class="flex items-center justify-between mb-2">
      <span class="text-xs font-semibold text-gray-600">Foto de capa</span>
      <div id="std2-sw-cover" class="switch ${d.std_show_cover !== false ? 'active' : ''}" onclick="toggleSwitch(this,'std2-cover-extra')"></div>
    </div>
    <div id="std2-cover-extra" class="${d.std_show_cover !== false ? '' : 'hidden'} mb-3">
      <p class="text-xs text-gray-400 mb-2">Foto independente — não usa a foto de fundo do convite.</p>

      <label class="text-xs font-semibold text-gray-600 block mb-1">Foto para telemóvel (1080×1920px, vertical)</label>
      <p class="text-xs font-semibold mb-1" style="color:${d.std_cover_mobile_url ? '#16a34a' : '#ef4444'}">
        ${d.std_cover_mobile_url ? '✓ Guardada' : '✗ Nenhuma foto'}
      </p>
      <input type="file" id="std2-cover-input-mobile" accept="image/*" class="input-field text-sm" onchange="handleStd2CoverUpload(this, 'mobile')">
      <input type="hidden" id="std2-cover-url-mobile" value="${d.std_cover_mobile_url || ''}">
      <div id="std2-cover-preview-mobile-wrap" class="${d.std_cover_mobile_url ? '' : 'hidden'} relative mt-1" style="max-width:120px">
        <img id="std2-cover-preview-mobile" class="rounded-lg max-h-40 object-cover w-full" src="${d.std_cover_mobile_url || ''}">
        <button type="button" onclick="document.getElementById('std2-cover-url-mobile').value='';document.getElementById('std2-cover-preview-mobile-wrap').classList.add('hidden')" class="absolute top-1 right-1 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-red-500 text-xs font-bold">✕</button>
      </div>

      <label class="text-xs font-semibold text-gray-600 block mt-2 mb-1">Foto para computador (1920×1080px, horizontal)</label>
      <p class="text-xs font-semibold mb-1" style="color:${d.std_cover_desktop_url ? '#16a34a' : '#ef4444'}">
        ${d.std_cover_desktop_url ? '✓ Guardada' : '✗ Nenhuma foto'}
      </p>
      <input type="file" id="std2-cover-input-desktop" accept="image/*" class="input-field text-sm" onchange="handleStd2CoverUpload(this, 'desktop')">
      <input type="hidden" id="std2-cover-url-desktop" value="${d.std_cover_desktop_url || ''}">
      <div id="std2-cover-preview-desktop-wrap" class="${d.std_cover_desktop_url ? '' : 'hidden'} relative mt-1" style="max-width:200px">
        <img id="std2-cover-preview-desktop" class="rounded-lg max-h-24 object-cover w-full" src="${d.std_cover_desktop_url || ''}">
        <button type="button" onclick="document.getElementById('std2-cover-url-desktop').value='';document.getElementById('std2-cover-preview-desktop-wrap').classList.add('hidden')" class="absolute top-1 right-1 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-red-500 text-xs font-bold">✕</button>
      </div>
      <p class="text-xs text-gray-400 mt-1">Se carregares só uma das duas, essa é usada em todos os dispositivos.</p>
    </div>

    <label class="text-xs font-semibold text-gray-600 block mb-1">Quando liberar o convite completo?</label>
    <select id="std2-release-type" class="input-field text-sm mb-3" onchange="document.getElementById('std2-release-date-wrap').classList.toggle('hidden', this.value!=='by_date')">
      <option value="manual" ${d.release_type==='manual'||!d.release_type?'selected':''}>Manualmente</option>
      <option value="on_confirmation" ${d.release_type==='on_confirmation'?'selected':''}>Quando confirmar presença</option>
      <option value="by_date" ${d.release_type==='by_date'?'selected':''}>A partir de uma data</option>
    </select>
    <div id="std2-release-date-wrap" class="${d.release_type==='by_date'?'':'hidden'} mb-3">
      <input id="std2-release-date" type="datetime-local" class="input-field text-sm" value="${d.release_date ? d.release_date.slice(0,16) : ''}">
    </div>
    <div class="flex items-center justify-between mb-4">
      <span class="text-xs font-semibold text-gray-600">Convite já liberado para todos?</span>
      <div id="std2-sw-released" class="switch ${d.is_invite_released === true ? 'active' : ''}" onclick="toggleSwitch(this)"></div>
    </div>

    <div class="flex items-center justify-between mb-4 pt-3" style="border-top:1px solid #e5e7eb">
      <span class="text-xs font-semibold text-gray-600">Mostrar "Gostaria de nos presentear?" aqui</span>
      <div id="std2-sw-iban" class="switch ${d.std_show_iban === true ? 'active' : ''}" onclick="toggleSwitch(this)"></div>
    </div>
    <p class="text-xs text-gray-400 -mt-3 mb-3">Independente de aparecer ou não no convite completo — usa os dados de IBAN já configurados no formulário geral do evento.</p>

    <div class="flex gap-2">
      <button class="flex-1 btn-main text-sm" onclick="saveStdEditor()">Guardar Save the Date</button>
      <button class="btn-outline text-sm" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  lucide.createIcons();
}

async function handleStd2CoverUpload(input, variant) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { toast('Imagem muito grande. Máx. 5 MB.'); return; }
  const eventId = Store.currentEventId;
  const label = variant === 'desktop' ? 'Foto de capa do Save the Date (computador)' : 'Foto de capa do Save the Date (telemóvel)';
  const applyUrl = (url) => {
    document.getElementById(`std2-cover-url-${variant}`).value = url;
    const prev = document.getElementById(`std2-cover-preview-${variant}`);
    if (prev) prev.src = url;
    document.getElementById(`std2-cover-preview-${variant}-wrap`)?.classList.remove('hidden');
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

async function saveStdEditor() {
  const eventId = Store.currentEventId;
  if (!eventId) { toast('Erro: evento não identificado.'); return; }

  const dateVal = document.getElementById('std2-date')?.value || null;
  const deadlineVal = document.getElementById('std2-deadline')?.value || dateVal;
  const releaseDateVal = document.getElementById('std2-release-date')?.value;

  const payload = {
    date: dateVal,
    confirm_by_date: deadlineVal,
    save_the_date_enabled: document.getElementById('std2-sw-enabled')?.classList.contains('active') || false,
    std_title: document.getElementById('std2-title')?.value?.trim() || 'Save the Date',
    std_subtitle: document.getElementById('std2-subtitle')?.value?.trim() || 'Nosso Casamento',
    std_extra_phrase: document.getElementById('std2-extra-phrase')?.value?.trim() || '',
    std_extra_phrase_enabled: document.getElementById('std2-sw-extra-phrase')?.classList.contains('active') ? 'yes' : 'no',
    std_date_style: document.getElementById('std2-date-style')?.value || 'card',
    std_show_cover: document.getElementById('std2-sw-cover')?.classList.contains('active') || false,
    std_cover_mobile_url: document.getElementById('std2-cover-url-mobile')?.value?.trim() || null,
    std_cover_desktop_url: document.getElementById('std2-cover-url-desktop')?.value?.trim() || null,
    std_cover_url: document.getElementById('std2-cover-url-mobile')?.value?.trim() || document.getElementById('std2-cover-url-desktop')?.value?.trim() || null,
    release_type: document.getElementById('std2-release-type')?.value || 'manual',
    release_date: releaseDateVal ? new Date(releaseDateVal).toISOString() : null,
    is_invite_released: document.getElementById('std2-sw-released')?.classList.contains('active') || false,
    std_show_iban: document.getElementById('std2-sw-iban')?.classList.contains('active') || false,
  };

  toast('A guardar...');
  try {
    const result = await supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', payload);
    // ✅ CRÍTICO: a página do convidado lê a data/prazo de uma tabela
    // dedicada (event_dates), que tem prioridade sobre esta coluna da
    // tabela events. Sem isto, o que se guarda aqui fica correto na
    // tabela events mas continua a aparecer errado para o convidado,
    // porque a outra tabela nunca é actualizada e continua com o valor
    // antigo (normalmente igual à data do evento).
    try { await saveEventDates(eventId, { event_date: dateVal, confirm_by_date: deadlineVal }); } catch(e) { console.warn('Falha ao sincronizar event_dates:', e); }
    if (result) {
      toast('Save the Date guardado com sucesso!');
      // Update local cache and re-fetch fresh in background
      const ev = Store.events.find(e => e.id === eventId);
      if (ev) Object.assign(ev, payload);
      document.getElementById('std-editor-modal')?.remove();
      try {
        const freshRows = await supabaseRequest(`events?id=eq.${eventId}&select=*`);
        // ✅ Mesma correção do formulário principal (ver _visualsPreserveSnapshot
        // em visuals.js) — protege TODOS os campos de event_visuals, não só
        // manual_items/schedule_items.
        if (freshRows && freshRows[0] && ev) {
          const preserved = _visualsPreserveSnapshot(ev);
          Object.assign(ev, freshRows[0], preserved);
        }
      } catch(e) {}
    } else {
      toast('Erro ao guardar. Verifica a consola para detalhes.');
    }
  } catch(e) {
    console.error('Erro ao guardar Save the Date:', e);
    toast('Erro ao guardar. Verifica a consola.');
  }
}

// ===================== ABA PRÓPRIA: DRESS CODE + SUGESTÃO DE PRESENTES =====================
async function openDressGiftsEditor() {
  if (!(await _checkEditingAllowed())) return;
  const eventId = Store.currentEventId;
  const ev = Store.events.find(e => e.id === eventId);
  if (!ev) { toast('Evento não encontrado.'); return; }

  toast('A carregar...');
  let visuals;
  try { visuals = await loadEventVisuals(eventId); } catch(e) { visuals = {}; }
  const d = (visuals && Object.keys(visuals).length > 1) ? visuals : ev;

  const allowGifts = !!(ev.allowGifts ?? (String(ev.allow_gifts).toLowerCase() === 'yes'));

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'dressgifts-editor-modal';
  modal.style.zIndex = '10600';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-5" style="max-width:480px;max-height:88vh;overflow-y:auto">
    <h3 class="text-base font-bold mb-1 flex items-center gap-2"><i data-lucide="shirt" class="w-5 h-5" style="color:#0ea5e9"></i> Dress Code + Presentes</h3>
    <p class="text-xs text-gray-500 mb-4">A secção aparece no convite com 2 botões — um abre o Dress Code, o outro abre a lista de presentes. Guardar aqui não afecta o resto do convite.</p>

    <div class="flex items-center justify-between mb-3 pb-3" style="border-bottom:1px solid #e5e7eb">
      <span class="text-sm font-semibold text-gray-700">Mostrar esta secção no convite</span>
      <div id="dg2-sw-section" class="switch ${d.show_dress_gifts === undefined || _yesOrTrue(d.show_dress_gifts) ? 'active' : ''}" onclick="toggleSwitch(this,'dg2-section-extra')"></div>
    </div>

    <div id="dg2-section-extra" class="${(d.show_dress_gifts === undefined || _yesOrTrue(d.show_dress_gifts)) ? '' : 'hidden'}">

      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-semibold text-gray-700">Botão: Dress Code</span>
        <div id="dg2-sw-dresscode" class="switch ${_yesOrTrue(d.show_dresscode) ? 'active' : ''}" onclick="toggleSwitch(this,'dg2-dresscode-extra')"></div>
      </div>
      <div id="dg2-dresscode-extra" class="${_yesOrTrue(d.show_dresscode) ? '' : 'hidden'} pl-1 mb-4">
        <label class="text-xs font-semibold text-gray-600 block mb-1">Traje</label>
        <input id="dg2-dresscode-text" class="input-field text-sm mb-2" placeholder="Ex: Traje social ou Roupa a rigor" value="${escapeHTML(d.dresscode_text || '')}">
        <label class="text-xs font-semibold text-gray-600 block mb-1">Paleta de cores (HEX, máx. 4)</label>
        <div id="evt-dresscode-swatches" style="display:flex;gap:0.5rem;margin-bottom:0.4rem;flex-wrap:wrap"></div>
        <textarea id="dg2-dresscode-colors" class="input-field text-sm mb-2" rows="3" placeholder="#FFFFFF
#C9A84C
#2D6A4F" oninput="updateDressCodeSwatches(this.value)">${escapeHTML(d.dresscode_colors || '')}</textarea>
        <label class="text-xs font-semibold text-gray-600 block mb-1">Detalhe adicional (opcional)</label>
        <textarea id="dg2-dresscode-detail" class="input-field text-sm" rows="2" placeholder="Ex: Pedimos gentilmente que os convidados optem por um traje elegante...">${escapeHTML(d.dresscode_detail || '')}</textarea>
        <label class="text-xs font-semibold text-gray-600 block mt-2 mb-1">Foto de referência (opcional)</label>
        <p class="text-xs text-gray-400 mb-2">Mostra aos convidados a cor/estilo exacto que tens em mente.</p>
        <div id="dg2-dresscode-image-wrap" class="${d.dresscode_image_url ? '' : 'hidden'} relative mb-2" style="max-width:160px">
          <img id="dg2-dresscode-image-preview" class="rounded-lg w-full" style="aspect-ratio:1;object-fit:cover" src="${d.dresscode_image_url || ''}">
          <button type="button" onclick="document.getElementById('dg2-dresscode-image-url').value='';document.getElementById('dg2-dresscode-image-wrap').classList.add('hidden')" class="absolute top-1 right-1 bg-white rounded-full w-6 h-6 flex items-center justify-center shadow text-red-500 text-xs font-bold">✕</button>
        </div>
        <input type="hidden" id="dg2-dresscode-image-url" value="${d.dresscode_image_url || ''}">
        <input type="file" id="dg2-dresscode-image-input" accept="image/*" class="input-field text-sm mb-1" onchange="handleDresscodeImageUpload(this)">
        <button type="button" class="text-xs text-teal-600 font-semibold" onclick="openMediaLibraryPicker((url) => { document.getElementById('dg2-dresscode-image-url').value=url; document.getElementById('dg2-dresscode-image-preview').src=url; document.getElementById('dg2-dresscode-image-wrap').classList.remove('hidden'); })">📁 Escolher da Biblioteca</button>
      </div>

      <div class="flex items-center justify-between mb-1 pt-2" style="border-top:1px solid #f1f5f9">
        <span class="text-sm font-semibold text-gray-700">Botão: Sugestão de Presentes</span>
        <span class="text-xs font-semibold ${allowGifts ? 'text-green-600' : 'text-gray-400'}">${allowGifts ? '✓ Activo' : '✗ Desligado'}</span>
      </div>
      <p class="text-xs text-gray-400 mb-3">Segue a opção "Permitir Presentes" do formulário principal do evento — ${allowGifts ? 'está activa, o botão aparece.' : 'está desligada, o botão não aparece. Liga "Permitir Presentes" no formulário principal para activar.'}</p>
    </div>

    <div class="flex gap-2 mt-2">
      <button class="flex-1 btn-main text-sm" onclick="saveDressGiftsEditor()">Guardar</button>
      <button class="btn-outline text-sm" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  updateDressCodeSwatches(d.dresscode_colors || '');
  lucide.createIcons();
}

async function handleDresscodeImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 4*1024*1024) { toast('Imagem muito grande. Máx. 4 MB.'); return; }
  const eventId = Store.currentEventId;
  const label = 'Foto de referência do Dress Code';
  const applyUrl = (url) => {
    document.getElementById('dg2-dresscode-image-url').value = url;
    document.getElementById('dg2-dresscode-image-preview').src = url;
    document.getElementById('dg2-dresscode-image-wrap').classList.remove('hidden');
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

async function saveDressGiftsEditor() {
  const eventId = Store.currentEventId;
  if (!eventId) { toast('Erro: evento não identificado.'); return; }

  const payload = {
    show_dress_gifts: document.getElementById('dg2-sw-section')?.classList.contains('active') ? 'yes' : 'no',
    show_dresscode: document.getElementById('dg2-sw-dresscode')?.classList.contains('active') ? 'yes' : 'no',
    dresscode_text: document.getElementById('dg2-dresscode-text')?.value?.trim() || null,
    dresscode_colors: document.getElementById('dg2-dresscode-colors')?.value?.trim() || null,
    dresscode_detail: document.getElementById('dg2-dresscode-detail')?.value?.trim() || null,
    dresscode_image_url: document.getElementById('dg2-dresscode-image-url')?.value?.trim() || null,
  };

  toast('A guardar...');
  try {
    const ok = await saveEventVisuals(eventId, payload);
    if (ok) {
      toast('Dress Code + Presentes guardado!');
      const ev = Store.events.find(e => e.id === eventId);
      if (ev) Object.assign(ev, payload);
      document.getElementById('dressgifts-editor-modal')?.remove();
    } else {
      toast('Erro ao guardar. Verifica a consola.');
    }
  } catch(e) {
    console.error('Erro ao guardar Dress Code + Presentes:', e);
    toast('Erro ao guardar. Verifica a consola.');
  }
}

// ===================== ADMIN: EVENTO EXEMPLAR =====================
async function adminToggleExampleEvent() {
  // Defesa em profundidade: apenas o admin God autenticado directamente,
  // nunca durante impersonação — mesmo que alguém chame esta função
  // directamente sem passar pelo botão (que já está escondido nesse caso).
  const isRealAdminGod = Store.currentUser && Store.currentUser.role === 'admin' && !Store.adminModeActive;
  if (!isRealAdminGod) {
    toast('Apenas o administrador pode marcar eventos como exemplo.');
    return;
  }

  const eventId = Store.currentEventId;
  const ev = Store.events.find(e => e.id === eventId);
  if (!ev) return;

  const newValue = !(ev.is_example_event === true);
  try {
    await supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', { is_example_event: newValue });
    ev.is_example_event = newValue;
    toast(newValue
      ? '⭐ Evento marcado como exemplar! As datas serão renovadas automaticamente sempre que se aproximarem do fim.'
      : 'Evento removido da lista de exemplares.');
    const exampleLabel = document.getElementById('btn-example-event-label');
    if (exampleLabel) exampleLabel.textContent = newValue ? 'Remover de Exemplo' : 'Marcar como Exemplo';
    if (newValue) {
      // Renovar imediatamente as datas ao marcar, para já começar bem configurado
      await _autoRenewExampleEventDates(ev, true);
    }
  } catch(e) {
    console.error('Erro ao marcar evento exemplar:', e);
    toast('Erro ao actualizar. Verifica a consola.');
  }
}

// ── Auto-renovação de datas para eventos exemplares ─────────────────────────
// Sempre que um evento marcado como "exemplar" (is_example_event = true) é
// aberto — seja por um possível cliente a quem o link foi enviado, seja pelo
// próprio organizador/admin — verificamos se a data do evento ou o prazo de
// confirmação estão a menos de 1 mês de distância (ou já passaram). Se sim,
// empurramos AMBAS as datas 2 meses para a frente a partir de hoje, mantendo
// o intervalo original entre elas. Isto garante que um link de demonstração
// enviado a clientes nunca mostra um evento "ultrapassado" ou prestes a
// expirar — o link continua sempre a parecer um evento próximo e credível.
async function _autoRenewExampleEventDates(ev, forceNow) {
  if (!ev || !ev.id) return;
  if (!forceNow && ev.is_example_event !== true) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eventDate = ev.date ? new Date(ev.date.split('T')[0] + 'T00:00:00') : null;
  const deadlineDate = ev.confirm_by_date ? new Date(ev.confirm_by_date.split(/[T ]/)[0] + 'T00:00:00') : null;

  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;
  const needsRenewal =
    !eventDate || (eventDate - today) < oneMonthMs ||
    !deadlineDate || (deadlineDate - today) < oneMonthMs;

  if (!needsRenewal && !forceNow) return;

  // Preserve the original gap between event date and deadline (e.g. if the
  // deadline was always 2 weeks before the event, keep that same 2-week gap)
  const gapMs = (eventDate && deadlineDate) ? (eventDate - deadlineDate) : (14 * 24 * 60 * 60 * 1000);

  const newEventDate = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000); // +2 months
  const newDeadlineDate = new Date(newEventDate.getTime() - gapMs);

  const fmtDate = (d) => d.toISOString().split('T')[0];

  try {
    await supabaseRequest(`events?id=eq.${ev.id}`, 'PATCH', {
      date: fmtDate(newEventDate),
      confirm_by_date: fmtDate(newDeadlineDate),
    });
    ev.date = fmtDate(newEventDate);
    ev.confirm_by_date = fmtDate(newDeadlineDate);
    dlog('🔄 Evento exemplar renovado automaticamente:', { id: ev.id, newDate: ev.date, newDeadline: ev.confirm_by_date });
  } catch(e) {
    console.warn('Falha ao renovar datas do evento exemplar:', e);
  }
}

async function handleStd2ScratchPhotoUpload(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5*1024*1024) { toast('Imagem muito grande. Máx. 5 MB.'); return; }
  const eventId = Store.currentEventId;
  const proceed = await _confirmIfDuplicatePhoto(file, eventId, 'Foto a raspar (Save the Date)');
  if (!proceed) { input.value = ''; return; }
  toast('A carregar foto...');
  try {
    const url = await uploadImageToStorage(file, 'event-covers');
    document.getElementById('std2-scratch-photo-url').value = url;
    const prev = document.getElementById('std2-scratch-photo-preview');
    if (prev) prev.src = url;
    document.getElementById('std2-scratch-photo-preview-wrap')?.classList.remove('hidden');
    toast('Foto carregada!');
  } catch(e) { toast('Erro ao carregar a foto.'); }
}
