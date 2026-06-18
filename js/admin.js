// ===================== ADMIN =====================

// ===================== CONTAS POR APROVAR =====================
function openPendingAccounts() {
  Router.go('pending-accounts');
}

function renderPendingAccounts() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') { Router.go('admin'); return; }
  const container = document.getElementById('pending-accounts-list');
  if (!container) return;
  const pending = (Store.users || []).filter(u => u.status === 'pending');
  if (pending.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm p-8 text-center border border-gray-100">
        <div class="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <i data-lucide="check-circle" class="w-7 h-7 text-green-500"></i>
        </div>
        <p class="font-bold text-gray-700 mb-1">Nenhuma conta pendente</p>
        <p class="text-sm text-gray-400">Todas as contas foram revistas.</p>
      </div>`;
    lucide.createIcons();
    return;
  }
  container.innerHTML = pending.map(u => `
    <div class="bg-white rounded-2xl shadow-sm p-5 border border-amber-100">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center font-bold text-amber-700 flex-shrink-0">
          ${u.phone.charAt(0).toUpperCase()}
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-gray-800 text-sm truncate">${u.phone}</p>
          <p class="text-xs text-gray-400">ID: ${u.id}</p>
        </div>
        <span class="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">Pendente</span>
      </div>
      <div class="flex gap-2">
        <button class="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white rounded-xl py-2.5 font-bold text-sm transition"
          onclick="approveFromPending('${u.id}')">
          <i data-lucide="check" class="w-4 h-4"></i> Aprovar
        </button>
        <button class="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 font-bold text-sm transition"
          onclick="rejectFromPending('${u.id}')">
          <i data-lucide="x" class="w-4 h-4"></i> Rejeitar
        </button>
      </div>
    </div>`).join('');
  lucide.createIcons();
}

function approveFromPending(userId) {
  const u = Store.users.find(u => u.id === userId);
  if (!u) return;
  supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', { status: 'active' }).then(() => {
    u.status = 'active';
    toast('Conta aprovada.');
    renderPendingAccounts();
    buildAdminQuickGrid();
    buildDrawerNav(Store.currentUser);
  });
}

function rejectFromPending(userId) {
  const u = Store.users.find(u => u.id === userId);
  if (!u) return;
  supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', { status: 'blocked' }).then(() => {
    u.status = 'blocked';
    toast('Conta rejeitada.');
    renderPendingAccounts();
    buildAdminQuickGrid();
    buildDrawerNav(Store.currentUser);
  });
}


// ===================== ADMIN PANEL =====================
function renderAdmin() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') { Router.go('dashboard'); return; }

  // Quick grid do admin
  buildAdminQuickGrid();

  const nonAdminUsers = Store.users.filter(u => u.role !== 'admin' && u.status !== 'deleted');
  const active = nonAdminUsers.filter(u => u.status === 'active').length;
  const pending = nonAdminUsers.filter(u => u.status === 'pending').length;

  const stats = [
    { label: 'Total Contas', value: nonAdminUsers.length, color: 'bg-blue-50 text-blue-600', icon: 'users' },
    { label: 'Ativas', value: active, color: 'bg-green-50 text-green-600', icon: 'check-circle' },
    { label: 'Pendentes', value: pending, color: 'bg-amber-50 text-amber-600', icon: 'clock' },
    { label: 'Total Eventos', value: Store.events.length, color: 'bg-indigo-50 text-indigo-600', icon: 'calendar' }
  ];

  document.getElementById('admin-stats').innerHTML = stats.map(s => `
    <div class="stat-card ${s.color} rounded-xl p-4 text-center">
      <i data-lucide="${s.icon}" class="w-5 h-5 mx-auto mb-1"></i>
      <div class="text-2xl font-bold">${s.value}</div>
      <div class="text-xs font-semibold mt-1">${s.label}</div>
    </div>`).join('');

  // Limpar input de busca
  document.getElementById('admin-search-input').value = '';
  
  renderAdminAccountsList(nonAdminUsers);
  lucide.createIcons();
}

function filterAdminAccounts() {
  const searchTerm = document.getElementById('admin-search-input').value.toLowerCase().trim();
  const nonAdminUsers = Store.users.filter(u => u.role !== 'admin' && u.status !== 'deleted');
  
  if (!searchTerm) {
    renderAdminAccountsList(nonAdminUsers);
    return;
  }
  
  // Filtrar por telefone/username (match parcial)
  const filtered = nonAdminUsers.filter(u => 
    u.phone.toLowerCase().includes(searchTerm)
  );
  
  console.log('🔍 Pesquisa:', { searchTerm, total: nonAdminUsers.length, encontrados: filtered.length });
  
  if (filtered.length === 0) {
    document.getElementById('admin-accounts').innerHTML = `
      <div class="bg-white rounded-xl shadow-sm p-8 text-center">
        <i data-lucide="search" class="w-12 h-12 text-gray-300 mx-auto mb-3"></i>
        <p class="text-gray-500">Nenhuma conta encontrada para: <strong>"${searchTerm}"</strong></p>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  renderAdminAccountsList(filtered);
}

function clearAdminSearch() {
  document.getElementById('admin-search-input').value = '';
  const nonAdminUsers = Store.users.filter(u => u.role !== 'admin' && u.status !== 'deleted');
  renderAdminAccountsList(nonAdminUsers);
}

