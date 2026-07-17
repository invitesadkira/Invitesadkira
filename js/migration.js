// ===================== MIGRAÇÃO DE DADOS (ADMIN GOD) =====================
// Ferramenta para migrar TUDO do site — contas, eventos, RSVPs, presentes,
// links, notificações, fotos/vídeos/áudio, a ESTRUTURA (tabelas/políticas)
// e o auth.users (senhas do Admin God) — para um projecto Supabase NOVO,
// sem depender do projecto antigo continuar a existir, e sem precisares de
// abrir um terminal.
//
// ⚠️ PRÉ-REQUISITO ÚNICO, uma vez por projecto NOVO (ver ficheiro
// BOOTSTRAP.sql / secção "Kit de Arranque" mais abaixo): colar 3 funções
// especiais no SQL Editor do Supabase. Isto só é preciso UMA vez porque é
// "o ovo e a galinha" — precisamos de alguma capacidade mínima já instalada
// para o site conseguir instalar/copiar o resto sozinho. Depois disso,
// tudo o resto (nesta e em futuras migrações a partir deste projecto) já
// não precisa de terminal nenhum.
//
// Passos, por esta ordem:
//   0. (só na primeira vez, no projecto NOVO) Colar o Kit de Arranque no
//      SQL Editor — ver botão "Ver Kit de Arranque" na ferramenta.
//   1. Gerar a estrutura do projecto ANTIGO com `pg_dump --schema-only`
//      (continua a precisar do terminal só para GERAR este ficheiro — é
//      a única ferramenta fiável para isto, ver nota no botão "Aplicar
//      Estrutura")
//   2. "Aplicar Estrutura" — cola aqui o texto do schema.sql, sem psql
//   3. "Copiar auth.users" — um clique, sem terminal
//   4. "Exportar dados" (deste projecto)
//   5. "Copiar ficheiros" (fotos/vídeos/áudio)
//   6. "Importar" no projecto novo

const MIGRATION_TABLES = [
  // Ordem "melhor esforço" (tabelas-mãe primeiro) — a importação tenta
  // várias passagens (retry), por isso a ordem exacta não é crítica, só
  // torna o processo mais rápido quando já está correcta.
  'accounts',
  'events',
  'event_dates',
  'event_visuals',
  'event_venues',
  'rsvps',
  'gifts',
  'guest_links',
  'media_library',
  'fonts',
  'notifications',
  'notice_views',
  'site_notices',
  'site_config',
  'site_reviews',
  'faq',
  'legal_pages',
  'icon_library',
  'orders',
  'intake_submissions',
  'intake_tokens',
  'lead_inquiries',
  'visit_log',
];

// Todos os "baldes" (buckets) de Storage usados pelo site — fotos, vídeos,
// música, templates de bilhete. São copiados ficheiro a ficheiro para o
// projecto novo, mantendo o mesmo nome/caminho, para os endereços gravados
// nas tabelas (depois de reescritos) apontarem para o sítio certo.
const MIGRATION_BUCKETS = ['event-covers', 'event-videos', 'event-music', 'ticket-templates', 'event-media'];

// Algumas tabelas não têm "id" como chave primária/coluna — usam "event_id"
// ou "key" directamente. Isto é usado tanto para EXPORTAR (para não pedir
// "order by id" numa coluna que não existe — isso fazia o pedido falhar
// silenciosamente e a tabela ficava vazia no backup, sem nenhum aviso
// visível) como para IMPORTAR (on_conflict correcto, para o upsert
// funcionar em vez de ser sempre rejeitado).
const MIGRATION_KEY_COLUMN = {
  event_dates: 'event_id',
  event_visuals: 'event_id',
  event_venues: 'event_id',
  site_config: 'key',
  guest_links: 'code',
  intake_tokens: 'token',
  legal_pages: 'slug',
};

