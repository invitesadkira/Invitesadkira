// ===================== DASHBOARD =====================
function renderDashboard() {
  if (!Store.currentUser) { Router.go('home'); return; }
  
  // Admin não tem acesso ao dashboard de eventos
  if (Store.currentUser.role === 'admin' && !Store.adminModeActive) { Router.go('admin'); return; }

  // Saudação personalizada
  const greet = document.getElementById('dashboard-greeting');
  const sub = document.getElementById('dashboard-sub');
  if (greet) {
    const h = new Date().getHours();
    const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    greet.textContent = `${saudacao}!`;
    if (sub) sub.textContent = Store.adminModeActive ? `A gerir conta: ${Store.currentUser.phone}` : 'Os seus eventos estão abaixo';
  }

  // Quick grid
  buildDashboardQuickGrid(Store.currentUser);

  // Load and display the user's order(s), if any
  if (!Store.adminModeActive) renderUserOrdersPanel(Store.currentUser.id);

  // Refresh notification badge
  if (typeof loadUserNotifications === 'function') loadUserNotifications();

  // Show font upload button only for admins
  const fontUploadBtn = document.getElementById('btn-font-upload');
  if (fontUploadBtn) fontUploadBtn.classList.toggle('hidden', Store.currentUser.role !== 'admin');

  const returnAdminBtn = document.getElementById('drawer-btn-return-admin');
  const adminBadge = document.getElementById('admin-mode-badge');
  
  if (Store.adminModeActive && Store.adminOriginalUser) {
    if (returnAdminBtn) returnAdminBtn.classList.remove('hidden');
    if (adminBadge) adminBadge.classList.remove('hidden');
    document.getElementById('admin-mode-user').textContent = Store.currentUser.phone;
  } else {
    if (returnAdminBtn) returnAdminBtn.classList.add('hidden');
    if (adminBadge) adminBadge.classList.add('hidden');
  }

  const container = document.getElementById('dashboard-events');
  
  // ✅ Mostrar eventos pertencentes ao usuário (já carregados do Supabase)
  let userEvents = Store.events.filter(ev => {
    const userId = ev.user_id || ev.userId;
    return userId === Store.currentUser.id;
  });
  
  // Remover duplicatas (mesmo ID)
  const seenIds = new Set();
  userEvents = userEvents.filter(ev => {
    if (seenIds.has(ev.id)) return false;
    seenIds.add(ev.id);
    return true;
  });

  if (userEvents.length === 0) {
    container.innerHTML = `
      <div style="background:var(--app-card);border-radius:var(--app-radius);box-shadow:var(--app-shadow);border:1px solid var(--app-border)" class="p-10 text-center">
        <div style="width:64px;height:64px;border-radius:50%;background:#f3eee2" class="flex items-center justify-center mx-auto mb-4">
          <i data-lucide="calendar-x" class="w-8 h-8" style="color:var(--app-muted)"></i>
        </div>
        <p style="color:var(--app-muted)" class="mb-4">Nenhum evento ainda.</p>
        <button class="btn-main" onclick="Router.go('create-event');switchEventTab('geral')">Criar Primeiro Evento</button>
      </div>`;
  } else {
    container.innerHTML = userEvents.map(ev => {
      const confirmed = (ev.confirmations || []).filter(c => c.attending || c.attending === 'yes').length;
      return `
        <div style="background:var(--app-card);border-radius:var(--app-radius);box-shadow:var(--app-shadow);border:1px solid var(--app-border)" class="p-5 mb-3 card-hover cursor-pointer" onclick="Store.currentEventId='${ev.id}'; Router.go('event-details')">
          <div class="flex items-center gap-4">
            <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,var(--app-gold-light),var(--app-gold))" class="flex items-center justify-center flex-shrink-0">
              <i data-lucide="calendar-check" class="w-6 h-6 text-white"></i>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-bold truncate" style="color:var(--app-ink)">${ev.title}</h3>
              <p class="text-sm" style="color:var(--app-muted)">${formatDate(ev.date)} às ${ev.time}</p>
            </div>
            <span class="text-xs font-semibold px-3 py-1 rounded-full" style="background:#eaf6f4;color:var(--app-teal-deep)">${confirmed} confirmados</span>
            ${ev.scanner_token ? `<button onclick="event.stopPropagation();_copyScanner('${ev.scanner_token}')" title="Copiar link do leitor QR para o porteiro" style="background:#f0fdf4;border:1px solid #4ade80;border-radius:0.5rem;padding:0.3rem 0.5rem;cursor:pointer;font-size:0.7rem;font-weight:700;color:#166534;white-space:nowrap">📲 Leitor</button>` : ''}
          </div>
        </div>`;
    }).join('');
  }
  lucide.createIcons();
}