function renderAdminAccountsList(users) {
  const statusColors = { active: 'bg-green-100 text-green-700', pending: 'bg-amber-100 text-amber-700', blocked: 'bg-red-100 text-red-600' };
  const statusLabels = { active: 'Ativo', pending: 'Pendente', blocked: 'Bloqueado' };

  let accountsHtml = '';
  // (import-file input kept for triggerImport compatibility)
  accountsHtml += '<input id="import-file" type="file" accept=".json,.csv" class="hidden" onchange="handleImport(event)">';

  accountsHtml += users.map(u => {
    const userEvents = Store.events.filter(e => e.userId === u.id).length;
    const userStatus = statusLabels[u.status] || statusLabels['active'] || 'Ativo';
    const userPhone = u.phone || 'N/A';
    const userId = u.id || 'N/A';
    const userPassword = u.password || 'N/A';
    const userStatusClass = statusColors[u.status] || statusColors['active'] || 'bg-green-100 text-green-700';
    const eventLimit = u.eventLimit !== null ? u.eventLimit : '∞';
    const adminLabel = u.adminLabel || '-';
    const userRole = u.role || 'user';
    
    let html = '<div class="bg-white rounded-xl shadow-sm p-4 mb-3">';
    html += '<div class="flex items-start gap-3 mb-3">';
    html += '<div class="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold flex-shrink-0">' + userPhone.charAt(0).toUpperCase() + '</div>';
    html += '<div class="flex-1 min-w-0">';
    html += '<p class="font-semibold text-gray-800 text-sm">' + userPhone + '</p>';
    html += '<p class="text-xs text-gray-500">ID: <code class="bg-gray-100 px-1 py-0.5 rounded">' + userId + '</code></p>';
    html += '</div></div>';
    
    html += '<div class="grid grid-cols-2 gap-2 mb-3 text-xs">';
    html += '<div class="bg-gray-50 p-2 rounded"><p class="text-gray-500 mb-0.5">Username</p><p class="text-gray-800 font-semibold break-all">' + userPhone + '</p></div>';
    html += '<div class="bg-gray-50 p-2 rounded"><p class="text-gray-500 mb-0.5">Tipo</p><p class="text-gray-800 font-semibold">' + (userRole === 'moderator' ? 'Moderador' : 'Utilizador') + '</p></div>';
    html += '<div class="bg-gray-50 p-2 rounded"><p class="text-gray-500 mb-0.5">Nome Admin</p><p class="text-gray-800 font-semibold">' + adminLabel + '</p></div>';
    html += '<div class="bg-gray-50 p-2 rounded"><p class="text-gray-500 mb-0.5">Senha</p><p class="text-gray-800 font-mono text-xs break-all">' + userPassword + '</p></div>';
    html += '<div class="bg-gray-50 p-2 rounded"><p class="text-gray-500 mb-0.5">Status</p><span class="inline-block px-2 py-0.5 rounded-full font-semibold ' + userStatusClass + '">' + userStatus + '</span></div>';
    html += '<div class="bg-gray-50 p-2 rounded"><p class="text-gray-500 mb-0.5">Eventos</p><p class="text-gray-800 font-semibold">' + userEvents + '/' + eventLimit + '</p></div>';
    html += '</div>';
    
    html += '<div class="flex flex-wrap gap-2">';
    html += '<button class="text-xs bg-teal-400 hover:bg-teal-500 text-white rounded-lg py-1.5 px-3 font-semibold transition" onclick="adminLoginAs(\'' + u.id + '\')">Entrar</button>';
    html += '<button class="text-xs bg-slate-500 hover:bg-slate-600 text-white rounded-lg py-1.5 px-3 font-semibold transition" onclick="editAdminLabel(\'' + u.id + '\')">Nome</button>';
    html += '<button class="text-xs bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg py-1.5 px-3 font-semibold transition" onclick="setEventLimit(\'' + u.id + '\')">Limite</button>';
    html += '<button class="text-xs bg-purple-500 hover:bg-purple-600 text-white rounded-lg py-1.5 px-3 font-semibold transition" onclick="toggleModeratorRole(\'' + u.id + '\')">' + (userRole === 'moderator' ? 'Utilizador' : 'Moderador') + '</button>';
    html += '<button class="text-xs bg-slate-500 hover:bg-slate-600 text-white rounded-lg py-1.5 px-3 font-semibold transition" onclick="changeUserPassword(\'' + u.id + '\')">Senha</button>';
    html += '<button class="text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-lg py-1.5 px-3 font-semibold transition" onclick="changeUserPhone(\'' + u.id + '\')">Username</button>';
    html += '<button class="text-xs ' + (u.edit_locked ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-600 hover:bg-yellow-700') + ' text-white rounded-lg py-1.5 px-3 font-semibold transition" onclick="adminToggleEditLock(\'' + u.id + '\',' + !!u.edit_locked + ')">' + (u.edit_locked ? '🔓 Desbloquear Edição' : '🔒 Bloquear Edição') + '</button>';
    
    if (Store.events.some(e => e.userId === u.id)) {
      html += '<button class="text-xs bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg py-1.5 px-3 font-semibold transition" onclick="showUserEventOptions(\'' + u.id + '\')">Eventos</button>';
    }
    
    if (u.status === 'pending') {
      html += '<button class="text-xs bg-green-500 hover:bg-green-600 text-white rounded-lg py-1.5 px-3 font-semibold transition" onclick="adminAction(\'' + u.id + '\',\'approve\')">Aprovar</button>';
    }
    
    if (u.status !== 'blocked' && u.status !== 'pending') {
      html += '<button class="text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-1.5 px-3 font-semibold transition" onclick="adminAction(\'' + u.id + '\',\'block\')">Bloquear</button>';
    }
    
    html += '<button class="text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg py-1.5 px-3 font-semibold transition" onclick="adminAction(\'' + u.id + '\',\'delete\')">Excluir</button>';
    html += '</div></div>';
    
    return html;
  }).join('');

  document.getElementById('admin-accounts').innerHTML = accountsHtml;
  lucide.createIcons();
}

function adminLoginAs(userId) {
  const user = Store.users.find(u => u.id === userId);
  if (user) {
    Store.adminOriginalUser = Store.currentUser; // Guardar admin original
    Store.adminModeActive = true;
    localStorage.setItem('adminImpersonatingUserId', user.id);
    localStorage.setItem('adminImpersonatingUserPhone', user.phone);
    localStorage.setItem('adminOriginalUserId', Store.adminOriginalUser.id);
    localStorage.setItem('adminOriginalUserPhone', Store.adminOriginalUser.phone);
    Store.currentUser = user;
    toast('Logado como ' + user.phone);
    Router.go('dashboard');
  }
}

function backToAdminPanel() {
  if (Store.adminOriginalUser) {
    Store.currentUser = Store.adminOriginalUser;
    Store.adminModeActive = false;
    Store.adminOriginalUser = null;
    localStorage.removeItem('adminImpersonatingUserId');
    localStorage.removeItem('adminImpersonatingUserPhone');
    localStorage.removeItem('adminOriginalUserId');
    localStorage.removeItem('adminOriginalUserPhone');
    if (!Store.users || Store.users.length === 0) { location.reload(); return; }
    Router.go('admin');
  }
}

function adminAction(userId, action) {
  if (action === 'approve') {
    const u = Store.users.find(u => u.id === userId);
    if (u) {
      u.status = 'active';
      // ✅ CRÍTICO: Sincronizar com Supabase IMEDIATAMENTE
      supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', { status: 'active' }).then(result => {
        console.log('✅ Conta aprovada e sincronizada com Supabase');
        toast('Conta aprovada e salva!');
        renderAdmin();
      }).catch(error => {
        console.error('❌ Erro ao sincronizar:', error);
        toast(' Erro ao sincronizar. Tente novamente.');
      });
      return;
    }
  } else if (action === 'block') {
    const u = Store.users.find(u => u.id === userId);
    if (u) {
      // 🔒 PROTEÇÃO: conta admin nunca pode ser bloqueada
      if (u.role === 'admin' || u.phone === 'invitesadkira@gmail.com') {
        toast('Operacao bloqueada: conta de administrador nao pode ser alterada.');
        return;
      }
      u.status = 'blocked';
      // ✅ CRÍTICO: Sincronizar com Supabase IMEDIATAMENTE
      supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', { status: 'blocked' }).then(result => {
        console.log('✅ Conta bloqueada e sincronizada com Supabase');
        toast('Conta bloqueada e salva!');
        renderAdmin();
      }).catch(error => {
        console.error('❌ Erro ao sincronizar:', error);
        toast(' Erro ao sincronizar. Tente novamente.');
      });
      return;
    }
  } else if (action === 'delete') {
    // ✅ CRÍTICO: Mostrar modal de confirmação ANTES de deletar
    const user = Store.users.find(u => u.id === userId);
    if (!user) return;
    
    const userEvents = Store.events.filter(e => e.userId === userId);
    
    const confirmModal = document.createElement('div');
    confirmModal.className = 'modal-overlay';
    confirmModal.innerHTML = `
      <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
        <h3 class="text-lg font-bold text-red-600 mb-2">Eliminar Conta Permanentemente?</h3>
        <p class="text-sm text-gray-600 mb-2">Utilizador: <strong>${user.phone}</strong></p>
        <p class="text-sm text-gray-600 mb-3">Eventos associados: <strong>${userEvents.length}</strong></p>
        <div class="bg-red-50 rounded-lg p-3 mb-4">
          <p class="text-xs text-red-700 font-semibold mb-1">⚠️ Esta acção é irreversível:</p>
          <ul class="text-xs text-red-600 space-y-1">
            <li>• A conta será eliminada permanentemente</li>
            <li>• Todos os eventos desta conta serão eliminados</li>
            <li>• Todas as confirmações de presença serão eliminadas</li>
          </ul>
        </div>
        <div class="flex gap-2">
          <button class="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 px-4 font-semibold transition" onclick="confirmAdminDeleteUser('${userId}', this.closest('.modal-overlay'))">
            Eliminar Permanentemente
          </button>
          <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(confirmModal);
    return;
  }
  renderAdmin();
}

async function confirmAdminDeleteUser(userId, modal) {
  const user = Store.users.find(u => u.id === userId);
  if (!user) { modal.remove(); return; }

  // 🔒 Admin God can NEVER be deleted
  if (user.role === 'admin' || user.phone === 'invitesadkira@gmail.com') {
    modal.remove();
    toast('Conta de administrador não pode ser eliminada.');
    return;
  }

  modal.remove();
  const btn = document.createElement('div');
  btn.innerHTML = '<div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;font-weight:600">A eliminar conta permanentemente...</div>';
  document.body.appendChild(btn);

  try {
    // 1. Get all events for this user
    const userEvents = await supabaseRequest(`events?user_id=eq.${userId}&select=id`);
    const eventIds = (userEvents || []).map(e => e.id);

    // 2. Delete RSVPs for each event
    for (const evId of eventIds) {
      await supabaseRequest(`rsvps?event_id=eq.${evId}`, 'DELETE');
      await supabaseRequest(`event_visuals?event_id=eq.${evId}`, 'DELETE');
      await supabaseRequest(`gifts?event_id=eq.${evId}`, 'DELETE');
    }

    // 3. Delete all events
    if (eventIds.length > 0) {
      await supabaseRequest(`events?user_id=eq.${userId}`, 'DELETE');
    }

    // 4. Delete the account
    await supabaseRequest(`accounts?id=eq.${userId}`, 'DELETE');

    Store.users  = Store.users.filter(u => u.id !== userId);
    Store.events = Store.events.filter(e => e.user_id !== userId && e.userId !== userId);

    btn.remove();
    toast(`Conta "${user.phone}" eliminada permanentemente.`);
    renderAdmin();
  } catch (error) {
    btn.remove();
    console.error('Erro ao eliminar conta:', error);
    toast('Erro ao eliminar conta. Verifica as permissões RLS no Supabase.');
    renderAdmin();
  }
}
async function adminEditDeliveryText() {
  const rows = await supabaseRequest('site_config?key=eq.packages_delivery_text&select=value&limit=1').catch(() => []);
  const current = (rows && rows[0] && rows[0].value)
    ? rows[0].value
    : 'Entrega em <strong>48h</strong> · Urgência 24h (taxa adicional de 8.000 Kz)';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-5" style="max-width:480px">
    <h3 class="text-base font-bold mb-3">Prazo de Entrega (site comercial)</h3>
    <p class="text-xs text-gray-500 mb-2">Podes usar HTML básico: <code>&lt;strong&gt;48h&lt;/strong&gt;</code></p>
    <textarea id="_delivery-text-input" class="input-field text-sm" rows="3" style="font-family:monospace">${current}</textarea>
    <p class="text-xs text-gray-400 mt-1 mb-3">Pré-visualização: <span id="_delivery-preview">${current}</span></p>
    <script>document.getElementById('_delivery-text-input').oninput = function(){document.getElementById('_delivery-preview').innerHTML=this.value}<\/script>
    <div class="flex gap-2">
      <button class="flex-1 btn-main text-sm" onclick="adminSaveDeliveryText()">Guardar</button>
      <button class="btn-outline text-sm" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function adminSaveDeliveryText() {
  const val = document.getElementById('_delivery-text-input')?.value?.trim();
  if (!val) { toast('Texto não pode estar vazio.'); return; }
  const ts = new Date().toISOString();
  const patch = await supabaseRequest('site_config?key=eq.packages_delivery_text', 'PATCH', { value: val, updated_at: ts });
  if (!patch || patch.length === 0) {
    await supabaseRequest('site_config', 'POST', { key: 'packages_delivery_text', value: val });
  }
  // Update live on the page
  const el = document.getElementById('packages-delivery-text');
  if (el) el.innerHTML = val;
  toast('Prazo de entrega actualizado!');
  document.querySelector('.modal-overlay')?. remove();
}

async function adminToggleEditLock(userId, currentlyLocked) {
  const newValue = !currentlyLocked;
  const label = newValue ? 'bloquear edição' : 'desbloquear edição';
  if (!confirm(`Tens a certeza que queres ${label} para este utilizador?`)) return;
  try {
    await supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', { edit_locked: newValue });
    toast(newValue ? '🔒 Edição bloqueada!' : '🔓 Edição desbloqueada!');
    // Refresh user list
    document.getElementById('admin-users-panel')?.querySelectorAll('button')
      ?.forEach(b => { if (b.textContent.includes('Utilizadores')) b.click(); });
    if (typeof renderAdminPanel !== 'undefined') renderAdminPanel();
  } catch(e) {
    toast('Erro ao alterar bloqueio. Verifica a consola.');
    console.error(e);
  }
}

function setEventLimit(userId) {
  const user = Store.users.find(u => u.id === userId);
  if (!user) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-2">Definir Limite de Eventos</h3>
      <p class="text-sm text-gray-500 mb-4">Usuário: <strong>${user.phone}</strong></p>
      
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Limite de Eventos</label>
          <input id="event-limit-input" type="number" min="0" max="100" value="${user.eventLimit !== null ? user.eventLimit : ''}" class="input-field" placeholder="0 = sem limite">
          <p class="text-xs text-gray-400 mt-1">Deixe vazio ou 0 para sem limite (∞)</p>
        </div>
      </div>
      
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="saveEventLimit('${userId}', this.closest('.modal-overlay'))">Guardar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('event-limit-input').focus();
}

function editEventURL(eventId) {
  const event = Store.events.find(e => e.id === eventId);
  if (!event) return;
  
  // APENAS admin pode trocar código
  if (Store.currentUser.role !== 'admin') {
    toast('Apenas administrador pode alterar o código do evento.');
    return;
  }

  const currentCode = event.eventCode || event.id;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  
  let html = '<div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">';
  html += '<h3 class="text-lg font-bold text-gray-800 mb-2">Alterar URL do Evento</h3>';
  html += '<p class="text-sm text-gray-500 mb-3">Evento: <strong>' + event.title + '</strong></p>';
  html += '<div class="bg-blue-50 border-l-3 border-blue-500 p-3 rounded mb-4 text-xs text-blue-700">';
  html += '<p class="font-semibold mb-1">URL Atual:</p>';
  html += '<code class="block bg-white p-2 rounded border border-blue-200 break-all">https://araujo418.github.io/painel-invitesqr/?event=' + currentCode + '</code>';
  html += '</div>';
  html += '<div class="space-y-3 mb-4"><div>';
  html += '<label class="block text-sm font-semibold text-gray-600 mb-1">Novo Código do Evento</label>';
  html += '<input id="event-url-input" type="text" value="' + currentCode + '" class="input-field uppercase" placeholder="Ex: ABC123XYZ" maxlength="20">';
  html += '<p class="text-xs text-gray-400 mt-1">Apenas letras e números. Este código será usado na URL.</p>';
  html += '</div></div>';
  html += '<div class="bg-amber-50 border-l-3 border-amber-500 p-3 rounded mb-4 text-xs text-amber-700">';
  html += 'Aviso: Links antigos deixarão de funcionar após a alteração.';
  html += '</div>';
  html += '<div class="flex gap-2">';
  html += '<button class="flex-1 btn-main" onclick="saveEventURL(\'' + eventId + '\', this.closest(\'.modal-overlay\'))">Guardar</button>';
  html += '<button class="flex-1 btn-outline" onclick="this.closest(\'.modal-overlay\').remove()">Cancelar</button>';
  html += '</div></div>';
  
  modal.innerHTML = html;
  document.body.appendChild(modal);
  document.getElementById('event-url-input').focus();
}

function saveEventURL(eventId, modal) {
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
  supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', { event_code: newCode }).then(result => {
    // ✅ CRÍTICO: Atualizar URL do navegador com o novo código
    const newURL = `${window.location.origin}${window.location.pathname}?event=${newCode}`;
    window.history.replaceState({ eventCode: newCode }, document.title, newURL);
    console.log('🔗 URL do navegador atualizada para:', newURL);
    
    modal.remove();
    toast(`URL alterada de "${oldCode}" para "${newCode}"`);
    renderEventDetails();
  });
}

function saveEventLimit(userId, modal) {
  const input = document.getElementById('event-limit-input');
  let limit = input.value.trim();
  
  const user = Store.users.find(u => u.id === userId);
  if (!user) return;
  
  if (limit === '' || limit === '0') {
    user.eventLimit = null; // Sem limite
    // ✅ Sincronizar com Supabase
    supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', { event_limit: null });
    toast('Limite removido (sem limite)');
  } else {
    const numLimit = parseInt(limit);
    if (isNaN(numLimit) || numLimit < 1) {
      toast('Digite um número válido');
      return;
    }
    user.eventLimit = numLimit;
    // ✅ Sincronizar com Supabase
    supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', { event_limit: numLimit });
    toast(`Limite definido para ${numLimit} evento(s)`);
  }
  
  modal.remove();
  renderAdmin();
}

// ===================== EXPORT / IMPORT =====================
function triggerImport() {
  document.getElementById('import-file').click();
}

function exportJSON() {
  const data = {
    exported_at: new Date().toISOString(),
    version: '1.0',
    users: Store.users,
    events: Store.events
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rsvp_backup_' + Date.now() + '.json';
  a.click();
  toast('JSON exportado com sucesso!');
}

function exportCSV() {
  let csv = '';

  // ACCOUNTS
  csv += 'CONTAS\nID,TELEFONE,STATUS,ROLE,CRIADA_EM\n';
  Store.users.forEach(u => {
    csv += `${u.id},"${u.phone}","${u.status}","${u.role}",${u.createdAt || 'N/A'}\n`;
  });

  csv += '\n\nEVENTOS\nID,CRIADOR,TITULO,DATA,HORA,LIMITE_CONFIRMACAO,ACOMPANHANTES,PRESENTES,CRIANCAS,LINK\n';
  Store.events.forEach(e => {
    const criador = Store.users.find(u => u.id === e.userId)?.phone || 'N/A';
    csv += `${e.id},"${criador}","${e.title}","${e.date}","${e.time}","${e.deadline}",${e.allowCompanions},${e.allowGifts},${e.allowKids},"rsvp.app/evento/${e.id}"\n`;
  });

  csv += '\n\nRSVPs - CONFIRMAÇÕES DE PRESENÇA\nEVENTO,CONVIDADO,CONFIRMACAO,LADO,ACOMPANHANTES,CRIANCAS\n';
  Store.events.forEach(e => {
    e.confirmations.forEach(c => {
      csv += `${e.id},"${c.name}","${c.attending ? 'SIM' : 'NÃO'}","${c.side}","${c.companions.join('; ')}","${c.kids.join('; ')}"\n`;
    });
  });

  csv += '\n\nPRESENTES\nEVENTO,PRESENTE,ESTADO,RESERVADO_POR\n';
  Store.events.forEach(e => {
    e.gifts.forEach(g => {
      csv += `${e.id},"${g.name}","${g.reserved ? 'RESERVADO' : 'DISPONIVEL'}","${g.reservedBy || 'N/A'}"\n`;
    });
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rsvp_backup_' + Date.now() + '.csv';
  a.click();
  toast('CSV exportado com sucesso!');
}

// ✅ EXPORTAR SCHEMA COMPLETO DO SUPABASE
async function exportSupabaseSchema() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') {
    toast('Apenas admin pode exportar schema.');
    return;
  }

  toast('Carregando schema do Supabase...');
  
  try {
    // 🎯 PASSO 1: Carregar TODAS as tabelas de dados
    console.log('📥 Carregando dados do Supabase...');
    
    const accountsData = await supabaseRequest('accounts?select=*');
    const eventsData = await supabaseRequest('events?select=*');
    const rsvpsData = await supabaseRequest('rsvps?select=*');
    const giftsData = await supabaseRequest('gifts?select=*');
    
    console.log('✅ Dados carregados:');
    console.log('  Contas:', accountsData?.length || 0);
    console.log('  Eventos:', eventsData?.length || 0);
    console.log('  RSVPs:', rsvpsData?.length || 0);
    console.log('  Presentes:', giftsData?.length || 0);
    
    // 🎯 PASSO 2: Definir schema das tabelas
    const schema = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      supabase_url: SUPABASE_URL,
      database: 'rsvp_events_db',
      
      tables: {
        accounts: {
          description: 'Contas de utilizadores do sistema',
          columns: {
            id: 'TEXT PRIMARY KEY - Identificador único da conta',
            phone: 'TEXT UNIQUE NOT NULL - Telefone do utilizador (usado para login)',
            password: 'TEXT NOT NULL - Senha do utilizador (armazenada em texto simples)',
            role: 'TEXT DEFAULT "user" - Role do utilizador: "user" ou "admin"',
            status: 'TEXT DEFAULT "active" - Status: "active", "pending", "blocked"',
            event_limit: 'INTEGER NULL - Limite de eventos que pode criar (NULL = sem limite)',
            created_at: 'TIMESTAMP - Data de criação da conta'
          },
          data: accountsData || []
        },
        
        events: {
          description: 'Eventos de casamento/eventos',
          columns: {
            id: 'TEXT PRIMARY KEY - Código único do evento',
            user_id: 'TEXT FOREIGN KEY - ID do utilizador que criou o evento',
            title: 'TEXT NOT NULL - Título/nome do evento',
            date: 'DATE NOT NULL - Data do evento (formato: YYYY-MM-DD)',
            time: 'TIME NOT NULL - Hora do evento (formato: HH:MM)',
            confirm_by_date: 'TEXT - Data limite para confirmação (pode incluir hora)',
            cover_image: 'TEXT - URL da imagem de capa do evento',
            event_code: 'TEXT UNIQUE - Código legado para compatibilidade com URLs antigos',
            allow_companions: 'TEXT DEFAULT "no" - Permite acompanhantes? "yes" ou "no"',
            max_companions: 'INTEGER DEFAULT 2 - Máximo de acompanhantes por convidado',
            allow_kids: 'TEXT DEFAULT "no" - Permite crianças? "yes" ou "no"',
            max_kids: 'INTEGER DEFAULT 2 - Máximo de crianças por convidado',
            allow_gifts: 'TEXT DEFAULT "no" - Permite presentes? "yes" ou "no"',
            created_at: 'TIMESTAMP - Data de criação do evento',
            updated_at: 'TIMESTAMP - Data da última atualização'
          },
          data: eventsData || []
        },
        
        rsvps: {
          description: 'Confirmações de presença dos convidados',
          columns: {
            id: 'TEXT PRIMARY KEY - Identificador único do RSVP',
            event_id: 'TEXT FOREIGN KEY - ID do evento',
            guest_name: 'TEXT NOT NULL - Nome do convidado',
            attending: 'TEXT - "yes" ou "no" - Confirmação de presença',
            side: 'TEXT - Grupo/lado escolhido pelo convidado',
            companions: 'TEXT - Lista de acompanhantes (separados por |)',
            kids: 'TEXT - Lista de crianças (separados por |)',
            wants_gift: 'TEXT - "yes" ou "no" - Quer presentear?',
            gift_ids: 'TEXT - IDs dos presentes escolhidos (separados por |)',
            created_at: 'TIMESTAMP - Data de criação do RSVP',
            updated_at: 'TIMESTAMP - Data da última atualização'
          },
          data: rsvpsData || []
        },
        
        gifts: {
          description: 'Lista de presentes dos eventos',
          columns: {
            id: 'TEXT PRIMARY KEY - Identificador único do presente',
            event_id: 'TEXT FOREIGN KEY - ID do evento',
            name: 'TEXT NOT NULL - Nome do presente',
            category: 'TEXT - Categoria do presente',
            reserved: 'BOOLEAN DEFAULT FALSE - Presente já foi escolhido?',
            reserved_by: 'TEXT - Nome de quem escolheu o presente',
            created_at: 'TIMESTAMP - Data de criação do presente'
          },
          data: giftsData || []
        }
      },
      
      relationships: {
        'events.user_id -> accounts.id': 'Um utilizador pode ter MÚLTIPLOS eventos',
        'rsvps.event_id -> events.id': 'Um evento pode ter MÚLTIPLOS RSVPs',
        'gifts.event_id -> events.id': 'Um evento pode ter MÚLTIPLOS presentes'
      },
      
      statistics: {
        total_accounts: accountsData?.length || 0,
        total_admins: (accountsData || []).filter(a => a.role === 'admin').length,
        total_users: (accountsData || []).filter(a => a.role === 'user').length,
        total_events: eventsData?.length || 0,
        total_rsvps: rsvpsData?.length || 0,
        total_gifts: giftsData?.length || 0,
        average_confirmations_per_event: eventsData?.length > 0 
          ? ((rsvpsData?.length || 0) / (eventsData?.length || 1)).toFixed(2)
          : 0
      }
    };
    
    // 🎯 PASSO 3: Gerar documento texto formatado
    let textContent = '';
    
    textContent += '═══════════════════════════════════════════════════════════════════════════\n';
    textContent += '                    SCHEMA DA BASE DE DADOS - SUPABASE\n';
    textContent += '                     RSVP EVENT MANAGEMENT SYSTEM\n';
    textContent += '═══════════════════════════════════════════════════════════════════════════\n\n';
    
    textContent += ` Data de Exportação: ${new Date().toLocaleString('pt-PT')}\n`;
    textContent += `URL do Supabase: ${SUPABASE_URL}\n`;
    textContent += ` Versão do Schema: ${schema.version}\n\n`;
    
    // ─── ESTATÍSTICAS ───
    textContent += '┌─ ESTATÍSTICAS GERAIS ───────────────────────────────────────────────────┐\n';
    textContent += `│ Total de Contas (Utilizadores):     ${String(schema.statistics.total_accounts).padEnd(40)}\n`;
    textContent += `│ • Administradores:                  ${String(schema.statistics.total_admins).padEnd(40)}\n`;
    textContent += `│ • Utilizadores Normais:             ${String(schema.statistics.total_users).padEnd(40)}\n`;
    textContent += `│ Total de Eventos:                   ${String(schema.statistics.total_events).padEnd(40)}\n`;
    textContent += `│ Total de Confirmações (RSVPs):      ${String(schema.statistics.total_rsvps).padEnd(40)}\n`;
    textContent += `│ Total de Presentes:                 ${String(schema.statistics.total_gifts).padEnd(40)}\n`;
    textContent += `│ Média de Confirmações por Evento:   ${String(schema.statistics.average_confirmations_per_event).padEnd(40)}\n`;
    textContent += '└───────────────────────────────────────────────────────────────────────────┘\n\n';
    
    // ─── DESCRIÇÃO DAS TABELAS ───
    textContent += '═════════════════════════════════════════════════════════════════════════════\n';
    textContent += '                          ESTRUTURA DAS TABELAS\n';
    textContent += '═════════════════════════════════════════════════════════════════════════════\n\n';
    
    Object.entries(schema.tables).forEach(([tableName, tableInfo]) => {
      textContent += `┌─ TABELA: ${tableName.toUpperCase()} ─────────────────────────────────────────────────┐\n`;
      textContent += `│ ${tableInfo.description}\n`;
      textContent += `│ Registos: ${tableInfo.data.length}\n`;
      textContent += '├─ COLUNAS:\n';
      
      Object.entries(tableInfo.columns).forEach(([colName, colDef]) => {
        textContent += `│   • ${colName}: ${colDef}\n`;
      });
      
      if (tableInfo.data.length > 0) {
        textContent += '├─ AMOSTRA DE DADOS (primeiros 3 registos):\n';
        textContent += '│\n';
        
        tableInfo.data.slice(0, 3).forEach((row, idx) => {
          textContent += `│   Registo ${idx + 1}:\n`;
          Object.entries(row).forEach(([key, value]) => {
            const displayValue = typeof value === 'string' && value.length > 50 
              ? value.substring(0, 47) + '...' 
              : String(value);
            textContent += `│     - ${key}: ${displayValue}\n`;
          });
          textContent += '│\n';
        });
      }
      
      textContent += '└───────────────────────────────────────────────────────────────────────────┘\n\n';
    });
    
    // ─── RELACIONAMENTOS ───
    textContent += '═════════════════════════════════════════════════════════════════════════════\n';
    textContent += '                       RELACIONAMENTOS ENTRE TABELAS\n';
    textContent += '═════════════════════════════════════════════════════════════════════════════\n\n';
    
    Object.entries(schema.relationships).forEach(([relationship, description]) => {
      textContent += `${relationship}\n`;
      textContent += `  └─ ${description}\n\n`;
    });
    
    // ─── QUERIES ÚTEIS ───
    textContent += '═════════════════════════════════════════════════════════════════════════════\n';
    textContent += '                       QUERIES SQL ÚTEIS (Supabase)\n';
    textContent += '═════════════════════════════════════════════════════════════════════════════\n\n';
    
    textContent += '# Listar todos os utilizadores activos:\n';
    textContent += 'SELECT id, phone, role, status, event_limit FROM accounts WHERE status = \'active\';\n\n';
    
    textContent += '# Contar confirmações por evento:\n';
    textContent += 'SELECT event_id, COUNT(*) as confirmacoes FROM rsvps GROUP BY event_id;\n\n';
    
    textContent += '# Listar presentes não reservados:\n';
    textContent += 'SELECT * FROM gifts WHERE reserved = false ORDER BY category;\n\n';
    
    textContent += '# Eventos com maior número de confirmações:\n';
    textContent += 'SELECT e.id, e.title, COUNT(r.id) as confirmacoes FROM events e LEFT JOIN rsvps r ON e.id = r.event_id GROUP BY e.id ORDER BY confirmacoes DESC;\n\n';
    
    textContent += '# Convidados que querem presentear:\n';
    textContent += 'SELECT * FROM rsvps WHERE wants_gift = \'yes\' AND attending = \'yes\';\n\n';
    
    // ─── DICAS ───
    textContent += '═════════════════════════════════════════════════════════════════════════════\n';
    textContent += '                              NOTAS IMPORTANTES\n';
    textContent += '═════════════════════════════════════════════════════════════════════════════\n\n';
    
    textContent += '  SEGURANÇA:\n';
    textContent += '    • As senhas são armazenadas em texto simples (INSEGURO para produção)\n';
    textContent += '    • Implementar bcrypt ou hashing de senha para ambientes reais\n';
    textContent += '    • Nunca compartilhe este arquivo com terceiros\n\n';
    
    textContent += 'DADOS:\n';
    textContent += '    • Campos de data/hora usam timezone: UTC\n';
    textContent += '    • Acompanhantes e crianças são armazenados como texto separado por |\n';
    textContent += '    • A coluna confirm_by_date pode conter data+hora (formato misto)\n\n';
    
    textContent += ' SINCRONIZAÇÃO:\n';
    textContent += '    • O sistema sincroniza automaticamente com Supabase a cada operação\n';
    textContent += '    • Mudanças feitas directamente no Supabase são refletidas no app\n';
    textContent += '    • Criar um backup regular desta schema\n\n';
    
    textContent += '═════════════════════════════════════════════════════════════════════════════\n';
    textContent += 'Fim do Documento\n';
    
    // Criar arquivo e baixar
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'supabase_schema_' + new Date().toISOString().split('T')[0] + '.txt';
    a.click();
    
    toast(' Schema do Supabase exportado com sucesso!');
    console.log('✅ Schema exportado:', schema);
    
  } catch (error) {
    console.error('❌ Erro ao exportar schema:', error);
    toast(' Erro ao exportar schema. Verifique a consola.');
  }
}

function showPasteModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-3">Colar Dados do Supabase</h3>
      <p class="text-sm text-gray-500 mb-4">Cole aqui os dados em formato CSV ou JSON:</p>
      <textarea id="paste-textarea" class="input-field w-full h-48 font-mono text-xs mb-4 p-3" placeholder="Cole seus dados aqui..." style="resize: vertical;"></textarea>
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="processPastedData()">Importar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function showUploadGuestListModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-3">Upload Lista de Convidados</h3>
      <p class="text-sm text-gray-500 mb-4">Selecione o usuário, depois o evento e cole a lista:</p>
      
      <label class="block text-sm font-semibold text-gray-600 mb-1">Utilizador</label>
      <select id="guest-list-user" class="input-field mb-4" onchange="updateEventsList()">
        <option value="">-- Selecione um usuário --</option>
        ${Store.users.filter(u => u.role !== 'admin' && u.status !== 'deleted').map(u => {
          const userEventCount = Store.events.filter(e => e.userId === u.id).length;
          return `<option value="${u.id}">${u.phone} (${userEventCount} evento${userEventCount !== 1 ? 's' : ''})</option>`;
        }).join('')}
      </select>
      
      <label class="block text-sm font-semibold text-gray-600 mb-1"> Evento</label>
      <select id="guest-list-event" class="input-field mb-4">
        <option value="">-- Primeiro selecione um usuário --</option>
      </select>
      
      <label class="block text-sm font-semibold text-gray-600 mb-1">Lista de Convidados (Cole aqui)</label>
      <textarea id="guest-list-textarea" class="input-field w-full h-48 font-mono text-xs mb-4 p-3" placeholder="Cole a lista de convidados aqui..." style="resize: vertical;"></textarea>
      
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="processGuestList()">Importar Lista</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  lucide.createIcons();
}

function updateEventsList() {
  const userId = document.getElementById('guest-list-user').value;
  const eventSelect = document.getElementById('guest-list-event');
  
  if (!userId) {
    eventSelect.innerHTML = '<option value="">-- Primeiro selecione um usuário --</option>';
    return;
  }
  
  // Buscar eventos deste usuário
  const userEvents = Store.events.filter(e => e.userId === userId);
  
  if (userEvents.length === 0) {
    eventSelect.innerHTML = '<option value="">Este usuário não tem eventos</option>';
    return;
  }
  
  eventSelect.innerHTML = `
    <option value="">-- Selecione um evento --</option>
    ${userEvents.map(e => `
      <option value="${e.id}">
        ${e.title} (${formatDate(e.date)}) - ${e.confirmations.length} confirmações
      </option>
    `).join('')}
  `;
}

function showUploadGiftsListModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-lg w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-3">Upload Lista de Presentes</h3>
      <p class="text-sm text-gray-500 mb-4">Selecione o evento e cole a lista:</p>
      
      <label class="block text-sm font-semibold text-gray-600 mb-1">Evento</label>
      <select id="gifts-list-event" class="input-field mb-4">
        <option value="">-- Selecione um evento --</option>
        ${Store.events.map(e => `<option value="${e.id}">${e.title}</option>`).join('')}
      </select>
      
      <label class="block text-sm font-semibold text-gray-600 mb-1">Lista de Presentes (Cole aqui)</label>
      <textarea id="gifts-list-textarea" class="input-field w-full h-48 font-mono text-xs mb-4 p-3" placeholder="Cole a lista de presentes aqui..." style="resize: vertical;"></textarea>
      
      <p class="text-xs text-gray-400 mb-4">A lista pode estar organizada por categorias (com títulos em maiúsculas ou negrito) ou sem categorias. O sistema detectará automaticamente!</p>
      
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="processGiftsList()">Importar Lista</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  lucide.createIcons();
}

function processGiftsList() {
  const eventId = document.getElementById('gifts-list-event').value;
  const giftsListText = document.getElementById('gifts-list-textarea').value.trim();
  
  if (!eventId) {
    toast('Selecione um evento!');
    return;
  }
  
  if (!giftsListText) {
    toast('Cole a lista de presentes!');
    return;
  }
  
  try {
    const event = Store.events.find(e => e.id === eventId);
    if (!event) {
      toast('Evento não encontrado!');
      return;
    }
    
    const gifts = parseGiftsListText(giftsListText);
    
    if (gifts.length === 0) {
      toast('Nenhum presente encontrado na lista!');
      return;
    }
    
    let addedCount = 0;
    gifts.forEach(gift => {
      const alreadyExists = event.gifts.some(g =>
        g.name.toLowerCase().trim() === gift.name.toLowerCase().trim()
      );
      
      if (!alreadyExists) {
        event.gifts.push(gift);
        addedCount++;
      }
    });
    
    document.querySelector('.modal-overlay').remove();
    toast(`${addedCount} presente(s) adicionado(s)!`);
    renderAdmin();
  } catch (error) {
    toast('Erro ao processar lista: ' + error.message);
  }
}

function parseGiftsListText(text) {
  const gifts = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && l !== '-');
  
  let currentCategory = 'Sem categoria';
  
  lines.forEach(line => {
    const isCategory = line === line.toUpperCase() && line.length > 3 && !line.startsWith('-');
    
    if (isCategory) {
      currentCategory = line;
    } else {
      let giftName = line.replace(/^[\s\-\*•\.]+/, '').trim();
      
      if (giftName && giftName.length > 2) {
        gifts.push({
          id: uid(),
          name: giftName,
          category: currentCategory,
          reserved: false,
          reservedBy: null
        });
      }
    }
  });
  
  return gifts;
}

function processGuestList() {
  const userId = document.getElementById('guest-list-user').value;
  const eventId = document.getElementById('guest-list-event').value;
  const guestListText = document.getElementById('guest-list-textarea').value.trim();
  
  if (!userId) {
    toast('Selecione um usuário!');
    return;
  }
  
  if (!eventId) {
    toast('Selecione um evento!');
    return;
  }
  
  if (!guestListText) {
    toast('Cole a lista de convidados!');
    return;
  }
  
  try {
    // Encontrar o evento específico selecionado
    const event = Store.events.find(e => e.id === eventId && e.userId === userId);
    
    if (!event) {
      toast('Evento não encontrado!');
      return;
    }
    
    const confirmations = parseGuestListText(guestListText);
    
    if (confirmations.length === 0) {
      toast('Nenhum convidado encontrado na lista!');
      return;
    }
    
    let addedCount = 0;
    confirmations.forEach(conf => {
      const alreadyExists = event.confirmations.some(c =>
        c.name.toLowerCase().trim() === conf.name.toLowerCase().trim()
      );
      
      if (!alreadyExists) {
        event.confirmations.push(conf);
        addedCount++;
      }
    });
    
    // ✅ CRÍTICO: Salvar TODOS os convidados no Supabase
    console.log('💾 Salvando convidados no Supabase...');
    saveGuestListToSupabase(eventId, event.confirmations);
    
    document.querySelector('.modal-overlay').remove();
    toast(` ${addedCount} convidado(s) adicionado(s) e salvos no Supabase!`);
    renderAdmin();
  } catch (error) {
    toast(' Erro ao processar lista: ' + error.message);
    console.error('Erro completo:', error);
  }
}

// ✅ NOVA FUNÇÃO: Salvar lista de convidados no Supabase
async function saveGuestListToSupabase(eventId, confirmations) {
  try {
    console.log('📤 Iniciando upload de convidados para Supabase');
    console.log('  Event ID:', eventId);
    console.log('  Convidados a salvar:', confirmations.length);
    
    // Salvar CADA convidado como um RSVP no Supabase
    for (const conf of confirmations) {
      const rsvpData = {
        event_id: eventId,
        guest_name: conf.name,
        attending: conf.attending ? 'yes' : 'no',
        side: conf.side || 'noivo',
        companions: conf.companions && conf.companions.length > 0 ? conf.companions.join('|') : '',
        kids: conf.kids && conf.kids.length > 0 ? conf.kids.join('|') : '',
        wants_gift: false,
        gift_ids: '',
        updated_at: new Date().toISOString()
      };
      
      console.log('  📝 Salvando convidado:', { name: conf.name, attending: rsvpData.attending });
      
      // Verificar se já existe (para UPDATE em vez de INSERT)
      const existingRsvps = await supabaseRequest(
        `rsvps?event_id=eq.${eventId}&guest_name=eq.${encodeURIComponent(conf.name)}`,
        'GET'
      );
      
      if (existingRsvps && existingRsvps.length > 0) {
        // Já existe - fazer UPDATE
        console.log('  🔄 Convidado já existe, atualizando...');
        const updateResult = await supabaseRequest(
          `rsvps?event_id=eq.${eventId}&guest_name=eq.${encodeURIComponent(conf.name)}`,
          'PATCH',
          rsvpData
        );
        console.log('  ✅ RSVP atualizado');
      } else {
        // Novo - fazer INSERT
        console.log('  ➕ Novo convidado, inserindo...');
        const createResult = await supabaseRequest('rsvps', 'POST', rsvpData);
        console.log('  ✅ RSVP criado:', createResult);
      }
    }
    
    console.log('✅ Todos os convidados foram salvos no Supabase!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao salvar convidados no Supabase:', error);
    throw error;
  }
}

function parseGuestListText(text) {
  const confirmations = [];
  const lines = text.split('\n').map(l => l.trim()).filter(l => l); // NÃO remover linhas vazias ainda
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    // ✅ PASSO 1: Detectar divisor alfabético (linha com APENAS uma letra)
    if (line.match(/^[A-Z]$/)) {
      console.log('📍 Divisor encontrado:', line);
      i++;
      continue;
    }
    
    // ✅ PASSO 2: Pular linhas vazias ou com apenas símbolos
    if (!line || line.match(/^[\s\W]*$/)) {
      i++;
      continue;
    }
    
    // ✅ PASSO 3: Detectar se é uma linha de acompanhante (começa com +)
    if (line.includes('+') && line.includes('acompanhante')) {
      console.log('⏭️ Pulando linha de acompanhante:', line);
      i++;
      continue;
    }
    
    // ✅ PASSO 4: Agora processamos o NOME
    const hasEmoji = line.includes('👰');
    
    // Remover APENAS o emoji, manter o resto do nome intacto
    let name = line.replace(/\s*👰\s*/g, '').trim();
    
    // Se não houver nome, pular
    if (!name || name.length < 2) {
      console.log('⚠️ Nome muito curto, pulando:', name);
      i++;
      continue;
    }
    
    console.log('✅ Convidado encontrado:', { name, hasEmoji });
    
    // ✅ PASSO 5: Determinar lado
    const side = hasEmoji ? 'noiva' : 'noivo';
    
    // ✅ PASSO 6: Verificar PRÓXIMA linha para acompanhantes
    let companions = [];
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1];
      
      // Se a próxima linha contém "+X acompanhante(s):"
      if (nextLine.includes('+') && nextLine.includes('acompanhante')) {
        console.log('🤝 Acompanhantes encontrados:', nextLine);
        
        // Extrair tudo depois dos ":"
        const colonIndex = nextLine.indexOf(':');
        if (colonIndex !== -1) {
          const companionText = nextLine.substring(colonIndex + 1).trim();
          
          // ✅ CRÍTICO: Contar número de acompanhantes no começo (ex: "+1 acompanhante(s):")
          const companionCountMatch = nextLine.match(/\+(\d+)/);
          const expectedCount = companionCountMatch ? parseInt(companionCountMatch[1]) : 1;
          
          console.log('  🔍 Análise de acompanhantes:', { companionText, expectedCount, nextLine });
          
          if (companionText && companionText !== 'Definir' && companionText.length > 0) {
            // ✅ CRÍTICO: Se espera apenas 1 acompanhante, tomar TUDO como um nome SEM SPLIT
            if (expectedCount === 1) {
              const singleCompanion = companionText.trim();
              if (singleCompanion && singleCompanion.length > 1) {
                companions = [singleCompanion]; // ✅ Nome COMPLETO sem split
                console.log('  📝 1 acompanhante (SEM SPLIT de vírgula):', companions);
              }
            } else {
              // Se espera múltiplos (2+), SIM separar por vírgula
              companions = companionText
                .split(',')
                .map(s => s.trim())
                .filter(s => s && s !== 'Definir' && s.length > 1);
              
              console.log(`  📝 ${expectedCount} acompanhante(s) (COM SPLIT):`, companions);
            }
          }
        }
        
        i++; // Pular a linha de acompanhantes na próxima iteração
      }
    }
    
    // ✅ PASSO 7: Criar confirmação
    confirmations.push({
      name: name,
      attending: true, // Assumir confirmado
      side: side,
      companions: companions,
      kids: []
    });
    
    i++;
  }
  
  console.log('✅ parseGuestListText finalizado. Total de convidados:', confirmations.length);
  console.log(' Convidados parseados:', confirmations);
  
  return confirmations;
}

function processPastedData() {
  const textarea = document.getElementById('paste-textarea');
  const data = textarea.value.trim();
  
  if (!data) {
    toast('Cole dados para importar!');
    return;
  }

  try {
    let parsedData;
    
    // Tentar parsear como JSON
    try {
      parsedData = JSON.parse(data);
      if (Array.isArray(parsedData)) {
        importWithMerge(parseSupabaseJSON(parsedData), 'json');
      } else {
        importWithMerge(parsedData, 'json');
      }
    } catch (e) {
      // Se falhar, tratar como CSV
      const csvData = importFromCSVToObject(data);
      importWithMerge(csvData, 'csv');
    }
    
    document.querySelector('.modal-overlay').remove();
  } catch (error) {
    toast('Erro ao processar dados: ' + error.message);
  }
}

function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(content);
        importWithMerge(data, 'json');
      } else if (file.name.endsWith('.csv')) {
        const parsedData = importFromCSVToObject(content);
        importWithMerge(parsedData, 'csv');
      }
    } catch (error) {
      toast('Erro ao importar arquivo: ' + error.message);
    }
  };
  reader.readAsText(file);
}

function importWithMerge(importedData, format) {
  let stats = { newUsers: 0, updatedUsers: 0, newEvents: 0, mergedEvents: 0, newConfirmations: 0, skippedConfirmations: 0, skippedEvents: 0, orphanedRsvps: 0 };

  // Merge Users
  if (importedData.users && Array.isArray(importedData.users)) {
    importedData.users.forEach(importedUser => {
      const existingUser = Store.users.find(u => u.phone === importedUser.phone);
      
      if (existingUser) {
        // Atualizar usuário existente
        if (importedUser.status && importedUser.status !== existingUser.status) {
          existingUser.status = importedUser.status;
          stats.updatedUsers++;
        }
      } else {
        // Novo usuário
        Store.users.push({
          ...importedUser,
          id: importedUser.id || uid()
        });
        stats.newUsers++;
      }
    });
  }

  // Validação rigorosa: um dono DEVE ter no máximo UM evento
  if (importedData.events && Array.isArray(importedData.events)) {
    const eventsByOwner = {};
    
    importedData.events.forEach(importedEvent => {
      // 1. Validação: evento DEVE ter owner
      if (!importedEvent.userId) {
        stats.skippedEvents++;
        return;
      }

      // 2. Verificar se este owner já tem um evento importado
      if (eventsByOwner[importedEvent.userId]) {
        stats.skippedEvents++;
        return; // Ignorar: dono já tem evento
      }

      // 3. Verificar se este owner já tem evento no Store
      const userAlreadyHasEvent = Store.events.some(e => e.userId === importedEvent.userId);
      if (userAlreadyHasEvent) {
        stats.skippedEvents++;
        return; // Ignorar: dono já tem evento no sistema
      }

      // 4. Procurar APENAS por ID exato e mesmo owner (sem fuzzy matching)
      let existingEvent = Store.events.find(e => 
        e.id === importedEvent.id && e.userId === importedEvent.userId
      );

      if (existingEvent) {
        // EVENTO JÁ EXISTE - fazer merge apenas de confirmações
        if (importedEvent.confirmations && Array.isArray(importedEvent.confirmations)) {
          importedEvent.confirmations.forEach(importedConf => {
            const alreadyExists = existingEvent.confirmations.some(c =>
              c.name.toLowerCase().trim() === importedConf.name.toLowerCase().trim()
            );
            
            if (!alreadyExists) {
              existingEvent.confirmations.push({
                name: importedConf.name,
                attending: importedConf.attending,
                side: importedConf.side || 'noivo',
                companions: importedConf.companions || [],
                kids: importedConf.kids || []
              });
              stats.newConfirmations++;
            } else {
              stats.skippedConfirmations++;
            }
          });
        }
        stats.mergedEvents++;
      } else {
        // NOVO EVENTO - adicionar apenas se tiver confirmações válidas
        const validConfirmations = (importedEvent.confirmations || []).filter(c => c && c.name);
        
        Store.events.push({
          ...importedEvent,
          id: importedEvent.id || uid(),
          userId: importedEvent.userId,
          eventCode: importedEvent.eventCode || importedEvent.id,
          confirmations: validConfirmations.map(c => ({
            name: c.name,
            attending: c.attending,
            side: c.side || 'noivo',
            companions: c.companions || [],
            kids: c.kids || []
          })),
          gifts: (importedEvent.gifts || []).map(g => ({ 
            ...g, 
            id: g.id || uid() 
          }))
        });
        stats.newEvents += validConfirmations.length > 0 ? 1 : 0;
        stats.newConfirmations += validConfirmations.length;
        eventsByOwner[importedEvent.userId] = true;
      }
    });
  }

  // Mostrar resumo de importação
  showImportSummary(stats, format);
  renderAdmin();
}

function showImportSummary(stats, format) {
  const summary = `
     Importação de ${format.toUpperCase()} concluída!
    
    Utilizadores:
    • ${stats.newUsers} novo(s)
    • ${stats.updatedUsers} atualizado(s)
    
    Eventos:
    • ${stats.newEvents} novo(s)
    • ${stats.mergedEvents} merge com existentes
    
    Confirmações:
    • ${stats.newConfirmations} adicionada(s)
    • ${stats.skippedConfirmations} ignorada(s) (duplicadas)
  `;

  // Criar modal de resumo
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-xl font-bold text-gray-800 mb-4">Resumo da Importação</h3>
      <pre class="text-sm text-gray-600 whitespace-pre-wrap font-quicksand mb-4 bg-gray-50 p-3 rounded-lg">${summary.trim()}</pre>
      <button class="btn-main w-full" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function importFromCSVToObject(csvContent) {
  const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
  let currentSection = '';
  const newUsers = [];
  const newEvents = [];

  lines.forEach(line => {
    if (line === 'CONTAS') { currentSection = 'accounts'; return; }
    if (line === 'EVENTOS') { currentSection = 'events'; return; }
    if (line === 'RSVPs - CONFIRMAÇÕES DE PRESENÇA') { currentSection = 'rsvps'; return; }
    if (line === 'PRESENTES') { currentSection = 'gifts'; return; }
    
    if (line.includes('ID,') || line.includes('EVENTO,') || line.includes('CONVIDADO,')) return;

    if (currentSection === 'accounts') {
      const parts = parseCSVLine(line);
      if (parts.length >= 5) {
        newUsers.push({
          id: parts[0],
          phone: parts[1],
          password: parts[2],
          status: parts[3],
          role: parts[4],
          createdAt: parts[5] || new Date().toISOString()
        });
      }
    } else if (currentSection === 'events') {
      const parts = parseCSVLine(line);
      if (parts.length >= 8) {
        newEvents.push({
          id: parts[0],
          eventCode: parts[0], // Preservar código original
          createdBy: parts[1],
          title: parts[2],
          date: parts[3],
          time: parts[4],
          deadline: parts[5],
          allowCompanions: parts[6] === 'true',
          maxCompanions: 2,
          allowGifts: parts[7] === 'true',
          allowKids: parts[8] === 'true',
          maxKids: 2,
          confirmations: [],
          gifts: []
        });
      }
    } else if (currentSection === 'rsvps') {
      const parts = parseCSVLine(line);
      if (parts.length >= 5) {
        const eventCode = parts[0];
        const event = newEvents.find(e => e.id === eventCode) || Store.events.find(e => e.eventCode === eventCode || e.id === eventCode);
        if (event) {
          event.confirmations = event.confirmations || [];
          event.confirmations.push({
            name: parts[1],
            attending: parts[2] === 'SIM',
            side: parts[3],
            companions: parts[4] ? parts[4].split(';').map(s => s.trim()).filter(Boolean) : [],
            kids: parts[5] ? parts[5].split(';').map(s => s.trim()).filter(Boolean) : []
          });
        }
      }
    } else if (currentSection === 'gifts') {
      const parts = parseCSVLine(line);
      if (parts.length >= 4) {
        const eventCode = parts[0];
        const event = newEvents.find(e => e.id === eventCode) || Store.events.find(e => e.eventCode === eventCode || e.id === eventCode);
        if (event) {
          event.gifts = event.gifts || [];
          event.gifts.push({
            id: uid(),
            name: parts[1],
            reserved: parts[2] === 'RESERVADO',
            reservedBy: parts[3] !== 'N/A' ? parts[3] : null
          });
        }
      }
    }
  });

  return { users: newUsers, events: newEvents };
}

function importFromCSV(csvContent) {
  const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
  let currentSection = '';
  const newUsers = [];
  const newEvents = [];

  lines.forEach(line => {
    if (line === 'CONTAS') { currentSection = 'accounts'; return; }
    if (line === 'EVENTOS') { currentSection = 'events'; return; }
    if (line === 'RSVPs - CONFIRMAÇÕES DE PRESENÇA') { currentSection = 'rsvps'; return; }
    if (line === 'PRESENTES') { currentSection = 'gifts'; return; }
    
    if (line.includes('ID,') || line.includes('EVENTO,') || line.includes('CONVIDADO,')) return;

    if (currentSection === 'accounts') {
      const parts = parseCSVLine(line);
      if (parts.length >= 5) {
        newUsers.push({
          id: parts[0],
          phone: parts[1],
          password: parts[2],
          status: parts[3],
          role: parts[4],
          createdAt: parts[5] || new Date().toISOString()
        });
      }
    } else if (currentSection === 'events') {
      const parts = parseCSVLine(line);
      if (parts.length >= 8) {
        const userId = Store.users.find(u => u.phone === parts[1])?.id;
        if (userId) {
          newEvents.push({
            id: parts[0],
            userId: userId,
            title: parts[2],
            date: parts[3],
            time: parts[4],
            deadline: parts[5],
            allowCompanions: parts[6] === 'true',
            maxCompanions: 2,
            allowGifts: parts[7] === 'true',
            allowKids: parts[8] === 'true',
            maxKids: 2,
            confirmations: [],
            gifts: []
          });
        }
      }
    } else if (currentSection === 'rsvps') {
      const parts = parseCSVLine(line);
      if (parts.length >= 5) {
        const event = newEvents.find(e => e.id === parts[0]) || Store.events.find(e => e.id === parts[0]);
        if (event) {
          event.confirmations = event.confirmations || [];
          event.confirmations.push({
            name: parts[1],
            attending: parts[2] === 'SIM',
            side: parts[3],
            companions: parts[4] ? parts[4].split(';').map(s => s.trim()).filter(Boolean) : [],
            kids: parts[5] ? parts[5].split(';').map(s => s.trim()).filter(Boolean) : []
          });
        }
      }
    } else if (currentSection === 'gifts') {
      const parts = parseCSVLine(line);
      if (parts.length >= 4) {
        const event = newEvents.find(e => e.id === parts[0]) || Store.events.find(e => e.id === parts[0]);
        if (event) {
          event.gifts = event.gifts || [];
          event.gifts.push({
            id: uid(),
            name: parts[1],
            reserved: parts[2] === 'RESERVADO',
            reservedBy: parts[3] !== 'N/A' ? parts[3] : null
          });
        }
      }
    }
  });

  if (newUsers.length > 0) {
    Store.users = newUsers;
  }
  if (newEvents.length > 0) {
    Store.events = newEvents;
  }
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      result.push(current.replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.replace(/^"|"$/g, ''));
  return result;
}

function importFromCSVToObject(csvContent) {
  try {
    // Tentar parsear como JSON primeiro (arquivo JSON do Supabase)
    const jsonData = JSON.parse(csvContent);
    if (Array.isArray(jsonData)) {
      return parseSupabaseJSON(jsonData);
    }
  } catch (e) {
    // Se falhar, é CSV
  }

  // Processar como CSV
  const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { users: [], events: [] };

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);
  
  const getIndex = (name) => {
    const idx = headers.findIndex(h => h.toLowerCase().replace(/\s+/g, '_') === name.toLowerCase());
    return idx >= 0 ? idx : -1;
  };
  
  const typeIdx = getIndex('type');
  const ownerIdIdx = getIndex('owner_id');
  const ownerPhoneIdx = getIndex('owner_phone');
  const ownerPasswordIdx = getIndex('owner_password');
  const accountStatusIdx = getIndex('account_status');
  const eventIdIdx = getIndex('event_id');
  const eventTitleIdx = getIndex('event_title');
  const eventDateIdx = getIndex('event_date');
  const eventTimeIdx = getIndex('event_time');
  const guestNameIdx = getIndex('guest_name');
  const guestResponseIdx = getIndex('guest_response');
  const guestCompanionsIdx = getIndex('guest_companions');
  const guestSideIdx = getIndex('guest_side');
  const maxCompanionsIdx = getIndex('max_companions');

  const newUsers = [];
  const newEvents = [];
  const eventMap = {};
  const userMap = {};

  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length < 2) continue;

    const type = typeIdx >= 0 ? parts[typeIdx]?.trim().toLowerCase() : '';
    
    if (type === 'owner' || type === 'user') {
      const phone = ownerPhoneIdx >= 0 ? parts[ownerPhoneIdx]?.trim() : '';
      const password = ownerPasswordIdx >= 0 ? parts[ownerPasswordIdx]?.trim() : '';
      const status = accountStatusIdx >= 0 ? parts[accountStatusIdx]?.trim() : 'active';
      const userId = ownerIdIdx >= 0 ? parts[ownerIdIdx]?.trim() : uid();

      if (phone && password && !userMap[phone]) {
        const newUser = {
          id: userId || uid(),
          phone: phone,
          password: password,
          status: status || 'active',
          role: 'user',
          createdAt: new Date().toISOString()
        };
        newUsers.push(newUser);
        userMap[phone] = newUser;
      }
    }
    
    if (type === 'event') {
      const eventCode = eventIdIdx >= 0 ? parts[eventIdIdx]?.trim() : '';
      const eventTitle = eventTitleIdx >= 0 ? parts[eventTitleIdx]?.trim() : 'Evento';
      const eventDate = eventDateIdx >= 0 ? parts[eventDateIdx]?.trim() : '2026-01-01';
      const eventTime = eventTimeIdx >= 0 ? parts[eventTimeIdx]?.trim() : '19:00';
      const ownerPhone = ownerPhoneIdx >= 0 ? parts[ownerPhoneIdx]?.trim() : '';
      const maxComp = maxCompanionsIdx >= 0 ? parseInt(parts[maxCompanionsIdx]) || 2 : 2;

      if (eventCode && !eventMap[eventCode]) {
        const ownerUser = userMap[ownerPhone] || newUsers[0];
        const userId = ownerUser?.id || uid();

        eventMap[eventCode] = {
          id: eventCode,
          eventCode: eventCode,
          userId: userId,
          title: eventTitle,
          date: eventDate,
          time: eventTime,
          deadline: eventDate,
          cover: null,
          allowCompanions: true,
          maxCompanions: maxComp,
          allowGifts: false,
          allowKids: false,
          maxKids: 2,
          confirmations: [],
          gifts: []
        };
        newEvents.push(eventMap[eventCode]);
      }
    }
    
    if (type === 'rsvp' || type === 'confirmation' || type === 'guest') {
      const eventCode = eventIdIdx >= 0 ? parts[eventIdIdx]?.trim() : '';
      const guestName = guestNameIdx >= 0 ? parts[guestNameIdx]?.trim() : '';
      const guestResponse = guestResponseIdx >= 0 ? parts[guestResponseIdx]?.trim().toLowerCase() : 'sim';
      const guestSide = guestSideIdx >= 0 ? parts[guestSideIdx]?.trim().toLowerCase() : 'noivo';
      const guestCompanions = guestCompanionsIdx >= 0 ? parts[guestCompanionsIdx]?.trim() : '';

      if (eventCode && guestName) {
        if (!eventMap[eventCode]) {
          eventMap[eventCode] = {
            id: eventCode,
            eventCode: eventCode,
            userId: newUsers[0]?.id || uid(),
            title: 'Evento',
            date: '2026-01-01',
            time: '19:00',
            deadline: '2026-01-01',
            cover: null,
            allowCompanions: true,
            maxCompanions: 5,
            allowGifts: false,
            allowKids: false,
            maxKids: 2,
            confirmations: [],
            gifts: []
          };
          newEvents.push(eventMap[eventCode]);
        }

        const companions = guestCompanions 
          ? guestCompanions.split(/[,;]/).map(s => s.trim()).filter(Boolean)
          : [];

        const existingConf = eventMap[eventCode].confirmations.find(c => c.name.toLowerCase() === guestName.toLowerCase());
        
        if (!existingConf) {
          eventMap[eventCode].confirmations.push({
            name: guestName,
            attending: guestResponse === 'sim' || guestResponse === 'yes' || guestResponse === 'true',
            side: guestSide || 'noivo',
            companions: companions,
            kids: []
          });
        }
      }
    }
  }

  return { users: newUsers, events: newEvents };
}

function parseSupabaseJSON(data) {
  const newUsers = [];
  const newEvents = [];
  const userMap = {}; // Map owner_id -> User
  const eventsByOwnerId = {}; // EXATAMENTE UM evento por owner
  const eventsByEventId = {}; // Map event_id para encontrar eventos já criados
  
  // PASS 1: Criar/mapear OWNERS (usuários)
  data.forEach(row => {
    const ownerId = row.owner_id?.trim();
    const ownerPhone = row.owner_phone?.trim();
    const ownerPassword = row.owner_password?.trim();

    if (ownerId && ownerPhone && ownerPassword && !userMap[ownerId]) {
      const newUser = {
        id: ownerId,
        phone: ownerPhone,
        password: ownerPassword,
        status: row.account_status || 'active',
        role: 'user',
        createdAt: row.created_at || new Date().toISOString()
      };
      newUsers.push(newUser);
      userMap[ownerId] = newUser;
    }
  });

  // Se não houver owners definidos, criar um padrão
  if (Object.keys(userMap).length === 0) {
    const defaultUserId = uid();
    const defaultUser = {
      id: defaultUserId,
      phone: 'usuario_importado',
      password: '1234',
      status: 'active',
      role: 'user',
      createdAt: new Date().toISOString()
    };
    newUsers.push(defaultUser);
    userMap[defaultUserId] = defaultUser;
  }

  // PASS 2: Para CADA owner, criar UM ÚNICO evento
  // (agrupa todos os RSVPs desse owner em um evento)
  Object.values(userMap).forEach(user => {
    // Encontrar informações de evento para este owner
    const ownerRows = data.filter(row => row.owner_id?.trim() === user.id);
    const firstRow = ownerRows.find(row => row.event_id || row.event_title);

    if (firstRow) {
      const eventCode = firstRow.event_id?.trim() || uid();
      const eventTitle = firstRow.event_title?.trim() || 'Evento';
      const eventDate = firstRow.event_date?.split(' ')[0]?.trim() || '2026-01-01';
      const eventTime = firstRow.event_time?.trim() || '19:00';
      const deadline = firstRow.confirm_by_date?.split(' ')[0]?.trim() || eventDate;

      const newEvent = {
        id: eventCode,
        eventCode: eventCode,
        userId: user.id,
        title: eventTitle,
        date: eventDate,
        time: eventTime,
        deadline: deadline,
        cover: firstRow.event_cover_image || null,
        allowCompanions: firstRow.allow_companions !== 'no',
        maxCompanions: parseInt(firstRow.max_companions) || 2,
        allowGifts: false,
        allowKids: false,
        maxKids: 2,
        confirmations: [],
        gifts: []
      };

      newEvents.push(newEvent);
      eventsByOwnerId[user.id] = newEvent;
      eventsByEventId[eventCode] = newEvent;
    }
  });

  // PASS 3: Adicionar RSVPs aos eventos corretos
  data.forEach(row => {
    const type = row.type?.toLowerCase() || '';
    const guestName = row.guest_name?.trim();

    if ((type === 'rsvp' || type === 'guest' || type === 'confirmation') && guestName) {
      const ownerId = row.owner_id?.trim();
      let event = null;

      // Tentar encontrar evento do owner
      if (ownerId && eventsByOwnerId[ownerId]) {
        event = eventsByOwnerId[ownerId];
      }

      // Fallback: usar primeiro evento se não encontrar
      if (!event && newEvents.length > 0) {
        event = newEvents[0];
      }

      if (!event) return;

      // Verificar se RSVP já existe (evitar duplicatas)
      const existing = event.confirmations.find(c => c.name.toLowerCase() === guestName.toLowerCase());
      if (existing) return;

      // Processar acompanhantes
      const companions = row.guest_companions
        ? row.guest_companions.split(/[,;]/).map(s => s.trim()).filter(Boolean)
        : [];

      const response = row.guest_response?.toLowerCase() || '';
      const attending = response === 'sim' || response === 'yes' || response === 'true' || response === 'confirmado';
      const side = row.guest_side?.toLowerCase() || 'noivo';

      event.confirmations.push({
        name: guestName,
        attending: attending,
        side: side,
        companions: companions,
        kids: []
      });
    }
  });

  return { users: newUsers, events: newEvents };
}


// ===================== TOGGLE MODERATOR ROLE =====================
function toggleModeratorRole(userId) {
  const user = Store.users.find(u => u.id === userId);
  if (!user) return;

  // Apenas admin pode atribuir role de moderador
  if (!Store.currentUser || Store.currentUser.role !== 'admin') {
    toast('Apenas admin pode atribuir role de moderador!');
    return;
  }

  const newRole = user.role === 'moderator' ? 'user' : 'moderator';
  
  // ✅ Mostrar confirmação
  const confirmModal = document.createElement('div');
  confirmModal.className = 'modal-overlay';
  confirmModal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full mx-4">
      <h3 class="text-lg font-bold text-gray-800 mb-3">${newRole === 'moderator' ? 'Promover a Moderador?' : 'Remover de Moderador?'}</h3>
      <p class="text-sm text-gray-600 mb-4">Utilizador: <strong>${user.phone}</strong></p>
      
      <div class="bg-blue-50 border-l-3 border-blue-500 p-3 rounded mb-4 text-xs text-blue-700">
        ${newRole === 'moderator' 
          ? '<p class="font-semibold mb-1">Moderador pode:</p><ul class="list-disc list-inside"><li>Editar eventos</li><li>Ver confirmações</li><li>Gerir presentes</li></ul><p class="mt-2"> NÃO pode eliminar convidados, eventos ou utilizadores</p>'
          : '<p class="font-semibold mb-1">O utilizador voltará a ser um utilizador normal</p>'
        }
      </div>
      
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="confirmToggleModeratorRole('${userId}', '${newRole}', this.closest('.modal-overlay'))">Confirmar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(confirmModal);
}

function confirmToggleModeratorRole(userId, newRole, modal) {
  const user = Store.users.find(u => u.id === userId);
  if (!user) return;

  user.role = newRole;
  
  // ✅ Sincronizar com Supabase
  supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', { role: newRole }).then(result => {
    console.log('✅ Role alterado para:', newRole);
    
    modal.remove();
    toast(newRole === 'moderator' 
      ? `${user.phone} foi promovido a Moderador!` 
      : `${user.phone} voltou a ser Utilizador Normal!`);
    
    renderAdmin();
  }).catch(error => {
    console.error('❌ Erro ao alterar role:', error);
    toast(' Erro ao alterar role. Tente novamente.');
  });
}

// Adicionar botão admin para gerir URLs legados (no renderAdmin)
// Será adicionado no painel admin


// ===================== STORAGE MANAGER =====================
async function openStorageManager() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'storage-manager-modal';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg w-full max-w-2xl" style="max-height:90vh;overflow-y:auto;padding:1.5rem">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-gray-800">Gestor de Ficheiros (Storage)</h3>
        <button onclick="this.closest('.modal-overlay').remove()" class="text-gray-400 hover:text-gray-600">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="flex gap-2 flex-wrap mb-4">
        <button class="btn-main text-xs px-4 py-2" onclick="loadStorageBuckets()">
          <i data-lucide="refresh-cw" class="w-3 h-3"></i> Carregar ficheiros
        </button>
        <button class="bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg py-2 px-4 font-semibold transition" onclick="deleteCheckedFiles()">
          <i data-lucide="trash-2" class="w-3 h-3"></i> Eliminar seleccionados
        </button>
      </div>
      <div id="sm-tabs" class="flex gap-2 mb-4">
        <button class="text-xs font-bold px-3 py-1.5 rounded-lg bg-teal-100 text-teal-700" onclick="filterStorageType('all')">Todos</button>
        <button class="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600" onclick="filterStorageType('image')">Imagens</button>
        <button class="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600" onclick="filterStorageType('audio')">Músicas</button>
        <button class="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600" onclick="filterStorageType('font')">Fontes</button>
      </div>
      <div id="sm-files-list" class="text-sm text-gray-500">Clique em "Carregar ficheiros" para listar.</div>
      <div class="mt-6 border-t pt-4">
        <h4 class="font-bold text-gray-700 mb-2 flex items-center gap-2">
          <i data-lucide="clock" class="w-4 h-4 text-amber-500"></i> Eventos com Ficheiros (>7 dias atrás)
        </h4>
        <button class="btn-outline text-xs px-4 py-2 mb-3" onclick="loadExpiredEventFiles()">Ver eventos expirados</button>
        <div id="sm-expired-list" class="text-sm text-gray-500 italic">Clique para listar.</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  lucide.createIcons();
}

Store.storageFiles = [];
Store.storageFilter = 'all';

async function loadStorageBuckets() {
  const listEl = document.getElementById('sm-files-list');
  if (!listEl) return;
  listEl.innerHTML = '<p class="text-gray-400 text-xs">A carregar...</p>';
  const buckets = ['event-covers', 'event-music'];
  let allFiles = [];
  for (const bucket of buckets) {
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 200, offset: 0, prefix: '' })
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        data.forEach(f => allFiles.push({ ...f, bucket, url: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${f.name}` }));
      }
    } catch(e) { console.error('Bucket error:', bucket, e); }
  }
  Store.storageFiles = allFiles;
  renderStorageFiles();
}

