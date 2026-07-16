// ===================== MIGRAÇÃO DE DADOS (ADMIN GOD) =====================
// Ferramenta para exportar TODOS os dados do site (contas, eventos, RSVPs,
// presentes, links, notificações, etc.) para um único ficheiro de texto, e
// depois importar esse ficheiro num projecto Supabase NOVO.
//
// ⚠️ O que NÃO é migrado por aqui, de propósito:
//   1) auth.users (as senhas) — a anon key nunca consegue ler essa tabela,
//      é uma zona protegida do Supabase. Isso tem de ser copiado à parte,
//      manualmente, pelo SQL Editor do painel do Supabase (feito uma única
//      vez, directamente por quem tem acesso de dono aos dois projectos).
//   2) Fotos e vídeos — não é preciso. As colunas guardam sempre o URL
//      COMPLETO (https://<projecto-antigo>.supabase.co/storage/...), por
//      isso continuam a funcionar depois da migração sem mover um único
//      ficheiro — desde que o projecto ANTIGO continue a existir (mesmo
//      que fique só no plano gratuito, sem ser actualizado).
//
// Pré-requisito antes de importar: o projecto novo já deve ter as MESMAS
// tabelas/colunas/políticas criadas (correr lá os scripts SQL habituais) e
// já deve ter a tabela auth.users copiada.

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
        Exporta todos os dados (contas, eventos, RSVPs, presentes, etc.) para um ficheiro.
        Fotos e vídeos NÃO são incluídos — continuam a funcionar a partir deste projecto Supabase sem precisares de os mover.
      </p>

      <div style="border:1px solid #e5e7eb;border-radius:0.6rem;padding:0.9rem;margin-bottom:0.9rem">
        <h4 class="text-sm font-bold text-gray-700 mb-2">1. Exportar deste projecto</h4>
        <button class="btn-main text-sm w-full" onclick="migrationExport()">📤 Descarregar backup (.txt)</button>
        <div id="migration-export-log" class="text-xs text-gray-500 mt-2 whitespace-pre-wrap" style="max-height:140px;overflow-y:auto;font-family:monospace"></div>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:0.6rem;padding:0.9rem">
        <h4 class="text-sm font-bold text-gray-700 mb-2">2. Importar no projecto novo</h4>
        <p class="text-xs text-red-500 mb-2">
          ⚠️ Antes de importar: cria o projecto novo no Supabase, corre lá os teus scripts SQL de configuração
          (as mesmas tabelas e políticas do projecto actual) e copia a tabela <code>auth.users</code>
          manualmente pelo SQL Editor. Só depois importa os dados aqui.
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

// ===================== IMPORTAR =====================
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
  let backup;
  try {
    backup = JSON.parse(await file.text());
  } catch (e) {
    _migLog(logId, '❌ Ficheiro inválido: ' + e.message);
    return;
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
