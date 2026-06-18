async function handleRegister(e) {
  e.preventDefault();
  const accessToken = document.getElementById('reg-access-token')?.value?.trim().toUpperCase();
  const phone = document.getElementById('reg-phone').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  const errEl = document.getElementById('reg-error');
  const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };

  if (!accessToken) { showErr('Insere o código de acesso fornecido pela AdKira.'); return; }
  if (!phone) { showErr('Insere o teu telefone ou ID.'); return; }
  if (pass.length < 4) { showErr('A senha deve ter pelo menos 4 caracteres.'); return; }
  if (pass !== pass2) { showErr('As senhas não coincidem.'); return; }
  errEl.classList.add('hidden');

  const btn = e.target.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = 'A verificar código...'; }

  try {
    const tokenRows = await supabaseRequest(
      `intake_tokens?token=eq.${encodeURIComponent(accessToken)}&select=token,locked,expires_at,event_id&limit=1`
    );
    const tk = tokenRows && tokenRows[0];
    if (!tk) { showErr('Código inválido. Verifica e tenta novamente.'); if (btn) { btn.disabled = false; btn.textContent = 'Criar Conta'; } return; }
    if (tk.locked) { showErr('Este código já foi utilizado.'); if (btn) { btn.disabled = false; btn.textContent = 'Criar Conta'; } return; }
    if (tk.expires_at && new Date(tk.expires_at) < new Date()) { showErr('Este código expirou. Contacta a AdKira.'); if (btn) { btn.disabled = false; btn.textContent = 'Criar Conta'; } return; }

    if (btn) btn.textContent = 'A criar conta...';
    const result = await supabaseRequest('accounts', 'POST', {
      phone, password: pass, role: 'user', approved: true, event_limit: 1, login_count: 0
    });
    if (!result || !result[0]) {
      showErr('Erro ao criar conta. O telefone pode já estar em uso.');
      if (btn) { btn.disabled = false; btn.textContent = 'Criar Conta'; }
      return;
    }
    await supabaseRequest(`intake_tokens?token=eq.${encodeURIComponent(accessToken)}`, 'PATCH', {
      locked: true, locked_at: new Date().toISOString(), locked_by: phone
    });
    const newAccount = result[0];
    localStorage.setItem('authToken', newAccount.id);
    localStorage.setItem('userId', newAccount.id);
    localStorage.setItem('userPhone', phone);
    localStorage.setItem('userRole', 'user');
    Store.currentUser = { id: newAccount.id, phone, role: 'user' };

    // Increment permanent account counter (never decreases)
    try {
      const cfgRows = await supabaseRequest('site_config?key=eq.total_accounts_ever&select=value&limit=1');
      const current = parseInt(cfgRows?.[0]?.value || '0');
      await supabaseRequest('site_config?key=eq.total_accounts_ever', 'PATCH', { value: String(current + 1) });
    } catch(e) {}

    // Link order to this account if this token came from an order
    try {
      await supabaseRequest(`orders?access_token=eq.${encodeURIComponent(accessToken)}`, 'PATCH', {
        account_id: newAccount.id, status: 'account_created', updated_at: new Date().toISOString()
      });
    } catch(e) {}

    toast('Conta criada com sucesso!');

    // If token has an event_id, go to intake form; otherwise create a blank event first
    if (tk.event_id) {
      Store._intakeEventId = tk.event_id;
      openIntakeForm(tk.event_id);
    } else {
      // Create a new blank event for this user, then open intake form for it
      const newEvent = await supabaseRequest('events', 'POST', {
        title: 'O Meu Evento', user_id: newAccount.id, event_code: Math.random().toString(36).substring(2,10).toUpperCase()
      }).catch(() => null);
      if (newEvent && newEvent[0]) {
        // Increment permanent event counter
        try {
          const cfgRows2 = await supabaseRequest('site_config?key=eq.total_events_ever&select=value&limit=1');
          const current2 = parseInt(cfgRows2?.[0]?.value || '0');
          await supabaseRequest('site_config?key=eq.total_events_ever', 'PATCH', { value: String(current2 + 1) });
        } catch(e) {}
        await supabaseRequest(`orders?access_token=eq.${encodeURIComponent(accessToken)}`, 'PATCH', { event_id: newEvent[0].id }).catch(() => {});
        Store._intakeEventId = newEvent[0].id;
        openIntakeForm(newEvent[0].id);
      } else {
        Router.go('dashboard');
      }
    }
  } catch(err) {
    showErr('Erro ao criar conta. Tenta novamente.');
    if (btn) { btn.disabled = false; btn.textContent = 'Criar Conta'; }
  }
}