function filterStorageType(type) {
  Store.storageFilter = type;
  renderStorageFiles();
}

function getFileType(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','webp','gif'].includes(ext)) return 'image';
  if (['mp3','ogg','wav','m4a'].includes(ext)) return 'audio';
  if (['ttf','otf','woff','woff2'].includes(ext)) return 'font';
  return 'other';
}

function renderStorageFiles() {
  const listEl = document.getElementById('sm-files-list');
  if (!listEl) return;
  let files = Store.storageFiles;
  if (Store.storageFilter !== 'all') {
    files = files.filter(f => getFileType(f.name) === Store.storageFilter);
  }
  if (!files.length) { listEl.innerHTML = '<p class="text-gray-400 text-xs italic">Nenhum ficheiro encontrado.</p>'; return; }
  listEl.innerHTML = files.map(f => {
    const type = getFileType(f.name);
    const sizeKB = f.metadata?.size ? Math.round(f.metadata.size / 1024) + ' KB' : '—';
    const iconMap = { image: 'image', audio: 'music', font: 'type', other: 'file' };
    return `<div class="flex items-center gap-3 py-2 border-b border-gray-100" data-file="${f.name}" data-bucket="${f.bucket}">
      <input type="checkbox" class="sm-file-check accent-teal-500 flex-shrink-0" data-name="${f.name}" data-bucket="${f.bucket}">
      <i data-lucide="${iconMap[type]}" class="w-4 h-4 text-gray-400 flex-shrink-0"></i>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold text-gray-700 truncate">${f.name}</p>
        <p class="text-xs text-gray-400">${f.bucket} · ${sizeKB}</p>
      </div>
      ${type === 'image' ? `<img src="${f.url}" class="w-10 h-10 object-cover rounded-lg flex-shrink-0">` : ''}
      <button onclick="deleteStorageFile('${f.bucket}','${f.name}',this)" class="text-red-400 hover:text-red-600 px-1 flex-shrink-0">
        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
      </button>
    </div>`;
  }).join('');
  lucide.createIcons();
}

