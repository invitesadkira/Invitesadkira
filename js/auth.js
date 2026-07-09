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
  if (pass.length < 6) { showErr('A senha deve ter pelo menos 6 caracteres.'); return; }
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

    // ✅ Fase 3: cria também o utilizador real no Supabase Auth, ligado a
    // esta conta via auth_uid — assim toda a conta nova já nasce protegida,
    // sem precisar de nenhum passo manual no painel do Supabase. Usa um
    // e-mail sintético derivado do telefone (o cliente nunca o vê nem o usa
    // directamente — só serve de identificador interno para o Auth).
    let newAuthUid = null;
    try {
      const syntheticEmail = _phoneToSyntheticEmail(phone);
      const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
        body: JSON.stringify({ email: syntheticEmail, password: pass })
      });
      const signupData = await signupRes.json();
      if (signupRes.ok && signupData.user) {
        newAuthUid = signupData.user.id;
      } else {
        // Não bloqueia a criação da conta — apenas regista para diagnóstico.
        // A conta continua a funcionar pelo sistema antigo até alguém a
        // ligar manualmente mais tarde (mesmo processo usado para o admin).
        console.warn('Conta criada sem auth_uid (Supabase Auth signup falhou):', signupData);
      }
    } catch(e) {
      console.warn('Falha ao criar utilizador no Supabase Auth (conta continua pelo sistema antigo):', e);
    }

    const result = await supabaseRequest('accounts', 'POST', {
      phone, password: pass, role: 'user', approved: true, event_limit: 1, login_count: 0,
      auth_uid: newAuthUid
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


// ===================== ANTI BRUTE-FORCE (mitigação no browser) =====================
// ⚠️ Isto é só uma camada extra de fricção contra tentativa-e-erro feita
// através do FORMULÁRIO de login. Não substitui rate-limiting no servidor
// (alguém pode sempre chamar a API do Supabase directamente, sem passar pelo
// formulário) — ver SECURITY.md, secção "Fase 2", para a proteção real.
const LOGIN_THROTTLE_KEY = 'loginAttempts';
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 2 * 60 * 1000; // 2 minutos

function _getLoginAttempts(phone) {
  try {
    const all = JSON.parse(localStorage.getItem(LOGIN_THROTTLE_KEY) || '{}');
    return all[phone] || { count: 0, lockedUntil: 0 };
  } catch (e) { return { count: 0, lockedUntil: 0 }; }
}
function _setLoginAttempts(phone, data) {
  try {
    const all = JSON.parse(localStorage.getItem(LOGIN_THROTTLE_KEY) || '{}');
    all[phone] = data;
    localStorage.setItem(LOGIN_THROTTLE_KEY, JSON.stringify(all));
  } catch (e) {}
}
function _clearLoginAttempts(phone) {
  try {
    const all = JSON.parse(localStorage.getItem(LOGIN_THROTTLE_KEY) || '{}');
    delete all[phone];
    localStorage.setItem(LOGIN_THROTTLE_KEY, JSON.stringify(all));
  } catch (e) {}
}
function _registerFailedLogin(phone) {
  const data = _getLoginAttempts(phone);
  data.count = (data.count || 0) + 1;
  if (data.count >= LOGIN_MAX_ATTEMPTS) {
    data.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
    data.count = 0;
  }
  _setLoginAttempts(phone, data);
}

// ============================================================================
// LOGIN — FASE 2 (opcional, desligado por padrão): login via RPC sem nunca
// trazer a senha para o browser.
// ============================================================================
// COMO ACTIVAR (faz isto só depois de testares a função no Supabase, ver
// supabase/02_rpc_login_fase2.sql):
//   1. Confirma que `rpc_login` funciona no SQL Editor do Supabase.
//   2. No HTML do formulário de login, troca onsubmit="handleLogin(event)"
//      por onsubmit="handleLoginSecure(event)".
//   3. Testa login com uma conta de teste antes de avisar utilizadores reais.
//   4. Só depois disto correr bem por uns dias, podes voltar ao SQL e correr
//      o REVOKE comentado no fundo do ficheiro 02_rpc_login_fase2.sql.
//
// Por agora, `handleLogin` (a função original, mais abaixo) continua a ser
// a usada — nada muda automaticamente.
async function handleLoginSecure(e) {
  e.preventDefault();
  const phone = document.getElementById('login-phone').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');

  const throttle = _getLoginAttempts(phone);
  if (throttle.lockedUntil && throttle.lockedUntil > Date.now()) {
    const waitMin = Math.ceil((throttle.lockedUntil - Date.now()) / 60000);
    errEl.textContent = `Demasiadas tentativas falhadas. Tenta novamente em ${waitMin} min.`;
    errEl.classList.remove('hidden');
    return;
  }

  toast('Autenticando...');

  let rows;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rpc_login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ p_phone: phone, p_password: pass })
    });
    rows = await res.json();
  } catch (err) {
    errEl.textContent = 'Erro de ligação. Tenta novamente.';
    errEl.classList.remove('hidden');
    return;
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    _registerFailedLogin(phone);
    errEl.textContent = 'Telefone ou senha incorrectos.'; // ✅ mensagem única — não revela qual dos dois está errado
    errEl.classList.remove('hidden');
    return;
  }

  _clearLoginAttempts(phone);
  const user = rows[0];

  if (user.status === 'pending') {
    errEl.textContent = 'A tua conta ainda está pendente de aprovação.';
    errEl.classList.remove('hidden');
    return;
  }
  if (user.status === 'blocked') {
    errEl.textContent = 'Esta conta foi bloqueada. Contacta o suporte.';
    errEl.classList.remove('hidden');
    return;
  }

  localStorage.setItem('authToken', user.id);
  localStorage.setItem('userId', user.id);
  localStorage.setItem('userPhone', user.phone);
  localStorage.setItem('userRole', user.role || 'user');

  Store.currentUser = { id: user.id, phone: user.phone, role: user.role || 'user', status: 'active' };
  toast('Bem-vindo! Carregando seus dados...');
  if (typeof invalidateEventsCache !== 'undefined') invalidateEventsCache();
  Router.go(user.role === 'admin' ? 'admin' : 'dashboard');
}

