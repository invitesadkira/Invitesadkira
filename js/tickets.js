// ============================================================================
// TICKETS.JS — Geração de tickets PDF por convidado + leitor QR na porta
// ============================================================================

// ── CRIPTO: AES-GCM com Web Crypto API ───────────────────────────────────
// Cada QR contém dados encriptados com a chave do evento (scanner_token).
// Um leitor genérico vê apenas "ADK:" + base64 aleatório — ilegível.
// Só o nosso scanner, que conhece o scanner_token do evento, consegue
// desencriptar e validar o rsvp_token do convidado.
const _QR_PREFIX = 'ADK:';

async function _deriveKey(scannerToken) {
  // Derivar chave AES-256-GCM a partir do scanner_token do evento
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(scannerToken), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('adkira-tickets-v1'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function _encryptToken(rsvpToken, scannerToken) {
  const key  = await _deriveKey(scannerToken);
  const enc  = new TextEncoder();
  const iv   = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(rsvpToken)
  );
  // Formato: IV (12 bytes) + ciphertext, tudo em base64url
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return _QR_PREFIX + btoa(String.fromCharCode(...combined)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
}

async function _decryptToken(qrText, scannerToken) {
  if (!qrText.startsWith(_QR_PREFIX)) return null;
  try {
    const b64   = qrText.slice(_QR_PREFIX.length).replace(/-/g,'+').replace(/_/g,'/');
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const iv    = bytes.slice(0, 12);
    const data  = bytes.slice(12);
    const key   = await _deriveKey(scannerToken);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(plain);
  } catch(e) {
    return null; // Chave errada ou dados corrompidos
  }
}

// ── 1. EDITOR DO TEMPLATE ─────────────────────────────────────────────────
async function openTicketTemplateEditor() {
  const eventId = Store.currentEventId;
  let ev = Store.events.find(e => e.id === eventId);
  if (!ev) return;

  // Verificar se conta tem mesas activadas
  let withTable = false;
  try {
    const userId = ev.user_id || ev.userId;
    if (userId) {
      const acc = await supabaseRequest(`accounts?id=eq.${userId}&select=tickets_with_table&limit=1`);
      withTable = acc?.[0]?.tickets_with_table || false;
    }
  } catch(e) {}

  try {
    const fresh = await supabaseRequest(
      `events?id=eq.${eventId}&select=ticket_template_url,ticket_name_x,ticket_name_y,ticket_qr_x,ticket_qr_y,ticket_name_size,ticket_qr_size,ticket_name_color,ticket_name_font,scanner_token,ticket_table_x,ticket_table_y,ticket_table_size,ticket_table_color&limit=1`
    );
    if (fresh && fresh[0]) Object.assign(ev, fresh[0]);
  } catch(e) {}

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'ticket-editor-modal';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl p-5" style="max-width:600px;max-height:90vh;overflow-y:auto">
      <h3 class="text-base font-bold text-gray-800 mb-1">Configurar Ticket PDF</h3>
      <p class="text-xs text-gray-500 mb-3">Carrega o template PDF, depois arrasta as marcas para posicionar o nome do convidado e o QR code.</p>

      <!-- Upload do template -->
      <label class="text-xs font-semibold text-gray-600 block mb-1">Template PDF</label>
      <div class="flex gap-2 items-center mb-3">
        ${ev.ticket_template_url ? `<span class="text-xs text-green-600 font-semibold">✓ Template guardado</span>` : `<span class="text-xs text-red-500">✗ Nenhum template</span>`}
        <input type="file" id="ticket-template-file" accept="application/pdf" class="hidden" onchange="handleTicketTemplateUpload(this)">
        <button class="btn-outline text-xs" onclick="document.getElementById('ticket-template-file').click()">📤 Carregar PDF</button>
      </div>

      <!-- Pré-visualização da 1ª página + marcadores arrastáveis -->
      <div id="ticket-preview-wrap" style="display:${ev.ticket_template_url ? 'block' : 'none'}">
        <label class="text-xs font-semibold text-gray-600 block mb-1">Posicionar elementos (arrastar)</label>
        <p class="text-xs text-gray-400 mb-2">🔵 = Nome &nbsp;|&nbsp; 🟢 = QR Code${withTable?' &nbsp;|&nbsp; 🟠 = Mesa':''}</p>
        <div id="ticket-canvas-wrap" style="position:relative;border:1px solid #e5e7eb;border-radius:0.5rem;overflow:hidden;background:#f8fafc;display:inline-block;max-width:100%">
          <canvas id="ticket-preview-canvas" style="display:block;max-width:100%"></canvas>
          <!-- Marcador do Nome -->
          <div id="ticket-mark-name" style="position:absolute;background:rgba(59,130,246,0.85);color:#fff;border-radius:6px;padding:4px 10px;font-size:13px;font-weight:700;cursor:grab;user-select:none;white-space:nowrap;left:${(ev.ticket_name_x||0.5)*100}%;top:${(ev.ticket_name_y||0.75)*100}%;transform:translate(-50%,-50%);backdrop-filter:blur(2px);border:2px solid #3b82f6">
            María da Silva
          </div>
          <!-- Marcador do QR -->
          <canvas id="ticket-mark-qr-canvas" style="position:absolute;left:${(ev.ticket_qr_x||0.5)*100}%;top:${(ev.ticket_qr_y||0.85)*100}%;transform:translate(-50%,-50%);border:2px solid #16a34a;border-radius:4px;cursor:grab;background:#fff" width="${ev.ticket_qr_size||80}" height="${ev.ticket_qr_size||80}"></canvas>
          <!-- Marcador da Mesa (só se mesas activadas) -->
          ${withTable ? `<div id="ticket-mark-table" style="position:absolute;background:rgba(234,88,12,0.85);color:#fff;border-radius:6px;padding:4px 10px;font-size:13px;font-weight:700;cursor:grab;user-select:none;white-space:nowrap;left:${(ev.ticket_table_x||0.5)*100}%;top:${(ev.ticket_table_y||0.9)*100}%;transform:translate(-50%,-50%);backdrop-filter:blur(2px);border:2px solid #ea580c">
            🪑 Mesa 5
          </div>` : ''}
        </div>

        <!-- Controlos do Nome -->
        <div class="flex gap-3 mt-3 flex-wrap">
          <div>
            <label class="text-xs text-gray-500 block mb-1">Tamanho do nome (pt)</label>
            <div class="flex items-center gap-1">
              <button type="button" onclick="document.getElementById('ticket-name-size').stepDown();document.getElementById('ticket-name-size').dispatchEvent(new Event('input'))" style="width:24px;height:24px;border:1px solid #e5e7eb;border-radius:4px;cursor:pointer;font-size:14px;line-height:1">−</button>
              <input id="ticket-name-size" type="number" value="${ev.ticket_name_size||24}" min="6" max="96" class="input-field text-xs text-center" style="width:52px" oninput="_updateTicketPreview()">
              <button type="button" onclick="document.getElementById('ticket-name-size').stepUp();document.getElementById('ticket-name-size').dispatchEvent(new Event('input'))" style="width:24px;height:24px;border:1px solid #e5e7eb;border-radius:4px;cursor:pointer;font-size:14px;line-height:1">+</button>
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Tamanho do QR (px)</label>
            <div class="flex items-center gap-1">
              <button type="button" onclick="document.getElementById('ticket-qr-size').stepDown();document.getElementById('ticket-qr-size').dispatchEvent(new Event('input'))" style="width:24px;height:24px;border:1px solid #e5e7eb;border-radius:4px;cursor:pointer;font-size:14px;line-height:1">−</button>
              <input id="ticket-qr-size" type="number" value="${ev.ticket_qr_size||80}" min="40" max="300" class="input-field text-xs text-center" style="width:52px" oninput="_updateTicketPreview()">
              <button type="button" onclick="document.getElementById('ticket-qr-size').stepUp();document.getElementById('ticket-qr-size').dispatchEvent(new Event('input'))" style="width:24px;height:24px;border:1px solid #e5e7eb;border-radius:4px;cursor:pointer;font-size:14px;line-height:1">+</button>
            </div>
          </div>
          <div>
            <label class="text-xs text-gray-500 block mb-1">Cor do nome</label>
            <input id="ticket-name-color" type="color" value="${ev.ticket_name_color||'#000000'}" class="input-field" style="width:44px;height:32px;padding:2px" oninput="_updateTicketPreview()">
          </div>
        </div>

        ${withTable ? `
        <!-- Controlos da Mesa -->
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:0.6rem;padding:0.75rem;margin-top:0.75rem">
          <p class="text-xs font-bold text-orange-700 mb-2">🪑 Configurar posição da mesa no PDF</p>
          <div class="flex gap-3 flex-wrap">
            <div>
              <label class="text-xs text-gray-500 block mb-1">Tamanho do texto (pt)</label>
              <div class="flex items-center gap-1">
                <button type="button" onclick="document.getElementById('ticket-table-size').stepDown();document.getElementById('ticket-table-size').dispatchEvent(new Event('input'))" style="width:24px;height:24px;border:1px solid #e5e7eb;border-radius:4px;cursor:pointer;font-size:14px;line-height:1">−</button>
                <input id="ticket-table-size" type="number" value="${ev.ticket_table_size||18}" min="6" max="72" class="input-field text-xs text-center" style="width:52px" oninput="_updateTicketPreview()">
                <button type="button" onclick="document.getElementById('ticket-table-size').stepUp();document.getElementById('ticket-table-size').dispatchEvent(new Event('input'))" style="width:24px;height:24px;border:1px solid #e5e7eb;border-radius:4px;cursor:pointer;font-size:14px;line-height:1">+</button>
              </div>
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1">Cor da mesa</label>
              <input id="ticket-table-color" type="color" value="${ev.ticket_table_color||'#000000'}" class="input-field" style="width:44px;height:32px;padding:2px" oninput="_updateTicketPreview()">
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-1">Arrasta o marcador 🟠 no PDF para posicionar. O texto aparece apenas se o convidado tiver uma mesa atribuída.</p>
        </div>` : ''}

        <div class="mt-2">
          <label class="text-xs text-gray-500 block mb-1">Fonte do nome</label>
          <div class="flex gap-2 items-center flex-wrap">
            <select id="ticket-name-font" class="input-field text-xs" style="width:160px" onchange="_updateTicketPreview()">
              <option value="Helvetica" ${(ev.ticket_name_font||'Helvetica')==='Helvetica'?'selected':''}>Helvetica (padrão)</option>
              <option value="Times-Roman" ${ev.ticket_name_font==='Times-Roman'?'selected':''}>Times Roman</option>
              <option value="Courier" ${ev.ticket_name_font==='Courier'?'selected':''}>Courier</option>
              <option value="Helvetica-Bold" ${ev.ticket_name_font==='Helvetica-Bold'?'selected':''}>Helvetica Bold</option>
              <option value="Times-Bold" ${ev.ticket_name_font==='Times-Bold'?'selected':''}>Times Bold</option>
              ${(Store.availableFonts||[]).map(f=>`<option value="custom:${f.name}" ${ev.ticket_name_font===('custom:'+f.name)?'selected':''}>${f.name} (carregada)</option>`).join('')}
            </select>
            <input type="file" id="ticket-font-file" accept=".ttf,.otf,.woff,.woff2" class="hidden" onchange="handleTicketFontUpload(this)">
            <button type="button" class="btn-outline text-xs" onclick="document.getElementById('ticket-font-file').click()">📤 Carregar fonte</button>
          </div>
          <div class="flex items-center gap-2 mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <input type="checkbox" id="ticket-font-global" class="w-4 h-4" ${ev.ticket_font_global?'checked':''}>
            <label for="ticket-font-global" class="text-xs text-amber-800 cursor-pointer font-semibold">Usar esta fonte em TODOS os tickets (todos os eventos)</label>
          </div>
        </div>
      </div>

      <div class="flex gap-2 mt-4">
        <button class="flex-1 btn-main" onclick="saveTicketTemplate()">Guardar Configuração</button>
        <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  if (ev.ticket_template_url) {
    await _renderTicketPreview(ev.ticket_template_url);
    // Renderizar QR de exemplo no marcador
    const qrCanvas = document.getElementById('ticket-mark-qr-canvas');
    if (qrCanvas && typeof QRCode !== 'undefined') {
      QRCode.toCanvas(qrCanvas, 'ADK:EXEMPLO', {
        width: ev.ticket_qr_size || 80, margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      }).catch(() => {});
    }
    _initTicketDrag();
    _initTicketLivePreview();
  }
}

async function handleTicketTemplateUpload(input) {
  const file = input.files[0];
  if (!file || file.type !== 'application/pdf') { toast('Ficheiro deve ser um PDF.'); return; }
  if (file.size > 10 * 1024 * 1024) { toast('PDF muito grande. Máx. 10MB.'); return; }
  toast('A carregar template...');
  try {
    // ✅ Upload para bucket dedicado 'ticket-templates' que aceita PDFs
    const fileName = `template_${Store.currentEventId}_${Date.now()}.pdf`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/ticket-templates/${fileName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/pdf',
        'x-upsert': 'true',
        'Cache-Control': '3600',
      },
      body: file,
    });
    if (!res.ok) { const t = await res.text(); console.error('PDF upload error:', t); toast('Erro ao carregar PDF. Certifica-te de ter corrido o SQL 22_tickets_and_scanner.sql'); return; }
    const url = `${SUPABASE_URL}/storage/v1/object/public/ticket-templates/${fileName}`;
    await supabaseRequest(`events?id=eq.${Store.currentEventId}`, 'PATCH', { ticket_template_url: url });
    const ev = Store.events.find(e => e.id === Store.currentEventId);
    if (ev) ev.ticket_template_url = url;
    toast('Template carregado!');
    document.getElementById('ticket-editor-modal')?.remove();
    openTicketTemplateEditor();
  } catch(e) { console.error('handleTicketTemplateUpload error:', e); toast('Erro ao carregar PDF.'); }
}