async function handleLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('login-phone').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');

  toast('Autenticando...');
  
  // ✅ Buscar no Supabase
  const accountData = await supabaseRequest(`accounts?phone=eq.${encodeURIComponent(phone)}`);
  
  console.log('🔍 Resultado da busca de conta:', {
    phone: phone,
    resultado: accountData,
    encontrou: accountData && accountData.length > 0
  });
  
  if (!accountData || accountData.length === 0) {
    console.log('❌ Nenhuma conta encontrada para:', phone);
    errEl.textContent = 'Conta não encontrada.';
    errEl.classList.remove('hidden');
    return;
  }

  const user = accountData[0];
  console.log('✅ Conta encontrada:', {
    id: user.id,
    phone: user.phone,
    status: user.status,
    role: user.role
  });
  
  // ✅ Validar senha (em produção usar bcrypt)
  if (user.password !== pass) {
    console.log('❌ Senha incorreta para:', phone);
    errEl.textContent = 'Senha incorreta.';
    errEl.classList.remove('hidden');
    return;
  }

  // ✅ CRÍTICO: Verificar se conta está APROVADA pelo admin
  if (user.status === 'pending') {
    console.log('⏳ Conta pendente de aprovação:', phone);
    errEl.textContent = '⏳ Sua conta ainda não foi aprovada pelo administrador.';
    errEl.classList.remove('hidden');
    return;
  }

  // ✅ CRÍTICO: Verificar se conta foi BLOQUEADA
  if (user.status === 'blocked') {
    console.log('🚫 Conta bloqueada:', phone);
    errEl.textContent = 'Sua conta foi bloqueada. Contacte o administrador.';
    errEl.classList.remove('hidden');
    return;
  }
  
  // ✅ CRÍTICO: Verificar se conta foi DELETADA (não deveria chegar aqui, mas é proteção extra)
  if (user.status === 'deleted' || user.deleted_at) {
    console.log('🗑️ Conta deletada:', phone);
    errEl.textContent = 'Esta conta foi eliminada. Não é possível fazer login.';
    errEl.classList.remove('hidden');
    return;
  }

  // ✅ Login bem-sucedido
  console.log('✅ Login bem-sucedido para:', phone);
  
  const userRole = user.role || 'user';
  Store.currentUser = {
    id: user.id,
    phone: user.phone,
    role: userRole,
    status: user.status,
    eventLimit: user.event_limit
  };

  // Mostrar topbar com hambúrguer
  showTopbar(Store.currentUser);

  localStorage.setItem('authToken', user.id);
  localStorage.setItem('userId', user.id);
  localStorage.setItem('userPhone', user.phone);
  localStorage.setItem('userRole', userRole);

  // ── Increment login count and check for notices to show ──
  // NOTE: admin god accounts never see maintenance notices or review prompts —
  // those are user-facing features and the admin's own login isn't a "customer" event.
  if (userRole !== 'admin') {
    const newLoginCount = (user.login_count || 0) + 1;
    supabaseRequest(`accounts?id=eq.${user.id}`, 'PATCH', { login_count: newLoginCount }).catch(() => {});
    Store.currentUser.loginCount = newLoginCount;

    // Show active site notices (e.g. maintenance) up to 2 times per user
    _checkAndShowLoginNotices(user.id).catch(() => {});

    // Prompt for review on exactly the 5th login (once only)
    if (newLoginCount === 5 && !user.review_requested) {
      setTimeout(() => {
        if (typeof openLeaveReview === 'function') {
          _showReviewPrompt(user.id);
        }
      }, 1500);
    }
  }

  // ── Track login for analytics (admin logins excluded — see visit_log) ──
  if (userRole !== 'admin') {
    supabaseRequest('visit_log', 'POST', { visit_type: 'user_login', account_id: user.id }).catch(() => {});
  }

  toast('Bem-vindo! Carregando seus dados...');

  // 🎯 Carregar dados do Supabase
  if (user.role === 'admin') {
    console.log('👨‍💼 Admin logado - carregando dados administrativos...');
    
    // ✅ AGUARDAR um pouco para garantir conexão
    await new Promise(r => setTimeout(r, 300));
    
    // ✅ CARREGA 1: TODAS AS CONTAS
    const allAccounts = await supabaseRequest(`accounts?select=id,phone,password,role,status,created_at,event_limit,admin_label&limit=500&order=created_at.desc`);
    
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
    
    console.log('✅ Contas carregadas:', Store.users?.length || 0, 'contas');
    
    // ✅ CARREGA 2: TODOS OS EVENTOS (COM JOIN para presentes e RSVPs)
    const allEvents = await supabaseRequest(`events?select=id,title,date,time,user_id,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,allow_messages,show_guest_messages,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,groom_name,bride_name,couple_size,show_couple,bg_url,bg_overlay,bible_text,bible_ref,show_bible,invite_text,show_invite,groom_parents,bride_parents,show_parents,gallery_urls,show_gallery,show_manual,manual_items,show_schedule,schedule_items,custom_font_family,section_order,story_text,invite_blessing,event_color,confirm_by_date,cover_image,event_code,gifts(id,name,category,reserved,reserved_by),rsvps(guest_name,attending,side,companions,kids,wants_gift,message,created_at,updated_at)&limit=500&order=date.desc`);
    
    console.log('✅ Eventos carregados:', allEvents?.length || 0, 'eventos');
    
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
        confirmations: (event.rsvps || []).map(rsvp => ({
          name: rsvp.guest_name,
          attending: rsvp.attending === true || rsvp.attending === 'yes',
          side: rsvp.side ?? null,
          companions: rsvp.companions ? rsvp.companions.split('|').filter(Boolean) : [],
          kids: rsvp.kids ? rsvp.kids.split('|').filter(Boolean) : [],
          wantsGift: rsvp.wants_gift === true || rsvp.wants_gift === 'yes',
          message: rsvp.message || '',
          ownerReply: rsvp.owner_reply || '',
        }))
      };
    });
    
    console.log('📊 Admin dashboard carregado:', {
      contas: Store.users.length,
      eventos: Store.events.length,
      role: userRole
    });
    
    setTimeout(() => Router.go('admin'), 300);
  } else {
    console.log('Utilizador normal logado - carregando eventos pessoais...');
    
    // ✅ Usar função melhorada que já traz tudo pronto
    const userData = await fetchUserDataForOrganizer(user.id);
    if (userData && userData.events) {
      Store.events = userData.events;
      console.log('✅ Store.events sincronizado com Supabase:', Store.events.length, 'eventos carregados');
    }
    Router.go('dashboard');
  }
}