function openMigrationTool() {
  if (!Store.currentUser || Store.currentUser.role !== 'admin') return;
  document.getElementById('migration-modal')?.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'migration-modal';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl p-5" style="max-width:560px;max-height:90vh;overflow-y:auto">
      <h3 class="text-lg font-bold text-gray-800 mb-1">🔀 Migração de Dados</h3>
      <p class="text-xs text-gray-500 mb-4">
        Migra tudo — contas, eventos, RSVPs, presentes, fotos e vídeos — para um projecto Supabase novo,
        em 3 passos. O projecto novo fica independente do actual no final.
      </p>

      <div style="border:1px solid #f59e0b;background:#fffbeb;border-radius:0.6rem;padding:0.9rem;margin-bottom:0.9rem">
        <h4 class="text-sm font-bold text-gray-700 mb-2">Projecto ANTIGO (de onde vêm os dados)</h4>
        <p class="text-xs text-gray-500 mb-2">
          Preenche sempre estes campos, independentemente de para onde o site esteja configurado neste momento
          (<code>js/config.js</code>) — assim a exportação nunca depende disso.
        </p>
        <label class="text-xs font-semibold text-gray-600 block mb-1">URL do projecto antigo</label>
        <input id="migration-old-url" class="input-field text-sm mb-2" placeholder="https://xxxx.supabase.co">
        <label class="text-xs font-semibold text-gray-600 block mb-1">Anon Key do projecto antigo</label>
        <input id="migration-old-key" class="input-field text-sm mb-2" placeholder="a anon key (pública) do projecto antigo">
        <label class="text-xs font-semibold text-gray-600 block mb-1">Service Role Key do projecto antigo <span class="text-gray-400 font-normal">(só para "Copiar auth.users")</span></label>
        <input id="migration-old-service-key" type="password" class="input-field text-sm" placeholder="opcional — só se fores usar o passo de auth.users">
      </div>

      <div style="border:1px solid #6366f1;background:#eef2ff;border-radius:0.6rem;padding:0.9rem;margin-bottom:0.9rem">
        <h4 class="text-sm font-bold text-gray-700 mb-2">0. Kit de Arranque <span class="text-xs font-normal text-gray-500">(só na primeira vez, por projecto novo)</span></h4>
        <p class="text-xs text-gray-500 mb-2">
          3 funções especiais que, uma vez coladas no SQL Editor do projecto novo, eliminam a necessidade de
          terminal para tudo o que vem a seguir. Só protegidas pela Service Role Key — mais ninguém as consegue usar.
        </p>
        <button class="btn-outline text-sm w-full" onclick="migrationShowBootstrapKit()">📋 Ver / Copiar Kit de Arranque</button>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:0.6rem;padding:0.9rem;margin-bottom:0.9rem">
        <h4 class="text-sm font-bold text-gray-700 mb-2">1. Aplicar Estrutura no projecto novo</h4>
        <p class="text-xs text-gray-500 mb-2">
          Ainda precisas do terminal só para <strong>gerar</strong> este texto (o <code>pg_dump</code> é a
          ferramenta certa para isso, não vale a pena reinventá-la):<br>
          <code style="font-size:0.65rem;word-break:break-all">pg_dump "CONNECTION_STRING_ANTIGO" --schema-only --no-owner --no-privileges -f schema.sql</code><br>
          Depois, abre esse ficheiro num editor de texto, copia tudo, e cola aqui — já não precisas do <code>psql</code>.
        </p>
        <textarea id="migration-schema-sql" class="input-field text-sm mb-2" rows="4" placeholder="Cola aqui o conteúdo do schema.sql..."></textarea>
        <button class="btn-main text-sm w-full" onclick="migrationApplySchema()">🏗️ Aplicar Estrutura no projecto novo</button>
        <div id="migration-schema-log" class="text-xs text-gray-500 mt-2 whitespace-pre-wrap" style="max-height:160px;overflow-y:auto;font-family:monospace"></div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:0.6rem;padding:0.9rem;margin-bottom:0.9rem">
        <h4 class="text-sm font-bold text-gray-700 mb-2">2. Copiar auth.users (senhas do Admin God)</h4>
        <p class="text-xs text-gray-500 mb-2">Um clique, sem terminal — usa as Service Role Keys preenchidas acima (antigo) e abaixo (novo).</p>
        <button class="btn-main text-sm w-full" onclick="migrationCopyAuthUsers()">🔑 Copiar auth.users</button>
        <div id="migration-auth-log" class="text-xs text-gray-500 mt-2 whitespace-pre-wrap" style="max-height:140px;overflow-y:auto;font-family:monospace"></div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:0.6rem;padding:0.9rem;margin-bottom:0.9rem">
        <h4 class="text-sm font-bold text-gray-700 mb-2">3. Exportar dados do projecto antigo</h4>
        <button class="btn-main text-sm w-full" onclick="migrationExport()">📤 Descarregar backup (.txt)</button>
        <div id="migration-export-log" class="text-xs text-gray-500 mt-2 whitespace-pre-wrap" style="max-height:140px;overflow-y:auto;font-family:monospace"></div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:0.6rem;padding:0.9rem;margin-bottom:0.9rem">
        <h4 class="text-sm font-bold text-gray-700 mb-2">4. Copiar fotos, vídeos e áudio (antigo → novo)</h4>
        <p class="text-xs text-gray-500 mb-2">Copia todos os ficheiros do projecto antigo para o novo (usa os campos preenchidos acima e abaixo). Pode demorar alguns minutos.</p>
        <button class="btn-main text-sm w-full" onclick="migrationCopyFiles()">🖼️ Copiar ficheiros</button>
        <div id="migration-files-log" class="text-xs text-gray-500 mt-2 whitespace-pre-wrap" style="max-height:160px;overflow-y:auto;font-family:monospace"></div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:0.6rem;padding:0.9rem">
        <h4 class="text-sm font-bold text-gray-700 mb-2">5. Importar no projecto novo</h4>
        <p class="text-xs text-red-500 mb-2">
          ⚠️ Antes de importar: cria o projecto novo no Supabase, cola o Kit de Arranque (passo 0), aplica a
          estrutura (passo 1) e copia o auth.users (passo 2) — e cria os mesmos buckets de Storage lá. Só depois
          corre o passo 4 (copiar ficheiros) e importa os dados aqui.
        </p>
        <label class="text-xs font-semibold text-gray-600 block mb-1">URL do projecto novo</label>
        <input id="migration-new-url" class="input-field text-sm mb-2" placeholder="https://xxxx.supabase.co">
        <label class="text-xs font-semibold text-gray-600 block mb-1">Service Role Key do projecto novo</label>
        <input id="migration-new-key" type="password" class="input-field text-sm mb-1" placeholder="Project Settings → API → service_role (secreta)">
        <p class="text-xs text-gray-400 mb-2">
          Esta chave nunca é guardada nem enviada para mais lado nenhum — só é usada aqui, neste navegador,
          para escrever directamente no teu projecto novo. Fecha esta janela quando terminares.
        </p>
        <label class="text-xs font-semibold text-gray-600 block mb-1">Ficheiro de backup (.txt)</label>
        <input id="migration-file-input" type="file" accept=".txt,.json" class="input-field text-sm mb-2">
        <button class="btn-main text-sm w-full" onclick="migrationImport()">📥 Iniciar importação</button>
        <div id="migration-import-log" class="text-xs text-gray-500 mt-2 whitespace-pre-wrap" style="max-height:220px;overflow-y:auto;font-family:monospace"></div>
      </div>

      <button class="btn-outline text-sm w-full mt-3" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
    </div>`;
  document.body.appendChild(modal);
}

// ===================== KIT DE ARRANQUE =====================
// As 3 funções abaixo só precisam de ser coladas UMA VEZ, no SQL Editor de
// cada projecto NOVO. Todas são protegidas pela Service Role Key — a
// própria função verifica isso lá dentro, por isso nem a anon key nem uma
// sessão normal de utilizador conseguem usá-las, só quem tiver a chave
// secreta (Project Settings → API Keys → service_role).
const MIGRATION_BOOTSTRAP_SQL = `-- ===== KIT DE ARRANQUE — colar uma vez no SQL Editor do projecto novo =====

-- 1) Corre qualquer SQL (usado para "Aplicar Estrutura", sem precisar de psql)
create or replace function public.rpc_admin_exec_sql(p_sql text)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') <> 'service_role' then
    raise exception 'Só a Service Role Key pode executar isto.';
  end if;
  execute p_sql;
  return 'OK';