// ✅ NOVA FUNÇÃO: Limpar formulário ANTES de ir para create-event
function goToCreateEvent() {
  dlog('🔄 Limpando formulário para novo evento...');
  
  // ✅ Limpar TODOS os campos do formulário
  document.getElementById('evt-title').value = '';
  document.getElementById('evt-date').value = '';
  document.getElementById('evt-time').value = '';
  document.getElementById('evt-deadline').value = '';
  document.getElementById('evt-deadline-time').value = '23:59';
  document.getElementById('evt-max-comp').value = '2';
  document.getElementById('evt-max-kids').value = '2';
  document.getElementById('evt-side1-name').value = 'Grupo 1';
  document.getElementById('evt-side2-name').value = 'Grupo 2';
  
  // ✅ Limpar imagem de capa
  document.getElementById('cover-img').classList.add('hidden');
  document.getElementById('cover-placeholder').classList.remove('hidden');
  document.getElementById('cover-input').value = '';
  
  // ✅ Limpar switches - ESTADO PADRÃO
  document.getElementById('sw-companions').classList.remove('active');
  document.getElementById('sw-gifts').classList.add('active');
  document.getElementById('sw-kids').classList.remove('active');
  document.getElementById('sw-sides').classList.add('active');
  
  // ✅ Esconder extras
  document.getElementById('companions-extra').classList.add('hidden');
  document.getElementById('kids-extra').classList.add('hidden');
  document.getElementById('sides-extra').classList.remove('hidden'); // sides sempre mostra
  
  // ✅ Resetar form para CREATE (não EDIT)
  const form = document.getElementById('screen-create-event').querySelector('form');
  form.onsubmit = handleCreateEvent;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = false;
  btn.style.opacity = '1';
  btn.textContent = 'Criar Evento';
  
  dlog('✅ Formulário limpo e pronto para novo evento');
  if (typeof renderGalleryOrderPreview === 'function') renderGalleryOrderPreview();
  
  // Navegar para create-event
  Router.go('create-event');
  if (typeof switchEventTab === 'function') switchEventTab('geral');
}

// ===================== USER ORDERS PANEL =====================
async function renderUserOrdersPanel(accountId) {
  const container = document.getElementById('dashboard-events');
  if (!container) return;

  let panel = document.getElementById('user-orders-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'user-orders-panel';
    panel.style.marginBottom = '1.25rem';
    container.parentElement.insertBefore(panel, container);
  }

  const orders = await supabaseRequest(
    `orders?account_id=eq.${accountId}&select=*&order=created_at.desc&limit=10`
  ).catch(() => []);

  if (!orders || !orders.length) { panel.innerHTML = ''; return; }

  const STATUS_LABELS = {
    pending: 'Pendente', token_sent: 'Código Enviado', account_created: 'Conta Criada',
    paid_70: '70% Pago — falta 30%', paid_100: 'Totalmente Pago', completed: 'Concluído', cancelled: 'Cancelado'
  };
  const STATUS_COLORS = {
    pending: '#f59e0b', token_sent: '#3b82f6', account_created: '#8b5cf6',
    paid_70: '#06b6d4', paid_100: '#16a34a', completed: '#16a34a', cancelled: '#ef4444'
  };
  const PAYMENT_METHOD_LABELS = { express: 'Transferência Express', iban: 'IBAN' };

  panel.innerHTML = `<p style="font-size:0.85rem;font-weight:700;color:#374151;margin-bottom:0.6rem">As Minhas Encomendas — Comprovante</p>
    ${orders.map(o => {
      const remaining = (o.status === 'paid_70') ? o.installment2 : 0;
      const fullyPaid = o.status === 'paid_100' || o.status === 'completed';
      let deliveryCountdownHtml = '';
      if (o.delivery_date) {
        const deliveryDate = new Date(o.delivery_date);
        const now = new Date();
        const diffDays = Math.ceil((deliveryDate - now) / 86400000);
        deliveryCountdownHtml = diffDays > 0
          ? `<div style="color:#0369a1">Entrega prevista em: <strong>${diffDays} dia${diffDays !== 1 ? 's' : ''}</strong> (${deliveryDate.toLocaleDateString('pt-PT')})</div>`
          : `<div style="color:#16a34a;font-weight:700">Prazo de entrega atingido</div>`;
      }
      return `<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:0.75rem;padding:0.85rem;margin-bottom:0.6rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.4rem">
          <p style="font-weight:700;font-size:0.88rem;color:#1e293b;margin:0">${escapeHTML(o.package_name||'')}</p>
          <span style="font-size:0.68rem;font-weight:700;padding:2px 8px;border-radius:999px;background:${STATUS_COLORS[o.status]}18;color:${STATUS_COLORS[o.status]};flex-shrink:0">${STATUS_LABELS[o.status]||o.status}</span>
        </div>
        <p style="font-size:0.72rem;color:#9ca3af;margin-bottom:0.5rem">Encomendado em ${new Date(o.created_at).toLocaleDateString('pt-PT')}</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;font-size:0.78rem;color:#374151;margin-bottom:0.4rem">
          <div>Total: <strong>${o.total_price?.toLocaleString('pt-PT')} Kz</strong></div>
          <div>1ª prestação: ${o.installment1?.toLocaleString('pt-PT')} Kz</div>
          ${o.payment_method ? `<div>Método: <strong>${PAYMENT_METHOD_LABELS[o.payment_method] || o.payment_method}</strong></div>` : ''}
          ${fullyPaid ? `<div style="color:#16a34a;font-weight:700">✓ Pagamento completo</div>` : (remaining > 0 ? `<div style="color:#ef4444;font-weight:700">Falta pagar: ${remaining.toLocaleString('pt-PT')} Kz</div>` : '')}
        </div>
        ${deliveryCountdownHtml ? `<div style="font-size:0.78rem;border-top:1px solid #e5e7eb;padding-top:0.4rem">${deliveryCountdownHtml}</div>` : ''}
      </div>`;
    }).join('')}`;
}

function _copyScanner(scannerToken) {
  const base = window.location.origin + window.location.pathname;
  const link = `${base}?scanner=${scannerToken}`;
  navigator.clipboard.writeText(link).then(() => {
    toast('Link do leitor copiado! Envia ao porteiro.');
  }).catch(() => {
    // Fallback para dispositivos sem clipboard API
    const ta = document.createElement('textarea');
    ta.value = link;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Link do leitor copiado!');
  });
}