async function deleteStorageFile(bucket, name, btn, skipConfirm = false) {
  if (!skipConfirm && !confirm(`Eliminar "${name}"?`)) return;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${name}`, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
  });
  if (res.ok) {
    Store.storageFiles = Store.storageFiles.filter(f => !(f.name === name && f.bucket === bucket));
    renderStorageFiles();
    toast('Ficheiro eliminado.');
  } else { toast('Erro ao eliminar ficheiro.'); }
}

async function deleteCheckedFiles() {
  const checks = Array.from(document.querySelectorAll('.sm-file-check:checked'));
  if (!checks.length) { toast('Seleccione ficheiros para eliminar.'); return; }
  if (!confirm(`Eliminar ${checks.length} ficheiro(s) seleccionado(s)? Esta acção não pode ser desfeita.`)) return;
  let done = 0;
  for (const ch of checks) {
    await deleteStorageFile(ch.dataset.bucket, ch.dataset.name, null, true); // skipConfirm
    done++;
  }
  toast(`${done} ficheiro(s) eliminado(s).`);
  await loadStorageBuckets();
}

async function deleteAllStorageFiles() {
  const allFiles = Store.storageFiles || [];
  if (!allFiles.length) { toast('Nenhum ficheiro para eliminar.'); return; }
  if (!confirm(`Eliminar TODOS os ${allFiles.length} ficheiros? Esta acção não pode ser desfeita.`)) return;
  let done = 0;
  for (const f of allFiles) {
    await deleteStorageFile(f.bucket, f.name, null, true);
    done++;
  }
  toast(`${done} ficheiro(s) eliminado(s).`);
  Store.storageFiles = [];
  renderStorageFiles();
}

async function loadExpiredEventFiles() {
  const listEl = document.getElementById('sm-expired-list');
  if (!listEl) return;
  listEl.innerHTML = '<p class="text-gray-400 text-xs">A carregar...</p>';
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const expiredEvents = Store.events.filter(ev => ev.date && ev.date < cutoffStr && (ev.cover_image || ev.music_url));
  if (!expiredEvents.length) {
    listEl.innerHTML = '<p class="text-gray-400 text-xs italic">Nenhum evento com ficheiros expirados encontrado.</p>';
    return;
  }
  const userMap = {};
  (Store.users || []).forEach(u => { userMap[u.id] = u.phone; });
  listEl.innerHTML = expiredEvents.map(ev => {
    const userName = userMap[ev.user_id || ev.userId] || 'Utilizador desconhecido';
    const files = [];
    if (ev.cover_image) files.push({ type: 'Capa', url: ev.cover_image });
    if (ev.music_url && ev.music_url.includes(SUPABASE_URL)) files.push({ type: 'Música', url: ev.music_url });
    return `<div class="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
      <p class="font-semibold text-gray-800 text-sm">${escapeHTML(ev.title)}</p>
      <p class="text-xs text-gray-500 mb-2">Data: ${ev.date} · Utilizador: ${escapeHTML(userName)}</p>
      <div class="space-y-1">
        ${files.map(f => `<div class="flex items-center gap-2 text-xs">
          <span class="text-gray-500">${f.type}:</span>
          <span class="text-teal-600 truncate flex-1" style="max-width:200px">${f.url.split('/').pop()}</span>
          <button onclick="deleteStorageFileByURL('${f.url}', this)" class="text-red-400 hover:text-red-600 font-semibold">Eliminar</button>
        </div>`).join('')}
      </div>
    </div>`;
  }).join('');
}

async function deleteStorageFileByURL(url, btn) {
  const parts = url.replace(SUPABASE_URL + '/storage/v1/object/public/', '').split('/');
  const bucket = parts[0];
  const name   = parts.slice(1).join('/');
  await deleteStorageFile(bucket, name, btn);
  if (btn) btn.closest('div.flex')?.remove();
}



// ===================== MUSIC REUSE FROM STORAGE =====================
async function openMusicFromStorage() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-5 max-w-md w-full" style="max-height:80vh;overflow-y:auto">
      <h3 class="text-base font-bold text-gray-800 mb-3">Reutilizar Música do Storage</h3>
      <div id="storage-music-list"><p class="text-xs text-gray-400">A carregar...</p></div>
      <button class="mt-4 btn-outline w-full text-sm" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
    </div>`;
  document.body.appendChild(modal);
  // Load audio files from event-music bucket
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/event-music`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: 100, offset: 0, prefix: '' })
    });
    const files = await res.json();
    const listEl = document.getElementById('storage-music-list');
    if (!Array.isArray(files) || !files.length) {
      listEl.innerHTML = '<p class="text-xs text-gray-400">Nenhuma música no storage.</p>';
      return;
    }
    listEl.innerHTML = files.map(f => {
      const url  = SUPABASE_URL + '/storage/v1/object/public/event-music/' + f.name;
      const name = f.name.replace(/^music_\d+_[a-z0-9]+\./, '').replace(/\.[^.]+$/, '');
      return `<div class="flex items-center gap-3 py-2 border-b border-gray-100">
        <i data-lucide="music" class="w-4 h-4 text-teal-500 flex-shrink-0"></i>
        <span class="flex-1 text-xs text-gray-700 truncate" title="${f.name}">${name}</span>
        <button class="text-xs btn-main px-3 py-1" onclick="selectStorageMusic('${url}','${name}',this)">Usar</button>
      </div>`;
    }).join('');
    lucide.createIcons();
  } catch(e) {
    document.getElementById('storage-music-list').innerHTML = '<p class="text-xs text-red-400">Erro ao carregar músicas.</p>';
  }
}

function selectStorageMusic(url, name, btn) {
  const urlInput   = document.getElementById('evt-music-url');
  const titleInput = document.getElementById('evt-music-title');
  if (urlInput)   urlInput.value   = url;
  if (titleInput && !titleInput.value) titleInput.value = name;
  btn.closest('.modal-overlay')?.remove();
  toast('Música seleccionada!');
}


function renderFontsList() {
  const listEl = document.getElementById('fonts-list');
  if (!listEl) return;
  const fonts = Store.availableFonts || [];
  if (!fonts.length) { listEl.innerHTML = '<p class="text-xs text-gray-400">Nenhuma fonte carregada.</p>'; return; }
  listEl.innerHTML = fonts.map(f => `
    <div class="flex items-center gap-2 text-xs py-1">
      <span class="font-semibold text-gray-700 flex-1" style="font-family:'${f.name}',sans-serif">${f.name}</span>
      <button onclick="deleteFontFromStorage('${f.name}','${f.url}',this)" class="text-red-400 hover:text-red-600">
        <i data-lucide="trash-2" class="w-3 h-3"></i>
      </button>
    </div>`).join('');
  lucide.createIcons();
}

async function deleteFontFromStorage(name, url, btn) {
  if (!confirm(`Eliminar fonte "${name}"?`)) return;
  const fileName = url.split('/').pop();
  await fetch(`${SUPABASE_URL}/storage/v1/object/event-covers/${fileName}`, {
    method: 'DELETE', headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
  });
  await supabaseRequest(`fonts?name=eq.${encodeURIComponent(name)}`, 'DELETE');
  Store.availableFonts = (Store.availableFonts || []).filter(f => f.name !== name);
  renderFontsList();
  updateFontSelector();
  toast(`Fonte "${name}" eliminada.`);
}
// ===================== LEGAL MODALS =====================
async function showPrivacyModal() {
  if (document.getElementById('_privacy-modal')) return;
  const m = document.createElement('div');
  m.id = '_privacy-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem';
  m.innerHTML = `<div style="background:#fff;border-radius:1.25rem;padding:1.75rem;max-width:540px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.25)">
    <h3 style="font-size:1.1rem;font-weight:800;color:#1e293b;margin-bottom:1rem">Política de Privacidade</h3>
    <div id="_privacy-content" style="font-size:0.875rem;color:#4b5563;line-height:1.7;white-space:pre-wrap">A carregar...</div>
    <button id="_close-privacy-btn" style="margin-top:1.25rem;width:100%;background:#007f9f;color:#fff;border:none;border-radius:999px;padding:0.8rem;font-weight:700;font-size:0.95rem;cursor:pointer;font-family:inherit">Fechar</button>
  </div>`;
  m.onclick = (e) => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
  document.getElementById('_close-privacy-btn').onclick = () => m.remove();

  try {
    const rows = await supabaseRequest(`legal_pages?slug=eq.privacy&select=content&limit=1`).catch(() => []);
    const content = (rows && rows[0] && rows[0].content) ? rows[0].content : _LEGACY_PRIVACY_TEXT;
    const el = document.getElementById('_privacy-content');
    if (el) el.textContent = content;
  } catch(e) {
    const el = document.getElementById('_privacy-content');
    if (el) el.textContent = _LEGACY_PRIVACY_TEXT;
  }
}

const _LEGACY_PRIVACY_TEXT = `A Invites Web-Convites (marca da AdKira) compromete-se a proteger a privacidade de todos os utilizadores e convidados desta plataforma.

Dados recolhidos: Nome e telefone (para conta); nome e resposta de confirmação (para convidados); imagens, música e informações do evento.

Finalidade: Uso exclusivo para gestão e exibição do convite digital. Nunca vendidos ou partilhados com terceiros.

Retenção: Dados do evento disponíveis até 1 semana após o evento. Dados de conta permanecem enquanto a conta estiver activa.

Segurança: Palavras-passe em hash SHA-256. Comunicações via HTTPS.

Menores: Plataforma não dirigida a menores de 18 anos.

Cookies: Apenas localStorage para sessão. Sem cookies de rastreamento.

Propaganda: Após confirmação de presença, pode surgir mensagem promocional dos nossos serviços.

Direitos: Solicite eliminação em invitesadkira@gmail.com.

Contacto: AdKira · Viana, Luanda Sul · invitesadkira@gmail.com · WhatsApp 959 823 409`;

async function showTermsModal() {
  if (document.getElementById('_terms-modal')) return;
  const m = document.createElement('div');
  m.id = '_terms-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem';
  m.innerHTML = `<div style="background:#fff;border-radius:1.25rem;padding:1.75rem;max-width:540px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.25)">
    <h3 style="font-size:1.1rem;font-weight:800;color:#1e293b;margin-bottom:1rem">Termos de Uso</h3>
    <div id="_terms-content" style="font-size:0.875rem;color:#4b5563;line-height:1.7;white-space:pre-wrap">A carregar...</div>
    <button id="_close-terms-btn" style="margin-top:1.25rem;width:100%;background:#007f9f;color:#fff;border:none;border-radius:999px;padding:0.8rem;font-weight:700;font-size:0.95rem;cursor:pointer;font-family:inherit">Fechar</button>
  </div>`;
  m.onclick = (e) => { if (e.target === m) m.remove(); };
  document.body.appendChild(m);
  document.getElementById('_close-terms-btn').onclick = () => m.remove();

  try {
    const rows = await supabaseRequest(`legal_pages?slug=eq.terms&select=content&limit=1`).catch(() => []);
    const content = (rows && rows[0] && rows[0].content) ? rows[0].content : _LEGACY_TERMS_TEXT;
    const el = document.getElementById('_terms-content');
    if (el) el.textContent = content;
  } catch(e) {
    const el = document.getElementById('_terms-content');
    if (el) el.textContent = _LEGACY_TERMS_TEXT;
  }
}

const _LEGACY_TERMS_TEXT = `Ao utilizar os serviços da Invites Web-Convites (marca da AdKira), concorda com os seguintes termos e condições. Leia-os com atenção.

1. O nosso compromisso consigo
A Invites Web-Convites compromete-se a fornecer uma plataforma estável, segura e funcional para a criação de convites digitais. Trabalhamos activamente para garantir que o seu convite esteja disponível durante todo o período do evento. Em caso de falha técnica que comprometa o acesso ao seu convite, contactamos activamente o organizador e envidamos todos os esforços para repor o serviço no menor tempo possível.

2. O que oferecemos
Um convite digital personalizado com página do convidado, sistema de confirmação de presença, galeria de fotos, música, locais do evento e muito mais. O convite fica activo desde a activação até 7 dias após a data do evento. Apoio por WhatsApp durante todo o processo.

3. Disponibilidade do serviço
Utilizamos infraestrutura de nível profissional (Supabase). Em caso de manutenção programada, avisamos com antecedência. Falhas imprevistas são tratadas com prioridade. Para eventos muito importantes, recomendamos confirmar o funcionamento do link com 48h de antecedência.

4. O vosso conteúdo
Todo o conteúdo (fotos, textos, músicas) que carrega é da sua responsabilidade. Deve garantir que possui os direitos de uso. Não publicamos nem partilhamos o vosso conteúdo com terceiros.

5. Preços e pagamentos
O pagamento é único por evento, sem mensalidades. Após confirmação do comprovativo, o evento é activado. Não efectuamos reembolsos após a activação do convite, salvo em caso de falha técnica grave da nossa parte.

6. Dados e privacidade
Guardamos apenas os dados necessários para o funcionamento do convite. Não vendemos dados a terceiros. Os dados dos convidados (nome e confirmação de presença) são visíveis apenas para o organizador do evento.

7. Mensagem promocional
Após a confirmação de presença de um convidado, é apresentada uma breve mensagem promovendo os nossos serviços. Esta prática é transparente e faz parte do nosso modelo de negócio.

8. Rescisão
Reservamos o direito de suspender contas que violem estes termos. Em caso de suspensão por nossa iniciativa sem justificação válida, reembolsamos o valor pago.

9. Contacto e suporte
Para qualquer questão, reclamação ou pedido, contacte-nos. Respondemos em menos de 24h em dias úteis.

AdKira · Viana, Luanda Sul, Angola · invitesadkira@gmail.com · WhatsApp 959 823 409 · Segunda a Sexta 08h–17h`;

// ===================== FAQ EDITOR =====================
async function loadFAQ() {
  const faqs = await supabaseRequest('faq?select=id,question,answer,position&order=position.asc');
  return faqs || Store._defaultFAQ || [];
}

Store._defaultFAQ = [
  { id:'d1', question:'O convite funciona no iPhone e Android?', answer:'Sim! Funciona em todos os dispositivos — iPhone, Android, tablets e computadores. Os convidados abrem pelo browser, sem instalar nada.', position:1 },
  { id:'d2', question:'Os convidados precisam de criar conta?', answer:'Não. Os convidados apenas abrem o link e confirmam presença directamente.', position:2 },
  { id:'d3', question:'O site fica sempre disponível?', answer:'O site pode estar temporariamente indisponível durante manutenções. Avisamos sempre com antecedência quando possível.', position:3 },
  { id:'d4', question:'Como faço o pagamento?', answer:'Por transferência bancária (IBAN) ou Express. Após pagamento, envia o comprovativo pelo WhatsApp 959 823 409.', position:4 },
];

async function renderFAQ(container) {
  if (!container) return;
  const faqs = await loadFAQ();
  container.innerHTML = faqs.map(f => `
    <div class="faq-item" id="faq-${f.id}">
      <button class="faq-q" onclick="toggleFaqItem('${f.id}')">
        ${escapeHTML(f.question)}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-a">${escapeHTML(f.answer)}</div>
    </div>`).join('');
}

function toggleFaqItem(id) {
  const el = document.getElementById('faq-' + id);
  if (el) el.classList.toggle('open');
}

async function openFaqEditor() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') return;
  const faqs = await loadFAQ();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-5 max-w-xl w-full" style="max-height:85vh;overflow-y:auto">
      <h3 class="text-base font-bold text-gray-800 mb-3">Editar FAQ</h3>
      <div id="faq-editor-list">${faqs.map((f,i) => `
        <div class="bg-gray-50 rounded-xl p-3 mb-3" id="fe-item-${i}">
          <input class="input-field text-sm mb-1" value="${escapeHTML(f.question)}" id="fe-q-${i}" placeholder="Pergunta">
          <textarea class="input-field text-sm" rows="2" id="fe-a-${i}">${escapeHTML(f.answer)}</textarea>
          <button type="button" class="text-red-400 text-xs mt-1" onclick="removeFaqItem('${f.id}','fe-item-${i}')">Remover</button>
        </div>`).join('')}
      </div>
      <button type="button" class="text-teal-600 text-sm font-semibold mb-3" onclick="addFaqEditorItem()">+ Adicionar pergunta</button>
      <div class="flex gap-2">
        <button class="flex-1 btn-main" onclick="saveFAQ(this)">Guardar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>`;
  modal.dataset.faqs = JSON.stringify(faqs);
  document.body.appendChild(modal);
}