end;
$$;

-- 2) Exporta auth.users + auth.identities deste projecto, como JSON
create or replace function public.rpc_admin_export_auth_users()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  result jsonb;
begin
  if coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') <> 'service_role' then
    raise exception 'Só a Service Role Key pode executar isto.';
  end if;
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(to_jsonb(u)) from auth.users u), '[]'::jsonb),
    'identities', coalesce((select jsonb_agg(to_jsonb(i)) from auth.identities i), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- 3) Importa auth.users + auth.identities para este projecto, a partir do JSON gerado pela função acima
create or replace function public.rpc_admin_import_auth_users(p_data jsonb)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  u jsonb;
  i jsonb;
  cnt_users int := 0;
  cnt_idents int := 0;
begin
  if coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') <> 'service_role' then
    raise exception 'Só a Service Role Key pode executar isto.';
  end if;

  for u in select * from jsonb_array_elements(coalesce(p_data->'users', '[]'::jsonb))
  loop
    begin
      insert into auth.users select * from jsonb_populate_record(null::auth.users, u)
      on conflict (id) do nothing;
      cnt_users := cnt_users + 1;
    exception when others then null; -- regista o que conseguir, não trava tudo por 1 linha problemática
    end;
  end loop;

  for i in select * from jsonb_array_elements(coalesce(p_data->'identities', '[]'::jsonb))
  loop
    begin
      insert into auth.identities select * from jsonb_populate_record(null::auth.identities, i)
      on conflict (id) do nothing;
      cnt_idents := cnt_idents + 1;
    exception when others then null;
    end;
  end loop;

  return format('Tentados %s users, %s identities (algumas linhas podem já existir e são ignoradas em silêncio)', cnt_users, cnt_idents);