async function _renderTicketPreview(pdfUrl) {
  try {
    // ✅ Carregar PDF.js lazily se ainda não estiver carregado
    if (typeof pdfjsLib === 'undefined') {
      await _loadPdfJs().catch(() => {});
    }
    if (typeof pdfjsLib === 'undefined') {
      console.warn('PDF.js falhou a carregar — a mostrar placeholder');
      const canvas = document.getElementById('ticket-preview-canvas');
      if (canvas) {
        const ctx = canvas.getContext('2d');
        canvas.width = 595; canvas.height = 842;
        ctx.fillStyle = '#f9fafb'; ctx.fillRect(0,0,595,842);
        ctx.strokeStyle = '#e5e7eb'; ctx.strokeRect(10,10,575,822);
        ctx.fillStyle = '#9ca3af'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('PDF não disponível — arrasta os marcadores para posicionar',297,421);
        document.getElementById('ticket-canvas-wrap')?.classList.remove('hidden');
      }
      return;
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf  = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });

    const canvas = document.getElementById('ticket-preview-canvas');
    const wrap   = document.getElementById('ticket-canvas-wrap');
    if (!canvas || !wrap) return;

    // Escalar para caber no modal (máx 480px de largura)
    const maxW  = Math.min(480, window.innerWidth - 48);
    const scale = maxW / viewport.width;
    const scaledVP = page.getViewport({ scale });

    canvas.width  = scaledVP.width;
    canvas.height = scaledVP.height;
    canvas.style.width  = scaledVP.width  + 'px';
    canvas.style.height = scaledVP.height + 'px';

    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport: scaledVP }).promise;

    // Guardar dimensões reais (em pts) para calcular coordenadas correctas
    wrap._pdfWidth  = viewport.width;
    wrap._pdfHeight = viewport.height;
  } catch(e) { console.error('_renderTicketPreview error:', e); }
}

function _initTicketLivePreview() {
  const wrap = document.getElementById('ticket-canvas-wrap');
  if (!wrap) return;

  const controls = ['ticket-name-size', 'ticket-qr-size', 'ticket-name-color', 'ticket-name-font', 'ticket-table-size', 'ticket-table-color'];
  controls.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', _updateTicketPreviewDebounced);
  });

  ['ticket-mark-name', 'ticket-mark-qr-canvas', 'ticket-mark-table'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('mouseup', _updateTicketPreview);
    if (el) el.addEventListener('touchend', _updateTicketPreview);
  });

  _updateTicketPreview();
}

let _ticketPreviewTimer = null;
function _updateTicketPreviewDebounced() {
  // Actualizar o marcador visualmente de imediato (instantâneo)
  _updateTicketMarkerStyles();
  // Re-renderizar o QR com debounce (300ms após parar de mexer)
  clearTimeout(_ticketPreviewTimer);
  _ticketPreviewTimer = setTimeout(_updateTicketPreview, 300);
}

function _updateTicketMarkerStyles() {
  const wrap      = document.getElementById('ticket-canvas-wrap');
  const nameEl    = document.getElementById('ticket-mark-name');
  const tableEl   = document.getElementById('ticket-mark-table');
  const nameFont  = document.getElementById('ticket-name-font')?.value || 'Helvetica';
  const nameSize  = parseInt(document.getElementById('ticket-name-size')?.value || '24');
  const tableSize = parseInt(document.getElementById('ticket-table-size')?.value || '18');
  const nameColor = document.getElementById('ticket-name-color')?.value || '#000000';
  const tableColor= document.getElementById('ticket-table-color')?.value || '#000000';
  if (!wrap) return;

  const scale = wrap.offsetWidth / (wrap._pdfWidth || wrap.offsetWidth);
  const fontMap = { 'Helvetica':'sans-serif','Helvetica-Bold':'sans-serif','Times-Roman':'serif','Times-Bold':'serif','Courier':'monospace' };

  if (nameEl) {
    const previewFontSize = Math.max(8, Math.round(nameSize * scale * 0.85));
    nameEl.style.fontSize   = previewFontSize + 'px';
    nameEl.style.color      = '#fff';
    nameEl.style.fontFamily = fontMap[nameFont] || 'sans-serif';
    nameEl.style.fontWeight = nameFont.includes('Bold') ? '800' : '600';
  }
  if (tableEl) {
    const tSize = Math.max(8, Math.round(tableSize * scale * 0.85));
    tableEl.style.fontSize = tSize + 'px';
  }
}

function _updateTicketPreview() {
  const wrap   = document.getElementById('ticket-canvas-wrap');
  const qrEl   = document.getElementById('ticket-mark-qr-canvas');
  const qrSize = parseInt(document.getElementById('ticket-qr-size')?.value || '80');
  if (!wrap) return;

  _updateTicketMarkerStyles();

  const scale = wrap.offsetWidth / (wrap._pdfWidth || wrap.offsetWidth);
  const previewQrSize = Math.max(20, Math.round(qrSize * scale));
  if (typeof QRCode !== 'undefined' && qrEl) {
    QRCode.toCanvas(qrEl, 'ADK:EXEMPLO', {
      width: previewQrSize, margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(() => {
      qrEl.style.width  = previewQrSize + 'px';
      qrEl.style.height = previewQrSize + 'px';
    }).catch(() => {});
  } else if (qrEl) {
    qrEl.width = qrEl.height = previewQrSize;
    qrEl.style.width = qrEl.style.height = previewQrSize + 'px';
  }
}
function _initTicketDrag() {
  const wrap = document.getElementById('ticket-canvas-wrap');
  if (!wrap) return;

  ['ticket-mark-name', 'ticket-mark-qr-canvas', 'ticket-mark-table'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // Touch support (mobile)
    el.addEventListener('touchstart', e => { el._dragging = true; e.preventDefault(); }, { passive: false });
    el.addEventListener('touchmove', e => {
      if (!el._dragging) return;
      e.preventDefault();
      const touch = e.touches[0];
      const rect = wrap.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (touch.clientY - rect.top)  / rect.height));
      el.style.left = (x * 100) + '%';
      el.style.top  = (y * 100) + '%';
    }, { passive: false });
    el.addEventListener('touchend', () => { el._dragging = false; });

    // Mouse drag
    el.addEventListener('mousedown', e => {
      e.preventDefault();
      const onMove = (ev) => {
        const rect = wrap.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (ev.clientY - rect.top)  / rect.height));
        el.style.left = (x * 100) + '%';
        el.style.top  = (y * 100) + '%';
      };
      const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

async function handleTicketFontUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const allowed = ['.ttf','.otf','.woff','.woff2'];
  if (!allowed.some(ext => file.name.toLowerCase().endsWith(ext))) {
    toast('Apenas .ttf, .otf, .woff, .woff2');
    return;
  }
  toast('A carregar fonte...');
  const url = await uploadImageToStorage(file, 'event-covers', 'Fonte ticket');
  if (!url) return;
  const fontName = file.name.replace(/\.[^.]+$/, '');
  // Guardar na lista de fontes disponíveis
  if (!Store.availableFonts) Store.availableFonts = [];
  if (!Store.availableFonts.find(f => f.name === fontName)) {
    Store.availableFonts.push({ name: fontName, url });
  }
  // ✅ Guardar o URL directamente no ticket_name_font para persistir entre sessões
  await supabaseRequest('events?id=eq.' + Store.currentEventId, 'PATCH',
    { ticket_name_font: url }).catch(() => {});
  // Adicionar ao selector
  const sel = document.getElementById('ticket-name-font');
  if (sel) {
    const opt = document.createElement('option');
    opt.value = url; // ✅ URL directamente, não "custom:NomeFonte"
    opt.textContent = fontName + ' (carregada)';
    opt.selected = true;
    sel.appendChild(opt);
  }
  toast('Fonte carregada e seleccionada!');
  _updateTicketPreview();
}

async function saveTicketTemplate() {
  const eventId = Store.currentEventId;
  const nameEl = document.getElementById('ticket-mark-name');
  const qrEl   = document.getElementById('ticket-mark-qr-canvas');
  const wrap    = document.getElementById('ticket-canvas-wrap');
  if (!nameEl || !qrEl || !wrap) { toast('Configure o template primeiro.'); return; }

  const nx = parseFloat(nameEl.style.left) / 100;
  const ny = parseFloat(nameEl.style.top)  / 100;
  const qx = parseFloat(qrEl.style.left)   / 100;
  const qy = parseFloat(qrEl.style.top)    / 100;

  const tableEl = document.getElementById('ticket-mark-table');
  const ev = Store.events.find(e => e.id === eventId);
  const tx = tableEl ? parseFloat(tableEl.style.left)/100 : (ev?.ticket_table_x || 0.5);
  const ty = tableEl ? parseFloat(tableEl.style.top)/100  : (ev?.ticket_table_y || 0.9);

  await supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', {
    ticket_name_x:    nx,  ticket_name_y:    ny,
    ticket_qr_x:      qx,  ticket_qr_y:      qy,
    ticket_name_size: parseInt(document.getElementById('ticket-name-size')?.value || '24'),
    ticket_qr_size:   parseInt(document.getElementById('ticket-qr-size')?.value   || '80'),
    ticket_name_color: document.getElementById('ticket-name-color')?.value || '#000000',
    ticket_name_font:  document.getElementById('ticket-name-font')?.value  || 'Helvetica',
    ticket_font_global: document.getElementById('ticket-font-global')?.checked || false,
    ticket_table_x:   tx,  ticket_table_y: ty,
    ticket_table_size: parseInt(document.getElementById('ticket-table-size')?.value || '18'),
    ticket_table_color: document.getElementById('ticket-table-color')?.value || '#000000',
  });
  if (ev) { ev.ticket_name_x=nx; ev.ticket_name_y=ny; ev.ticket_qr_x=qx; ev.ticket_qr_y=qy; }
  toast('Configuração guardada!');
  document.getElementById('ticket-editor-modal')?.remove();
}