function addFaqEditorItem() {
  const list = document.getElementById('faq-editor-list');
  const i = list.children.length;
  const div = document.createElement('div');
  div.className = 'bg-gray-50 rounded-xl p-3 mb-3';
  div.id = `fe-item-${i}`;
  div.innerHTML = `
    <input class="input-field text-sm mb-1" id="fe-q-${i}" placeholder="Nova pergunta">
    <textarea class="input-field text-sm" rows="2" id="fe-a-${i}" placeholder="Resposta"></textarea>
    <button type="button" class="text-red-400 text-xs mt-1" onclick="this.closest('.bg-gray-50').remove()">Remover</button>`;
  list.appendChild(div);
}

function removeFaqItem(id, divId) {
  if (id && !id.startsWith('d')) supabaseRequest(`faq?id=eq.${id}`, 'DELETE');
  document.getElementById(divId)?.remove();
}

async function saveFAQ(btn) {
  btn.textContent = 'A guardar...';
  const items = document.querySelectorAll('[id^="fe-item-"]');
  for (let i = 0; i < items.length; i++) {
    const q = document.getElementById(`fe-q-${i}`)?.value?.trim();
    const a = document.getElementById(`fe-a-${i}`)?.value?.trim();
    if (q && a) await supabaseRequest('faq', 'POST', { question: q, answer: a, position: i + 1 });
  }
  btn.closest('.modal-overlay').remove();
  toast('FAQ actualizado!');
  // Re-render FAQ on home page
  const container = document.getElementById('faq-container');
  if (container) renderFAQ(container);
}

// ===================== PACKAGE PAYMENT MODAL =====================
function startPackageOrder(name, price) {
  const priceNum = parseFloat(String(price).replace(/[^0-9]/g, ''));
  const URGENCY_FEE = 8000;
  const modalId = '_pkg-order-' + Date.now();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  modal.innerHTML = `<div style="background:#fff;border-radius:1.25rem;padding:1.75rem;max-width:440px;width:100%;max-height:90vh;overflow-y:auto">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">
      <h3 style="font-size:1.05rem;font-weight:800;color:#1e293b;margin:0">Encomendar — ${escapeHTML(name)}</h3>
      <button id="${modalId}-close" style="background:#f3f4f6;border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>

    <label style="display:flex;align-items:center;gap:0.5rem;font-size:0.85rem;font-weight:600;color:#374151;cursor:pointer;padding:0.75rem;background:#fef3c7;border-radius:0.65rem;margin-bottom:0.75rem">
      <input type="checkbox" id="${modalId}-urgent">
      Adicionar urgência +${URGENCY_FEE.toLocaleString('pt-PT')} Kz (entrega em 24h)
    </label>

    <div id="${modalId}-calc"></div>

    <div style="background:#f0f9fb;border-radius:0.75rem;padding:0.85rem;margin:0.75rem 0">
      <p style="font-size:0.8rem;font-weight:700;color:#007f9f;margin-bottom:0.5rem">Dados de pagamento</p>
      <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.3rem">
        <p style="font-size:0.78rem;color:#374151;flex:1"><strong>Transferência Express:</strong> 959 823 409</p>
        <button type="button" onclick="copyToClipboard('959823409', this)" style="background:none;border:none;color:#007f9f;cursor:pointer;padding:2px;flex-shrink:0" title="Copiar número">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
      <div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.3rem">
        <p style="font-size:0.78rem;color:#374151;flex:1"><strong>IBAN BAI:</strong> 0040 0000 3066 6927 1014 1</p>
        <button type="button" onclick="copyToClipboard('004000003066692710141', this)" style="background:none;border:none;color:#007f9f;cursor:pointer;padding:2px;flex-shrink:0" title="Copiar IBAN">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </div>
      <p style="font-size:0.78rem;color:#374151"><strong>Titular:</strong> Araújo Artur Cataca</p>
    </div>

    <div style="border-top:1px solid #e5e7eb;margin:0.75rem 0;padding-top:0.75rem">
      <label style="font-size:0.82rem;font-weight:700;color:#374151;display:block;margin-bottom:0.4rem">O seu nome</label>
      <input id="${modalId}-name" class="input-field" placeholder="Nome completo" style="margin-bottom:0.6rem">
      <label style="font-size:0.82rem;font-weight:700;color:#374151;display:block;margin-bottom:0.4rem">WhatsApp para contacto</label>
      <input id="${modalId}-wa" class="input-field" placeholder="Ex: 244912345678">
    </div>

    <button id="${modalId}-submit" style="background:#007f9f;color:#fff;border:none;border-radius:999px;padding:0.85rem;font-weight:700;font-size:0.92rem;cursor:pointer;width:100%;font-family:inherit;margin-top:0.75rem">
      Encomendar
    </button>
    <p style="font-size:0.72rem;color:#9ca3af;text-align:center;margin-top:0.5rem">A AdKira enviará um código de acesso pelo WhatsApp após confirmação.</p>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById(`${modalId}-close`).onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };

  function calc() {
    const urgent = document.getElementById(`${modalId}-urgent`)?.checked;
    const total = priceNum + (urgent ? URGENCY_FEE : 0);
    const p1 = Math.ceil(total * 0.7);
    const p2 = total - p1;
    const fmt = n => n.toLocaleString('pt-PT') + ' Kz';
    const el = document.getElementById(`${modalId}-calc`);
    if (!el) return;
    el.innerHTML = `<div style="background:#f8fafc;border-radius:0.75rem;padding:1rem">
      <div style="display:flex;justify-content:space-between;margin-bottom:0.4rem"><span style="font-size:0.85rem;color:#374151">Valor do pacote</span><span style="font-size:0.85rem;font-weight:600">${fmt(priceNum)}</span></div>
      ${urgent ? `<div style="display:flex;justify-content:space-between;margin-bottom:0.4rem"><span style="font-size:0.85rem;color:#374151">Taxa de urgência</span><span style="font-size:0.85rem;font-weight:600;color:#ef4444">+ ${fmt(URGENCY_FEE)}</span></div>` : ''}
      <div style="border-top:1px solid #e5e7eb;padding-top:0.5rem;margin-top:0.25rem">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.3rem"><span style="font-size:0.82rem;color:#6b7280">1ª prestação (70%)</span><span style="font-size:0.9rem;font-weight:800;color:#007f9f">${fmt(p1)}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="font-size:0.82rem;color:#6b7280">2ª prestação (30%)</span><span style="font-size:0.9rem;font-weight:700;color:#374151">${fmt(p2)}</span></div>
      </div>
      <div style="margin-top:0.6rem;background:#dbeafe;border-radius:0.5rem;padding:0.4rem 0.65rem;font-size:0.75rem;color:#1e40af">Entrega em 48h úteis${urgent?' (urgência: 24h)':''}</div>
    </div>`;
  }
  document.getElementById(`${modalId}-urgent`).addEventListener('change', calc);
  calc();

  document.getElementById(`${modalId}-submit`).onclick = async function() {
    const name = document.getElementById(`${modalId}-name`)?.value?.trim();
    const wa   = document.getElementById(`${modalId}-wa`)?.value?.trim();
    if (!name) { toast('Insere o teu nome.'); return; }
    if (!wa)   { toast('Insere o teu WhatsApp.'); return; }

    const urgent = document.getElementById(`${modalId}-urgent`)?.checked;
    const urgencyFee = urgent ? URGENCY_FEE : 0;
    const total = priceNum + urgencyFee;
    const p1 = Math.ceil(total * 0.7);
    const p2 = total - p1;

    this.disabled = true; this.textContent = 'A processar...';

    const order = await supabaseRequest('orders', 'POST', {
      customer_name: name, whatsapp: wa, package_name: name + ' — ' + (document.querySelector(`#${modalId} h3`)?.textContent || ''),
      package_price: priceNum, urgency_fee: urgencyFee, total_price: total,
      installment1: p1, installment2: p2, status: 'pending'
    }).catch(() => null);

    if (!order || !order[0]) { toast('Erro ao processar encomenda. Tenta novamente.'); this.disabled = false; this.textContent = 'Encomendar'; return; }

    modal.innerHTML = `<div style="padding:1.5rem;text-align:center">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 1rem"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
      <h3 style="font-size:1.1rem;font-weight:800;color:#1e293b;margin-bottom:0.5rem">Encomenda Recebida!</h3>
      <p style="font-size:0.85rem;color:#6b7280;margin-bottom:1.25rem">Entraremos em contacto pelo WhatsApp <strong>${escapeHTML(wa)}</strong> com o código de acesso e instruções de pagamento.</p>
      <button onclick="document.getElementById('${modalId}').remove()" style="background:#007f9f;color:#fff;border:none;border-radius:999px;padding:0.75rem 2rem;font-weight:700;cursor:pointer;font-family:inherit">Fechar</button>
    </div>`;
    toast('Encomenda enviada! Acompanha o teu WhatsApp.');
  };
}