end;
$$;
`;

function migrationShowBootstrapKit() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl p-5" style="max-width:640px;max-height:85vh;overflow-y:auto">
      <h3 class="text-base font-bold text-gray-800 mb-1">📋 Kit de Arranque</h3>
      <p class="text-xs text-gray-500 mb-3">
        Copia este texto e cola-o no <strong>SQL Editor do projecto NOVO</strong> — uma única vez. Só depois
        disso os botões "Aplicar Estrutura" e "Copiar auth.users" funcionam.
      </p>
      <textarea id="migration-bootstrap-textarea" readonly class="input-field text-xs" rows="16" style="font-family:monospace" onclick="this.select()">${MIGRATION_BOOTSTRAP_SQL.replace(/</g, '&lt;')}</textarea>
      <div class="flex gap-2 mt-3">
        <button class="flex-1 btn-main text-sm" onclick="navigator.clipboard.writeText(document.getElementById('migration-bootstrap-textarea').value); toast('Copiado!')">📋 Copiar</button>
        <button class="btn-outline text-sm" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ===================== APLICAR ESTRUTURA (sem psql) =====================
async function migrationApplySchema() {
  const logId = 'migration-schema-log';
  document.getElementById(logId).textContent = '';
  const newUrl = document.getElementById('migration-new-url').value.trim().replace(/\/$/, '');
  const newKey = document.getElementById('migration-new-key').value.trim();
  const sql = document.getElementById('migration-schema-sql').value.trim();
  if (!newUrl || !newKey) { toast('Preenche primeiro o URL e a Service Role Key do projecto novo (mais abaixo).'); return; }
  if (!sql) { toast('Cola o conteúdo do schema.sql primeiro.'); return; }
  if (!confirm(`Vais aplicar esta estrutura em:\n${newUrl}\n\nIsto corre directamente na base de dados. Confirma que é mesmo o projecto novo e vazio. Continuar?`)) return;

  _migLog(logId, 'A aplicar estrutura...');
  try {
    const res = await fetch(`${newUrl}/rest/v1/rpc/rpc_admin_exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': newKey, 'Authorization': `Bearer ${newKey}`, 'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_sql: sql })
    });
    const text = await res.text();
    if (!res.ok) {
      _migLog(logId, `⚠️ Falhou: HTTP ${res.status} — ${text.slice(0, 300)}`);
      _migLog(logId, 'Se o erro disser que a função não existe, cola primeiro o "Kit de Arranque" (passo 0) no SQL Editor do projecto novo.');
    } else {
      _migLog(logId, '✅ Estrutura aplicada! Resultado: ' + text);
      toast('Estrutura aplicada com sucesso!');
    }
  } catch (e) {
    _migLog(logId, '⚠️ Erro de rede: ' + e.message);
  }
}