// ── 2. GERAÇÃO DO TICKET NO BROWSER (download directo) ───────────────────
async function generateGuestTicket(guestName, rsvpToken, eventId, skipNameEdit) {
  // ✅ Permitir editar o nome antes de gerar o ticket
  if (!skipNameEdit) {
    return new Promise(async resolve => {
      // Verificar se conta tem mesas activadas
      const userId = Store.events.find(e=>e.id===(eventId||Store.currentEventId))?.user_id;
      let withTable = false;
      if (userId) {
        try { const a=await supabaseRequest(`accounts?id=eq.${userId}&select=tickets_with_table&limit=1`); withTable=a?.[0]?.tickets_with_table||false; } catch(e) {}
      }

      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-5" style="max-width:380px">
        <h3 class="text-sm font-bold text-gray-800 mb-1">Nome no ticket</h3>
        <p class="text-xs text-gray-500 mb-2">Pode editar antes de gerar — ex: "Araújo e esposa"</p>
        <input id="ticket-name-edit" class="input-field mb-2" value="${escapeHTML(guestName)}">
        ${withTable ? `<input id="ticket-table-edit" class="input-field mb-3" placeholder="Mesa (ex: Mesa 5, VIP, Mesa dos Noivos)">` : '<div class="mb-3"></div>'}
        <div class="flex gap-2">
          <button class="flex-1 btn-main" onclick="(()=>{
            const n=document.getElementById('ticket-name-edit').value.trim()||'${escapeHTML(guestName)}';
            const t=document.getElementById('ticket-table-edit')?.value.trim()||null;
            this.closest('.modal-overlay').remove();
            generateGuestTicket(n,'${rsvpToken}','${eventId||''}',true,t);
          })()">Gerar Ticket</button>
          <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
      setTimeout(() => document.getElementById('ticket-name-edit')?.select(), 50);
    });
  }
  const ev = Store.events.find(e => e.id === (eventId || Store.currentEventId));
  if (!ev) { toast('Evento não encontrado.'); return; }

  // ✅ Verificar limite de tickets da conta
  try {
    const userId = ev.user_id || ev.userId;
    if (userId && !Store.adminModeActive) {
      const acc = await supabaseRequest(`accounts?id=eq.${userId}&select=ticket_limit&limit=1`);
      const limit = acc?.[0]?.ticket_limit ?? 50;
      const issued = await supabaseRequest(`rsvps?event_id=eq.${ev.id}&ticket_issued=eq.true&select=rsvp_token`);
      const count  = (issued||[]).length;
      if (count >= limit) {
        toast(`Limite de ${limit} tickets atingido. Contacta o suporte para aumentar.`);
        return;
      }
    }
  } catch(e) { console.warn('Ticket limit check failed:', e); }

  // ✅ Sempre recarregar os campos do ticket para garantir que ticket_name_font
  // e outros campos estão actualizados (evita usar dados cached desactualizados)
  try {
    const fresh = await supabaseRequest(`events?id=eq.${ev.id}&select=ticket_template_url,ticket_name_x,ticket_name_y,ticket_qr_x,ticket_qr_y,ticket_name_size,ticket_qr_size,ticket_name_color,ticket_name_font,scanner_token,ticket_table_x,ticket_table_y,ticket_table_size,ticket_table_color&limit=1`);
    if (fresh && fresh[0]) {
      Object.assign(ev, fresh[0]);
      console.log('[TICKET] ticket_name_font carregado:', fresh[0].ticket_name_font);
    }
  } catch(e) { console.warn('[TICKET] Falha ao recarregar campos do ticket:', e); }

  if (!ev.ticket_template_url) {
    toast('Configure o template PDF primeiro.');
    return;
  }

  toast('A gerar ticket...');
  try {
    // Verificar se as bibliotecas estão carregadas
    // ✅ Carregar pdf-lib lazily se ainda não estiver carregado
    await _loadPdfLib().catch(() => {});
    if (typeof PDFLib === 'undefined') { toast('Biblioteca PDF não carregada. Aguarda e tenta novamente.'); return; }
    if (typeof QRCode === 'undefined') { toast('Biblioteca QR não carregada. Aguarda e tenta novamente.'); return; }

    const { PDFDocument, rgb, StandardFonts } = PDFLib;

    // 1. Carregar template
    const templateBytes = await fetch(ev.ticket_template_url).then(r => r.arrayBuffer());
    const doc  = await PDFDocument.load(templateBytes);
    const page = doc.getPages()[0];
    const { width, height } = page.getSize();

    // 2. Gerar QR code com token encriptado
    let scannerToken = ev.scanner_token;
    if (!scannerToken) {
      scannerToken = (crypto.randomUUID ? crypto.randomUUID() : uid() + '-' + uid());
      await supabaseRequest(`events?id=eq.${ev.id}`, 'PATCH', { scanner_token: scannerToken });
      ev.scanner_token = scannerToken;
    }
    const encryptedPayload = await _encryptToken(rsvpToken, scannerToken);

    // ✅ QRCode.toDataURL — API do npm qrcode@1.5.3: primeiro o texto, depois as opções
    const qrDataUrl = await QRCode.toDataURL(encryptedPayload, {
      width: 256, margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });
    const qrBytes = _dataUrlToBytes(qrDataUrl);
    const qrImage = await doc.embedPng(qrBytes);

    // 3. Escrever nome com a fonte e cor escolhidas
    const fontName = ev.ticket_name_font || 'Helvetica';
    const fontMap = {
      'Helvetica': StandardFonts.Helvetica,
      'Helvetica-Bold': StandardFonts.HelveticaBold,
      'Times-Roman': StandardFonts.TimesRoman,
      'Times-Bold': StandardFonts.TimesRomanBold,
      'Courier': StandardFonts.Courier,
    };

    let font;
    const isCustomFont = fontName.startsWith('custom:') || 
                         fontName.startsWith('http') || 
                         fontName.startsWith('//');
    if (isCustomFont) {
      // Fonte personalizada — carregar do URL e incorporar no PDF
      try {
        let fontUrl = null;
        if (fontName.startsWith('http') || fontName.startsWith('//')) {
          fontUrl = fontName; // URL directo
        } else if (fontName.startsWith('custom:')) {
          const name = fontName.replace('custom:', '');
          const fontRecord = (Store.availableFonts||[]).find(f => f.name === name);
          fontUrl = fontRecord?.url;
        }
        if (fontUrl) {
          const fontBytes = await fetch(fontUrl).then(r => r.arrayBuffer());
          font = await doc.embedFont(fontBytes);
          console.log('[TICKET] Fonte personalizada incorporada:', fontUrl);
        } else {
          console.warn('[TICKET] URL da fonte não encontrado para:', fontName);
          font = await doc.embedFont(StandardFonts.Helvetica);
        }
      } catch(e) {
        console.warn('[TICKET] Falha ao carregar fonte personalizada, usando Helvetica:', e);
        font = await doc.embedFont(StandardFonts.Helvetica);
      }
    } else {
      font = await doc.embedFont(fontMap[fontName] || StandardFonts.Helvetica);
    }
    const nameSize = ev.ticket_name_size || 24;

    // Converter cor hex para rgb (0-1)
    const hexColor = ev.ticket_name_color || '#000000';
    const hr = parseInt(hexColor.slice(1,3),16)/255;
    const hg = parseInt(hexColor.slice(3,5),16)/255;
    const hb = parseInt(hexColor.slice(5,7),16)/255;

    const nx = (ev.ticket_name_x || 0.5) * width;
    const ny = height - (ev.ticket_name_y || 0.75) * height;
    const textW = font.widthOfTextAtSize(guestName, nameSize);
    page.drawText(guestName, {
      x: nx - textW / 2,
      y: ny - nameSize / 2,
      size: nameSize,
      font,
      color: rgb(hr, hg, hb),
    });

    // 4. Desenhar QR code
    const qrSize = ev.ticket_qr_size || 80;
    const qx = (ev.ticket_qr_x || 0.5) * width  - qrSize / 2;
    const qy = height - (ev.ticket_qr_y || 0.85) * height - qrSize / 2;
    page.drawImage(qrImage, { x: qx, y: qy, width: qrSize, height: qrSize });

    // 4b. Desenhar mesa (apenas se preenchida)
    const tableName = typeof skipNameEdit === 'string' ? skipNameEdit : null;  // 5.º arg é tableName
    if (tableName && ev.ticket_table_x !== undefined) {
      const tableSize  = ev.ticket_table_size || 18;
      const tableFontP = PDFLib.PDFDocument;
      const tHexColor  = (ev.ticket_table_color || '#000000').replace('#','');
      const tr = parseInt(tHexColor.slice(0,2),16)/255;
      const tg = parseInt(tHexColor.slice(2,4),16)/255;
      const tb = parseInt(tHexColor.slice(4,6),16)/255;
      const tx  = (ev.ticket_table_x || 0.5) * width;
      const ty  = height - (ev.ticket_table_y || 0.9) * height;
      const tw  = font.widthOfTextAtSize(tableName, tableSize);
      page.drawText(tableName, {
        x: tx - tw / 2,
        y: ty - tableSize / 2,
        size: tableSize,
        font,
        color: rgb(tr, tg, tb),
      });
    }

    // 5. Download directo — ZERO upload para o Supabase
    const pdfBytes = await doc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${guestName}.pdf`;  // ✅ Apenas o nome, sem prefixo
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    // ✅ Marcar como "ticket emitido"
    supabaseRequest(
      `rsvps?rsvp_token=eq.${rsvpToken}&event_id=eq.${ev.id}`,
      'PATCH',
      { ticket_issued: true, ticket_issued_at: new Date().toISOString() }
    ).catch(() => {});

    toast(`Ticket gerado: ${guestName}`);
  } catch(e) {
    console.error('generateGuestTicket error:', e);
    toast('Erro ao gerar ticket: ' + (e.message || String(e)));
  }
}

function _dataUrlToBytes(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary  = atob(base64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── 3. SCANNER QR NA PORTA ───────────────────────────────────────────────
// ── Cache local do scanner (localStorage) ─────────────────────────────
const _SC_CACHE_KEY   = (t) => `adk_scanner_${t}`;
const _SC_CHECKIN_KEY = (t) => `adk_checkin_queue_${t}`;

function _scSaveCache(scannerToken, data) {
  try { localStorage.setItem(_SC_CACHE_KEY(scannerToken), JSON.stringify(data)); } catch(e) {}
}
function _scLoadCache(scannerToken) {
  try { return JSON.parse(localStorage.getItem(_SC_CACHE_KEY(scannerToken)) || 'null'); } catch(e) { return null; }
}
function _scSaveCheckinQueue(scannerToken, queue) {
  try { localStorage.setItem(_SC_CHECKIN_KEY(scannerToken), JSON.stringify(queue)); } catch(e) {}
}
function _scLoadCheckinQueue(scannerToken) {
  try { return JSON.parse(localStorage.getItem(_SC_CHECKIN_KEY(scannerToken)) || '[]'); } catch(e) { return []; }
}

async function checkAndInitScanner() {
  const params = new URLSearchParams(window.location.search);
  const scannerToken = params.get('scanner');
  if (!scannerToken) return false;

  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;padding:0;font-family:sans-serif;background:#0f172a;min-height:100vh;color:#fff;display:flex;align-items:center;justify-content:center';
  document.body.innerHTML = `<p style="color:#6b7280;font-size:0.9rem">A carregar scanner...</p>`;

  let cache = _scLoadCache(scannerToken);
  const isOnline = navigator.onLine;

  if (isOnline) {
    // ── Online: carregar dados frescos e actualizar cache ──────────────
    try {
      const rows = await supabaseRequest(`events?scanner_token=eq.${scannerToken}&select=id,title,event_color&limit=1`);
      if (!rows || !rows.length) {
        document.body.innerHTML = `<div style="text-align:center"><p style="font-size:2rem">🚫</p><p style="font-weight:700;color:#dc2626">Link inválido</p><p style="color:#6b7280;font-size:0.85rem">Token não encontrado.</p></div>`;
        return true;
      }
      const ev = rows[0];
      // ✅ Só carregar convidados que já têm ticket emitido pelo dono do evento
      const rsvps = await supabaseRequest(`rsvps?event_id=eq.${ev.id}&ticket_issued=eq.true&select=rsvp_token,guest_name,checked_in&limit=2000`);
      // Guardar em cache local — indexado por rsvp_token para O(1) lookup
      const rsvpMap = {};
      (rsvps || []).forEach(r => { rsvpMap[r.rsvp_token] = { name: r.guest_name, checkedIn: r.checked_in || false, companionCheckedIn: false, scanCount: 0 }; });
      cache = { ev, rsvpMap, cachedAt: Date.now() };
      _scSaveCache(scannerToken, cache);
      // Sincronizar fila de check-ins pendentes (feitos offline)
      await _scSyncQueue(scannerToken, ev.id);
    } catch(e) {
      if (!cache) {
        document.body.innerHTML = `<div style="text-align:center"><p style="font-size:2rem">⚠️</p><p style="font-weight:700;color:#f59e0b">Sem ligação</p><p style="color:#6b7280;font-size:0.85rem">Não foi possível carregar. Liga a internet e tenta novamente.</p></div>`;
        return true;
      }
    }
  } else {
    // ── Offline ────────────────────────────────────────────────────────
    if (!cache) {
      document.body.innerHTML = `<div style="text-align:center"><p style="font-size:2rem">📵</p><p style="font-weight:700;color:#f59e0b">Sem ligação e sem cache</p><p style="color:#6b7280;font-size:0.85rem">Abre o scanner uma vez com internet para activar o modo offline.</p></div>`;
      return true;
    }
  }

  _renderScannerUI(cache.ev, scannerToken, cache, isOnline);
  return true;
}

// Sincronizar check-ins feitos offline quando voltar a ter internet
async function _scSyncQueue(scannerToken, eventId) {
  const queue = _scLoadCheckinQueue(scannerToken);
  if (!queue.length) return;
  const remaining = [];
  for (const rsvpToken of queue) {
    try {
      await supabaseRequest(
        `rsvps?rsvp_token=eq.${rsvpToken}&event_id=eq.${eventId}`,
        'PATCH',
        { checked_in: true, checked_in_at: new Date().toISOString() }
      );
    } catch(e) { remaining.push(rsvpToken); }
  }
  _scSaveCheckinQueue(scannerToken, remaining);
  if (queue.length > remaining.length) {
    console.log(`[Scanner] Sincronizados ${queue.length - remaining.length} check-ins offline.`);
  }
}

function _renderScannerUI(ev, scannerToken, cache, isOnline) {
  const C      = ev.event_color || '#5aa189';
  const total  = Object.keys(cache.rsvpMap || {}).length;
  const countIn= Object.values(cache.rsvpMap || {}).filter(r => r.checkedIn).length;
  const pct    = total ? Math.round(countIn / total * 100) : 0;

  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;padding:0;font-family:Inter,sans-serif;background:#f9fafb;min-height:100vh;color:#111827';
  document.head.insertAdjacentHTML('beforeend',
    '' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap">' +
    `<style>
      *{box-sizing:border-box}
      .sc-tab-btn{flex:1;padding:12px 16px;font-size:14px;font-weight:500;border:none;border-bottom:2px solid transparent;background:none;cursor:pointer;color:#6b7280;transition:all .2s;border-radius:8px 8px 0 0}
      .sc-tab-btn.active{color:${C};border-bottom-color:${C};background:${C}18}
      .sc-card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:16px;overflow:hidden}
      .sc-badge-online{display:inline-flex;align-items:center;gap:6px;background:#f0fdf4;color:#065f46;border:1px solid #86efac;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:600}
      .sc-badge-offline{display:inline-flex;align-items:center;gap:6px;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:600}
      .sc-sync-bar{position:fixed;top:0;left:0;right:0;background:#7c3aed;color:#fff;text-align:center;padding:8px;font-size:13px;font-weight:600;z-index:9999;transform:translateY(-100%);transition:transform .3s}
      .sc-sync-bar.visible{transform:translateY(0)}
      .sc-result-box{border-radius:10px;padding:16px;text-align:center;border-left:4px solid;transition:all .3s}
      .sc-btn{width:100%;padding:14px;font-size:16px;font-weight:600;border-radius:12px;border:none;cursor:pointer;transition:all .2s;touch-action:manipulation}
      .sc-guest-row{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid #f3f4f6}
      .sc-guest-row:last-child{border-bottom:none}
    </style>`
  );

  document.body.innerHTML = `
    <div class="sc-sync-bar" id="scSyncBar">🔄 <span id="scSyncTxt">0 scans por sincronizar</span> — a aguardar ligação...</div>

    <!-- Header -->
    <header style="background:#fff;border-bottom:1px solid #e5e7eb;position:sticky;top:0;z-index:50">
      <div style="max-width:768px;margin:0 auto;padding:0 16px;display:flex;justify-content:space-between;align-items:center;height:56px">
        <div style="display:flex;align-items:center;gap:10px;min-width:0">
          <h1 style="font-size:17px;font-weight:600;color:#111827;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(ev.title||'Evento')}</h1>
          <span id="scOnlineBadge" class="${isOnline?'sc-badge-online':'sc-badge-offline'}">
            <span id="scDot" style="width:8px;height:8px;border-radius:50%;background:${isOnline?'#22c55e':'#f59e0b'};display:inline-block"></span>
            <span id="scStatusTxt">${isOnline?'Online':'Offline'}</span>
          </span>
        </div>
        <div style="font-size:13px;color:#6b7280;white-space:nowrap"><span id="scCountIn">${countIn}</span> / <span id="scCountTotal">${total}</span></div>
      </div>
      <!-- Tabs -->
      <div style="max-width:768px;margin:0 auto;padding:0 16px;display:flex;gap:0">
        <button class="sc-tab-btn active" id="tabBtnScanner" onclick="_scTab('scanner')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;flex-shrink:0"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="16" y="16" width="3" height="3" fill="currentColor" stroke="none"/><rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none"/></svg>Scanner</button>
        <button class="sc-tab-btn" id="tabBtnOpcoes" onclick="_scTab('opcoes')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;flex-shrink:0"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>Opções</button>
      </div>
    </header>

    <!-- Scanner Tab -->
    <div id="tabScanner" style="max-width:768px;margin:0 auto;padding:16px;padding-bottom:120px">
      <div class="sc-card" style="padding:16px">
        <!-- Botão check-in manual -->
        <button onclick="_scOpenManual()" style="width:100%;margin-bottom:12px;padding:12px 16px;border-radius:10px;border:2px solid ${C};color:${C};background:${C}10;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>Pesquisar por nome
        </button>
        <!-- Câmara com resultado sobreposto -->
        <div id="scanner-reader" style="border-radius:12px;overflow:hidden;background:#111827;aspect-ratio:4/3;max-width:480px;margin:0 auto;display:flex;align-items:center;justify-content:center;position:relative">
          <div style="text-align:center;color:#6b7280">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto 12px"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="16" y="16" width="3" height="3" fill="currentColor" stroke="none"/><rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none"/></svg>
            <p>A inicializar câmara...</p>
          </div>
          <!-- Resultado sobreposto na câmara -->
          <div id="scanner-result" style="display:none;position:absolute;bottom:0;left:0;right:0;padding:16px 20px;text-align:center;backdrop-filter:blur(4px);z-index:10;transition:all .3s"></div>
        </div>
      </div>

      <!-- Progresso -->
      <div class="sc-card" style="padding:16px">
        <h3 style="font-size:14px;font-weight:600;color:#374151;margin:0 0 12px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Progresso
        </h3>
        <div style="text-align:center;margin-bottom:12px">
          <div id="scPct" style="font-size:32px;font-weight:700;color:#2563eb">${pct}%</div>
          <div style="font-size:13px;color:#6b7280">Concluído</div>
        </div>
        <div style="background:#e5e7eb;border-radius:999px;height:10px;margin-bottom:12px">
          <div id="scProgressBar" style="height:10px;border-radius:999px;transition:width .5s;background:linear-gradient(90deg,${C},${C}cc);width:${pct}%"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="padding:12px;border-radius:10px;text-align:center;background:${C}15">
            <div id="scCountInCard" style="font-size:22px;font-weight:700;color:${C}">${countIn}</div>
            <div style="font-size:12px;color:${C}cc">Escaneados</div>
          </div>
          <div style="padding:12px;border-radius:10px;text-align:center;background:#eff6ff">
            <div id="scCountTotalCard" style="font-size:22px;font-weight:700;color:#2563eb">${total}</div>
            <div style="font-size:12px;color:#3b82f6">Total</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Opções Tab -->
    <div id="tabOpcoes" style="display:none;max-width:768px;margin:0 auto;padding:16px">

      <!-- Estatísticas -->
      <div class="sc-card" style="padding:16px;margin-bottom:16px">
        <h2 style="font-size:16px;font-weight:600;color:#111827;margin:0 0 16px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>Estatísticas
        </h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center">
            <div id="scStatIn" style="font-size:28px;font-weight:700;color:#16a34a">${countIn}</div>
            <div style="font-size:13px;color:#15803d">Entradas</div>
          </div>
          <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:16px;text-align:center">
            <div id="scStatPending" style="font-size:28px;font-weight:700;color:#ca8a04">${total-countIn}</div>
            <div style="font-size:13px;color:#a16207">Por entrar</div>
          </div>
        </div>
        <div id="scQueueInfo" style="display:none;padding:10px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span id="scQueueCount">0</span> scans por sincronizar
        </div>
      </div>

      <!-- Lista de Convidados -->
      <div class="sc-card">
        <div style="padding:16px;border-bottom:1px solid #f3f4f6;background:linear-gradient(to right,#eff6ff,#f5f3ff)">
          <h2 style="font-size:16px;font-weight:600;color:#111827;margin:0 0 12px;display:flex;align-items:center;gap:8px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Lista de Convidados
          </h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input type="text" id="scSearch" placeholder="Procurar convidado..." oninput="_scRenderGuests()" style="flex:1;min-width:160px;padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none">
            <select id="scFilter" onchange="_scRenderGuests()" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;outline:none">
              <option value="all">Todos</option>
              <option value="in">Entrou</option>
              <option value="pending">Por entrar</option>
            </select>
          </div>
        </div>
        <div id="scGuestList" style="max-height:380px;overflow-y:auto">
          <div style="text-align:center;color:#9ca3af;padding:32px">A carregar...</div>
        </div>
      </div>

      <!-- Configurações -->
      <div class="sc-card" style="padding:16px;margin-top:16px">
        <h2 style="font-size:16px;font-weight:600;color:#111827;margin:0 0 16px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>Feedback
        </h2>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:8px">
          <div><b style="font-size:14px">🔊 Som</b><div style="font-size:12px;color:#6b7280">Feedback sonoro nos scans</div></div>
          <input type="checkbox" id="scSoundToggle" checked style="width:18px;height:18px;cursor:pointer" onchange="window._scSound=this.checked">
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px">
          <div><b style="font-size:14px">📳 Vibração</b><div style="font-size:12px;color:#6b7280">Feedback tátil nos scans</div></div>
          <input type="checkbox" id="scVibToggle" checked style="width:18px;height:18px;cursor:pointer" onchange="window._scVib=this.checked">
        </div>
      </div>

      <!-- Acções rápidas -->
      <div class="sc-card" style="padding:16px;margin-top:16px">
        <h2 style="font-size:16px;font-weight:600;color:#111827;margin:0 0 16px;display:flex;align-items:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>Acções Rápidas
        </h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button onclick="_scRefreshCache('${scannerToken}')" style="padding:14px;background:#4b5563;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>Actualizar
          </button>
          <button onclick="_scSyncQueue('${scannerToken}','${ev.id}').then(()=>toast('Sincronizado!'))" style="padding:14px;background:#16a34a;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>Sincronizar
          </button>
        </div>
        <button onclick="_scDownloadReport('${ev.id}','${escapeHTML(ev.title||'Evento')}')" style="margin-top:10px;width:100%;padding:14px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descarregar Relatório PDF
        </button>
        <button onclick="_scUndoScans('${scannerToken}','${ev.id}')" id="scUndoBtn" style="margin-top:8px;width:100%;padding:14px;background:#dc2626;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
          <span id="scUndoLabel">Desfazer todos os scans</span>
        </button>
        <p id="scUndoInfo" style="text-align:center;font-size:12px;color:#6b7280;margin-top:6px">A carregar usos restantes...</p>
      </div>
    </div>

    <!-- Modal check-in manual -->
    <div id="scManualModal" style="display:none;position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);padding:16px;align-items:center;justify-content:center">
      <div style="background:#fff;border-radius:16px;padding:24px;width:100%;max-width:380px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 style="font-size:18px;font-weight:700;margin:0;display:flex;align-items:center;gap:8px">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${C}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>Check-in Manual
          </h2>
          <button onclick="document.getElementById('scManualModal').style.display='none'" style="background:#f3f4f6;border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:16px">×</button>
        </div>
        <input type="text" id="scManualInput" placeholder="Pesquisar nome do convidado..."
          oninput="_scManualSearch('${scannerToken}','${ev.id}')"
          style="width:100%;padding:12px;border:2px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;margin-bottom:12px">
        <div id="scManualResults" style="max-height:256px;overflow-y:auto;border-radius:10px;border:1px solid #f3f4f6"></div>
      </div>
    </div>

`;

  // Guardar referências globais para uso nas funções
  window._scCache = cache;
  window._scSound = true;
  window._scVib   = true;

  // Carregar usos restantes do desfazer
  _scLoadUndoRemaining(ev.id);

  // Renderizar lista de convidados
  _scRenderGuests();

  // Actualizações de rede
  window.addEventListener('online', async () => {
    document.getElementById('scOnlineBadge').className = 'sc-badge-online';
    document.getElementById('scDot').style.background = '#22c55e';
    document.getElementById('scStatusTxt').textContent = 'Online';
    await _scSyncQueue(scannerToken, ev.id);
    _scUpdateSyncBadge(scannerToken);
  });
  window.addEventListener('offline', () => {
    document.getElementById('scOnlineBadge').className = 'sc-badge-offline';
    document.getElementById('scDot').style.background = '#f59e0b';
    document.getElementById('scStatusTxt').textContent = 'Offline';
  });

  _scUpdateSyncBadge(scannerToken);

  // ✅ Restaurar aba guardada (evita voltar ao Scanner ao fazer refresh)
  const _savedTab = sessionStorage.getItem('sc_active_tab') || 'scanner';
  if (_savedTab === 'opcoes') setTimeout(() => _scTab('opcoes'), 100);

  // Botão próximo scan (mobile)
  const nextBtnDiv = document.createElement('div');
  nextBtnDiv.id = 'scNextBtn';
  nextBtnDiv.style.cssText = 'display:block;position:fixed;bottom:0;left:0;right:0;background:#fff;padding:16px;border-top:1px solid #e5e7eb;z-index:50';
  nextBtnDiv.innerHTML = `<button onclick="_scNextScan()" style="width:100%;padding:16px;background:${C};color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>Próximo Scan</button>`;
  document.body.appendChild(nextBtnDiv);

  // ✅ Realtime — sincronizar check-ins de outros leitores do mesmo evento
  // Quando 4 pessoas estão a escanear ao mesmo tempo, cada uma vê as entradas das outras
  if (isOnline && window.supabase) {
    try {
      window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        .channel('scanner-' + ev.id)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'rsvps',
          filter: `event_id=eq.${ev.id}`
        }, (payload) => {
          const r = payload.new;
          if (!r || !r.rsvp_token) return;
          const entry = cache.rsvpMap[r.rsvp_token];
          if (entry && r.checked_in && !entry.checkedIn) {
            entry.checkedIn = true;
            _scSaveCache(scannerToken, cache);
            window._scCache = cache;
            _scUpdateCounters(cache);
            _scRenderGuests();
          }
        })
        .subscribe();
    } catch(e) { console.warn('[Scanner] Realtime init failed:', e); }
  }

  // Iniciar câmara
  const readerEl = document.getElementById('scanner-reader');
  readerEl.style.cssText = 'border-radius:12px;overflow:hidden;background:#111827;aspect-ratio:4/3;max-width:480px;margin:0 auto;position:relative';
  readerEl.innerHTML = `
    <video id="sc-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;display:block"></video>
    <canvas id="sc-canvas" style="display:none"></canvas>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
      <div id="sc-viewfinder" style="width:220px;height:220px;border:3px solid ${C};border-radius:12px;box-shadow:0 0 0 4000px rgba(0,0,0,0.4);transition:border-color .2s"></div>
    </div>
    <div id="scanner-result" style="display:none;position:absolute;bottom:0;left:0;right:0;padding:20px;text-align:center;z-index:10;border-radius:0 0 12px 12px"></div>`;

  const video  = document.getElementById('sc-video');
  const canvas = document.getElementById('sc-canvas');
  const ctx    = canvas.getContext('2d', { willReadFrequently: true });
  let scanning = true;

  const _doScan = async () => {
    if (!scanning || _scannerCooldown) return;
    if (video.readyState < 2) return;

    // Tentar BarcodeDetector no canvas (mais fiável que no video directamente)
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const codes = await detector.detect(canvas);  // ← canvas, não video
        if (codes.length > 0) {
          scanning = false;
          // Piscar o viewfinder a verde
          const vf = document.getElementById('sc-viewfinder');
          if (vf) { vf.style.borderColor = '#22c55e'; setTimeout(() => { if(vf) vf.style.borderColor = '${C}'; }, 600); }
          await _onQrScanned(codes[0].rawValue, ev.id, C, scannerToken, cache);
          setTimeout(() => { scanning = true; }, 2800);
        }
      }
    } catch(e) {}
  };

  // Scan a cada 250ms (não requestAnimationFrame — mais estável em Android)
  const _scanInterval = setInterval(_doScan, 250);
  window._scScanInterval = _scanInterval; // guardar para poder parar

  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
    .then(stream => {
      video.srcObject = stream;
      video.play();

      // ✅ Reactivar câmara quando o ecrã desbloquear / voltar ao separador
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (video.paused || video.ended || !video.srcObject) {
            navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment' }, audio: false })
              .then(s => { video.srcObject = s; video.play(); })
              .catch(() => {});
          } else {
            video.play().catch(() => {});
          }
        }
      });
    })
    .catch(err => {
      readerEl.innerHTML = `<div style="padding:24px;text-align:center;color:#ef4444">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto 12px"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/><path d="M7.9 4H14a2 2 0 0 1 2 2v4.1"/><path d="m22 8-6 4 6 4V8z"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
        <p style="font-size:14px;font-weight:700;margin-bottom:4px">Sem acesso à câmara</p>
        <p style="font-size:12px;color:#9ca3af">${err.message||err}</p>
      </div>`;
      clearInterval(_scanInterval);
    });
}