// ============================================================================
// LOGIN/REGISTO — FASE 3 (opcional, desligado por padrão): sessão real do
// Supabase Auth, para o RLS conseguir verificar "és mesmo o dono disto?"
// ============================================================================
// Segue supabase/04_fase3_guia_migracao.md antes de activar isto. Resumo:
//   1. Cria as contas equivalentes no Supabase Auth (painel → Authentication)
//   2. Liga-as à tabela accounts via a coluna auth_uid
//   3. Só DEPOIS troca os onsubmit dos formulários para chamarem
//      loginViaSupabaseAuth / registerViaSupabaseAuth, e chama
//      bootstrapSupabaseSession() na inicialização (router.js)
//   4. Corre supabase/05_fase3_apertar_politicas.sql só no fim, confirmado
//      que o login novo já funciona.
//
// Até activares isto, handleLogin/handleRegister (mais abaixo) continuam a
// ser usados — nada muda automaticamente.

function _phoneToSyntheticEmail(phone) {
  const clean = String(phone).trim().replace(/[^a-zA-Z0-9]/g, '');
  return `${clean}@adkira.local`;
}

async function registerViaSupabaseAuth(phone, password, accessTokenCode) {
  // 1) Validar o código de acesso, exactamente como o registo actual
  const tokenRows = await supabaseRequest(
    `intake_tokens?token=eq.${encodeURIComponent(accessTokenCode)}&select=token,locked,expires_at,event_id&limit=1`
  );
  const tk = tokenRows && tokenRows[0];
  if (!tk) return { error: 'Código inválido. Verifica e tenta novamente.' };
  if (tk.locked) return { error: 'Este código já foi utilizado.' };
  if (tk.expires_at && new Date(tk.expires_at) < new Date()) return { error: 'Este código expirou.' };

  // 2) Criar o utilizador no Supabase Auth
  const email = _phoneToSyntheticEmail(phone);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok || !data.user) {
    return { error: data?.msg || data?.error_description || 'Erro ao criar conta. O telefone pode já estar em uso.' };
  }

  // 3) Criar a linha em accounts, já ligada ao auth_uid novo
  const result = await supabaseRequest('accounts', 'POST', {
    phone, password, role: 'user', approved: true, event_limit: 1, login_count: 0,
    auth_uid: data.user.id
  });
  if (!result || !result[0]) return { error: 'Conta criada no Auth, mas falhou ao guardar em accounts. Contacta o suporte.' };

  // 4) Trancar o código de acesso
  await supabaseRequest(`intake_tokens?token=eq.${encodeURIComponent(accessTokenCode)}`, 'PATCH', {
    locked: true, locked_at: new Date().toISOString(), locked_by: phone
  });

  // 5) Guardar sessão, se o Supabase já tiver devolvido tokens (depende de
  // confirmação de email estar desligada no projecto)
  if (data.access_token) {
    setStoredSupabaseSession({ access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at });
  }

  return { account: result[0] };
}

