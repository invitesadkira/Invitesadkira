// ===================== MIGRAÇÃO DE DADOS (ADMIN GOD) =====================
// Ferramenta para migrar TUDO do site — contas, eventos, RSVPs, presentes,
// links, notificações, E as fotos/vídeos/áudio — para um projecto Supabase
// NOVO, sem depender do projecto antigo continuar a existir.
//
// ⚠️ A única coisa que NÃO é migrada automaticamente por aqui:
//   auth.users (as senhas) — a anon key nunca consegue ler essa tabela, é
//   uma zona protegida do Supabase. Tem de ser copiada à parte, uma única
//   vez, pelo SQL Editor do painel do Supabase, por quem tem acesso de
//   dono aos dois projectos.
//
// Como funciona (3 passos, por esta ordem):
//   1. Exportar os dados deste projecto para um ficheiro .txt
//   2. Copiar as fotos/vídeos/áudio deste projecto para o projecto novo
//      (mesmo nome de balde/ficheiro, para os caminhos coincidirem)
//   3. Importar o ficheiro no projecto novo — os endereços das fotos são
//      reescritos automaticamente para apontarem para lá, por isso o
//      projecto novo fica totalmente independente do antigo.
//
// Pré-requisito antes do passo 3: o projecto novo já deve ter as MESMAS
// tabelas/colunas/políticas/buckets criados (correr lá os scripts SQL
// habituais) e já deve ter a tabela auth.users copiada.

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

      <div style="border:1px solid #e5e7eb;border-radius:0.6rem;padding:0.9rem;margin-bottom:0.9rem">
        <h4 class="text-sm font-bold text-gray-700 mb-2">1. Exportar dados deste projecto</h4>
        <button class="btn-main text-sm w-full" onclick="migrationExport()">📤 Descarregar backup (.txt)</button>
        <div id="migration-export-log" class="text-xs text-gray-500 mt-2 whitespace-pre-wrap" style="max-height:140px;overflow-y:auto;font-family:monospace"></div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:0.6rem;padding:0.9rem;margin-bottom:0.9rem">
        <h4 class="text-sm font-bold text-gray-700 mb-2">2. Copiar fotos, vídeos e áudio</h4>
        <p class="text-xs text-gray-500 mb-2">Copia todos os ficheiros deste projecto para o projecto novo (usa os campos do passo 3 abaixo — preenche-os primeiro). Pode demorar alguns minutos.</p>
        <button class="btn-main text-sm w-full" onclick="migrationCopyFiles()">🖼️ Copiar ficheiros</button>
        <div id="migration-files-log" class="text-xs text-gray-500 mt-2 whitespace-pre-wrap" style="max-height:160px;overflow-y:auto;font-family:monospace"></div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:0.6rem;padding:0.9rem">
        <h4 class="text-sm font-bold text-gray-700 mb-2">3. Importar no projecto novo</h4>
        <p class="text-xs text-red-500 mb-2">
          ⚠️ Antes de importar: cria o projecto novo no Supabase, corre lá os teus scripts SQL de configuração
          (as mesmas tabelas e políticas do projecto actual, incluindo os mesmos buckets de Storage) e copia a tabela
          <code>auth.users</code> manualmente pelo SQL Editor. Depois corre o passo 2 acima. Só então importa os dados aqui.
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
  _migLog(logId, 'A iniciar exportação...');

  const backup = {
    exported_at: new Date().toISOString(),
    source_url: SUPABASE_URL,
    tables: {}
  };
  let totalRows = 0;

  for (const table of MIGRATION_TABLES) {
    try {
      const rows = await _migFetchAllRows(table);
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

// Percorre uma tabela do projecto ACTUAL em páginas de 1000, usando a
// sessão do admin já autenticado (a mesma que o resto do site usa).
async function _migFetchAllRows(table) {
  const pageSize = 1000;
  let offset = 0;
  let all = [];
  while (true) {
    const rows = await supabaseRequest(`${table}?select=*&order=id.asc&limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(rows) || rows.length === 0) break;
    all = all.concat(rows);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

// ===================== COPIAR FICHEIROS (STORAGE) =====================
// Lista todos os ficheiros de um "balde" (bucket) do projecto ACTUAL,
// paginando 200 a 200.
async function _migListAllFiles(bucket) {
  const pageSize = 200;
  let offset = 0;
  let all = [];
  while (true) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
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

  const newUrl = document.getElementById('migration-new-url').value.trim().replace(/\/$/, '');
  const newKey = document.getElementById('migration-new-key').value.trim();
  if (!newUrl || !newKey) { toast('Preenche primeiro o URL e a Service Role Key do projecto novo (passo 3).'); return; }
  if (!confirm(`Vais copiar todas as fotos/vídeos/áudio deste projecto para:\n${newUrl}\n\nPode demorar alguns minutos. Continuar?`)) return;

  _migLog(logId, 'A listar ficheiros...');
  let totalFiles = 0, totalBytes = 0;
  const failedFiles = [];

  for (const bucket of MIGRATION_BUCKETS) {
    let files;
    try { files = await _migListAllFiles(bucket); }
    catch (e) { _migLog(logId, `⚠️ ${bucket}: não foi possível listar (${e.message})`); continue; }
    if (!files.length) { _migLog(logId, `— ${bucket}: vazio ou não existe, a saltar`); continue; }
    _migLog(logId, `${bucket}: ${files.length} ficheiro(s) encontrados`);

    for (const f of files) {
      const path = f.name;
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
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

// Importa uma tabela em lotes de 500, com upsert (on_conflict=id) para ser
// seguro repetir sem duplicar caso a importação seja corrida mais de uma
// vez. Devolve as linhas que falharam, para se tentar de novo depois.
async function _migImportTable(newUrl, newKey, table, rows, logId) {
  const BATCH = 500;
  const failed = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    try {
      const res = await fetch(`${newUrl}/rest/v1/${table}?on_conflict=id`, {
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