// Funções auxiliares do novo scanner
function _scTab(tab) {
  document.getElementById('tabScanner').style.display = tab==='scanner'?'block':'none';
  document.getElementById('tabOpcoes').style.display  = tab==='opcoes' ?'block':'none';
  document.getElementById('tabBtnScanner').classList.toggle('active', tab==='scanner');
  document.getElementById('tabBtnOpcoes').classList.toggle('active', tab==='opcoes');
  // Ocultar botão Próximo na aba Opções
  const nb = document.getElementById('scNextBtn');
  if (nb) nb.style.display = tab==='opcoes' ? 'none' : 'block';
  try { sessionStorage.setItem('sc_active_tab', tab); } catch(e) {}
}

function _scUpdateCounters(cache) {
  const total   = Object.keys(cache.rsvpMap||{}).length;
  const countIn = Object.values(cache.rsvpMap||{}).filter(r=>r.checkedIn).length;
  const pct     = total ? Math.round(countIn/total*100) : 0;
  ['scCountIn','scCountInCard','scStatIn'].forEach(id => { const e=document.getElementById(id); if(e)e.textContent=countIn; });
  ['scCountTotal','scCountTotalCard'].forEach(id => { const e=document.getElementById(id); if(e)e.textContent=total; });
  const sp=document.getElementById('scStatPending'); if(sp)sp.textContent=total-countIn;
  const pb=document.getElementById('scProgressBar'); if(pb)pb.style.width=pct+'%';
  const pp=document.getElementById('scPct'); if(pp)pp.textContent=pct+'%';
}

