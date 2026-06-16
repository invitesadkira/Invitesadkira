// ===================== ROUTER =====================
const Router = {
  go(screen) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById('screen-' + screen);
    if (el) {
      el.classList.remove('hidden');
      const inner = el.querySelector('.page-transition');
      if (inner) { inner.style.animation = 'none'; inner.offsetHeight; inner.style.animation = ''; }
    }
    // Mostrar/ocultar topbar consoante ecrã
    const publicScreens = ['home','register','login','guest','gift-confirmed','not-found'];
    if (publicScreens.includes(screen)) {
      hideTopbar();
    } else if (Store.currentUser) {
      showTopbar(Store.currentUser);
    }
    closeDrawer();
    // Screen-specific init
    if (screen === 'settings' && Store.currentUser?.role === 'admin') {
      if (typeof loadCurrentDemoEvent !== 'undefined') loadCurrentDemoEvent();
      if (typeof loadAvailableFonts !== 'undefined') loadAvailableFonts();
      if (typeof checkAndRenewDemoEvent !== 'undefined') checkAndRenewDemoEvent();
    }
    if (screen === 'home') {
      const faqContainer = document.getElementById('faq-container');
      if (faqContainer && typeof renderFAQ !== 'undefined') renderFAQ(faqContainer);
      // Load packages from Supabase
      if (typeof renderLandingPackages !== 'undefined') renderLandingPackages();
      // Load stats
      if (typeof loadLandingStats !== 'undefined') loadLandingStats();
      // Load reviews
      if (typeof renderLandingReviews !== 'undefined') renderLandingReviews();
      // Load notices
      if (typeof loadAndShowNotices !== 'undefined') loadAndShowNotices();
      // Show FAQ edit button only for admin
      const faqEdit = document.getElementById('faq-edit-btn');
      if (faqEdit) faqEdit.classList.toggle('hidden', !Store.currentUser || Store.currentUser.role !== 'admin');
    }
    if (screen === 'dashboard') renderDashboard();
    if (screen === 'event-details') renderEventDetails();
    if (screen === 'guest') renderGuestView();
    if (screen === 'gifts') renderGifts();
    if (screen === 'admin') renderAdmin();
    if (screen === 'pending-accounts') renderPendingAccounts();
    if (screen === 'settings') { /* static screen, just show */ lucide.createIcons(); }
    lucide.createIcons();
  }
};


// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', async () => {
  // Load fonts early so they're available for guest pages
  if (typeof loadAvailableFonts === 'function') {
    loadAvailableFonts().catch(() => {});
  }
  // Check for client intake mode (?intake= or ?intake_token=)
  const _intakeHandled = await checkForIntakeMode();
  if (_intakeHandled) return;

  console.log('🚀 Inicializando aplicação...');
  
  // ✅ PASSO 1: Verificar token NO LOCALSTORAGE (persiste entre refreshes)
  const token = localStorage.getItem('authToken');
  const userId = localStorage.getItem('userId');
  const userPhone = localStorage.getItem('userPhone');
  const userRole = localStorage.getItem('userRole') || 'user';
  const impersonatingUserId = localStorage.getItem('adminImpersonatingUserId');
  const impersonatingUserPhone = localStorage.getItem('adminImpersonatingUserPhone');

  // ── Event loading cache (5 min TTL to reduce Supabase calls) ──
const _CACHE_TTL = 5 * 60 * 1000;
let _lastLoad = 0;
let _forceNextLoad = false;
function invalidateEventsCache() { _forceNextLoad = true; }