function handleLogout() {
  Store.currentUser = null;
  hideTopbar();
  localStorage.removeItem('authToken');
  localStorage.removeItem('userId');
  localStorage.removeItem('userPhone');
  localStorage.removeItem('userRole');
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('userId');
  localStorage.removeItem('lastUserPhone');
  localStorage.removeItem('adminImpersonatingUserId');
  localStorage.removeItem('adminImpersonatingUserPhone');
  localStorage.removeItem('adminOriginalUserId');
  localStorage.removeItem('adminOriginalUserPhone');
  Router.go('home');
  toast('Desconectado com sucesso.');
}


// ===================== CHANGE USER PASSWORD =====================
function editAdminLabel(userId) {
  const user = Store.users.find(u => u.id === userId);
  if (!user) return;

  // Apenas admin pode alterar
  if (!Store.currentUser || Store.currentUser.role !== 'admin') {
    toast('Apenas admin pode atribuir nomes!');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Atribuir Nome (Admin Label)</h3>
      <p class="text-sm text-gray-500 mb-4">Utilizador: <strong>${user.phone}</strong></p>
      
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Nome Identificador</label>
          <input id="admin-label-input" type="text" class="input-field" placeholder="Ex: João Silva - Casamento" value="${user.adminLabel || ''}">
          <p class="text-xs text-gray-400 mt-1">Este nome é apenas para VOCÊ identificar este utilizador. O utilizador NÃO vê isto.</p>
        </div>
      </div>
      
      <div class="bg-blue-50 border-l-3 border-blue-500 p-3 rounded mb-4 text-xs text-blue-700">
        Use um nome descritivo para saber rapidamente quem é este utilizador (ex: organização do evento, nome do cliente, etc).
      </div>
      
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="saveAdminLabel('${userId}', this.closest('.modal-overlay'))">Guardar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('admin-label-input').focus();
}

function saveAdminLabel(userId, modal) {
  const label = document.getElementById('admin-label-input').value.trim();
  
  const user = Store.users.find(u => u.id === userId);
  if (!user) {
    console.error('❌ Utilizador não encontrado:', userId);
    return;
  }

  console.log('💾 Salvando admin label:', { userId, label });

  // ✅ Atualizar Store PRIMEIRO
  user.adminLabel = label && label.length > 0 ? label : null;
  
  console.log('✅ Store atualizado. Novo valor:', user.adminLabel);

  // ✅ CRÍTICO: Sincronizar com Supabase
  const updateData = label && label.length > 0 
    ? { admin_label: label } 
    : { admin_label: null };

  console.log('📤 Enviando para Supabase:', updateData);

  supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', updateData).then(result => {
    console.log('✅ Resposta do Supabase:', result);
    
    modal.remove();
    toast(label && label.length > 0 
      ? `Nome "${label}" atribuído com sucesso!` 
      : 'Nome removido!');
    
    renderAdmin();
  }).catch(error => {
    console.error('❌ Erro ao salvar admin label no Supabase:', error);
    toast(' Erro ao salvar. Tente novamente.');
  });
}