function copyText(text, msg) {
  navigator.clipboard.writeText(text).then(() => toast(msg || 'Copiado!')).catch(() => {});
}

// ===================== DEMO EVENT SETTING =====================
async function setDemoEvent(eventId) {
  await supabaseRequest('site_config', 'POST', { key: 'demo_event_id', value: eventId });
  toast('Evento exemplo definido!');
}

async function loadDemoEvent() {
  const btn = document.getElementById('demo-btn');
  if (btn) { btn.textContent = 'A carregar...'; btn.disabled = true; }
  try {
    const cfg = await supabaseRequest('site_config?key=eq.demo_event_id&select=value&limit=1');
    const demoId = cfg && cfg[0] ? cfg[0].value : null;
    if (!demoId) {
      toast('Nenhum evento exemplo definido ainda.');
      if(btn){btn.textContent='Ver Convite Exemplo';btn.disabled=false;}
      return;
    }
    // Set event ID and go to guest view — event will be loaded via URL check
    Store.currentEventId = demoId;
    // Load event data fresh from Supabase
    // Try to find in already-loaded events first
    let demoEv = Store.events && Store.events.find(e => e.id === demoId);
    if (!demoEv) {
      // Load from Supabase — use the same full query as the guest URL check
      const evData = await supabaseRequest(`events?id=eq.${demoId}&select=id,title,date,time,confirm_by_date,cover_image,event_code,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,allow_messages,show_guest_messages,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,groom_name,bride_name,couple_size,show_couple,bg_url,bg_overlay,bible_text,bible_ref,show_bible,invite_text,show_invite,groom_parents,bride_parents,show_parents,gallery_urls,show_gallery,show_manual,manual_items,show_schedule,schedule_items,custom_font_family,section_order,story_text,invite_blessing,event_color,rsvps(guest_name,attending,side,companions,kids,wants_gift,message,created_at,updated_at),gifts(id,name,category,reserved,reserved_by)&limit=1`);
      if (!evData || !evData[0]) {
        toast('Evento exemplo não encontrado. Define um evento válido nas Definições.');
        if(btn){btn.textContent='Ver Convite Exemplo';btn.disabled=false;}
        return;
      }
      demoEv = {
        ...evData[0],
        confirmations: (evData[0].rsvps||[]).map(r=>({name:r.guest_name,attending:r.attending,side:r.side,companions:r.companions?r.companions.split('|').filter(Boolean):[],kids:r.kids?r.kids.split('|').filter(Boolean):[],wantsGift:r.wants_gift,message:r.message||''})),
        gifts: (evData[0].gifts||[])
      };
    }
    Store.guestEventData = demoEv;
    Store.currentEventId = demoId;
    if(btn){btn.textContent='Ver Convite Exemplo';btn.disabled=false;}
    Router.go('guest');
  } catch(e) {
    console.error('loadDemoEvent error:', e);
    if(btn){btn.textContent='Ver Convite Exemplo';btn.disabled=false;}
  }
}


// ===================== ADMIN: CREATE USER ACCOUNT =====================
function openCreateUserModal() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') return;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-6" style="max-width:420px">
      <h3 class="text-lg font-bold text-gray-800 mb-1">Criar Conta de Utilizador</h3>
      <p class="text-xs text-gray-400 mb-4">O utilizador poderá entrar com estas credenciais.</p>
      <div class="space-y-3">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Telefone / Email</label>
          <input id="new-user-phone" class="input-field" placeholder="ex: 9xx xxx xxx">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Palavra-passe</label>
          <input id="new-user-pass" type="password" class="input-field" placeholder="Mínimo 6 caracteres">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Limite de eventos</label>
          <input id="new-user-limit" type="number" class="input-field" value="1" min="1" max="100">
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Papel</label>
          <select id="new-user-role" class="input-field">
            <option value="user">Utilizador</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">Etiqueta (opcional)</label>
          <input id="new-user-label" class="input-field" placeholder="ex: Cliente VIP, Parceiro...">
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <button class="flex-1 btn-main" onclick="createUserAccount(this)">Criar Conta</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
      <div id="create-user-msg" class="mt-2 text-xs text-center hidden"></div>
    </div>`;
  document.body.appendChild(modal);
}

async function createUserAccount(btn) {
  const phone = document.getElementById('new-user-phone').value.trim();
  const pass  = document.getElementById('new-user-pass').value.trim();
  const limit = parseInt(document.getElementById('new-user-limit').value) || 1;
  const role  = document.getElementById('new-user-role').value;
  const label = document.getElementById('new-user-label').value.trim() || null;
  const msg   = document.getElementById('create-user-msg');

  if (!phone || !pass) { msg.textContent = 'Preenche telefone e palavra-passe.'; msg.className = 'mt-2 text-xs text-center text-red-500'; msg.classList.remove('hidden'); return; }
  if (pass.length < 6) { msg.textContent = 'Palavra-passe deve ter mínimo 6 caracteres.'; msg.className = 'mt-2 text-xs text-center text-red-500'; msg.classList.remove('hidden'); return; }

  btn.textContent = 'A criar...'; btn.disabled = true;

  // Hash password same way as registration
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  const passHash   = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const result = await supabaseRequest('accounts', 'POST', {
    phone, password: passHash, role, status: 'active',
    event_limit: limit, admin_label: label
  });

  btn.textContent = 'Criar Conta'; btn.disabled = false;

  if (result) {
    msg.textContent = 'Conta criada com sucesso!';
    msg.className = 'mt-2 text-xs text-center text-green-600';
    msg.classList.remove('hidden');
    toast('Conta criada!');
    setTimeout(() => btn.closest('.modal-overlay')?.remove(), 1500);
    // Refresh user list
    if (typeof Store !== 'undefined') {
      const users = await supabaseRequest('accounts?select=id,phone,role,status,event_limit,admin_label,created_at&order=created_at.desc');
      if (users) Store.users = users;
    }
  } else {
    msg.textContent = 'Erro ao criar conta. O telefone já pode estar registado.';
    msg.className = 'mt-2 text-xs text-center text-red-500';
    msg.classList.remove('hidden');
  }
}

// ===================== ADMIN: SET DEMO EVENT =====================
async function setDemoEventFromInput() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') return;
  const input = document.getElementById('demo-event-id-input');
  const eventId = input?.value?.trim();
  if (!eventId) { toast('Insere o ID ou código do evento.'); return; }

  // Verify event exists
  const ev = Store.events.find(e => e.id === eventId || e.event_code === eventId);
  const demoId = ev ? ev.id : eventId;

  // Try PATCH first (update existing), then POST (create if not exists)
  const patchRes = await supabaseRequest('site_config?key=eq.demo_event_id', 'PATCH', { value: demoId, updated_at: new Date().toISOString() });
  if (!patchRes || (Array.isArray(patchRes) && patchRes.length === 0)) {
    await supabaseRequest('site_config', 'POST', { key: 'demo_event_id', value: demoId });
  }

  const infoEl = document.getElementById('current-demo-event');
  if (infoEl) infoEl.textContent = `Activo: ${ev ? ev.title || demoId : demoId}`;
  toast('Evento exemplo definido!');
}

// Load current demo event on settings page
async function loadCurrentDemoEvent() {
  const cfg = await supabaseRequest('site_config?key=eq.demo_event_id&select=value&limit=1');
  const id  = cfg && cfg[0] ? cfg[0].value : null;
  const infoEl = document.getElementById('current-demo-event');
  if (infoEl) {
    if (id) {
      const ev = Store.events.find(e => e.id === id);
      infoEl.textContent = 'Activo: ' + (ev ? ev.title : id);
    } else {
      infoEl.textContent = 'Nenhum evento exemplo definido.';
    }
  }
}


// ===================== GLOBAL HELPERS (called from HTML) =====================
function copyIban(iban) {
  navigator.clipboard.writeText(iban).then(() => {
    const btn = document.getElementById('iban-copy-btn');
    if (btn) {
      const orig = btn.innerHTML;
      btn.style.background = '#16a34a';
      btn.textContent = '✓ Copiado!';
      setTimeout(() => { btn.style.background = ''; btn.innerHTML = orig; }, 2500);
    }
    toast('IBAN copiado!');
  }).catch(() => toast('Não foi possível copiar.'));
}

function showAdminUserPicker() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') return;
  const users = (Store.users || []).filter(u => u.role !== 'admin');
  if (!users.length) { toast('Nenhum utilizador disponível.'); return; }
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-5" style="max-width:400px;max-height:70vh;overflow-y:auto">
      <h3 class="text-base font-bold text-gray-800 mb-3">Gerir como Utilizador</h3>
      <p class="text-xs text-gray-400 mb-3">Escolhe um utilizador para gerir os seus eventos.</p>
      <div class="space-y-2">
        ${users.map(u => `<button onclick="impersonateUser('${u.id}','${escapeHTML(u.phone || '')}',this)" class="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition text-sm font-semibold text-gray-700">${escapeHTML(u.phone || u.id)}${u.admin_label ? ' <span class="text-gray-400 font-normal">· '+escapeHTML(u.admin_label)+'</span>' : ''}</button>`).join('')}
      </div>
      <button class="btn-outline w-full mt-4 text-sm" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
    </div>`;
  document.body.appendChild(modal);
}

function impersonateUser(userId, userPhone, btn) {
  const user = Store.users.find(u => u.id === userId) || { id: userId, phone: userPhone, role: 'user' };
  Store.adminOriginalUser = Store.currentUser; // Guardar admin original
  Store.adminModeActive = true;
  localStorage.setItem('adminImpersonatingUserId', user.id);
  localStorage.setItem('adminImpersonatingUserPhone', user.phone);
  localStorage.setItem('adminOriginalUserId', Store.adminOriginalUser.id);
  localStorage.setItem('adminOriginalUserPhone', Store.adminOriginalUser.phone);
  // CRITICAL: role must become 'user', not stay 'admin' — otherwise this
  // impersonation session would still be treated as an admin login (no
  // notices/review prompts shown, admin-only UI visible, etc.) even though
  // we're viewing as a customer.
  Store.currentUser = { ...user, role: 'user' };
  btn.closest('.modal-overlay')?.remove();
  toast('A gerir como: ' + userPhone);
  if (typeof invalidateEventsCache !== 'undefined') invalidateEventsCache();
  if (typeof loadEventosComDelay !== 'undefined') loadEventosComDelay();
  Router.go('dashboard');
}

// ===================== PACKAGE EDITOR =====================
const DEFAULT_PACKAGES = [
  { name: 'Único', price: '79 999 Kz', people: '∞', invites: 'Envio ilimitado para quantas pessoas desejares', description: 'Envie sem limites, obs.: não leva nomes dos convidados no PDF e nem QR Code.', badge: 'Novo', featured: false },
  { name: 'Básico',   price: '99 999 Kz',  people: 110, invites: '60–66 convites digitais',  description: '', badge: 'Básico',   color: '#e0f2fe', textColor: '#0369a1' },
  { name: 'Popular',  price: '159 999 Kz', people: 230, invites: '126–136 convites digitais', description: '', badge: 'Popular',  color: '#fef3c7', textColor: '#92400e', featured: true },
  { name: 'Premium',  price: '219 999 Kz', people: 300, invites: '166–176 convites digitais', description: '', badge: 'Premium',  color: '#e0fdf4', textColor: '#065f46' },
];

async function loadPackages() {
  try {
    const cfg = await supabaseRequest('site_config?key=eq.packages&select=value&limit=1');
    if (cfg && cfg[0] && cfg[0].value) return JSON.parse(cfg[0].value);
  } catch(e) {}
  return DEFAULT_PACKAGES;
}

async function openPackageEditor() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') return;
  const pkgs = await loadPackages();
  Store._editPackages = JSON.parse(JSON.stringify(pkgs));

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'pkg-editor-modal';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-5" style="max-width:560px;max-height:85vh;overflow-y:auto">
      <h3 class="text-base font-bold text-gray-800 mb-3">Editar Pacotes</h3>
      <div id="pkg-editor-list">${renderPackageEditorList(Store._editPackages)}</div>
      <button type="button" class="text-teal-600 text-sm font-semibold mb-3 mt-1" onclick="addPackageItem()">+ Adicionar pacote</button>
      <div class="flex gap-2 mt-3">
        <button class="flex-1 btn-main" onclick="savePackages(this)">Guardar</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function renderPackageEditorList(pkgs) {
  return pkgs.map((p, i) => `
    <div class="bg-gray-50 rounded-xl p-3 mb-3" id="pkg-item-${i}">
      <div class="grid grid-cols-2 gap-2 mb-2">
        <input class="input-field text-sm" value="${escapeHTML(p.name)}" placeholder="Nome (ex: Básico)" id="pkg-name-${i}">
        <input class="input-field text-sm" value="${escapeHTML(p.price)}" placeholder="Preço (ex: 99 999 Kz)" id="pkg-price-${i}">
      </div>
      <input class="input-field text-sm mb-2" value="${escapeHTML(p.invites || '')}" placeholder="Nº de convites (ex: 60–66 convites digitais)" id="pkg-invites-${i}">
      <textarea class="input-field text-sm mb-2" rows="2" placeholder="Descrição/detalhe (opcional)" id="pkg-desc-${i}">${escapeHTML(p.description || '')}</textarea>
      <button type="button" class="text-red-400 text-xs" onclick="removePackageItem(${i})">Remover</button>
    </div>`).join('');
}

function addPackageItem() {
  Store._editPackages.push({ name: 'Novo', price: '0 Kz', invites: '', description: '', badge: 'Novo' });
  document.getElementById('pkg-editor-list').innerHTML = renderPackageEditorList(Store._editPackages);
}

function removePackageItem(i) {
  Store._editPackages.splice(i, 1);
  document.getElementById('pkg-editor-list').innerHTML = renderPackageEditorList(Store._editPackages);
}

async function savePackages(btn) {
  btn.textContent = 'A guardar...'; btn.disabled = true;
  const pkgs = Store._editPackages.map((p, i) => ({
    ...p,
    name:        document.getElementById(`pkg-name-${i}`)?.value?.trim()    || p.name,
    price:       document.getElementById(`pkg-price-${i}`)?.value?.trim()   || p.price,
    invites:     document.getElementById(`pkg-invites-${i}`)?.value?.trim() || p.invites,
    description: document.getElementById(`pkg-desc-${i}`)?.value?.trim()   || '',
  }));
  const val = JSON.stringify(pkgs);
  const ts  = new Date().toISOString();
  // Try PATCH first; if no rows match, INSERT
  const patchResult = await supabaseRequest('site_config?key=eq.packages', 'PATCH', { value: val, updated_at: ts });
  if (!patchResult || (Array.isArray(patchResult) && patchResult.length === 0)) {
    await supabaseRequest('site_config', 'POST', { key: 'packages', value: val, updated_at: ts }).catch(() => {});
  }
  // Update landing page immediately
  if (typeof renderLandingPackages !== 'undefined') renderLandingPackages(pkgs);
  toast('Pacotes actualizados!');
  document.getElementById('pkg-editor-modal')?.remove();
  btn.textContent = 'Guardar'; btn.disabled = false;
}

// ===================== INTAKE LINK PICKER (for admin) =====================
function openIntakeLinkPicker() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') return;
  const events = Store.events || [];
  if (!events.length) { toast('Nenhum evento encontrado. Cria ou carrega eventos primeiro.'); return; }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl shadow-lg p-5" style="max-width:480px;max-height:80vh;overflow-y:auto">
      <h3 class="text-base font-bold text-gray-800 mb-1">Link de Preenchimento pelo Cliente</h3>
      <p class="text-xs text-gray-400 mb-4">Escolhe o evento e envia o link ao cliente. O cliente preenche os dados sem precisar de conta.</p>
      <div class="space-y-2">
        ${events.map(ev => `
          <div class="flex items-center justify-between p-3 rounded-xl border border-gray-200 hover:border-teal-400 transition">
            <div>
              <p class="text-sm font-semibold text-gray-800">${escapeHTML(ev.title || 'Sem título')}</p>
              <p class="text-xs text-gray-400">${ev.date || '—'}</p>
            </div>
            <button class="btn-main text-xs px-3 py-1.5" onclick="copyIntakeLink('${ev.id}', this)">Copiar Link</button>
          </div>`).join('')}
      </div>
      <button class="btn-outline w-full mt-4 text-sm" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
    </div>`;
  document.body.appendChild(modal);
}

async function copyIntakeLink(eventId, btn) {
  const origText = btn.textContent;
  btn.textContent = 'A gerar...'; btn.disabled = true;
  const ev2 = Store.events.find(e => e.id === eventId);
  const evName = ev2 ? ev2.title : eventId;
  try {
    const link = await generateIntakeLink(eventId);
    await navigator.clipboard.writeText(link);
    btn.textContent = '✓ Copiado!'; btn.style.background = '#16a34a';
    setTimeout(() => { btn.textContent = origText; btn.style.background = ''; btn.disabled = false; }, 2500);
    toast(`Link de "${evName}" copiado! Link válido para uso único.`);
  } catch(e) {
    const base = window.location.origin + window.location.pathname;
    prompt(`Link para "${evName}":`, `${base}?intake=${eventId}`);
    btn.textContent = origText; btn.disabled = false;
  }
}

// ===================== DEMO EVENT AUTO-RENEW =====================
async function checkAndRenewDemoEvent() {
  try {
    // Get demo event ID from site_config
    const cfg = await supabaseRequest('site_config?key=eq.demo_event_id&select=value&limit=1');
    const demoId = cfg && cfg[0] ? cfg[0].value : null;
    if (!demoId) return;

    // Get current event dates
    const dates = await supabaseRequest(`event_dates?event_id=eq.${demoId}&select=event_date,confirm_by_date&limit=1`);
    if (!dates || !dates[0] || !dates[0].event_date) return;

    const eventDate = new Date(dates[0].event_date + 'T12:00:00');
    const now = new Date();
    const daysUntil = (eventDate - now) / (1000 * 60 * 60 * 24);

    // If less than 30 days until event, renew by adding 1 year
    if (daysUntil < 30) {
      const newEventDate = new Date(eventDate);
      newEventDate.setFullYear(newEventDate.getFullYear() + 1);

      const newDeadline = new Date(newEventDate);
      newDeadline.setDate(newDeadline.getDate() - 14); // 2 weeks before

      const newDateStr    = newEventDate.toISOString().split('T')[0];
      const newDeadlineStr = newDeadline.toISOString().split('T')[0];

      await supabaseRequest(`event_dates?event_id=eq.${demoId}`, 'PATCH', {
        event_date:      newDateStr,
        confirm_by_date: newDeadlineStr,
        updated_at:      new Date().toISOString()
      });
      // Also update events table
      await supabaseRequest(`events?id=eq.${demoId}`, 'PATCH', {
        date:            newDateStr,
        confirm_by_date: newDeadlineStr
      });

      console.log(`Demo event renewed: ${newDateStr}`);
      toast(`Evento modelo renovado para ${newDateStr}.`);
    }
  } catch(e) {
    console.warn('Demo event renew check failed:', e);
  }
}

// Run auto-renew check when admin opens settings

// ===================== INTAKE TOKEN MANAGEMENT =====================

async function openIntakeManager(eventId) {
  const ev = Store.events.find(e => e.id === eventId);
  const evTitle = ev ? ev.title : eventId;

  // Load tokens for this event
  const tokens = await supabaseRequest(
    `intake_tokens?event_id=eq.${eventId}&select=token,used,locked,expires_at,use_count,created_at,label&order=created_at.desc&limit=20`
  );

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'intake-manager-modal';

  const tokenRows = (tokens || []).map(t => {
    const expired = t.expires_at && new Date(t.expires_at) < new Date();
    const statusColor = t.locked ? '#ef4444' : expired ? '#f59e0b' : '#16a34a';
    const statusLabel = t.locked ? 'Bloqueado' : expired ? 'Expirado' : 'Activo';
    const link = (window.location.origin + window.location.pathname).replace(/\/+$/, '') + '?intake_token=' + t.token;
    return `<div style="background:#f8fafc;border-radius:0.75rem;padding:0.85rem;margin-bottom:0.6rem;border:1px solid #e5e7eb">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.4rem">
        <span style="font-size:0.7rem;font-weight:700;letter-spacing:0.05em;color:${statusColor};background:${statusColor}18;padding:2px 8px;border-radius:999px">${statusLabel}</span>
        <span style="font-size:0.68rem;color:#9ca3af">Usos: ${t.use_count || 0}</span>
      </div>
      ${t.label ? `<p style="font-size:0.8rem;font-weight:600;color:#374151;margin-bottom:0.3rem">${escapeHTML(t.label)}</p>` : ''}
      ${t.expires_at ? `<p style="font-size:0.7rem;color:#6b7280;margin-bottom:0.3rem">Expira: ${new Date(t.expires_at).toLocaleDateString('pt-PT')}</p>` : ''}
      <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem">
        <button onclick="copyIntakeTokenLink('${t.token}')" style="background:#007f9f;color:#fff;border:none;border-radius:0.5rem;padding:0.3rem 0.65rem;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit">Copiar Link</button>
        <button onclick="toggleIntakeTokenLock('${t.token}',${!t.locked})" style="background:${t.locked?'#16a34a':'#ef4444'};color:#fff;border:none;border-radius:0.5rem;padding:0.3rem 0.65rem;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit">${t.locked ? 'Desbloquear' : 'Bloquear'}</button>
        <button onclick="setIntakeTokenExpiry('${t.token}')" style="background:#f3f4f6;color:#374151;border:none;border-radius:0.5rem;padding:0.3rem 0.65rem;font-size:0.7rem;font-weight:600;cursor:pointer;font-family:inherit">Data Limite</button>
      </div>
    </div>`;
  }).join('') || '<p style="text-align:center;color:#9ca3af;padding:1rem">Nenhum link gerado ainda.</p>';

  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl shadow-lg p-5" style="max-width:520px;max-height:85vh;overflow-y:auto">
    <h3 class="text-base font-bold text-gray-800 mb-1">Links de Preenchimento</h3>
    <p class="text-xs text-gray-400 mb-4">Evento: <strong>${escapeHTML(evTitle)}</strong></p>

    <div style="background:#f0f9fb;border-radius:0.75rem;padding:0.85rem;margin-bottom:1rem">
      <p class="text-xs font-semibold text-gray-700 mb-2">Novo Link</p>
      <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem">
        <input id="new-token-label" class="input-field" placeholder="Nome/Label (ex: Cliente João)" style="font-size:0.82rem;flex:1">
        <input id="new-token-expiry" type="date" class="input-field" style="font-size:0.82rem;width:130px">
      </div>
      <button onclick="createIntakeTokenForEvent('${eventId}')" class="btn-main text-sm w-full">Gerar Novo Link</button>
    </div>

    <div id="intake-token-list">${tokenRows}</div>
    <button class="btn-outline w-full mt-3 text-sm" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
  </div>`;
  document.body.appendChild(modal);
}