async function loadEventosComDelay() {
  const now = Date.now();
  if (!_forceNextLoad && Store.events && Store.events.length > 0 && (now - _lastLoad) < _CACHE_TTL) {
    console.log('📦 Cache OK — não recarrega eventos');
    renderDashboard();
    return;
  }
  _lastLoad = now;
  _forceNextLoad = false;
    if (token && userId) {
      console.log('✅ Sessão anterior encontrada, restaurando...', { userId, userPhone, userRole });
      
      // ✅ PASSO 2: Restaurar informações do utilizador PRIMEIRO (COM ROLE!)
      Store.currentUser = {
        id: userId,
        phone: userPhone || 'user',
        role: userRole,
        status: 'active'
      };
      
      // Restaurar topbar
      showTopbar(Store.currentUser);
      
      console.log('✅ Utilizador restaurado:', Store.currentUser);
      
      // ✅ PASSO 3: CRÍTICO - RECARREGAR DADOS DO SUPABASE COM DELAY PARA GARANTIR
      console.log('📥 Recarregando dados do Supabase...');
      
      // Dar 500ms para garantir que a conexão está pronta
      await new Promise(r => setTimeout(r, 500));
      
      try {
        if (userRole === 'admin' && impersonatingUserId) {
          console.log('Admin em modo cliente restaurado apos refresh:', impersonatingUserId);
          Store.adminModeActive = true;
          Store.adminOriginalUser = { id: userId, phone: userPhone || 'admin', role: 'admin', status: 'active' };
          Store.currentUser = { id: impersonatingUserId, phone: impersonatingUserPhone || 'cliente', role: 'user', status: 'active' };
          const userData = await fetchUserDataForOrganizer(impersonatingUserId);
          Store.events = userData && userData.events ? userData.events : [];
          return true;
        }

        // ✅ SE É ADMIN: carregar TODAS as contas e TODOS os eventos
        if (userRole === 'admin') {
          console.log('👨‍💼 Admin detectado - carregando dados administrativos...');
          
          // Carregar TODAS as contas (excluindo admins)
          const allAccounts = await supabaseRequest(`accounts?role=eq.user&select=id,phone,password,role,status,created_at,event_limit,admin_label&limit=500&order=created_at.desc`);
          console.log('✅ Contas carregadas:', allAccounts?.length || 0);
          
          Store.users = (allAccounts || []).filter(a => a.role !== 'admin' && a.status !== 'deleted').map(u => ({
            id: u.id,
            phone: u.phone,
            password: u.password,
            role: u.role || 'user',
            status: u.status || 'active',
            eventLimit: u.event_limit || null,
            adminLabel: u.admin_label || null,
            createdAt: u.created_at
          }));
          
          // Carregar TODOS os eventos (com JOIN para presentes e RSVPs)
          const allEvents = await supabaseRequest(`events?select=id,title,date,time,user_id,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,allow_messages,show_guest_messages,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,groom_name,bride_name,couple_size,show_couple,bg_url,bg_overlay,bible_text,bible_ref,show_bible,invite_text,show_invite,groom_parents,bride_parents,show_parents,gallery_urls,show_gallery,show_manual,manual_items,show_schedule,schedule_items,custom_font_family,section_order,story_text,invite_blessing,event_color,decor_ornament_url,decor_side_url,show_decor,save_the_date,confirm_by_date,cover_image,event_code,gifts(id,name,category,reserved,reserved_by),rsvps(guest_name,attending,side,companions,kids,wants_gift,message,created_at,updated_at)&limit=500&order=date.desc`);
          console.log('✅ Eventos carregados:', allEvents?.length || 0);
          
          Store.events = (allEvents || []).map(event => {
            const maxComp = event.max_companions !== null && event.max_companions !== undefined ? parseInt(event.max_companions) : 2;
            const maxKds = event.max_kids !== null && event.max_kids !== undefined ? parseInt(event.max_kids) : 2;
            let deadlineDate = event.confirm_by_date;
            if (deadlineDate) deadlineDate = deadlineDate.trim();
            if (!deadlineDate || deadlineDate === '') deadlineDate = event.date;
            
            return {
              id: event.id,
              user_id: event.user_id,
              userId: event.user_id,
              title: event.title,
              date: event.date,
              time: event.time,
              eventCode: event.event_code || event.id,
              deadline: deadlineDate,
              confirm_by_date: deadlineDate,
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
      event_color: event.event_color || null,
      decor_ornament_url: event.decor_ornament_url || null,
      decor_side_url: event.decor_side_url || null,
      show_decor: event.show_decor || null,
      save_the_date: event.save_the_date || null,
      story_text: event.story_text || null,
      invite_blessing: event.invite_blessing || null,
      event_color: event.event_color || null,
        cover: event.cover_image,
              cover_image: event.cover_image,
              gifts: (event.gifts || []).map(g => ({
                id: g.id,
                name: g.name,
                category: g.category || 'Sem categoria',
                reserved: g.reserved || false,
                reservedBy: g.reserved_by || null
              })),
// visual data loaded from event_visuals table via loadEventVisuals()
      confirmations: (event.rsvps || []).map(rsvp => ({
                name: rsvp.guest_name,
                attending: rsvp.attending === true || rsvp.attending === 'yes',
                side: rsvp.side ?? null,
                companions: rsvp.companions ? rsvp.companions.split('|').filter(Boolean) : [],
                kids: rsvp.kids ? rsvp.kids.split('|').filter(Boolean) : [],
                wantsGift: rsvp.wants_gift === true || rsvp.wants_gift === 'yes',
          message: rsvp.message || '',
          ownerReply: rsvp.owner_reply || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }))
            };
          });
          
          console.log('✅ Admin dashboard carregado:', { contas: Store.users.length, eventos: Store.events.length });
        } else {
          // ✅ SE É UTILIZADOR NORMAL: carregar apenas seus eventos
          console.log('Utilizador normal - carregando seus eventos...');
          
          const userEvents = await supabaseRequest(`events?user_id=eq.${userId}&select=id,title,date,time,user_id,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,allow_messages,show_guest_messages,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,groom_name,bride_name,couple_size,show_couple,bg_url,bg_overlay,bible_text,bible_ref,show_bible,invite_text,show_invite,groom_parents,bride_parents,show_parents,gallery_urls,show_gallery,show_manual,manual_items,show_schedule,schedule_items,custom_font_family,section_order,story_text,invite_blessing,event_color,decor_ornament_url,decor_side_url,show_decor,save_the_date,confirm_by_date,cover_image,event_code,gifts(id,name,category,reserved,reserved_by),rsvps(guest_name,attending,side,companions,kids,wants_gift,message,created_at,updated_at)`);
          
          console.log('📥 Eventos recebidos do Supabase:', userEvents?.length || 0);
          
          // ✅ Normalizar dados do Supabase
          if (userEvents && Array.isArray(userEvents) && userEvents.length >= 0) {
            Store.events = userEvents.map(event => {
              const maxComp = event.max_companions !== null && event.max_companions !== undefined ? parseInt(event.max_companions) : 2;
              const maxKds = event.max_kids !== null && event.max_kids !== undefined ? parseInt(event.max_kids) : 2;
              let deadlineDate = event.confirm_by_date;
              if (deadlineDate) deadlineDate = deadlineDate.trim();
              if (!deadlineDate || deadlineDate === '') deadlineDate = event.date;
              
              return {
                id: event.id,
                user_id: event.user_id,
                userId: event.user_id,
                title: event.title,
                date: event.date,
                time: event.time,
                eventCode: event.event_code || event.id,
                deadline: deadlineDate,
                confirm_by_date: deadlineDate,
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
      event_color: event.event_color || null,
      decor_ornament_url: event.decor_ornament_url || null,
      decor_side_url: event.decor_side_url || null,
      show_decor: event.show_decor || null,
      save_the_date: event.save_the_date || null,
      story_text: event.story_text || null,
      invite_blessing: event.invite_blessing || null,
      event_color: event.event_color || null,
        cover: event.cover_image,
                cover_image: event.cover_image,
                gifts: (event.gifts || []).map(g => ({
                  id: g.id,
                  name: g.name,
                  category: g.category || 'Sem categoria',
                  reserved: g.reserved || false,
                  reservedBy: g.reserved_by || null
                })),
  // visual data loaded from event_visuals table via loadEventVisuals()
      confirmations: (event.rsvps || []).map(rsvp => ({
                  name: rsvp.guest_name,
                  attending: rsvp.attending === true || rsvp.attending === 'yes',
                  side: rsvp.side ?? null,
                  companions: rsvp.companions ? rsvp.companions.split('|').filter(Boolean) : [],
                  kids: rsvp.kids ? rsvp.kids.split('|').filter(Boolean) : [],
                  wantsGift: rsvp.wants_gift === true || rsvp.wants_gift === 'yes',
          message: rsvp.message || '',
          ownerReply: rsvp.owner_reply || '',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }))
              };
            });
            
            console.log('✅ Store.events sincronizado:', Store.events.length, 'eventos carregados');
          } else {
            console.log('⚠️ Nenhum evento retornado');
            Store.events = [];
          }
        }
      } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        // Keep existing events if already loaded — don't wipe on transient errors
        if (!Store.events || Store.events.length === 0) Store.events = [];
        if (!Store.users || Store.users.length === 0) Store.users = [];
      }
      
      return true; // Indicar que dados foram carregados
    }
    return false;
  }

  // ✅ PASSO 4: Verificar URL PRIMEIRO (evita flash do dashboard)
  const eventFromURL = await checkURLForEvent();
  
  if (eventFromURL) {
    console.log('📍 Evento encontrado na URL');
    // Load session in background if logged in (for back button functionality)
    if (token && userId) loadEventosComDelay().catch(() => {});
    Router.go(eventFromURL);
  } else {
    // ✅ PASSO 5: Só depois carrega eventos (se sessão existe)
    const sessaoCarregada = await loadEventosComDelay();
    
    if (token && userId && sessaoCarregada) {
      console.log('✅ Sessão válida com', Store.events.length, 'evento(s)');
      Router.go('dashboard');
    } else {
      console.log('🏠 Navegando para home');
      Router.go('home');

      // ── Landing nav scroll effect ──
      window.addEventListener('scroll', () => {
        const nav = document.getElementById('landing-nav');
        if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
      }, { passive: true });

      // ── Show WhatsApp float on landing ──
      const _waBtn = document.getElementById('wa-float-btn');
      if (_waBtn) _waBtn.style.display = 'flex';
    }
  }
});