function changeUserPassword(userId) {
  const user = Store.users.find(u => u.id === userId);
  if (!user) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Alterar Senha</h3>
      <p class="text-sm text-gray-500 mb-4">Utilizador: <strong>${user.phone}</strong></p>
      
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Nova Senha</label>
          <input id="new-password-input" type="text" class="input-field" placeholder="Digite a nova senha" value="">
          <p class="text-xs text-gray-400 mt-1">Mínimo 4 caracteres</p>
        </div>
      </div>
      
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="saveUserPassword('${userId}', this.closest('.modal-overlay'))">Guardar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('new-password-input').focus();
}

function saveUserPassword(userId, modal) {
  const newPassword = document.getElementById('new-password-input').value.trim();
  
  if (newPassword.length < 4) {
    toast('Senha deve ter mínimo 4 caracteres!');
    return;
  }

  const user = Store.users.find(u => u.id === userId);
  if (!user) return;
  // ✅ Sincronizar com Supabase
  supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', { password: newPassword });
  
  modal.remove();
  toast('Senha alterada com sucesso!');
  renderAdmin();
}

// ===================== CHANGE USER PHONE/USERNAME =====================
function changeUserPhone(userId) {
  const user = Store.users.find(u => u.id === userId);
  if (!user) return;

  // Apenas admin pode alterar username
  if (!Store.currentUser || Store.currentUser.role !== 'admin') {
    toast('Apenas admin pode alterar username!');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Alterar Username</h3>
      <p class="text-sm text-gray-500 mb-4">Username atual: <strong>${user.phone}</strong></p>
      
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Novo Username</label>
          <input id="new-phone-input" type="text" class="input-field" placeholder="Digite o novo username" value="${user.phone}">
          <p class="text-xs text-gray-400 mt-1">Este é o identificador único do utilizador (ex: telefone, email, username)</p>
        </div>
      </div>
      
      <div class="bg-amber-50 border-l-3 border-amber-500 p-3 rounded mb-4 text-xs text-amber-700">
         O utilizador terá que usar o NOVO username para fazer login!
      </div>
      
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="saveUserPhone('${userId}', this.closest('.modal-overlay'))">Guardar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('new-phone-input').focus();
}

function changeUserId(userId) {
  const user = Store.users.find(u => u.id === userId);
  if (!user) return;

  // Apenas admin pode alterar ID
  if (!Store.currentUser || Store.currentUser.role !== 'admin') {
    toast('Apenas admin pode alterar ID!');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Alterar ID do Utilizador</h3>
      <p class="text-sm text-gray-500 mb-4">Username: <strong>${user.phone}</strong></p>
      <p class="text-sm text-gray-500 mb-4">ID atual: <code class="bg-gray-200 px-2 py-1 rounded">${user.id}</code></p>
      
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Novo ID</label>
          <input id="new-user-id-input" type="text" class="input-field" placeholder="Digite o novo ID" value="${user.id}">
          <p class="text-xs text-gray-400 mt-1">Identificador único (não pode ser repetido)</p>
        </div>
      </div>
      
      <div class="bg-red-50 border-l-3 border-red-500 p-3 rounded mb-4 text-xs text-red-700">
        <strong>Aviso:</strong> Alterar o ID pode quebrar todos os eventos deste utilizador! Certifique-se antes de continuar.
      </div>
      
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="saveUserId('${userId}', this.closest('.modal-overlay'))">Guardar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('new-user-id-input').focus();
}

function saveUserId(userId, modal) {
  const newId = document.getElementById('new-user-id-input').value.trim();
  
  if (!newId || newId.length < 2) {
    toast('Digite um ID válido (mínimo 2 caracteres)!');
    return;
  }

  const user = Store.users.find(u => u.id === userId);
  if (!user) return;

  // Verificar se já existe outro utilizador com este ID
  const idExists = Store.users.some(u => u.id !== userId && u.id === newId);
  if (idExists) {
    toast('Este ID já está em uso por outro utilizador!');
    return;
  }

  const oldId = user.id;
  
  // ✅ PASSO 1: Atualizar TODOS os eventos deste utilizador
  console.log('🔄 Atualizando user_id em todos os eventos...');
  const userEvents = Store.events.filter(e => e.userId === oldId || e.user_id === oldId);
  
  userEvents.forEach(event => {
    event.user_id = newId;
    event.userId = newId;
    
    // ✅ Sincronizar evento no Supabase
    supabaseRequest(`events?id=eq.${event.id}`, 'PATCH', { user_id: newId });
  });

  // ✅ PASSO 2: Atualizar ID do utilizador
  user.id = newId;
  
  // ✅ PASSO 3: Sincronizar utilizador no Supabase
  // ⚠️ CRÍTICO: Deletar o registo antigo e criar um novo com o novo ID
  console.log('🔄 Atualizando ID do utilizador no Supabase...');
  
  // Primeiro, copiar os dados do utilizador antigo
  const userData = {
    id: newId,
    phone: user.phone,
    password: user.password,
    role: user.role,
    status: user.status,
    event_limit: user.eventLimit,
    admin_label: user.adminLabel,
    created_at: user.createdAt
  };

  // Inserir novo registo com novo ID
  supabaseRequest('accounts', 'POST', userData).then(result => {
    console.log('✅ Novo registo criado com ID:', newId);
    
    // Depois, deletar o registo antigo
    supabaseRequest(`accounts?id=eq.${oldId}`, 'DELETE', {}).then(delResult => {
      console.log('✅ Registo antigo deletado');
      
      modal.remove();
      toast(`ID alterado de "${oldId}" para "${newId}" e todos os ${userEvents.length} evento(s) foram atualizados!`);
      renderAdmin();
    }).catch(error => {
      console.error('❌ Erro ao deletar registo antigo:', error);
      toast(' ID criado mas registo antigo não foi deletado. Limpe manualmente no Supabase!');
    });
  }).catch(error => {
    console.error('❌ Erro ao criar novo registo:', error);
    toast(' Erro ao alterar ID. Tente novamente.');
  });
}

function saveUserPhone(userId, modal) {
  const newPhone = document.getElementById('new-phone-input').value.trim();
  
  if (!newPhone || newPhone.length < 2) {
    toast('Digite um username válido (mínimo 2 caracteres)!');
    return;
  }

  const user = Store.users.find(u => u.id === userId);
  if (!user) return;

  // Verificar se já existe outro utilizador com este username
  const phoneExists = Store.users.some(u => u.id !== userId && u.phone === newPhone);
  if (phoneExists) {
    toast('Este username já está em uso por outro utilizador!');
    return;
  }

  const oldPhone = user.phone;
  user.phone = newPhone;
  
  // ✅ Sincronizar com Supabase
  supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', { phone: newPhone });
  
  modal.remove();
  toast(`Username alterado de "${oldPhone}" para "${newPhone}"`);
  renderAdmin();
}


// ── Show active site notices up to 2 times per logged-in user ──
async function _checkAndShowLoginNotices(userId) {
  const notices = await supabaseRequest(`site_notices?active=eq.true&select=id,title,message,type&order=created_at.desc&limit=5`).catch(() => []);
  if (!notices || !notices.length) return;

  for (const notice of notices) {
    const viewRows = await supabaseRequest(
      `notice_views?notice_id=eq.${notice.id}&user_id=eq.${userId}&select=id,view_count&limit=1`
    ).catch(() => []);

    const existing = viewRows && viewRows[0];
    const viewCount = existing ? existing.view_count : 0;

    if (viewCount >= 2) continue; // Already shown twice, skip

    // Show the notice
    _showNoticeModal(notice);

    // Increment view count
    if (existing) {
      await supabaseRequest(`notice_views?id=eq.${existing.id}`, 'PATCH', { view_count: viewCount + 1 }).catch(() => {});
    } else {
      await supabaseRequest('notice_views', 'POST', { notice_id: notice.id, user_id: userId, view_count: 1 }).catch(() => {});
    }
    break; // Show only one notice per login
  }
}

function _showNoticeModal(notice) {
  const TYPE_COLORS = { info: '#3b82f6', warning: '#f59e0b', maintenance: '#ef4444' };
  const TYPE_ICONS = { info: 'info', warning: 'alert-triangle', maintenance: 'tool' };
  const color = TYPE_COLORS[notice.type] || TYPE_COLORS.info;

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem';
  modal.innerHTML = `<div style="background:#fff;border-radius:1.25rem;padding:1.75rem;max-width:420px;width:100%;text-align:center">
    <div style="width:52px;height:52px;border-radius:50%;background:${color}18;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
    <h3 style="font-size:1.05rem;font-weight:800;color:#1e293b;margin-bottom:0.5rem">${escapeHTML(notice.title)}</h3>
    <p style="font-size:0.88rem;color:#6b7280;line-height:1.6;margin-bottom:1.25rem">${escapeHTML(notice.message)}</p>
    <button onclick="this.closest('div[style*=fixed]').remove()" style="background:${color};color:#fff;border:none;border-radius:999px;padding:0.75rem 2rem;font-weight:700;cursor:pointer;font-family:inherit">Entendido</button>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelector('button').closest('div').parentElement.onclick = null; // avoid duplicate
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
}

// ── Review prompt on 5th login ──
function _showReviewPrompt(userId) {
  const modal = document.createElement('div');
  modal.id = '_review-prompt-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem';
  modal.innerHTML = `<div style="background:#fff;border-radius:1.25rem;padding:1.75rem;max-width:400px;width:100%;text-align:center">
    <div style="font-size:2rem;margin-bottom:0.5rem">⭐</div>
    <h3 style="font-size:1.05rem;font-weight:800;color:#1e293b;margin-bottom:0.5rem">Gostas da AdKira?</h3>
    <p style="font-size:0.85rem;color:#6b7280;margin-bottom:1.25rem">A tua opinião ajuda-nos a crescer. Gostarias de deixar uma avaliação rápida?</p>
    <button onclick="document.getElementById('_review-prompt-modal').remove(); if(typeof openLeaveReview==='function') openLeaveReview();" style="background:#007f9f;color:#fff;border:none;border-radius:999px;padding:0.75rem 2rem;font-weight:700;cursor:pointer;width:100%;margin-bottom:0.5rem;font-family:inherit">Avaliar Agora</button>
    <button onclick="document.getElementById('_review-prompt-modal').remove()" style="background:none;border:none;color:#9ca3af;font-size:0.82rem;cursor:pointer;font-family:inherit">Talvez depois</button>
  </div>`;
  document.body.appendChild(modal);

  // Mark as requested so it never shows again
  supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', { review_requested: true }).catch(() => {});
}