async function createIntakeTokenForEvent(eventId) {
  const label   = document.getElementById('new-token-label')?.value?.trim() || null;
  const expiry  = document.getElementById('new-token-expiry')?.value || null;
  const payload = { event_id: eventId, used: false, locked: false, use_count: 0 };
  if (label)  payload.label      = label;
  if (expiry) payload.expires_at = expiry + 'T23:59:59Z';

  const result = await supabaseRequest('intake_tokens', 'POST', payload);
  if (result && result[0]) {
    const link = (window.location.origin + window.location.pathname).replace(/\/+$/, '') + '?intake_token=' + result[0].token;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast('Link gerado e copiado!');
    document.getElementById('intake-manager-modal')?.remove();
    openIntakeManager(eventId);
  } else {
    toast('Erro ao gerar link.');
  }
}

async function toggleIntakeTokenLock(token, lock) {
  await supabaseRequest(`intake_tokens?token=eq.${token}`, 'PATCH', {
    locked: lock,
    locked_by: lock ? Store.currentUser?.phone : null,
    locked_at: lock ? new Date().toISOString() : null
  });
  toast(lock ? 'Link bloqueado.' : 'Link desbloqueado.');
  // Refresh the modal
  const eventId = Store.currentEventId;
  document.getElementById('intake-manager-modal')?.remove();
  openIntakeManager(eventId);
}

async function setIntakeTokenExpiry(token) {
  const date = prompt('Data de expiração (YYYY-MM-DD):');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('Data inválida.'); return; }
  await supabaseRequest(`intake_tokens?token=eq.${token}`, 'PATCH', {
    expires_at: date + 'T23:59:59Z'
  });
  toast('Data de expiração actualizada.');
  const eventId = Store.currentEventId;
  document.getElementById('intake-manager-modal')?.remove();
  openIntakeManager(eventId);
}

function copyIntakeTokenLink(token) {
  const link = (window.location.origin + window.location.pathname).replace(/\/+$/, '') + '?intake_token=' + token;
  navigator.clipboard.writeText(link).then(() => toast('Link copiado!')).catch(() => prompt('Link:', link));
}

// ===================== LANDING PACKAGES RENDER =====================
async function renderLandingPackages(pkgsData) {
  const grid = document.getElementById('landing-packages-grid');
  if (!grid) return;

  let pkgs = pkgsData;
  if (!pkgs) {
    try {
      const cfg = await supabaseRequest('site_config?key=eq.packages&select=value&limit=1');
      if (cfg && cfg[0] && cfg[0].value) pkgs = JSON.parse(cfg[0].value);
    } catch(e) {}
  }
  if (!pkgs || !pkgs.length) return; // keep default HTML

  const BADGE_STYLES = [
    'background:#e0f2fe;color:#0369a1',
    'background:#fef3c7;color:#92400e',
    'background:#e0fdf4;color:#065f46',
  ];

  grid.innerHTML = pkgs.map((p, i) => {
    let invitesText = p.invites || '';
    // Defensive: ensure the word "convites" is present so it's never confused with a price
    if (invitesText && !/convite/i.test(invitesText) && !/ilimitad|envio/i.test(invitesText)) {
      invitesText = invitesText + ' convites';
    }
    return `
    <div class="lp-card ${i === 1 ? 'lp-featured' : ''}">
      <div class="lp-badge" style="${BADGE_STYLES[i] || BADGE_STYLES[0]}">${escapeHTML(p.name)}</div>
      <div class="lp-detail" style="font-size:0.95rem;font-weight:700;color:#1e293b;margin-bottom:0.35rem">${escapeHTML(invitesText)}</div>
      <div class="lp-price">${escapeHTML(p.price)}</div>
      ${p.description ? `<p style="font-size:0.78rem;color:#6b7280;margin:0.5rem 0;line-height:1.5">${escapeHTML(p.description)}</p>` : ''}
      <button class="lp-btn" onclick="startPackageOrder('${escapeHTML(p.name)}','${escapeHTML(p.price)}')">Encomendar</button>
    </div>`;
  }).join('');
}

// ===================== SITE NOTICES =====================
async function loadAndShowNotices() {
  const now = new Date().toISOString();
  const rows = await supabaseRequest(
    `site_notices?active=eq.true&select=title,message,type&order=created_at.desc&limit=5`
  ).catch(() => []);
  if (!rows || !rows.length) return;
  // Show first active notice
  const n = rows[0];
  const banner = document.getElementById('site-notices-banner');
  const text   = document.getElementById('site-notices-text');
  if (banner && text) {
    text.textContent = n.title + ' — ' + n.message;
    banner.style.display = 'block';
    banner.style.background = n.type === 'warning' ? '#fef3c7' : n.type === 'maintenance' ? '#fee2e2' : '#dbeafe';
    banner.style.color = n.type === 'warning' ? '#92400e' : n.type === 'maintenance' ? '#991b1b' : '#1e40af';
    banner.style.borderColor = n.type === 'warning' ? '#f59e0b' : n.type === 'maintenance' ? '#ef4444' : '#3b82f6';
  }
}

async function openSiteNoticesManager() {
  const rows = await supabaseRequest('site_notices?select=id,title,message,type,active,show_until&order=created_at.desc&limit=20').catch(() => []);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-5" style="max-width:560px;max-height:85vh;overflow-y:auto">
    <h3 class="text-base font-bold mb-1">Avisos do Site Comercial</h3>
    <p class="text-xs text-gray-400 mb-3">Avisos aparecem no topo do site comercial automaticamente.</p>
    <div style="background:#f8fafc;border-radius:0.75rem;padding:0.85rem;margin-bottom:1rem">
      <input id="notice-title" class="input-field mb-2 text-sm" placeholder="Título (ex: Manutenção Programada)">
      <textarea id="notice-msg" class="input-field mb-2 text-sm" rows="2" placeholder="Mensagem detalhada..."></textarea>
      <select id="notice-type" class="input-field mb-2 text-sm">
        <option value="info">ℹ️ Informação</option>
        <option value="warning">⚠️ Aviso</option>
        <option value="maintenance">🔧 Manutenção</option>
      </select>
      <input id="notice-until" type="datetime-local" class="input-field mb-2 text-sm">
      <button onclick="adminCreateNotice()" class="btn-main text-sm w-full">Publicar Aviso</button>
    </div>
    <div id="notices-list">
      ${(rows||[]).map(n => `<div style="background:#f8fafc;border-radius:0.65rem;padding:0.75rem;margin-bottom:0.5rem;border:1px solid #e5e7eb">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div><p style="font-weight:700;font-size:0.85rem;margin:0">${escapeHTML(n.title)}</p><p style="font-size:0.75rem;color:#6b7280;margin:0.1rem 0 0">${escapeHTML(n.message)}</p></div>
          <div style="display:flex;gap:0.4rem;flex-shrink:0;margin-left:0.5rem">
            <button onclick="adminToggleNotice('${n.id}',${!n.active})" style="background:${n.active?'#fee2e2':'#dcfce7'};color:${n.active?'#991b1b':'#166534'};border:none;border-radius:0.5rem;padding:3px 8px;font-size:0.7rem;font-weight:700;cursor:pointer">${n.active?'Desactivar':'Activar'}</button>
            <button onclick="adminDeleteNotice('${n.id}')" style="background:#f3f4f6;color:#374151;border:none;border-radius:0.5rem;padding:3px 8px;font-size:0.7rem;cursor:pointer">Apagar</button>
          </div>
        </div>
      </div>`).join('') || '<p style="text-align:center;color:#9ca3af;padding:1rem">Nenhum aviso.</p>'}
    </div>
    <button class="btn-outline w-full mt-3 text-sm" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
  </div>`;
  document.body.appendChild(modal);
}

async function adminCreateNotice() {
  const title  = document.getElementById('notice-title')?.value?.trim();
  const msg    = document.getElementById('notice-msg')?.value?.trim();
  const type   = document.getElementById('notice-type')?.value || 'info';
  const until  = document.getElementById('notice-until')?.value || null;
  if (!title || !msg) { toast('Preenche título e mensagem.'); return; }
  await supabaseRequest('site_notices', 'POST', {
    title, message: msg, type, active: true,
    show_until: until ? new Date(until).toISOString() : null
  });
  toast('Aviso publicado!');
  document.querySelector('.modal-overlay')?.remove();
  openSiteNoticesManager();
  loadAndShowNotices();
}

async function adminToggleNotice(id, active) {
  await supabaseRequest(`site_notices?id=eq.${id}`, 'PATCH', { active });
  document.querySelector('.modal-overlay')?.remove();
  openSiteNoticesManager();
  loadAndShowNotices();
}

async function adminDeleteNotice(id) {
  if (!confirm('Apagar este aviso?')) return;
  await supabaseRequest(`site_notices?id=eq.${id}`, 'DELETE');
  document.querySelector('.modal-overlay')?.remove();
  openSiteNoticesManager();
}

// ===================== REVIEWS =====================
async function renderLandingReviews() {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;
  const rows = await supabaseRequest('site_reviews?approved=eq.true&select=name,stars,review,created_at&order=created_at.desc&limit=12').catch(() => []);
  if (!rows || !rows.length) { grid.innerHTML = '<p style="text-align:center;color:#9ca3af;grid-column:1/-1">Ainda não há avaliações. Sê o primeiro!</p>'; return; }
  grid.innerHTML = rows.map(r => `
    <div style="background:#fff;border-radius:1rem;padding:1.25rem;box-shadow:0 2px 12px rgba(0,0,0,0.07)">
      <div style="display:flex;gap:2px;margin-bottom:0.5rem">${'★'.repeat(r.stars)}<span style="color:#e5e7eb">${'★'.repeat(5-r.stars)}</span></div>
      ${r.review ? `<p style="font-size:0.85rem;color:#374151;font-style:italic;margin-bottom:0.5rem">"${escapeHTML(r.review)}"</p>` : ''}
      <p style="font-size:0.75rem;font-weight:700;color:#6b7280">${r.anonymous ? '— Anónimo' : '— ' + escapeHTML(r.name)}</p>
      ${r.created_at ? `<p style="font-size:0.68rem;color:#9ca3af">${new Date(r.created_at).toLocaleDateString('pt-PT')}</p>` : ''}
    </div>`).join('');
}

function openLeaveReview() {
  const modal = document.createElement('div');
  modal.id = '_review-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  let selectedStars = 5;
  modal.innerHTML = `<div style="background:#fff;border-radius:1.25rem;padding:1.75rem;max-width:420px;width:100%;text-align:center">
    <h3 style="font-size:1.1rem;font-weight:800;color:#1e293b;margin-bottom:0.25rem">A sua avaliação</h3>
    <p style="font-size:0.82rem;color:#6b7280;margin-bottom:1rem">Ajuda-nos a melhorar e a inspirar outros clientes.</p>
    <div id="star-selector" style="font-size:2rem;letter-spacing:0.1em;margin-bottom:1rem;cursor:pointer">★★★★★</div>
    <input id="rev-name" class="input-field" placeholder="O seu nome (obrigatório)" style="margin-bottom:0.4rem">
    <label style="display:flex;align-items:center;gap:0.4rem;font-size:0.78rem;color:#6b7280;margin-bottom:0.6rem;cursor:pointer">
      <input type="checkbox" id="rev-anon" style="width:14px;height:14px">
      Publicar como anónimo (o seu nome não aparecerá no site)
    </label>
    <textarea id="rev-text" class="input-field" rows="3" placeholder="Escreva a sua experiência (opcional)..." style="resize:none;margin-bottom:1rem"></textarea>
    <button id="rev-submit-btn" style="background:#007f9f;color:#fff;border:none;border-radius:999px;padding:0.8rem 2rem;font-weight:700;font-size:0.92rem;cursor:pointer;width:100%;font-family:inherit;margin-bottom:0.5rem">Enviar Avaliação</button>
    <button onclick="document.getElementById('_review-modal').remove()" style="background:none;border:none;color:#9ca3af;font-size:0.82rem;cursor:pointer;font-family:inherit">Cancelar</button>
  </div>`;
  document.body.appendChild(modal);

  // Star selector
  const starEl = document.getElementById('star-selector');
  function updateStars(n) {
    selectedStars = n;
    starEl.innerHTML = '★'.repeat(n) + '<span style="color:#e5e7eb">' + '★'.repeat(5-n) + '</span>';
  }
  updateStars(5);
  [1,2,3,4,5].forEach(n => {
    const span = document.createElement('span');
    span.style.cssText = 'cursor:pointer;font-size:2rem';
    span.textContent = '★';
    span.onmouseenter = () => updateStars(n);
    span.onclick = () => updateStars(n);
  });
  // Rebuild star selector as individual spans
  starEl.innerHTML = '';
  [1,2,3,4,5].forEach(n => {
    const span = document.createElement('span');
    span.textContent = '★';
    span.style.cssText = `cursor:pointer;color:${n<=selectedStars?'#fbbf24':'#e5e7eb'};transition:color 0.1s`;
    span.onmouseenter = () => { [].forEach.call(starEl.children, (s,i) => s.style.color = i<n?'#fbbf24':'#e5e7eb'); };
    span.onmouseleave = () => { [].forEach.call(starEl.children, (s,i) => s.style.color = i<selectedStars?'#fbbf24':'#e5e7eb'); };
    span.onclick = () => { selectedStars = n; [].forEach.call(starEl.children, (s,i) => s.style.color = i<n?'#fbbf24':'#e5e7eb'); };
    starEl.appendChild(span);
  });

  document.getElementById('rev-submit-btn').onclick = async function() {
    const name = document.getElementById('rev-name')?.value?.trim();
    const text = document.getElementById('rev-text')?.value?.trim() || null;
    if (!name) { toast('Por favor insere o teu nome.'); return; }
    this.disabled = true; this.textContent = 'A enviar...';
    const isAnon = document.getElementById('rev-anon')?.checked || false;
    await supabaseRequest('site_reviews', 'POST', { name, stars: selectedStars, review: text, approved: true, anonymous: isAnon });
    toast('Obrigado pela tua avaliação!');
    modal.remove();
    renderLandingReviews();
  };
}

// ===================== STATS =====================
function _animateCounter(el, target, suffix) {
  if (!el) return;
  const duration = 1800;
  const start = performance.now();
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3); // cubic ease out
    el.textContent = Math.floor(ease * target) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function loadLandingStats() {
  try {
    const cfg = await supabaseRequest('site_config?key=in.(stats_users,stats_events,stats_confirmations)&select=key,value');
    const vals = {};
    if (cfg) cfg.forEach(r => { vals[r.key] = parseInt(r.value) || 0; });

    const statMap = {
      'stat-events':        { val: vals.stats_events        || 150, suffix: '+' },
      'stat-users':         { val: vals.stats_users         || 100, suffix: '+' },
      'stat-confirmations': { val: vals.stats_confirmations || 850, suffix: '+' },
    };

    // Use IntersectionObserver to trigger animation when visible
    const statsSection = document.querySelector('[id*="stat-events"]')?.closest('.landing-section');
    if (!statsSection) { Object.keys(statMap).forEach(id => { const el = document.getElementById(id); if(el) el.textContent = statMap[id].val + statMap[id].suffix; }); return; }

    let animated = false;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !animated) {
        animated = true;
        Object.keys(statMap).forEach(id => _animateCounter(document.getElementById(id), statMap[id].val, statMap[id].suffix));
        obs.disconnect();
      }
    }, { threshold: 0.3 });
    obs.observe(statsSection);
  } catch(e) {}
}

// ===================== NOTIFICATIONS SYSTEM =====================
async function loadUserNotifications() {
  const userId = Store.currentUser?.id;
  if (!userId) return;

  const rows = await supabaseRequest(
    `notifications?select=id,title,body,read,created_at&user_id=eq.${userId}&order=created_at.desc&limit=20`
  ).catch(() => []);

  const badge = document.getElementById('notif-badge');
  const unread = (rows || []).filter(n => !n.read).length;
  if (badge) {
    badge.textContent = unread;
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }
  return rows || [];
}

function openNotificationsPanel() {
  loadUserNotifications().then(rows => {
    const modal = document.createElement('div');
    modal.id = '_notif-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-start;justify-content:flex-end;padding:3rem 1rem 0';
    modal.innerHTML = `<div style="background:#fff;border-radius:1rem;width:100%;max-width:360px;max-height:70vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.18)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:1rem 1.25rem;border-bottom:1px solid #e5e7eb;position:sticky;top:0;background:#fff">
        <h3 style="font-size:1rem;font-weight:800;color:#1e293b;margin:0">Notificações</h3>
        <button id="_notif-close" style="background:none;border:none;cursor:pointer;color:#9ca3af">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div id="_notif-list" style="padding:0.75rem">
        ${!rows || !rows.length ? '<p style="text-align:center;color:#9ca3af;padding:2rem;font-size:0.85rem">Sem notificações.</p>' :
          rows.map(n => `<div style="padding:0.75rem;border-radius:0.65rem;margin-bottom:0.4rem;background:${n.read?'#f8fafc':'#eff6ff'};border:1px solid ${n.read?'#e5e7eb':'#bfdbfe'}">
            <p style="font-size:0.85rem;font-weight:700;color:#1e293b;margin-bottom:0.2rem">${escapeHTML(n.title)}</p>
            <p style="font-size:0.8rem;color:#374151">${escapeHTML(n.body || '')}</p>
            <p style="font-size:0.68rem;color:#9ca3af;margin-top:0.3rem">${new Date(n.created_at).toLocaleDateString('pt-PT')}</p>
          </div>`).join('')}
      </div>
    </div>`;
    document.body.appendChild(modal);
    document.getElementById('_notif-close').onclick = () => modal.remove();
    modal.onclick = e => { if (e.target === modal) modal.remove(); };

    // Mark all as read
    const userId2 = Store.currentUser?.id;
    if (userId2) {
      supabaseRequest(`notifications?user_id=eq.${userId2}&read=eq.false`, 'PATCH', { read: true }).catch(() => {});
      const badge = document.getElementById('notif-badge');
      if (badge) badge.style.display = 'none';
    }
  });
}

// ── Admin: send notification to all users ──
function openSendNotificationModal() {
  const modal = document.createElement('div');
  modal.id = '_send-notif-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem';
  modal.innerHTML = `<div style="background:#fff;border-radius:1.25rem;padding:1.75rem;max-width:420px;width:100%">
    <h3 style="font-size:1rem;font-weight:800;color:#1e293b;margin-bottom:1rem">Enviar Notificação</h3>
    <input id="_notif-title" class="input-field" placeholder="Título" style="margin-bottom:0.6rem">
    <textarea id="_notif-body" class="input-field" rows="3" placeholder="Mensagem..." style="resize:none;margin-bottom:1rem"></textarea>
    <button id="_notif-send-btn" style="background:#007f9f;color:#fff;border:none;border-radius:999px;padding:0.8rem;font-weight:700;width:100%;cursor:pointer;font-family:inherit">Enviar para Todos</button>
    <button id="_notif-cancel-btn" style="background:none;border:none;color:#9ca3af;font-size:0.82rem;cursor:pointer;width:100%;margin-top:0.5rem;font-family:inherit">Cancelar</button>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('_notif-cancel-btn').onclick = () => modal.remove();
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  document.getElementById('_notif-send-btn').onclick = async function() {
    const title = document.getElementById('_notif-title')?.value?.trim();
    const body  = document.getElementById('_notif-body')?.value?.trim();
    if (!title) { toast('Insere um título.'); return; }
    this.disabled = true; this.textContent = 'A enviar...';
    // Get all user IDs
    const users = await supabaseRequest('accounts?select=id&role=eq.user&limit=1000').catch(() => []);
    const inserts = (users || []).map(u => ({ user_id: u.id, title, body: body || '', read: false }));
    if (inserts.length > 0) {
      await supabaseRequest('notifications', 'POST', inserts).catch(() => {});
    }
    toast(`Notificação enviada para ${inserts.length} utilizadores!`);
    modal.remove();
  };
}