async function loginViaSupabaseAuth(phone, password) {
  const email = _phoneToSyntheticEmail(phone);
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    return { error: 'Telefone ou senha incorrectos.' };
  }

  setStoredSupabaseSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at
  });
  localStorage.setItem('sb_session_phone', phone);

  // Agora que já há sessão real, supabaseRequest() vai usar este token —
  // basta procurar a conta correspondente.
  const accountRows = await supabaseRequest(`accounts?phone=eq.${encodeURIComponent(phone)}&limit=1`);
  const account = accountRows && accountRows[0];
  if (!account) return { error: 'Conta não encontrada em accounts (auth_uid pode não estar ligado).' };

  return { account };
}

// Chamar isto no arranque da app (router.js), ANTES de tentar restaurar a
// sessão antiga por localStorage — se houver uma sessão real do Supabase
// Auth guardada, usa-a; caso contrário, não faz nada (deixa o fluxo actual
// continuar normalmente).
async function bootstrapSupabaseSession() {
  const session = await refreshSupabaseSessionIfNeeded();
  if (!session) return null;
  // Não sabemos o telefone só pelo token; procuramos a conta cujo
  // auth_uid corresponde ao utilizador autenticado actual via uma RPC
  // simples, ou — mais simples — guardamos o telefone também ao fazer
  // login (ver loginViaSupabaseAuth) e lemos daqui:
  const phone = localStorage.getItem('sb_session_phone');
  if (!phone) return null;
  const accountRows = await supabaseRequest(`accounts?phone=eq.${encodeURIComponent(phone)}&limit=1`);
  return (accountRows && accountRows[0]) || null;
}

// Login com e-mail real do Supabase Auth (para contas já migradas, como o
// admin) — diferente de loginViaSupabaseAuth, que converte telefone num
// e-mail sintético. Esta usa o e-mail tal como foi introduzido.
async function loginViaSupabaseAuthEmail(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    return { error: 'E-mail ou senha incorrectos.' };
  }

  setStoredSupabaseSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at
  });
  localStorage.setItem('sb_session_auth_uid', data.user.id);

  // Agora que já há sessão real, procura a conta (profile) ligada a este
  // utilizador do Auth pelo auth_uid — NÃO pelo telefone, porque esta
  // conta pode nem ter telefone definido.
  const accountRows = await supabaseRequest(`accounts?auth_uid=eq.${data.user.id}&limit=1`);
  const account = accountRows && accountRows[0];
  if (!account) return { error: 'Conta autenticada, mas não encontrada em "accounts" (confirma se o auth_uid foi ligado correctamente).' };

  return { account };
}