function _scUpdateSyncBadge(scannerToken) {
  const q = _scLoadCheckinQueue(scannerToken);
  const bar=document.getElementById('scSyncBar');
  const qi=document.getElementById('scQueueInfo');
  const qc=document.getElementById('scQueueCount');
  if(q.length) {
    if(bar){ document.getElementById('scSyncTxt').textContent=`${q.length} scans por sincronizar`; bar.classList.add('visible'); }
    if(qi)qi.style.display='block';
    if(qc)qc.textContent=q.length;
  } else {
    if(bar)bar.classList.remove('visible');
    if(qi)qi.style.display='none';
  }
}

function _scRenderGuests() {
  const cache  = window._scCache;
  const list   = document.getElementById('scGuestList');
  if (!list || !cache) return;
  const search = (document.getElementById('scSearch')?.value||'').toLowerCase();
  const filter = document.getElementById('scFilter')?.value||'all';
  const guests = Object.entries(cache.rsvpMap||{})
    .filter(([,r]) => r.name.toLowerCase().includes(search))
    .filter(([,r]) => filter==='all'||(filter==='in'&&r.checkedIn)||(filter==='pending'&&!r.checkedIn))
    .sort((a,b) => a[1].name.localeCompare(b[1].name));
  if (!guests.length) { list.innerHTML='<div style="text-align:center;color:#9ca3af;padding:24px;font-size:13px">Nenhum convidado encontrado</div>'; return; }
  list.innerHTML = guests.map(([tok,r]) => `<div class="sc-guest-row">
    <div style="width:36px;height:36px;border-radius:50%;background:${r.checkedIn?'#dcfce7':'#f3f4f6'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
      ${r.checkedIn?'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>':'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'}
    </div>
    <div style="flex:1;min-width:0">
      <p style="font-size:14px;font-weight:500;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(r.name)}</p>
      <p style="font-size:12px;color:${r.checkedIn?'#16a34a':'#9ca3af'};margin:0">${r.checkedIn?'✅ Entrou':'⏳ Por entrar'}</p>
    </div>
  </div>`).join('');
}

function _scOpenManual() {
  const modal = document.getElementById('scManualModal');
  if (modal) { modal.style.display='flex'; document.getElementById('scManualInput').focus(); }
}