// ===================== COPIAR auth.users (sem terminal) =====================
async function migrationCopyAuthUsers() {
  const logId = 'migration-auth-log';
  document.getElementById(logId).textContent = '';
  const oldUrl = document.getElementById('migration-old-url').value.trim().replace(/\/$/, '');
  const oldServiceKey = document.getElementById('migration-old-service-key').value.trim();
  const newUrl = document.getElementById('migration-new-url').value.trim().replace(/\/$/, '');
  const newKey = document.getElementById('migration-new-key').value.trim();
  if (!oldUrl || !oldServiceKey) { toast('Preenche o URL e a Service Role Key do projecto ANTIGO (no topo).'); return; }
  if (!newUrl || !newKey) { toast('Preenche o URL e a Service Role Key do projecto NOVO (mais abaixo).'); return; }
  if (!confirm('Vais copiar auth.users do projecto antigo para o novo. Continuar?')) return;

  _migLog(logId, 'A exportar auth.users do projecto antigo...');
  let data;
  try {
    const res1 = await fetch(`${oldUrl}/rest/v1/rpc/rpc_admin_export_auth_users`, {
      method: 'POST',
      headers: { 'apikey': oldServiceKey, 'Authorization': `Bearer ${oldServiceKey}`, 'Content-Type': 'application/json' },
      body: '{}'
    });
    const text1 = await res1.text();
    if (!res1.ok) {
      _migLog(logId, `⚠️ Falhou a exportar: HTTP ${res1.status} — ${text1.slice(0, 300)}`);
      _migLog(logId, 'Se o erro disser que a função não existe, cola o "Kit de Arranque" (passo 0) no SQL Editor do projecto ANTIGO também.');
      return;
    }
    data = JSON.parse(text1);
    const nUsers = (data.users || []).length;
    const nIdents = (data.identities || []).length;
    _migLog(logId, `✅ Exportados: ${nUsers} utilizador(es), ${nIdents} identidade(s).`);
  } catch (e) {
    _migLog(logId, '⚠️ Erro de rede ao exportar: ' + e.message);
    return;
  }

  _migLog(logId, 'A importar no projecto novo...');
  try {
    const res2 = await fetch(`${newUrl}/rest/v1/rpc/rpc_admin_import_auth_users`, {
      method: 'POST',
      headers: { 'apikey': newKey, 'Authorization': `Bearer ${newKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_data: data })
    });
    const text2 = await res2.text();
    if (!res2.ok) {
      _migLog(logId, `⚠️ Falhou a importar: HTTP ${res2.status} — ${text2.slice(0, 300)}`);
      _migLog(logId, 'Se o erro disser que a função não existe, cola o "Kit de Arranque" (passo 0) no SQL Editor do projecto NOVO.');
    } else {
      _migLog(logId, '✅ ' + text2);
      toast('auth.users copiado!');
    }
  } catch (e) {
    _migLog(logId, '⚠️ Erro de rede ao importar: ' + e.message);
  }
}

function _migLog(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent += (el.textContent ? '\n' : '') + msg;
  el.scrollTop = el.scrollHeight;
}

// ===================== EXPORTAR =====================
async function migrationExport() {
  const logId = 'migration-export-log';
  const logEl = document.getElementById(logId);
  if (logEl) logEl.textContent = '';

  const oldUrl = document.getElementById('migration-old-url').value.trim().replace(/\/$/, '');
  const oldKey = document.getElementById('migration-old-key').value.trim();
  if (!oldUrl || !oldKey) { toast('Preenche primeiro o URL e a Anon Key do projecto ANTIGO, no topo.'); return; }

  _migLog(logId, `A iniciar exportação de ${oldUrl}...`);

  const backup = {
    exported_at: new Date().toISOString(),
    source_url: oldUrl,
    tables: {}
  };
  let totalRows = 0;

  for (const table of MIGRATION_TABLES) {
    try {
      const rows = await _migFetchAllRows(oldUrl, oldKey, table);
      backup.tables[table] = rows;
      totalRows += rows.length;
      _migLog(logId, `✅ ${table}: ${rows.length} registo(s)`);
    } catch (e) {
      backup.tables[table] = [];
      _migLog(logId, `⚠️ ${table}: falhou (${e.message || e}) — ficou vazio no backup`);
    }
  }

  _migLog(logId, `\nTotal: ${totalRows} registo(s) em ${MIGRATION_TABLES.length} tabelas.`);

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `invitesadkira_backup_${ts}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  _migLog(logId, '📥 Ficheiro descarregado!');
  toast('Backup descarregado!');
}

// Percorre uma tabela do projecto ANTIGO em páginas de 1000, usando o URL
// e a Anon Key introduzidos nos campos do topo (não depende do config.js).
async function _migFetchAllRows(oldUrl, oldKey, table) {
  const pageSize = 1000;
  const orderCol = MIGRATION_KEY_COLUMN[table] || 'id';
  let offset = 0;
  let all = [];
  const headers = { 'apikey': oldKey, 'Authorization': `Bearer ${oldKey}`, 'Accept': 'application/json' };
  while (true) {
    let res = await fetch(`${oldUrl}/rest/v1/${table}?select=*&order=${orderCol}.asc&limit=${pageSize}&offset=${offset}`, { headers });
    if (!res.ok) {
      // A coluna assumida para ordenar pode não existir nesta tabela —
      // tenta outra vez sem nenhuma ordenação, em vez de desistir e deixar
      // a tabela vazia no backup sem se perceber porquê.
      res = await fetch(`${oldUrl}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`, { headers });
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) break;
    all = all.concat(rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

// ===================== COPIAR FICHEIROS (STORAGE) =====================
// Lista todos os ficheiros de um "balde" (bucket) do projecto ANTIGO,
// paginando 200 a 200.
async function _migListAllFiles(oldUrl, oldKey, bucket) {
  const pageSize = 200;
  let offset = 0;
  let all = [];
  while (true) {
    const res = await fetch(`${oldUrl}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { 'apikey': oldKey, 'Authorization': `Bearer ${oldKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: pageSize, offset, prefix: '' })
    });
    if (!res.ok) break;
    const data = await res.json().catch(() => []);
    if (!Array.isArray(data) || data.length === 0) break;
    // Ignora entradas que são "pastas" (sem metadata de ficheiro real)
    all = all.concat(data.filter(f => f && (f.id || f.metadata)));
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

async function migrationCopyFiles() {
  const logId = 'migration-files-log';
  const logEl = document.getElementById(logId);
  if (logEl) logEl.textContent = '';

  const oldUrl = document.getElementById('migration-old-url').value.trim().replace(/\/$/, '');
  const oldKey = document.getElementById('migration-old-key').value.trim();
  const newUrl = document.getElementById('migration-new-url').value.trim().replace(/\/$/, '');
  const newKey = document.getElementById('migration-new-key').value.trim();
  if (!oldUrl || !oldKey) { toast('Preenche primeiro o URL e a Anon Key do projecto ANTIGO, no topo.'); return; }
  if (!newUrl || !newKey) { toast('Preenche primeiro o URL e a Service Role Key do projecto novo (passo 3).'); return; }
  if (!confirm(`Vais copiar todas as fotos/vídeos/áudio de:\n${oldUrl}\npara:\n${newUrl}\n\nPode demorar alguns minutos. Continuar?`)) return;

  _migLog(logId, 'A listar ficheiros...');
  let totalFiles = 0, totalBytes = 0;
  const failedFiles = [];

  for (const bucket of MIGRATION_BUCKETS) {
    let files;
    try { files = await _migListAllFiles(oldUrl, oldKey, bucket); }
    catch (e) { _migLog(logId, `⚠️ ${bucket}: não foi possível listar (${e.message})`); continue; }
    if (!files.length) { _migLog(logId, `— ${bucket}: vazio ou não existe, a saltar`); continue; }
    _migLog(logId, `${bucket}: ${files.length} ficheiro(s) encontrados`);

    for (const f of files) {
      const path = f.name;
      const publicUrl = `${oldUrl}/storage/v1/object/public/${bucket}/${path}`;
      try {
        const fileRes = await fetch(publicUrl);
        if (!fileRes.ok) throw new Error('download falhou: HTTP ' + fileRes.status);
        const blob = await fileRes.blob();
        const uploadRes = await fetch(`${newUrl}/storage/v1/object/${bucket}/${path}`, {
          method: 'POST',
          headers: {
            'apikey': newKey,
            'Authorization': `Bearer ${newKey}`,
            'Content-Type': blob.type || 'application/octet-stream',
            'x-upsert': 'true',
            'Cache-Control': '2592000'
          },
          body: blob
        });
        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => '');
          throw new Error('upload falhou: HTTP ' + uploadRes.status + ' ' + errText.slice(0, 100));
        }
        totalFiles++;
        totalBytes += blob.size;
        _migLog(logId, `  ✅ ${bucket}/${path} (${(blob.size / 1024).toFixed(0)} KB)`);
      } catch (e) {
        failedFiles.push(`${bucket}/${path}`);
        _migLog(logId, `  ⚠️ ${bucket}/${path}: ${e.message}`);
      }
    }
  }

  _migLog(logId, `\nTotal copiado: ${totalFiles} ficheiro(s), ${(totalBytes / 1024 / 1024).toFixed(1)} MB.`);
  if (failedFiles.length) {
    _migLog(logId, `⚠️ ${failedFiles.length} ficheiro(s) falharam — corre "Copiar ficheiros" outra vez (é seguro repetir, substitui em vez de duplicar).`);
  } else {
    _migLog(logId, '✅ Todos os ficheiros copiados com sucesso!');
  }
  toast('Cópia de ficheiros terminada — vê o registo.');
}


async function migrationImport() {
  const logId = 'migration-import-log';
  const logEl = document.getElementById(logId);
  if (logEl) logEl.textContent = '';

  const newUrl = document.getElementById('migration-new-url').value.trim().replace(/\/$/, '');
  const newKey = document.getElementById('migration-new-key').value.trim();
  const file = document.getElementById('migration-file-input').files[0];

  if (!newUrl || !newKey) { toast('Preenche o URL e a Service Role Key do projecto novo.'); return; }
  if (!file) { toast('Escolhe o ficheiro de backup.'); return; }
  if (!confirm(`Vais importar dados para:\n${newUrl}\n\nConfirma que já criaste as tabelas e copiaste auth.users nesse projecto. Continuar?`)) return;

  _migLog(logId, 'A ler ficheiro...');
  let rawText;
  try {
    rawText = await file.text();
  } catch (e) {
    _migLog(logId, '❌ Não foi possível ler o ficheiro: ' + e.message);
    return;
  }

  let backup;
  try {
    backup = JSON.parse(rawText);
  } catch (e) {
    _migLog(logId, '❌ Ficheiro inválido: ' + e.message);
    return;
  }

  // ── Reescrever endereços do projecto antigo para o projecto novo ──
  // Os dados exportados ainda têm URLs completos do projecto antigo
  // (ex: cover_image, gallery_urls, cover_video_url) porque foram gravados
  // assim na altura do upload. Se já correste "2. Copiar ficheiros", os
  // mesmos ficheiros já existem no projecto novo com o mesmo caminho — só
  // falta trocar o domínio nos dados para apontarem para lá.
  const oldUrl = backup.source_url;
  if (oldUrl && newUrl && oldUrl !== newUrl && rawText.includes(oldUrl)) {
    const occurrences = rawText.split(oldUrl).length - 1;
    _migLog(logId, `A actualizar ${occurrences} endereço(s) de ${oldUrl} para ${newUrl}...`);
    rawText = rawText.split(oldUrl).join(newUrl);
    try { backup = JSON.parse(rawText); }
    catch (e) { _migLog(logId, '❌ Erro ao reescrever endereços: ' + e.message); return; }
  }


  const tables = Object.keys(backup.tables || {});
  if (!tables.length) { _migLog(logId, '❌ Backup vazio ou em formato inesperado.'); return; }

  _migLog(logId, `Encontradas ${tables.length} tabelas no backup. A importar...\n`);

  // Fila de tentativas — se uma tabela "filha" falhar por a "mãe" ainda não
  // existir no destino, ela volta para a passagem seguinte. Até 5 passagens.
  let pending = tables.map(t => ({ table: t, rows: backup.tables[t] || [] })).filter(t => t.rows.length);
  const MAX_PASSES = 5;

  for (let pass = 1; pass <= MAX_PASSES && pending.length; pass++) {
    _migLog(logId, `── Passagem ${pass} ──`);
    const stillPending = [];
    for (const { table, rows } of pending) {
      const failedRows = await _migImportTable(newUrl, newKey, table, rows, logId);
      if (failedRows.length) stillPending.push({ table, rows: failedRows });
    }
    pending = stillPending;
  }

  if (pending.length) {
    _migLog(logId, `\n⚠️ Registos que não foi possível importar após ${MAX_PASSES} passagens:`);
    pending.forEach(p => _migLog(logId, `  - ${p.table}: ${p.rows.length} registo(s)`));
    _migLog(logId, 'Revê estes manualmente — normalmente é uma dependência em falta ou uma coluna diferente entre projectos.');
  } else {
    _migLog(logId, '\n✅ Importação concluída sem registos pendentes!');
  }
  toast('Importação terminada — vê o registo abaixo.');
}

// Importa uma tabela em lotes de 500, com upsert (on_conflict pela chave
// primária certa de cada tabela) para ser seguro repetir sem duplicar caso
// a importação seja corrida mais de uma vez. Devolve as linhas que
// falharam, para se tentar de novo depois.
//
// Auto-defesa: se a chave de conflito assumida (da lista partilhada no
// topo do ficheiro, ou "id" por omissão) estiver errada para alguma tabela
// que ainda não conhecemos bem, o Postgres recusa com um erro específico
// ("no unique or exclusion constraint..."). Nesse caso, tenta-se
// automaticamente o mesmo lote como inserção simples (sem upsert) — seguro
// porque a importação é sempre para um projecto novo/vazio, não há nada
// para entrar em conflito à primeira vez.
async function _migImportTable(newUrl, newKey, table, rows, logId) {
  const BATCH = 500;
  const conflictKey = MIGRATION_KEY_COLUMN[table] || 'id';
  const failed = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      let res = await fetch(`${newUrl}/rest/v1/${table}?on_conflict=${conflictKey}`, {
        method: 'POST',
        headers: {
          'apikey': newKey,
          'Authorization': `Bearer ${newKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(batch)
      });

      if (!res.ok) {
        const firstErrText = await res.text().catch(() => '');
        if (/no unique or exclusion constraint/i.test(firstErrText) || /column .* does not exist/i.test(firstErrText)) {
          _migLog(logId, `  ↻ ${table}: chave "${conflictKey}" não é a certa aqui, a tentar inserção simples...`);
          res = await fetch(`${newUrl}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
              'apikey': newKey,
              'Authorization': `Bearer ${newKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify(batch)
          });
        } else {
          failed.push(...batch);
          _migLog(logId, `  ⚠️ ${table} [${i}-${i + batch.length}]: HTTP ${res.status} — ${firstErrText.slice(0, 150)}`);
          continue;
        }
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        failed.push(...batch);
        _migLog(logId, `  ⚠️ ${table} [${i}-${i + batch.length}]: HTTP ${res.status} — ${errText.slice(0, 150)}`);
      } else {
        _migLog(logId, `  ✅ ${table}: ${batch.length} registo(s) (lote ${Math.floor(i / BATCH) + 1})`);
      }
    } catch (e) {
      failed.push(...batch);
      _migLog(logId, `  ⚠️ ${table}: erro de rede — ${e.message}`);
    }
  }
  return failed;
}