// ===================== ADMIN: ORDERS MANAGER =====================
async function openOrdersManager() {
  const orders = await supabaseRequest('orders?select=*&order=created_at.desc&limit=100').catch(() => []);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = '_orders-modal';
  const STATUS_LABELS = {
    pending: 'Pendente', token_sent: 'Código Enviado', account_created: 'Conta Criada',
    paid_70: '70% Pago', paid_100: '100% Pago', completed: 'Concluído', cancelled: 'Cancelado'
  };
  const STATUS_COLORS = {
    pending: '#f59e0b', token_sent: '#3b82f6', account_created: '#8b5cf6',
    paid_70: '#06b6d4', paid_100: '#16a34a', completed: '#16a34a', cancelled: '#ef4444'
  };
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-5" style="max-width:680px;max-height:88vh;overflow-y:auto">
    <h3 class="text-base font-bold mb-3">Encomendas</h3>
    <div id="orders-list">
      ${(orders||[]).map(o => `<div style="background:#f8fafc;border-radius:0.75rem;padding:0.85rem;margin-bottom:0.65rem;border:1px solid #e5e7eb">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.4rem">
          <div>
            <p style="font-weight:700;font-size:0.88rem;color:#1e293b;margin:0">${escapeHTML(o.customer_name)}</p>
            <p style="font-size:0.75rem;color:#6b7280;margin:0.1rem 0 0">${escapeHTML(o.whatsapp)} · ${escapeHTML(o.package_name||'')}</p>
          </div>
          <span style="font-size:0.68rem;font-weight:700;padding:2px 8px;border-radius:999px;background:${STATUS_COLORS[o.status]}18;color:${STATUS_COLORS[o.status]};flex-shrink:0">${STATUS_LABELS[o.status]||o.status}</span>
        </div>
        <div style="display:flex;gap:1rem;font-size:0.72rem;color:#6b7280;margin-bottom:0.5rem">
          <span>Total: <strong>${o.total_price?.toLocaleString('pt-PT')} Kz</strong></span>
          <span>1ª: ${o.installment1?.toLocaleString('pt-PT')} Kz</span>
          <span>2ª: ${o.installment2?.toLocaleString('pt-PT')} Kz</span>
        </div>
        ${o.access_token ? `<p style="font-size:0.72rem;color:#374151;background:#fff;border:1px dashed #cbd5e1;border-radius:0.4rem;padding:0.3rem 0.5rem;margin-bottom:0.5rem;font-family:monospace">${o.access_token}</p>` : ''}
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;background:#fff;border:1px solid #e5e7eb;border-radius:0.5rem;padding:0.4rem 0.6rem">
          <span style="font-size:0.7rem;color:#6b7280;white-space:nowrap">Entrega:</span>
          <input type="date" id="delivery-date-${o.id}" value="${o.delivery_date ? o.delivery_date.split('T')[0] : ''}" style="font-size:0.72rem;border:none;flex:1;color:#1e293b;font-weight:600">
          <button onclick="adminSetDeliveryDate('${o.id}', document.getElementById('delivery-date-${o.id}').value)" style="background:#007f9f;color:#fff;border:none;border-radius:0.4rem;padding:0.25rem 0.6rem;font-size:0.65rem;font-weight:700;cursor:pointer;flex-shrink:0">Guardar</button>
        </div>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap">
          ${!o.access_token ? `<button onclick="adminGenerateOrderToken('${o.id}')" style="background:#007f9f;color:#fff;border:none;border-radius:0.5rem;padding:0.3rem 0.7rem;font-size:0.7rem;font-weight:700;cursor:pointer">Gerar Código</button>` : `<button onclick="copyOrderToken('${o.access_token}')" style="background:#f3f4f6;color:#374151;border:none;border-radius:0.5rem;padding:0.3rem 0.7rem;font-size:0.7rem;font-weight:600;cursor:pointer">Copiar Código</button>`}
          <button onclick="adminUpdateOrderStatus('${o.id}','paid_70')" style="background:#e0f2fe;color:#0369a1;border:none;border-radius:0.5rem;padding:0.3rem 0.7rem;font-size:0.7rem;cursor:pointer">Marcar 70% Pago</button>
          <button onclick="adminUpdateOrderStatus('${o.id}','paid_100')" style="background:#dcfce7;color:#166534;border:none;border-radius:0.5rem;padding:0.3rem 0.7rem;font-size:0.7rem;cursor:pointer">Marcar 100% Pago</button>
          <button onclick="adminUpdateOrderStatus('${o.id}','cancelled')" style="background:#fee2e2;color:#991b1b;border:none;border-radius:0.5rem;padding:0.3rem 0.7rem;font-size:0.7rem;cursor:pointer">Cancelar</button>
        </div>
      </div>`).join('') || '<p style="text-align:center;color:#9ca3af;padding:1.5rem">Nenhuma encomenda ainda.</p>'}
    </div>
    <button class="btn-outline w-full mt-3 text-sm" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
  </div>`;
  document.body.appendChild(modal);
}

async function adminSetDeliveryDate(orderId, dateStr) {
  if (!dateStr) { toast('Seleciona uma data primeiro.'); return; }
  try {
    await supabaseRequest(`orders?id=eq.${orderId}`, 'PATCH', {
      delivery_date: new Date(dateStr + 'T23:59:59').toISOString(),
      updated_at: new Date().toISOString()
    });
    toast('Data de entrega atualizada!');
  } catch(e) {
    toast('Erro ao atualizar a data de entrega.');
    console.error(e);
  }
}

async function adminGenerateOrderToken(orderId) {
  const token = 'ADKIRA-' + Math.random().toString(36).substring(2,6).toUpperCase() + '-' + Math.random().toString(36).substring(2,6).toUpperCase();

  // NOTE: intake_tokens.event_id must be NULLABLE for this to work (see SQL fix).
  // We intentionally do NOT create a placeholder event here, because events.user_id
  // is NOT NULL and we don't have a real user yet at this stage — the actual event
  // is created later in handleRegister() once the client's account exists, using
  // their real account id. This token is purely an access key until then.
  const tokenResult = await supabaseRequest('intake_tokens', 'POST', {
    token, event_id: null, used: false, locked: false, label: 'Encomenda #' + orderId.substring(0,8)
  }).catch(() => null);

  if (!tokenResult || !tokenResult[0]) {
    toast('Erro ao gerar código. Verifica se a coluna intake_tokens.event_id é nullable (corre o SQL de migração).');
    console.error('adminGenerateOrderToken: falha ao criar token', tokenResult);
    return;
  }

  await supabaseRequest(`orders?id=eq.${orderId}`, 'PATCH', {
    access_token: token, status: 'token_sent', updated_at: new Date().toISOString()
  });

  toast('Código gerado: ' + token);
  navigator.clipboard.writeText(token).catch(() => {});
  document.getElementById('_orders-modal')?.remove();
  openOrdersManager();
}

function copyOrderToken(token) {
  navigator.clipboard.writeText(token).then(() => toast('Código copiado!')).catch(() => prompt('Código:', token));
}

async function adminUpdateOrderStatus(orderId, status) {
  await supabaseRequest(`orders?id=eq.${orderId}`, 'PATCH', { status, updated_at: new Date().toISOString() });
  toast('Estado actualizado!');
  document.getElementById('_orders-modal')?.remove();
  openOrdersManager();
}

// ===================== ADMIN: REVIEWS MANAGER =====================
async function openReviewsManager() {
  const reviews = await supabaseRequest('site_reviews?select=*&order=created_at.desc&limit=100').catch(() => []);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = '_reviews-mgr-modal';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-5" style="max-width:560px;max-height:85vh;overflow-y:auto">
    <h3 class="text-base font-bold mb-3">Gerir Avaliações</h3>
    <div id="reviews-mgr-list">
      ${(reviews||[]).map(r => `<div style="background:#f8fafc;border-radius:0.75rem;padding:0.85rem;margin-bottom:0.6rem;border:1px solid #e5e7eb">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.4rem">
          <div>
            <div style="color:#fbbf24;font-size:0.9rem">${'★'.repeat(r.stars)}<span style="color:#e5e7eb">${'★'.repeat(5-r.stars)}</span></div>
            <p style="font-size:0.75rem;color:#6b7280;margin:0.15rem 0 0">${r.anonymous ? 'Anónimo' : escapeHTML(r.name)} · ${new Date(r.created_at).toLocaleDateString('pt-PT')}</p>
          </div>
          <button onclick="adminDeleteReview('${r.id}')" style="background:#fee2e2;color:#991b1b;border:none;border-radius:0.4rem;padding:0.25rem 0.6rem;font-size:0.68rem;cursor:pointer;flex-shrink:0">Apagar</button>
        </div>
        <textarea id="rev-edit-${r.id}" class="input-field text-xs" rows="2" style="margin-bottom:0.4rem">${escapeHTML(r.review || '')}</textarea>
        <button onclick="adminSaveReviewEdit('${r.id}')" style="background:#007f9f;color:#fff;border:none;border-radius:0.4rem;padding:0.3rem 0.7rem;font-size:0.7rem;font-weight:700;cursor:pointer">Guardar Edição</button>
      </div>`).join('') || '<p style="text-align:center;color:#9ca3af;padding:1.5rem">Nenhuma avaliação ainda.</p>'}
    </div>
    <button class="btn-outline w-full mt-3 text-sm" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
  </div>`;
  document.body.appendChild(modal);
}

async function adminSaveReviewEdit(id) {
  const text = document.getElementById(`rev-edit-${id}`)?.value?.trim() || '';
  await supabaseRequest(`site_reviews?id=eq.${id}`, 'PATCH', { review: text });
  toast('Avaliação actualizada!');
  if (typeof renderLandingReviews === 'function') renderLandingReviews();
}

async function adminDeleteReview(id) {
  if (!confirm('Apagar esta avaliação?')) return;
  await supabaseRequest(`site_reviews?id=eq.${id}`, 'DELETE');
  toast('Avaliação apagada.');
  document.getElementById('_reviews-mgr-modal')?.remove();
  openReviewsManager();
  if (typeof renderLandingReviews === 'function') renderLandingReviews();
}

// ===================== ADMIN: LEGAL PAGES EDITOR =====================
async function openLegalPagesEditor() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = '_legal-editor-modal';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-5" style="max-width:600px;max-height:88vh;overflow-y:auto">
    <h3 class="text-base font-bold mb-3">Política de Privacidade e Termos de Uso</h3>
    <div id="legal-editor-body" style="text-align:center;padding:2rem 0;color:#9ca3af;font-size:0.85rem">A carregar...</div>
    <button class="btn-outline w-full mt-3 text-sm" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
  </div>`;
  document.body.appendChild(modal);

  try {
    const rows = await supabaseRequest('legal_pages?select=slug,title,content').catch(() => []);
    const privacy = (rows || []).find(r => r.slug === 'privacy');
    const terms = (rows || []).find(r => r.slug === 'terms');

    document.getElementById('legal-editor-body').innerHTML = `
      <div class="mb-4">
        <label class="text-sm font-semibold text-gray-700 block mb-1">Política de Privacidade</label>
        <textarea id="legal-privacy-text" class="input-field text-sm" rows="10" style="font-family:inherit">${escapeHTML(privacy?.content || _LEGACY_PRIVACY_TEXT)}</textarea>
        <button class="btn-main text-sm mt-2" onclick="adminSaveLegalPage('privacy')">Guardar Política de Privacidade</button>
      </div>
      <div>
        <label class="text-sm font-semibold text-gray-700 block mb-1">Termos de Uso</label>
        <textarea id="legal-terms-text" class="input-field text-sm" rows="14" style="font-family:inherit">${escapeHTML(terms?.content || _LEGACY_TERMS_TEXT)}</textarea>
        <button class="btn-main text-sm mt-2" onclick="adminSaveLegalPage('terms')">Guardar Termos de Uso</button>
      </div>
    `;
  } catch(e) {
    document.getElementById('legal-editor-body').innerHTML = '<p style="color:#ef4444;font-size:0.85rem">Erro ao carregar.</p>';
    console.error(e);
  }
}

async function adminSaveLegalPage(slug) {
  const textareaId = slug === 'privacy' ? 'legal-privacy-text' : 'legal-terms-text';
  const content = document.getElementById(textareaId)?.value || '';
  const title = slug === 'privacy' ? 'Política de Privacidade' : 'Termos de Uso';
  try {
    const patchResult = await supabaseRequest(`legal_pages?slug=eq.${slug}`, 'PATCH', { content, title, updated_at: new Date().toISOString() });
    if (!patchResult || patchResult.length === 0) {
      await supabaseRequest('legal_pages', 'POST', { slug, content, title });
    }
    toast(title + ' guardado(a)!');
  } catch(e) {
    toast('Erro ao guardar. Verifica a consola.');
    console.error(e);
  }
}

// ===================== ADMIN: ANALYTICS PANEL =====================
async function adminResetAnalytics() {
  if (!confirm('Isto vai apagar TODO o histórico de acessos até agora. Novos acessos continuarão a ser registados a partir de zero.\n\nContinuar?')) return;
  try {
    // DELETE with a filter that matches every row (created_at is never null)
    await supabaseRequest('visit_log?created_at=not.is.null', 'DELETE');
    toast('Contagens resetadas para zero!');
    document.getElementById('_analytics-modal')?.remove();
    openAnalyticsPanel();
  } catch(e) {
    toast('Erro ao resetar. Verifica a consola.');
    console.error(e);
  }
}

async function openAnalyticsPanel() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = '_analytics-modal';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-5" style="max-width:560px;max-height:85vh;overflow-y:auto">
    <h3 class="text-base font-bold mb-3">Análise de Acessos</h3>
    <div id="analytics-body" style="text-align:center;padding:2rem 0;color:#9ca3af;font-size:0.85rem">A calcular...</div>
    <div class="flex gap-2 mt-3">
      <button class="flex-1 btn-outline text-sm" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
      <button class="text-xs text-red-500 font-semibold px-3" onclick="adminResetAnalytics()">Resetar para zero</button>
    </div>
  </div>`;
  document.body.appendChild(modal);

  try {
    const [loginRows, guestRows, commercialRows] = await Promise.all([
      supabaseRequest('visit_log?visit_type=eq.user_login&select=account_id,created_at&limit=5000').catch(() => []),
      supabaseRequest('visit_log?visit_type=eq.guest_view&select=event_id,created_at&limit=5000').catch(() => []),
      supabaseRequest('visit_log?visit_type=eq.commercial_view&select=created_at&limit=5000').catch(() => []),
    ]);

    const totalLogins = (loginRows || []).length;
    const uniqueUsers = new Set((loginRows || []).map(r => r.account_id)).size;
    const totalGuestViews = (guestRows || []).length;
    const uniqueEventsViewed = new Set((guestRows || []).map(r => r.event_id)).size;
    const totalCommercialViews = (commercialRows || []).length;

    // Per-user login counts (top 10)
    const perUserCounts = {};
    (loginRows || []).forEach(r => { perUserCounts[r.account_id] = (perUserCounts[r.account_id] || 0) + 1; });
    const topUsers = Object.entries(perUserCounts).sort((a,b) => b[1]-a[1]).slice(0, 10);

    // Resolve phone numbers for top users
    let userPhones = {};
    if (topUsers.length) {
      const ids = topUsers.map(([id]) => id);
      const accRows = await supabaseRequest(`accounts?id=in.(${ids.join(',')})&select=id,phone`).catch(() => []);
      (accRows || []).forEach(a => { userPhones[a.id] = a.phone; });
    }

    document.getElementById('analytics-body').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.75rem;margin-bottom:1.25rem">
        <div style="background:#f0f9fb;border-radius:0.75rem;padding:1rem;text-align:center">
          <p style="font-size:1.6rem;font-weight:800;color:#007f9f;margin:0">${totalLogins}</p>
          <p style="font-size:0.72rem;color:#6b7280;margin:0.2rem 0 0">Entradas de utilizadores (total)</p>
        </div>
        <div style="background:#f0f9fb;border-radius:0.75rem;padding:1rem;text-align:center">
          <p style="font-size:1.6rem;font-weight:800;color:#007f9f;margin:0">${uniqueUsers}</p>
          <p style="font-size:0.72rem;color:#6b7280;margin:0.2rem 0 0">Utilizadores únicos que entraram</p>
        </div>
        <div style="background:#fef3c7;border-radius:0.75rem;padding:1rem;text-align:center">
          <p style="font-size:1.6rem;font-weight:800;color:#92400e;margin:0">${totalGuestViews}</p>
          <p style="font-size:0.72rem;color:#6b7280;margin:0.2rem 0 0">Visitas a eventos (convidados)</p>
        </div>
        <div style="background:#fef3c7;border-radius:0.75rem;padding:1rem;text-align:center">
          <p style="font-size:1.6rem;font-weight:800;color:#92400e;margin:0">${uniqueEventsViewed}</p>
          <p style="font-size:0.72rem;color:#6b7280;margin:0.2rem 0 0">Eventos diferentes visitados</p>
        </div>
        <div style="background:#dcfce7;border-radius:0.75rem;padding:1rem;text-align:center;grid-column:1/-1">
          <p style="font-size:1.6rem;font-weight:800;color:#166534;margin:0">${totalCommercialViews}</p>
          <p style="font-size:0.72rem;color:#6b7280;margin:0.2rem 0 0">Visitas ao site comercial (total)</p>
        </div>
      </div>
      <p style="font-size:0.82rem;font-weight:700;color:#374151;margin-bottom:0.6rem">Top utilizadores por nº de entradas</p>
      ${topUsers.length ? topUsers.map(([id, count]) => `
        <div style="display:flex;justify-content:space-between;padding:0.5rem 0.75rem;background:#f8fafc;border-radius:0.5rem;margin-bottom:0.4rem">
          <span style="font-size:0.82rem;color:#374151">${escapeHTML(userPhones[id] || id)}</span>
          <span style="font-size:0.82rem;font-weight:700;color:#007f9f">${count}× </span>
        </div>`).join('') : '<p style="text-align:center;color:#9ca3af;font-size:0.8rem;padding:1rem">Sem dados ainda.</p>'}
    `;
  } catch(e) {
    document.getElementById('analytics-body').innerHTML = '<p style="color:#ef4444;font-size:0.85rem">Erro ao carregar análise.</p>';
    console.error(e);
  }
}