async function handleLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('login-phone').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');

  // ✅ Verificar bloqueio temporário por demasiadas tentativas falhadas
  const throttle = _getLoginAttempts(phone);
  if (throttle.lockedUntil && throttle.lockedUntil > Date.now()) {
    const waitMin = Math.ceil((throttle.lockedUntil - Date.now()) / 60000);
    errEl.textContent = `Demasiadas tentativas falhadas. Tenta novamente em ${waitMin} min.`;
    errEl.classList.remove('hidden');
    return;
  }

  toast('Autenticando...');

  // ✅ NOVO (Fase 3, em migração): se o campo parece um e-mail, esta conta
  // já foi migrada para o Supabase Auth real — usa esse caminho em vez do
  // antigo. Contas por telefone continuam exactamente como sempre foram,
  // sem nenhuma alteração, até serem migradas uma a uma.
  if (phone.includes('@')) {
    const result = await loginViaSupabaseAuthEmail(phone, pass);
    if (result.error) {
      _registerFailedLogin(phone);
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }
    _clearLoginAttempts(phone);
    const user = result.account;
    if (user.status === 'pending') {
      errEl.textContent = '⏳ Sua conta ainda não foi aprovada pelo administrador.';
      errEl.classList.remove('hidden');
      return;
    }
    if (user.status === 'blocked') {
      errEl.textContent = 'Sua conta foi bloqueada. Contacte o administrador.';
      errEl.classList.remove('hidden');
      return;
    }
    localStorage.setItem('authToken', user.id);
    localStorage.setItem('userId', user.id);
    localStorage.setItem('userPhone', user.phone || '');
    localStorage.setItem('userRole', user.role || 'user');
    Store.currentUser = { id: user.id, phone: user.phone, role: user.role || 'user', status: 'active' };
    toast('Bem-vindo! Carregando seus dados...');
  if (typeof invalidateEventsCache !== 'undefined') invalidateEventsCache();
    Router.go(user.role === 'admin' ? 'admin' : 'dashboard');
    return;
  }
  
  // ✅ Buscar no Supabase
  const accountData = await supabaseRequest(`accounts?phone=eq.${encodeURIComponent(phone)}`);
  
  dlog('🔍 Resultado da busca de conta:', {
    phone: phone,
    resultado: accountData,
    encontrou: accountData && accountData.length > 0
  });
  
  if (!accountData || accountData.length === 0) {
    dlog('❌ Nenhuma conta encontrada para:', phone);
    _registerFailedLogin(phone);
    errEl.textContent = 'Conta não encontrada.';
    errEl.classList.remove('hidden');
    return;
  }

  const user = accountData[0];
  dlog('✅ Conta encontrada:', {
    id: user.id,
    phone: user.phone,
    status: user.status,
    role: user.role
  });

  // ✅ Fase 3, em migração: esta conta já tem auth_uid ligado (foi migrada
  // para o Supabase Auth real) — usa esse caminho, mais seguro, em vez da
  // comparação de senha em texto simples. Contas ainda não migradas
  // (auth_uid vazio) continuam pelo caminho antigo, sem qualquer mudança.
  if (user.auth_uid) {
    const result = await loginViaSupabaseAuth(phone, pass);
    if (result.error) {
      _registerFailedLogin(phone);
      errEl.textContent = result.error;
      errEl.classList.remove('hidden');
      return;
    }
    _clearLoginAttempts(phone);
    const authedUser = result.account;
    if (authedUser.status === 'pending') {
      errEl.textContent = '⏳ Sua conta ainda não foi aprovada pelo administrador.';
      errEl.classList.remove('hidden');
      return;
    }
    if (authedUser.status === 'blocked') {
      errEl.textContent = 'Sua conta foi bloqueada. Contacte o administrador.';
      errEl.classList.remove('hidden');
      return;
    }
    localStorage.setItem('authToken', authedUser.id);
    localStorage.setItem('userId', authedUser.id);
    localStorage.setItem('userPhone', authedUser.phone || '');
    localStorage.setItem('userRole', authedUser.role || 'user');
    Store.currentUser = { id: authedUser.id, phone: authedUser.phone, role: authedUser.role || 'user', status: 'active' };
    toast('Bem-vindo! Carregando seus dados...');
  if (typeof invalidateEventsCache !== 'undefined') invalidateEventsCache();
    Router.go(authedUser.role === 'admin' ? 'admin' : 'dashboard');
    return;
  }
  
  // ✅ Validar senha (em produção usar bcrypt)
  if (user.password !== pass) {
    dlog('❌ Senha incorreta para:', phone);
    _registerFailedLogin(phone);
    errEl.textContent = 'Senha incorreta.';
    errEl.classList.remove('hidden');
    return;
  }

  // ✅ Login bem-sucedido — limpar contador de tentativas
  _clearLoginAttempts(phone);

  // ✅ CRÍTICO: Verificar se conta está APROVADA pelo admin
  if (user.status === 'pending') {
    dlog('⏳ Conta pendente de aprovação:', phone);
    errEl.textContent = '⏳ Sua conta ainda não foi aprovada pelo administrador.';
    errEl.classList.remove('hidden');
    return;
  }

  // ✅ CRÍTICO: Verificar se conta foi BLOQUEADA
  if (user.status === 'blocked') {
    dlog('🚫 Conta bloqueada:', phone);
    errEl.textContent = 'Sua conta foi bloqueada. Contacte o administrador.';
    errEl.classList.remove('hidden');
    return;
  }
  
  // ✅ CRÍTICO: Verificar se conta foi DELETADA (não deveria chegar aqui, mas é proteção extra)
  if (user.status === 'deleted' || user.deleted_at) {
    dlog('🗑️ Conta deletada:', phone);
    errEl.textContent = 'Esta conta foi eliminada. Não é possível fazer login.';
    errEl.classList.remove('hidden');
    return;
  }

  // ✅ Login bem-sucedido
  dlog('✅ Login bem-sucedido para:', phone);

  // CRITICAL: always reset admin impersonation state on a fresh login.
  // Prevents a leftover Store.adminModeActive=true (from a previous admin
  // session that didn't click "Voltar ao Admin" before logging out) from
  // incorrectly showing impersonation-only UI to this regular user.
  Store.adminModeActive = false;
  Store.adminOriginalUser = null;

  const userRole = user.role || 'user';
  Store.currentUser = {
    id: user.id,
    phone: user.phone,
    role: userRole,
    status: user.status,
    eventLimit: user.event_limit,
    edit_locked: user.edit_locked === true,
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
    dlog('👨‍💼 Admin logado - carregando dados administrativos...');
    
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
    
    dlog('✅ Contas carregadas:', Store.users?.length || 0, 'contas');
    
    // ✅ CARREGA 2: TODOS OS EVENTOS (COM JOIN para presentes e RSVPs)
    const allEvents = await supabaseRequest(`events?select=id,title,date,time,user_id,allow_companions,max_companions,allow_gifts,allow_kids,max_kids,allow_sides,side1_name,side2_name,show_time,allow_messages,show_guest_messages,music_url,music_title,iban_message,iban_number,iban_holder,iban_footer,groom_name,bride_name,couple_size,show_couple,bg_url,bg_overlay,bible_text,bible_ref,show_bible,invite_text,show_invite,groom_parents,bride_parents,show_parents,gallery_urls,show_gallery,show_manual,manual_items,show_schedule,schedule_items,custom_font_family,section_order,story_text,invite_blessing,event_color,confirm_by_date,cover_image,event_code,gifts(id,name,category,reserved,reserved_by,quantity,image_url),rsvps(guest_name,attending,side,companions,kids,wants_gift,message,created_at,updated_at)&limit=500&order=date.desc`);
    
    dlog('✅ Eventos carregados:', allEvents?.length || 0, 'eventos');
    
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
      invite_blessing: event.invite_blessing ?? null,
      event_color: event.event_color || null,
        cover: event.cover_image,
        cover_image: event.cover_image,
        gifts: (event.gifts || []).map(g => ({
          id: g.id,
          name: g.name,
          category: g.category || 'Sem categoria',
          reserved: g.reserved || false,
          reservedBy: g.reserved_by || null,
        quantity: g.quantity || 1,
        imageUrl: g.image_url || null
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
    
    dlog('📊 Admin dashboard carregado:', {
      contas: Store.users.length,
      eventos: Store.events.length,
      role: userRole
    });
    
    setTimeout(() => Router.go('admin'), 300);
  } else {
    dlog('Utilizador normal logado - carregando eventos pessoais...');
    
    // ✅ Usar função melhorada que já traz tudo pronto
    const userData = await fetchUserDataForOrganizer(user.id);
    if (userData && userData.events) {
      Store.events = userData.events;
      dlog('✅ Store.events sincronizado com Supabase:', Store.events.length, 'eventos carregados');
    }
    Router.go('dashboard');
  }
}

function handleLogout() {
  Store.currentUser = null;
  // CRITICAL: reset admin impersonation state in memory. Without this, if
  // an admin impersonated a user and then logged out without clicking
  // "Voltar ao Admin" first, Store.adminModeActive stays true — and if a
  // different person logs in normally afterward in the same browser tab
  // (no hard refresh), they would incorrectly see admin-impersonation UI
  // like "Voltar ao Admin" even though they're a regular user.
  Store.adminModeActive = false;
  Store.adminOriginalUser = null;
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
  sessionStorage.removeItem('lastScreen');
  sessionStorage.removeItem('lastEventId');
  localStorage.removeItem('adminOriginalUserPhone');
  // Fase 3 (dormente até ser activada, mas limpa por precaução)
  localStorage.removeItem('sb_auth_session');
  localStorage.removeItem('sb_session_phone');
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

  dlog('💾 Salvando admin label:', { userId, label });

  // ✅ Atualizar Store PRIMEIRO
  user.adminLabel = label && label.length > 0 ? label : null;
  
  dlog('✅ Store atualizado. Novo valor:', user.adminLabel);

  // ✅ CRÍTICO: Sincronizar com Supabase
  const updateData = label && label.length > 0 
    ? { admin_label: label } 
    : { admin_label: null };

  dlog('📤 Enviando para Supabase:', updateData);

  supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', updateData).then(result => {
    dlog('✅ Resposta do Supabase:', result);
    
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
      <p class="text-sm text-gray-500 mb-4">Utilizador: <strong>${escapeHTML(user.phone)}</strong></p>
      
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-sm font-semibold text-gray-600 mb-1">Nova Senha</label>
          <input id="new-password-input" type="text" class="input-field" placeholder="Digite a nova senha" value="">
          <p class="text-xs text-gray-400 mt-1">Mínimo 6 caracteres</p>
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
  
  if (newPassword.length < 6) {
    toast('Senha deve ter mínimo 6 caracteres!');
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
  dlog('🔄 Atualizando user_id em todos os eventos...');
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
  dlog('🔄 Atualizando ID do utilizador no Supabase...');
  
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
    dlog('✅ Novo registo criado com ID:', newId);
    
    // Depois, deletar o registo antigo
    supabaseRequest(`accounts?id=eq.${oldId}`, 'DELETE', {}).then(delResult => {
      dlog('✅ Registo antigo deletado');
      
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