function _scManualSearch(scannerToken, eventId) {
  const cache   = window._scCache;
  const q       = (document.getElementById('scManualInput')?.value || '').toLowerCase().trim();
  const res     = document.getElementById('scManualResults');
  const evColor = window._scEvColor || '#5aa189';
  if (!res || !cache) return;

  if (q.length < 1) {
    res.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:16px;font-size:13px">Escreve o nome do convidado</div>';
    return;
  }

  const matches = Object.entries(cache.rsvpMap || {})
    .filter(([, r]) => r.name.toLowerCase().includes(q))
    .slice(0, 12);

  if (!matches.length) {
    res.innerHTML = '<div style="text-align:center;color:#9ca3af;padding:16px;font-size:13px">Nenhum convidado encontrado</div>';
    return;
  }

  res.innerHTML = matches.map(([tok, r]) => {
    const done = r.checkedIn;
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #f3f4f6;background:${done?'#f9fafb':'#fff'}">
      <div>
        <span style="font-size:14px;font-weight:600;color:${done?'#9ca3af':'#111827'}">${escapeHTML(r.name)}</span>
        ${done ? '<span style="font-size:11px;color:#16a34a;display:block">✓ Já entrou</span>' : ''}
      </div>
      ${done
        ? `<span style="font-size:12px;color:#9ca3af;padding:6px 12px">Entrou</span>`
        : `<button data-tok="${tok}" onclick="_scManualCheckin('${scannerToken}','${eventId}',this.dataset.tok)"
            style="padding:8px 16px;background:${evColor};color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer">
            Check-in
          </button>`
      }
    </div>`;
  }).join('');
}

async function _scManualCheckin(scannerToken, eventId, rsvpToken) {
  const cache = window._scCache;
  if (!cache || !cache.rsvpMap[rsvpToken]) return;

  const rsvp = cache.rsvpMap[rsvpToken];
  const hasCompanion  = / e /i.test(rsvp.name);
  const mainName      = hasCompanion ? rsvp.name.split(/ e /i)[0].trim() : rsvp.name;
  const companionName = hasCompanion ? rsvp.name.split(/ e /i).slice(1).join(' e ').trim() : '';

  document.getElementById('scManualModal').style.display = 'none';

  if (hasCompanion) {
    // Perguntar sobre acompanhante — mostrar na câmara
    _scShowResult('success', mainName, `Veio com ${companionName}?`, 0);
    const resultEl = document.getElementById('scanner-result');
    if (resultEl) {
      const evColor = window._scEvColor || '#5aa189';
      resultEl.innerHTML += `
        <div style="display:flex;gap:10px;justify-content:center;margin-top:12px">
          <button onclick="window._scManualCompanionAnswer('${scannerToken}','${eventId}','${rsvpToken}',true)" style="flex:1;max-width:140px;padding:10px;background:#fff;color:#16a34a;border:none;border-radius:10px;font-weight:800;font-size:15px;cursor:pointer">✓ Sim</button>
          <button onclick="window._scManualCompanionAnswer('${scannerToken}','${eventId}','${rsvpToken}',false)" style="flex:1;max-width:140px;padding:10px;background:rgba(255,255,255,0.3);color:#fff;border:none;border-radius:10px;font-weight:800;font-size:15px;cursor:pointer">Não</button>
        </div>`;
    }
    window._scManualCompanionAnswer = async (st, evId, tok, companionCame) => {
      delete window._scManualCompanionAnswer;
      cache.rsvpMap[tok].checkedIn = true;
      cache.rsvpMap[tok].companionCheckedIn = companionCame;
      _scSaveCache(st, cache);
      window._scCache = cache;
      _scUpdateCounters(cache);
      _scRenderGuests();
      const sub = companionCame ? `${mainName} + ${companionName}` : `${mainName} (acompanhante virá depois)`;
      _scShowResult('success', 'Entrada permitida', sub, 4000);
      const patch = { checked_in: true, checked_in_at: new Date().toISOString() };
      if (companionCame) Object.assign(patch, { companion_checked_in: true, companion_checked_in_at: new Date().toISOString() });
      if (navigator.onLine) supabaseRequest(`rsvps?rsvp_token=eq.${tok}&event_id=eq.${evId}`, 'PATCH', patch).catch(()=>{});
    };
    return;
  }

  // Sem acompanhante — check-in directo
  cache.rsvpMap[rsvpToken].checkedIn = true;
  _scSaveCache(scannerToken, cache);
  window._scCache = cache;
  _scUpdateCounters(cache);
  _scRenderGuests();
  _scShowResult('success', rsvp.name, 'Check-in manual realizado!');
  if (navigator.onLine) {
    supabaseRequest(`rsvps?rsvp_token=eq.${rsvpToken}&event_id=eq.${eventId}`, 'PATCH',
      { checked_in: true, checked_in_at: new Date().toISOString() }).catch(() => {});
  } else {
    const q = [..._scLoadCheckinQueue(scannerToken), rsvpToken];
    _scSaveCheckinQueue(scannerToken, q);
    _scUpdateSyncBadge(scannerToken);
  }
}

function _scNextScan() {
  document.getElementById('scNextBtn').style.display='none';
  document.getElementById('scanner-result').innerHTML = `<div style="text-align:center;color:#9ca3af;padding:24px">
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;margin:0 auto 8px"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="5" y="5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="16" y="5" width="3" height="3" fill="currentColor" stroke="none"/><rect x="16" y="16" width="3" height="3" fill="currentColor" stroke="none"/><rect x="5" y="16" width="3" height="3" fill="currentColor" stroke="none"/></svg>
    <p style="font-size:14px;margin:0">Aguardando scan...</p>
  </div>`;
}

function _scShowResult(type, title, subtitle, duration=3500) {
  const el = document.getElementById('scanner-result');
  if (!el) return;
  const isGood = type==='success'||type==='companion';
  const textColor = isGood ? '#16a34a' : (type==='already' ? '#2563eb' : '#dc2626');
  el.style.cssText = 'display:block;position:absolute;bottom:16px;left:16px;right:16px;padding:14px 18px;text-align:center;background:rgba(0,0,0,0.72);backdrop-filter:blur(6px);z-index:10;border-radius:12px;border:1.5px solid rgba(255,255,255,0.15)';
  el.innerHTML = `
    <div style="font-size:11px;font-weight:800;color:${textColor};letter-spacing:0.12em;text-transform:uppercase;margin-bottom:5px">${isGood?'✓ Entrada Permitida':'✗ Acesso Negado'}</div>
    <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:2px">${escapeHTML(title)}</div>
    ${subtitle?`<div style="font-size:12px;color:rgba(255,255,255,0.7)">${escapeHTML(subtitle)}</div>`:''}
  `;
  // Som
  if (window._scSound) {
    try { const ctx=new AudioContext(); const osc=ctx.createOscillator(); const g=ctx.createGain(); osc.connect(g); g.connect(ctx.destination); osc.frequency.value=isGood?880:220; g.gain.setValueAtTime(0.3,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3); osc.start(); osc.stop(ctx.currentTime+0.3); } catch(e){}
  }
  // Vibração
  if (window._scVib && navigator.vibrate) navigator.vibrate(isGood?[100]:[200,100,200]);
  if (duration>0) setTimeout(()=>{ if(el)el.style.display='none'; }, duration);
}

async function _scLoadUndoRemaining(eventId) {
  try {
    const ev = await supabaseRequest(`events?id=eq.${eventId}&select=user_id&limit=1`);
    const userId = ev?.[0]?.user_id;
    if (!userId) return;
    const acc = await supabaseRequest(`accounts?id=eq.${userId}&select=undo_scans_remaining&limit=1`);
    const remaining = acc?.[0]?.undo_scans_remaining ?? 4;
    const btn  = document.getElementById('scUndoBtn');
    const info = document.getElementById('scUndoInfo');
    if (info) info.textContent = `Restam ${remaining} utilizações`;
    if (btn && remaining <= 0) {
      btn.disabled = true; btn.style.background = '#9ca3af'; btn.style.cursor = 'not-allowed';
      if (info) info.textContent = 'Sem utilizações — contacta o suporte';
    }
  } catch(e) { console.warn('_scLoadUndoRemaining:', e); }
}

async function _scUndoScans(scannerToken, eventId) {
  try {
    const ev = await supabaseRequest(`events?id=eq.${eventId}&select=user_id&limit=1`);
    const userId = ev?.[0]?.user_id;
    const acc = await supabaseRequest(`accounts?id=eq.${userId}&select=undo_scans_remaining&limit=1`);
    const remaining = acc?.[0]?.undo_scans_remaining ?? 4;
    if (remaining <= 0) { alert('Sem utilizações disponíveis. Contacta o administrador.'); return; }
    if (!confirm(`Tens a certeza que queres desfazer TODOS os check-ins?\n\nRestam ${remaining} utilizações.`)) return;
    await supabaseRequest(`rsvps?event_id=eq.${eventId}`, 'PATCH',
      { checked_in: false, checked_in_at: null, companion_checked_in: false });
    await supabaseRequest(`accounts?id=eq.${userId}`, 'PATCH', { undo_scans_remaining: remaining - 1 });
    const cache = window._scCache;
    if (cache) {
      Object.values(cache.rsvpMap || {}).forEach(r => { r.checkedIn = false; r.companionCheckedIn = false; });
      _scSaveCache(scannerToken, cache);
      window._scCache = cache;
      _scUpdateCounters(cache);
      _scRenderGuests();
    }
    localStorage.removeItem(`adk_checkin_queue_${scannerToken}`);
    _scUpdateSyncBadge(scannerToken);
    _scLoadUndoRemaining(eventId);
    alert(`✅ Todos os check-ins foram anulados.\nRestam ${remaining - 1} utilizações.`);
  } catch(e) { alert('Erro ao desfazer. Tenta novamente.'); console.error(e); }
}

async function _scDownloadReport(eventId, eventTitle) {
  const cache = window._scCache;
  if (!cache) { alert('Carrega o scanner primeiro.'); return; }

  const now     = new Date();
  const entries = Object.values(cache.rsvpMap || {});
  const entered = entries.filter(r => r.checkedIn).sort((a,b) => a.name.localeCompare(b.name));
  const absent  = entries.filter(r => !r.checkedIn).sort((a,b) => a.name.localeCompare(b.name));
  const pct     = entries.length ? Math.round(entered.length/entries.length*100) : 0;
  const companionMissing = entered.filter(r => / e /i.test(r.name) && !r.companionCheckedIn).sort((a,b) => a.name.localeCompare(b.name));
  const suspicious = entries.filter(r => (r.scanCount||0) > 2).sort((a,b) => (b.scanCount||0)-(a.scanCount||0));

  if (!window.jspdf?.jsPDF && !window.jsPDF) {
    await _loadJsPDF().catch(() => {});
  }
  const J = (window.jspdf||window).jsPDF;
  const doc = new J({ orientation:'portrait', unit:'mm', format:'a4' });
  const W=210, margin=18;
  let y=margin;

  const hex2rgb=h=>{h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];};
  const setColor=h=>{const[r,g,b]=hex2rgb(h);doc.setTextColor(r,g,b);};
  const setFill=h=>{const[r,g,b]=hex2rgb(h);doc.setFillColor(r,g,b);};
  const setDraw=h=>{const[r,g,b]=hex2rgb(h);doc.setDrawColor(r,g,b);};

  // Cabeçalho
  setFill('#1e293b'); doc.rect(0,0,W,32,'F');
  doc.setFontSize(18); doc.setFont('helvetica','bold'); setColor('#ffffff');
  doc.text('Relatório de Presenças', margin, 13);
  doc.setFontSize(10); doc.setFont('helvetica','normal'); setColor('#94a3b8');
  doc.text(eventTitle, margin, 21);
  doc.text(now.toLocaleDateString('pt-PT',{weekday:'long',year:'numeric',month:'long',day:'numeric'})+'  •  '+now.toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}), margin, 28);
  y=42;

  // Cards estatísticas
  const cards=[
    {label:'Entraram', value:entered.length, bg:'#f0fdf4', border:'#86efac', text:'#16a34a'},
    {label:'Ausentes',  value:absent.length,  bg:'#fef2f2', border:'#fca5a5', text:'#dc2626'},
    {label:'Total',     value:entries.length, bg:'#eff6ff', border:'#93c5fd', text:'#2563eb'},
    {label:'Presença',  value:pct+'%',        bg:'#f5f3ff', border:'#c4b5fd', text:'#7c3aed'},
  ];
  if(companionMissing.length) cards.push({label:'Acomp.faltam', value:companionMissing.length, bg:'#fff7ed', border:'#fed7aa', text:'#ea580c'});
  if(suspicious.length)       cards.push({label:'⚠️ Suspeitos',  value:suspicious.length,       bg:'#fefce8', border:'#fde68a', text:'#ca8a04'});

  const cW=(W-margin*2-(cards.length-1)*3)/cards.length;
  cards.forEach((card,i)=>{
    const x=margin+i*(cW+3);
    setFill(card.bg); setDraw(card.border); doc.setLineWidth(0.4); doc.roundedRect(x,y,cW,18,2,2,'FD');
    doc.setFontSize(13); doc.setFont('helvetica','bold'); setColor(card.text);
    doc.text(String(card.value), x+cW/2, y+10, {align:'center'});
    doc.setFontSize(7); doc.setFont('helvetica','normal'); setColor('#6b7280');
    doc.text(card.label, x+cW/2, y+15, {align:'center'});
  });
  y+=26;

  const drawTable=(title,color,rows,cols,bgH='#f8fafc')=>{
    if(y>250){doc.addPage();y=margin;}
    doc.setFontSize(11); doc.setFont('helvetica','bold'); setColor(color);
    doc.text(title,margin,y); y+=2; setDraw(color); doc.setLineWidth(0.5); doc.line(margin,y,W-margin,y); y+=5;
    setFill(bgH); setDraw('#e2e8f0'); doc.setLineWidth(0.3); doc.rect(margin,y,W-margin*2,7,'FD');
    doc.setFontSize(8); doc.setFont('helvetica','bold'); setColor('#64748b');
    let cx=margin+2;
    cols.forEach(col=>{doc.text(col.header,cx,y+5);cx+=col.w;});
    y+=7;
    rows.forEach((row,idx)=>{
      if(y>275){doc.addPage();y=margin;}
      if(idx%2===0){setFill('#f9fafb');doc.rect(margin,y,W-margin*2,7,'F');}
      setDraw('#f1f5f9'); doc.setLineWidth(0.2); doc.line(margin,y+7,W-margin,y+7);
      doc.setFontSize(8); doc.setFont('helvetica','normal'); setColor('#1e293b');
      let rx=margin+2;
      row.forEach((cell,ci)=>{
        const txt=doc.splitTextToSize(String(cell),cols[ci].w-3)[0];
        doc.text(txt,rx,y+5); rx+=cols[ci].w;
      });
      y+=7;
    });
    y+=8;
  };

  // Secção 1: Presentes com estado do acompanhante
  drawTable(`✓  Presentes (${entered.length})`,'#16a34a',
    entered.map((r,i)=>{
      const has=/ e /i.test(r.name);
      const main=has?r.name.split(/ e /i)[0]:r.name;
      const comp=has?r.name.split(/ e /i).slice(1).join(' e '):'—';
      const st=!has?'—':(r.companionCheckedIn?'✓ Entrou':'✗ Não apareceu');
      return[i+1,main,comp,st];
    }),
    [{header:'#',w:8},{header:'Nome',w:70},{header:'Acompanhante',w:60},{header:'Acomp.',w:36}]
  );

  // Secção 2: Acompanhantes em falta
  if(companionMissing.length){
    drawTable(`⚠️  Acompanhantes que não apareceram (${companionMissing.length})`,'#ea580c',
      companionMissing.map((r,i)=>{
        const main=r.name.split(/ e /i)[0];
        const comp=r.name.split(/ e /i).slice(1).join(' e ');
        return[i+1,main,comp];
      }),
      [{header:'#',w:8},{header:'Titular (presente)',w:86},{header:'Acompanhante (não apareceu)',w:80}],
      '#fff7ed'
    );
  }

  // Secção 3: QR suspeitos
  if(suspicious.length){
    drawTable(`⚠️  QR lido mais de 2x — Possível partilha de convite (${suspicious.length})`,'#ca8a04',
      suspicious.map((r,i)=>[i+1,r.name,r.scanCount||0,r.checkedIn?'Entrou':'Não entrou']),
      [{header:'#',w:8},{header:'Nome',w:100},{header:'Leituras',w:26},{header:'Estado',w:40}],
      '#fefce8'
    );
  }

  // Secção 4: Ausentes
  drawTable(`✗  Ausentes (${absent.length})`,'#dc2626',
    absent.map((r,i)=>[i+1,r.name]),
    [{header:'#',w:10},{header:'Nome',w:164}]
  );

  // Rodapé em todas as páginas
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){
    doc.setPage(p); setColor('#94a3b8'); doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text(`AdKira  •  Página ${p} de ${pages}  •  ${now.toLocaleString('pt-PT')}`,W/2,290,{align:'center'});
  }
  doc.save(`relatorio_${eventTitle.replace(/[^a-zA-Z0-9]/g,'_')}_${now.toISOString().slice(0,10)}.pdf`);
}


async function _scRefreshCache(scannerToken) {
  if (!navigator.onLine) { alert('Sem internet. Liga a rede e tenta novamente.'); return; }
  try {
    const rows = await supabaseRequest(`events?scanner_token=eq.${scannerToken}&select=id,title,event_color&limit=1`);
    if (!rows || !rows.length) return;
    const ev = rows[0];
    const rsvps = await supabaseRequest(`rsvps?event_id=eq.${ev.id}&ticket_issued=eq.true&select=rsvp_token,guest_name,checked_in&limit=2000`);
    const rsvpMap = {};
    (rsvps || []).forEach(r => { rsvpMap[r.rsvp_token] = { name: r.guest_name, checkedIn: r.checked_in || false, companionCheckedIn: false, scanCount: 0 }; });
    const cache = { ev, rsvpMap, cachedAt: Date.now() };
    _scSaveCache(scannerToken, cache);
    await _scSyncQueue(scannerToken, ev.id);
    _renderScannerUI(ev, scannerToken, cache, true);
  } catch(e) { alert('Erro ao actualizar. Tenta novamente.'); }
}

function _scClearCache(scannerToken) {
  if (!confirm('Apagar cache local? Vai precisar de internet para voltar a usar.')) return;
  localStorage.removeItem(_SC_CACHE_KEY(scannerToken));
  localStorage.removeItem(_SC_CHECKIN_KEY(scannerToken));
  location.reload();
}

let _scannerCooldown = false;
async function _onQrScanned(text, eventId, evColor, scannerToken, cache) {
  if (_scannerCooldown) return;
  _scannerCooldown = true;
  setTimeout(() => _scannerCooldown = false, 2500);

  if (!text.startsWith(_QR_PREFIX)) {
    _scShowResult('error', 'QR não reconhecido', 'Não emitido pelo AdKira');
    return;
  }

  const token = await _decryptToken(text, scannerToken);
  if (!token) {
    _scShowResult('error', 'QR de outro evento', 'Chave incorrecta');
    return;
  }

  const rsvp = cache.rsvpMap[token];
  if (!rsvp) {
    _scShowResult('error', 'Não encontrado', 'Convidado não tem ticket ou já foi removido');
    return;
  }

  // Detectar se tem acompanhante ("Nome e Acompanhante")
  const hasCompanion  = / e /i.test(rsvp.name);
  const mainName      = hasCompanion ? rsvp.name.split(/ e /i)[0].trim() : rsvp.name;
  const companionName = hasCompanion ? rsvp.name.split(/ e /i).slice(1).join(' e ').trim() : '';

  // Caso: já entrou completamente — não incrementar scanCount, apenas avisar
  if (rsvp.checkedIn && (!hasCompanion || rsvp.companionCheckedIn)) {
    _scShowResult('already', rsvp.name, 'Já entrou anteriormente');
    return;
  }

  // Incrementar contador apenas para leituras que ainda fazem sentido
  // (1ª entrada, ou acompanhante em falta)
  rsvp.scanCount = (rsvp.scanCount || 0) + 1;
  _scSaveCache(scannerToken, cache);

  // Alertar se lido mais de 2x sem entrar (possível partilha do convite)
  // Para convites com acompanhante, 2 leituras são normais (titular + acompanhante)
  const maxScans = hasCompanion ? 3 : 2;
  if (rsvp.scanCount > maxScans && !rsvp.checkedIn) {
    _scShowResult('warning', `⚠️ QR lido ${rsvp.scanCount}x`, `${rsvp.name} — Possível partilha do convite!`, 5000);
    if (window._scVib && navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300]);
    return;
  }

  // Caso: convidado principal entrou mas acompanhante ainda não
  if (rsvp.checkedIn && hasCompanion && !rsvp.companionCheckedIn) {
    // Segunda leitura — entrada do acompanhante
    cache.rsvpMap[token].companionCheckedIn = true;
    _scSaveCache(scannerToken, cache);
    window._scCache = cache;
    _scShowResult('companion', companionName, `Acompanhante de ${mainName}`, 4000);
    if (navigator.onLine) {
      supabaseRequest(`rsvps?rsvp_token=eq.${token}&event_id=eq.${eventId}`, 'PATCH',
        { companion_checked_in: true, companion_checked_in_at: new Date().toISOString() }
      ).catch(() => {});
    }
    return;
  }

  // Caso: primeira leitura
  if (hasCompanion) {
    // Perguntar se o acompanhante veio junto
    _scannerCooldown = true; // manter bloqueado durante o modal
    _scShowResult('success', mainName, `Veio com ${companionName}?`, 0); // sem auto-dismiss

    // Mostrar modal de confirmação
    const resultEl = document.getElementById('scanner-result');
    if (resultEl) {
      resultEl.innerHTML += `
        <div style="display:flex;gap:10px;justify-content:center;margin-top:12px">
          <button onclick="window._scCompanionAnswer('${token}','${eventId}','${scannerToken}',true)" style="flex:1;max-width:140px;padding:10px;background:#fff;color:#16a34a;border:none;border-radius:10px;font-weight:800;font-size:15px;cursor:pointer">✓ Sim</button>
          <button onclick="window._scCompanionAnswer('${token}','${eventId}','${scannerToken}',false)" style="flex:1;max-width:140px;padding:10px;background:rgba(255,255,255,0.3);color:#fff;border:none;border-radius:10px;font-weight:800;font-size:15px;cursor:pointer">Não</button>
        </div>`;
    }

    window._scCompanionAnswer = async (tok, evId, scToken, companionCame) => {
      delete window._scCompanionAnswer;
      cache.rsvpMap[tok].checkedIn = true;
      cache.rsvpMap[tok].companionCheckedIn = companionCame;
      _scSaveCache(scToken, cache);
      window._scCache = cache;
      _scUpdateCounters(cache);
      _scRenderGuests();

      const subtitle = companionCame ? `${mainName} + ${companionName}` : `${mainName} (acompanhante virá depois)`;
      _scShowResult('success', 'Entrada permitida', subtitle, 4000);
      _scannerCooldown = false;

      const patch = { checked_in: true, checked_in_at: new Date().toISOString() };
      if (companionCame) Object.assign(patch, { companion_checked_in: true, companion_checked_in_at: new Date().toISOString() });

      if (navigator.onLine) {
        supabaseRequest(`rsvps?rsvp_token=eq.${tok}&event_id=eq.${evId}`, 'PATCH', patch).catch(() => {
          const q = _scLoadCheckinQueue(scToken); if(!q.includes(tok)){q.push(tok);_scSaveCheckinQueue(scToken,q);}
        });
      } else {
        const q = _scLoadCheckinQueue(scToken); if(!q.includes(tok)){q.push(tok);_scSaveCheckinQueue(scToken,q);} _scUpdateSyncBadge(scToken);
      }
    };
    return;
  }

  // Sem acompanhante — entrada directa
  cache.rsvpMap[token].checkedIn = true;
  _scSaveCache(scannerToken, cache);
  window._scCache = cache;
  _scUpdateCounters(cache);
  _scRenderGuests();
  _scShowResult('success', rsvp.name, '');

  if (navigator.onLine) {
    // ✅ PATCH atómico — só actualiza se ainda não estiver checked_in
    // Se 0 linhas actualizadas → outro scanner chegou primeiro
    const res = await supabaseRequest(
      `rsvps?rsvp_token=eq.${token}&event_id=eq.${eventId}&checked_in=eq.false`,
      'PATCH',
      { checked_in: true, checked_in_at: new Date().toISOString() }
    ).catch(() => null);

    if (Array.isArray(res) && res.length === 0) {
      // Outro scanner já registou esta entrada
      cache.rsvpMap[token].checkedIn = true;
      _scShowResult('already', rsvp.name, 'Já registado por outro leitor');
    }
  } else {
    const q = _scLoadCheckinQueue(scannerToken);
    if (!q.includes(token)) { q.push(token); _scSaveCheckinQueue(scannerToken, q); }
    _scUpdateSyncBadge(scannerToken);
  }
}

// ── 4. Gerar/mostrar token do scanner para o admin ───────────────────────
async function showScannerToken() {
  const eventId = Store.currentEventId;
  const ev = Store.events.find(e => e.id === eventId);
  if (!ev) return;

  // Garantir que o token existe
  let token = ev.scanner_token;
  if (!token) {
    const res = await supabaseRequest(`events?id=eq.${eventId}&select=scanner_token&limit=1`);
    token = res && res[0] && res[0].scanner_token;
    if (!token) {
      token = crypto.randomUUID ? crypto.randomUUID() : uid() + uid();
      await supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', { scanner_token: token });
      ev.scanner_token = token;
    }
  }

  const base = window.location.origin + window.location.pathname;
  const link = `${base}?scanner=${token}`;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-6" style="max-width:440px">
    <h3 class="text-base font-bold text-gray-800 mb-1">Link do Scanner — ${escapeHTML(ev.title || '')}</h3>
    <p class="text-xs text-gray-500 mb-3">Partilha este link com quem vai estar na porta. Só funciona para este evento — não afecta outros clientes.</p>
    <div id="scanner-qr-preview" style="text-align:center;margin-bottom:0.75rem"></div>
    <div style="background:#f1f5f9;border-radius:0.5rem;padding:0.75rem;font-size:0.72rem;font-family:monospace;word-break:break-all;color:#1e293b;margin-bottom:1rem">${link}</div>
    <div class="flex gap-2">
      <button class="flex-1 btn-main" onclick="navigator.clipboard.writeText('${link}').then(()=>toast('Link copiado!'))">Copiar Link</button>
      <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
    </div>
  </div>`;
  document.body.appendChild(modal);

  // Mostrar QR do próprio link do scanner
  QRCode.toCanvas(document.getElementById('scanner-qr-preview'), link, { width: 140, margin: 1 }).catch(() => {});
}

// ── 5. GESTOR DE TICKETS — visão geral de todos os convidados ────────────
async function generateManualTicket(eventId) {
  const name       = document.getElementById('manual-ticket-name')?.value?.trim();
  const companion  = document.getElementById('manual-ticket-companion')?.value?.trim();
  if (!name) { toast('Insere o nome do convidado.'); return; }

  const fullName = companion ? `${name} e ${companion}` : name;
  const ev = Store.events.find(e => e.id === (eventId || Store.currentEventId));
  if (!ev?.ticket_template_url) { toast('Template de ticket não configurado.'); return; }

  // Gerar um UUID como token — tem de existir na tabela rsvps para o scanner reconhecer
  const manualToken = 'manual_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

  // ✅ Guardar na tabela rsvps ANTES de gerar o ticket
  // O scanner carrega apenas tokens que existem em rsvps com ticket_issued=true
  try {
    await supabaseRequest('rsvps', 'POST', {
      event_id:         eventId,
      guest_name:       fullName,
      rsvp_token:       manualToken,
      attending:        true,
      ticket_issued:    true,
      ticket_issued_at: new Date().toISOString(),
      is_manual_ticket: true,
    });
  } catch(e) {
    console.error('Erro ao criar RSVP manual:', e);
    toast('Erro ao guardar convidado. Tenta novamente.');
    return;
  }

  // Agora gerar o PDF com o token válido
  await generateGuestTicket(fullName, manualToken, eventId, true);
  document.getElementById('manual-ticket-name').value   = '';
  document.getElementById('manual-ticket-companion').value = '';
  toast(`Ticket gerado: ${fullName}`);
}

async function openTicketManager() {
  const eventId = Store.currentEventId;
  const ev = Store.events.find(e => e.id === eventId);
  if (!ev) return;

  // Recarregar campos do ticket
  try {
    const fresh = await supabaseRequest(`events?id=eq.${eventId}&select=ticket_template_url,ticket_name_x,ticket_name_y,ticket_qr_x,ticket_qr_y,ticket_name_size,ticket_qr_size,ticket_name_color,ticket_name_font,scanner_token&limit=1`);
    if (fresh && fresh[0]) Object.assign(ev, fresh[0]);
  } catch(e) {}

  if (!ev.ticket_template_url) {
    toast('Configura o template PDF primeiro (botão "Template Ticket").');
    return;
  }

  // Carregar RSVPs confirmados com estado do ticket
  const rsvps = await supabaseRequest(
    `rsvps?event_id=eq.${eventId}&attending=eq.true&select=guest_name,rsvp_token,ticket_issued,ticket_issued_at,checked_in,is_manual_ticket&order=guest_name&limit=500`
  ).catch(() => []) || [];

  const issued   = rsvps.filter(r => r.ticket_issued);
  const pending  = rsvps.filter(r => !r.ticket_issued && !r.is_manual_ticket);

  // Verificar limite de tickets
  let ticketLimit = null, ticketUsed = issued.length;
  try {
    const userId = ev.user_id || ev.userId;
    if (userId) {
      const acc = await supabaseRequest(`accounts?id=eq.${userId}&select=ticket_limit&limit=1`);
      ticketLimit = acc?.[0]?.ticket_limit ?? 50;
    }
  } catch(e) {}

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'ticket-manager-modal';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl p-5" style="max-width:520px;max-height:88vh;overflow-y:auto">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-base font-bold text-gray-800">Gerir Tickets</h3>
        <button onclick="this.closest('.modal-overlay').remove()" style="background:#f3f4f6;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:1rem">×</button>
      </div>

      ${ticketLimit !== null ? `
      <!-- Contador de tickets -->
      <div style="background:${ticketUsed>=ticketLimit?'#fef2f2':'#eff6ff'};border:1px solid ${ticketUsed>=ticketLimit?'#fca5a5':'#93c5fd'};border-radius:0.75rem;padding:0.6rem 0.9rem;margin-bottom:0.75rem;display:flex;align-items:center;justify-content:space-between">
        <span class="text-sm font-semibold text-gray-700">🎫 Tickets gerados</span>
        <span style="font-size:1.1rem;font-weight:800;color:${ticketUsed>=ticketLimit?'#dc2626':'#2563eb'}">${ticketUsed} / ${ticketLimit}</span>
      </div>` : ''}

      <!-- Gerar ticket manual (para não confirmados) -->
      <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:0.75rem;padding:0.75rem;margin-bottom:0.75rem">
        <p class="text-xs font-bold text-gray-700 mb-1">🎫 Gerar ticket manualmente</p>
        <p class="text-xs text-gray-400 mb-2">Para convidados que não confirmaram no sistema. O QR será válido na porta.</p>
        <div class="flex gap-2 mb-1">
          <input id="manual-ticket-name" class="input-field text-sm flex-1" placeholder="Nome do convidado *">
          <input id="manual-ticket-companion" class="input-field text-sm flex-1" placeholder="Acompanhante (opcional)">
        </div>
        <button onclick="generateManualTicket('${eventId}')" class="btn-main text-xs w-full">Gerar Ticket</button>
      </div>

      <div class="flex gap-3 mb-3">
        <div style="flex:1;background:#f5f3ff;border-radius:0.75rem;padding:0.75rem;text-align:center">
          <p style="font-size:1.4rem;font-weight:800;color:#7c3aed;margin:0">${issued.length}</p>
          <p style="font-size:0.7rem;color:#6b7280;margin:0">Tickets emitidos</p>
        </div>
        <div style="flex:1;background:#fef9c3;border-radius:0.75rem;padding:0.75rem;text-align:center">
          <p style="font-size:1.4rem;font-weight:800;color:#b45309;margin:0">${pending.length}</p>
          <p style="font-size:0.7rem;color:#6b7280;margin:0">Por emitir</p>
        </div>
        <div style="flex:1;background:#dcfce7;border-radius:0.75rem;padding:0.75rem;text-align:center">
          <p style="font-size:1.4rem;font-weight:800;color:#166534;margin:0">${rsvps.filter(r=>r.checked_in).length}</p>
          <p style="font-size:0.7rem;color:#6b7280;margin:0">Já entraram</p>
        </div>
      </div>

      ${pending.length ? `
      <button onclick="generateAllTickets()" class="btn-main text-sm w-full mb-3">
        🎫 Gerar todos os tickets em falta (${pending.length})
      </button>` : ''}

      <div class="space-y-1">
        ${rsvps.map((r, idx) => `
          <div style="display:flex;align-items:center;gap:0.5rem;padding:0.6rem 0.75rem;background:${r.ticket_issued?'#f5f3ff':'#fafafa'};border-radius:0.6rem;border:1px solid ${r.ticket_issued?'#ede9fe':'#f3f4f6'}">
            <span style="width:28px;height:28px;border-radius:50%;background:${r.checked_in?'#dcfce7':r.ticket_issued?'#ede9fe':'#f3f4f6'};display:flex;align-items:center;justify-content:center;font-size:0.75rem;flex-shrink:0">
              ${r.checked_in ? '✅' : r.ticket_issued ? '🎫' : '⏳'}
            </span>
            <span style="flex:1;font-size:0.85rem;font-weight:600;color:#1e293b">${escapeHTML(r.guest_name)}${r.is_manual_ticket ? ' <span style="font-size:0.6rem;background:#fef3c7;color:#92400e;border-radius:4px;padding:1px 5px;font-weight:700">MANUAL</span>' : ''}</span>
            <span style="font-size:0.65rem;color:#9ca3af;margin-right:0.25rem">${r.ticket_issued ? 'emitido' : 'por emitir'}</span>
            <button class="tm-gen-btn"
              data-idx="${idx}"
              style="background:${r.ticket_issued?'#ede9fe':'#007f9f'};color:${r.ticket_issued?'#7c3aed':'#fff'};border:none;border-radius:0.4rem;padding:0.3rem 0.6rem;font-size:0.7rem;font-weight:700;cursor:pointer;white-space:nowrap">
              ${r.ticket_issued ? '↺ Gerar de novo' : '↓ Gerar ticket'}
            </button>
            <button class="tm-del-btn" data-idx="${idx}" data-token="${escapeHTML(r.rsvp_token)}" data-manual="${r.is_manual_ticket?'1':'0'}"
              style="background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:0.4rem;padding:0.3rem 0.5rem;font-size:0.75rem;cursor:pointer;flex-shrink:0"
              title="Eliminar ticket">🗑</button>
          </div>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(modal);

  // ✅ Usar data-attributes em vez de onclick inline — evita que aspas nos
  // nomes dos convidados quebrem o HTML do atributo onclick="..."
  document.querySelectorAll('.tm-gen-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = rsvps[parseInt(btn.dataset.idx)];
      if (r) generateGuestTicket(r.guest_name, r.rsvp_token);
    });
  });

  document.querySelectorAll('.tm-del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const r = rsvps[parseInt(btn.dataset.idx)];
      if (!r) return;
      const isManual = btn.dataset.manual === '1';
      const msg = isManual
        ? `Eliminar completamente o ticket manual de "${r.guest_name}"?`
        : `Retirar o ticket de "${r.guest_name}"? (A confirmação de presença fica intacta)`;
      if (!confirm(msg)) return;

      if (isManual) {
        // Ticket manual — eliminar o registo inteiramente
        await supabaseRequest(`rsvps?rsvp_token=eq.${r.rsvp_token}&event_id=eq.${eventId}`, 'DELETE').catch(() => {});
      } else {
        // Ticket de confirmado — apenas remover o ticket, manter o RSVP
        await supabaseRequest(`rsvps?rsvp_token=eq.${r.rsvp_token}&event_id=eq.${eventId}`, 'PATCH',
          { ticket_issued: false, ticket_issued_at: null }
        ).catch(() => {});
      }
      toast('Ticket eliminado.');
      document.getElementById('ticket-manager-modal')?.remove();
      try { await openTicketManager(); } catch(e) {}
    });
  });

  // Guardar lista para gerar todos
  window._pendingTicketRsvps = rsvps.filter(r => !r.ticket_issued);
  window._allTicketRsvps     = rsvps;
}

async function generateAllTickets() {
  const rsvps = window._pendingTicketRsvps || [];
  if (!rsvps.length) { toast('Não há tickets por emitir.'); return; }
  const btn = document.querySelector('#ticket-manager-modal .btn-main');
  if (btn) { btn.disabled = true; btn.textContent = 'A gerar...'; }

  for (let i = 0; i < rsvps.length; i++) {
    const r = rsvps[i];
    if (btn) btn.textContent = `A gerar ${i+1} de ${rsvps.length}...`;
    await generateGuestTicket(r.guest_name, r.rsvp_token, null, true);
    await new Promise(res => setTimeout(res, 400));
  }

  toast(`${rsvps.length} ticket(s) gerados!`);
  document.getElementById('ticket-manager-modal')?.remove();
  // ✅ Reabrir com try/catch para não deixar o erro aparecer
  try { await openTicketManager(); } catch(e) { console.warn('openTicketManager refresh error:', e); }
}
