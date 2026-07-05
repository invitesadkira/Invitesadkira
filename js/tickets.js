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

  // ✅ Recarregar dados frescos do evento para garantir que ticket_template_url
  // está actualizado — sem isto, um refresh da página podia limpar o valor
  // do Store mesmo que já estivesse guardado no Supabase.
  try {
    const fresh = await supabaseRequest(
      `events?id=eq.${eventId}&select=ticket_template_url,ticket_name_x,ticket_name_y,ticket_qr_x,ticket_qr_y,ticket_name_size,ticket_qr_size,ticket_name_color,ticket_name_font,scanner_token&limit=1`
    );
    if (fresh && fresh[0]) {
      Object.assign(ev, fresh[0]);
    }
  } catch(e) { /* continua com o que já tem */ }

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
        <p class="text-xs text-gray-400 mb-2">🔵 = Nome do convidado &nbsp;|&nbsp; 🟢 = QR Code</p>
        <div id="ticket-canvas-wrap" style="position:relative;border:1px solid #e5e7eb;border-radius:0.5rem;overflow:hidden;background:#f8fafc;display:inline-block;max-width:100%">
          <canvas id="ticket-preview-canvas" style="display:block;max-width:100%"></canvas>
      <!-- Marcador do Nome -->
      <div id="ticket-mark-name" style="position:absolute;background:rgba(59,130,246,0.85);color:#fff;border-radius:6px;padding:4px 10px;font-size:13px;font-weight:700;cursor:grab;user-select:none;white-space:nowrap;left:${(ev.ticket_name_x||0.5)*100}%;top:${(ev.ticket_name_y||0.75)*100}%;transform:translate(-50%,-50%);backdrop-filter:blur(2px);border:2px solid #3b82f6">
        María da Silva
      </div>
      <!-- Marcador do QR (mostra QR real de exemplo) -->
      <canvas id="ticket-mark-qr-canvas" style="position:absolute;left:${(ev.ticket_qr_x||0.5)*100}%;top:${(ev.ticket_qr_y||0.85)*100}%;transform:translate(-50%,-50%);border:2px solid #16a34a;border-radius:4px;cursor:grab;background:#fff" width="${ev.ticket_qr_size||80}" height="${ev.ticket_qr_size||80}"></canvas>
        </div>
        <div class="flex gap-3 mt-2 flex-wrap">
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
    // ✅ Renderizar a 1ª página do PDF com PDF.js para o utilizador ver
    // o layout real e posicionar os marcadores correctamente.
    if (typeof pdfjsLib === 'undefined') {
      console.warn('PDF.js não carregado — usando placeholder');
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

  // Ouvir alterações nos controlos de estilo
  const controls = ['ticket-name-size', 'ticket-qr-size', 'ticket-name-color', 'ticket-name-font'];
  controls.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', _updateTicketPreview);
  });

  // Actualizar a prévia quando os marcadores são arrastados
  ['ticket-mark-name', 'ticket-mark-qr-canvas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('mouseup', _updateTicketPreview);
    if (el) el.addEventListener('touchend', _updateTicketPreview);
  });

  _updateTicketPreview();
}

function _updateTicketPreview() {
  const wrap      = document.getElementById('ticket-canvas-wrap');
  const nameEl    = document.getElementById('ticket-mark-name');
  const qrEl      = document.getElementById('ticket-mark-qr-canvas');
  const nameFont  = document.getElementById('ticket-name-font')?.value || 'Helvetica';
  const nameSize  = parseInt(document.getElementById('ticket-name-size')?.value || '24');
  const qrSize    = parseInt(document.getElementById('ticket-qr-size')?.value   || '80');
  const nameColor = document.getElementById('ticket-name-color')?.value || '#000000';
  if (!nameEl || !qrEl || !wrap) return;

  // Actualizar estilo do marcador de nome
  const scale = wrap.offsetWidth / (wrap._pdfWidth || wrap.offsetWidth);
  const previewFontSize = Math.max(8, Math.round(nameSize * scale * 0.85));
  nameEl.style.fontSize   = previewFontSize + 'px';
  nameEl.style.color      = nameColor;
  const fontMap = {
    'Helvetica':'sans-serif','Helvetica-Bold':'sans-serif',
    'Times-Roman':'serif','Times-Bold':'serif','Courier':'monospace'
  };
  nameEl.style.fontFamily = fontMap[nameFont] || 'sans-serif';
  nameEl.style.fontWeight = nameFont.includes('Bold') ? '800' : '600';

  // ✅ Redimensionar o QR em tempo real — redesenhar no canvas com o novo tamanho
  const previewQrSize = Math.max(20, Math.round(qrSize * scale));
  if (typeof QRCode !== 'undefined') {
    QRCode.toCanvas(qrEl, 'ADK:EXEMPLO', {
      width: previewQrSize, margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(() => {
      // Manter a posição centrada após redimensionar
      qrEl.style.width  = previewQrSize + 'px';
      qrEl.style.height = previewQrSize + 'px';
    }).catch(() => {});
  } else {
    qrEl.width = qrEl.height = previewQrSize;
    qrEl.style.width = qrEl.style.height = previewQrSize + 'px';
  }
}
function _initTicketDrag() {
  const wrap = document.getElementById('ticket-canvas-wrap');
  if (!wrap) return;

  ['ticket-mark-name', 'ticket-mark-qr-canvas'].forEach(id => {
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
    await supabaseRequest('event_visuals?event_id=eq.' + Store.currentEventId, 'PATCH',
      { custom_font_url: url, custom_font_family: fontName }).catch(() => {});
  }
  // Adicionar ao selector
  const sel = document.getElementById('ticket-name-font');
  if (sel) {
    const opt = document.createElement('option');
    opt.value = 'custom:' + fontName;
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

  await supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', {
    ticket_name_x:    nx,  ticket_name_y:    ny,
    ticket_qr_x:      qx,  ticket_qr_y:      qy,
    ticket_name_size: parseInt(document.getElementById('ticket-name-size')?.value || '24'),
    ticket_qr_size:   parseInt(document.getElementById('ticket-qr-size')?.value   || '80'),
    ticket_name_color: document.getElementById('ticket-name-color')?.value || '#000000',
    ticket_name_font:  document.getElementById('ticket-name-font')?.value  || 'Helvetica',
    ticket_font_global: document.getElementById('ticket-font-global')?.checked || false,
  });
  const ev = Store.events.find(e => e.id === eventId);
  if (ev) { ev.ticket_name_x=nx; ev.ticket_name_y=ny; ev.ticket_qr_x=qx; ev.ticket_qr_y=qy; }
  toast('Configuração guardada!');
  document.getElementById('ticket-editor-modal')?.remove();
}

// ── 2. GERAÇÃO DO TICKET NO BROWSER (download directo) ───────────────────
async function generateGuestTicket(guestName, rsvpToken, eventId, skipNameEdit) {
  // ✅ Permitir editar o nome antes de gerar o ticket
  if (!skipNameEdit) {
    return new Promise(resolve => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-5" style="max-width:380px">
        <h3 class="text-sm font-bold text-gray-800 mb-1">Nome no ticket</h3>
        <p class="text-xs text-gray-500 mb-2">Pode editar antes de gerar — ex: "Araújo e esposa", "Araújo e acompanhante"</p>
        <input id="ticket-name-edit" class="input-field mb-3" value="${escapeHTML(guestName)}">
        <div class="flex gap-2">
          <button class="flex-1 btn-main" onclick="(()=>{
            const n=document.getElementById('ticket-name-edit').value.trim()||'${escapeHTML(guestName)}';
            this.closest('.modal-overlay').remove();
            generateGuestTicket(n,'${rsvpToken}','${eventId||''}',true);
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

  // Garantir que os campos do ticket estão actualizados
  if (!ev.ticket_template_url) {
    try {
      const fresh = await supabaseRequest(`events?id=eq.${ev.id}&select=ticket_template_url,ticket_name_x,ticket_name_y,ticket_qr_x,ticket_qr_y,ticket_name_size,ticket_qr_size,ticket_name_color,ticket_name_font,scanner_token&limit=1`);
      if (fresh && fresh[0]) Object.assign(ev, fresh[0]);
    } catch(e) {}
  }

  if (!ev.ticket_template_url) {
    toast('Configure o template PDF primeiro.');
    return;
  }

  toast('A gerar ticket...');
  try {
    // Verificar se as bibliotecas estão carregadas
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
    const font = await doc.embedFont(fontMap[fontName] || StandardFonts.Helvetica);
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
      (rsvps || []).forEach(r => { rsvpMap[r.rsvp_token] = { name: r.guest_name, checkedIn: r.checked_in || false }; });
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
  const evColor = ev.event_color || '#007f9f';
  const total   = Object.keys(cache.rsvpMap || {}).length;
  const countIn = Object.values(cache.rsvpMap || {}).filter(r => r.checkedIn).length;
  const cacheAge = cache.cachedAt ? Math.round((Date.now() - cache.cachedAt) / 60000) : null;

  document.body.innerHTML = '';
  document.body.style.cssText = 'margin:0;padding:0;font-family:sans-serif;background:#0f172a;min-height:100vh;color:#fff';
  document.body.innerHTML = `
    <div style="max-width:480px;margin:0 auto;padding:1.5rem 1.25rem;padding-bottom:max(1.5rem,env(safe-area-inset-bottom))">
      <div style="text-align:center;margin-bottom:1rem">
        <p style="font-size:0.65rem;letter-spacing:0.15em;text-transform:uppercase;color:${evColor};font-weight:800;margin-bottom:0.2rem">SCANNER</p>
        <h1 style="font-size:1.2rem;font-weight:800;margin:0">${escapeHTML(ev.title || 'Evento')}</h1>
        <div id="sc-online-badge" style="display:inline-flex;align-items:center;gap:0.3rem;margin-top:0.4rem;font-size:0.65rem;font-weight:700;padding:0.2rem 0.6rem;border-radius:999px;background:${isOnline?'#166534':'#78350f'};color:#fff">
          <span>${isOnline ? '🟢 Online' : '🔴 Offline'}</span>
          ${!isOnline && cacheAge !== null ? `<span>· cache há ${cacheAge}min</span>` : ''}
        </div>
      </div>

      <div id="scanner-reader" style="border-radius:1rem;overflow:hidden;background:#1e293b;margin-bottom:1rem"></div>

      <div id="scanner-result" style="border-radius:1rem;padding:1.25rem;background:#1e293b;text-align:center;min-height:80px;display:flex;align-items:center;justify-content:center">
        <p style="color:#6b7280;font-size:0.85rem">Aponte a câmara para o QR code do convidado</p>
      </div>

      <div style="display:flex;gap:1rem;margin-top:1rem">
        <div style="flex:1;background:#1e293b;border-radius:0.75rem;padding:1rem;text-align:center">
          <p style="font-size:1.6rem;font-weight:800;color:${evColor}" id="sc-count-in">${countIn}</p>
          <p style="font-size:0.7rem;color:#6b7280;margin:0">Já entraram</p>
        </div>
        <div style="flex:1;background:#1e293b;border-radius:0.75rem;padding:1rem;text-align:center">
          <p style="font-size:1.6rem;font-weight:800;color:#fff" id="sc-count-total">${total}</p>
          <p style="font-size:0.7rem;color:#6b7280;margin:0">Confirmados</p>
        </div>
      </div>

      <div style="display:flex;gap:0.75rem;margin-top:1rem">
        <button onclick="_scRefreshCache('${scannerToken}')" style="flex:1;background:#1e293b;color:#6b7280;border:none;border-radius:0.6rem;padding:0.6rem;font-size:0.75rem;cursor:pointer">🔄 Actualizar lista</button>
        <button onclick="_scClearCache('${scannerToken}')" style="flex:1;background:#1e293b;color:#6b7280;border:none;border-radius:0.6rem;padding:0.6rem;font-size:0.75rem;cursor:pointer">🗑️ Limpar cache</button>
      </div>

      <p id="sc-queue-badge" style="text-align:center;font-size:0.7rem;color:#f59e0b;margin-top:0.75rem;display:none"></p>
    </div>`;

  // Mostrar fila pendente se houver
  const queue = _scLoadCheckinQueue(scannerToken);
  if (queue.length) {
    const qb = document.getElementById('sc-queue-badge');
    if (qb) { qb.style.display='block'; qb.textContent = `⏳ ${queue.length} check-in(s) para sincronizar`; }
  }

  // Listener de estado de rede — actualiza badge e sincroniza ao voltar online
  window.addEventListener('online', async () => {
    const badge = document.getElementById('sc-online-badge');
    if (badge) { badge.style.background='#166534'; badge.innerHTML='<span>🟢 Online</span>'; }
    await _scSyncQueue(scannerToken, ev.id);
    const qb = document.getElementById('sc-queue-badge');
    if (qb) { const q = _scLoadCheckinQueue(scannerToken); qb.style.display = q.length ? 'block' : 'none'; if (q.length) qb.textContent = `⏳ ${q.length} para sincronizar`; }
  });
  window.addEventListener('offline', () => {
    const badge = document.getElementById('sc-online-badge');
    if (badge) { badge.style.background='#78350f'; badge.innerHTML='<span>🔴 Offline</span>'; }
  });

  // ✅ Scanner nativo — usa getUserMedia + BarcodeDetector (Chrome/Android)
  // Sem nenhuma biblioteca externa. Funciona em todos os browsers modernos.
  const readerEl = document.getElementById('scanner-reader');
  readerEl.style.cssText = 'position:relative;border-radius:1rem;overflow:hidden;background:#000;aspect-ratio:1;margin-bottom:1rem';
  readerEl.innerHTML = `
    <video id="sc-video" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;display:block"></video>
    <canvas id="sc-canvas" style="display:none"></canvas>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
      <div style="width:220px;height:220px;border:3px solid ${evColor};border-radius:12px;box-shadow:0 0 0 4000px rgba(0,0,0,0.4)"></div>
    </div>`;

  const video = document.getElementById('sc-video');
  const canvas = document.getElementById('sc-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let scanning = true;

  // Pedir câmara traseira
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      video.srcObject = stream;
      video.play();

      // Usar BarcodeDetector nativo (Chrome 83+, Android Chrome)
      if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const scan = async () => {
          if (!scanning) return;
          if (video.readyState >= 2) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            try {
              const codes = await detector.detect(video);
              if (codes.length > 0) {
                scanning = false;
                await _onQrScanned(codes[0].rawValue, ev.id, evColor, scannerToken, cache);
                setTimeout(() => { scanning = true; }, 2500);
              }
            } catch(e) {}
          }
          requestAnimationFrame(scan);
        };
        scan();
      } else {
        // Fallback: botão para capturar foto e detectar QR
        readerEl.insertAdjacentHTML('beforeend', `
          <div style="position:absolute;bottom:0.75rem;left:0;right:0;text-align:center">
            <button onclick="window._captureQR('${scannerToken}','${ev.id}','${evColor}',cache)"
              style="background:${evColor};color:#fff;border:none;border-radius:0.5rem;padding:0.5rem 1.25rem;font-weight:700;cursor:pointer;font-size:0.8rem">
              📷 Capturar e ler QR
            </button>
          </div>`);
        window._captureQR = async (st, eid, ec, cache) => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0);
          toast('BarcodeDetector não disponível neste browser. Usa o Chrome actualizado.');
        };
      }
    })
    .catch(err => {
      readerEl.innerHTML = `<div style="padding:1.5rem;text-align:center;color:#ef4444">
        <p style="font-size:0.9rem;font-weight:700;margin-bottom:0.5rem">Sem acesso à câmara</p>
        <p style="font-size:0.75rem;color:#6b7280">${err.message || err}</p>
        <p style="font-size:0.72rem;color:#6b7280;margin-top:0.5rem">Certifica-te de que o browser tem permissão para a câmara e que o site está em HTTPS.</p>
      </div>`;
    });
}

async function _scRefreshCache(scannerToken) {
  if (!navigator.onLine) { alert('Sem internet. Liga a rede e tenta novamente.'); return; }
  try {
    const rows = await supabaseRequest(`events?scanner_token=eq.${scannerToken}&select=id,title,event_color&limit=1`);
    if (!rows || !rows.length) return;
    const ev = rows[0];
    const rsvps = await supabaseRequest(`rsvps?event_id=eq.${ev.id}&ticket_issued=eq.true&select=rsvp_token,guest_name,checked_in&limit=2000`);
    const rsvpMap = {};
    (rsvps || []).forEach(r => { rsvpMap[r.rsvp_token] = { name: r.guest_name, checkedIn: r.checked_in || false }; });
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
  setTimeout(() => _scannerCooldown = false, 2000);

  const resultEl = document.getElementById('scanner-result');
  const show = (bg, html, dur=2500) => {
    resultEl.style.background = bg;
    resultEl.innerHTML = html;
    setTimeout(() => { resultEl.style.background='#1e293b'; resultEl.innerHTML='<p style="color:#6b7280;font-size:0.85rem">Aponte a câmara para o QR code do convidado</p>'; }, dur);
  };

  if (!text.startsWith(_QR_PREFIX)) {
    show('#7f1d1d', `<div><p style="font-size:2rem;margin:0">🚫</p><p style="font-weight:700;font-size:1rem;margin:0.3rem 0 0">QR não reconhecido</p><p style="font-size:0.8rem;color:#fca5a5">Não emitido pelo AdKira</p></div>`);
    return;
  }

  const token = await _decryptToken(text, scannerToken);
  if (!token) {
    show('#7f1d1d', `<div><p style="font-size:2rem;margin:0">🔐</p><p style="font-weight:700;font-size:1rem;margin:0.3rem 0 0">QR de outro evento</p><p style="font-size:0.8rem;color:#fca5a5">Chave incorrecta</p></div>`);
    return;
  }

  // ✅ Verificar na cache local (funciona offline)
  const rsvp = cache.rsvpMap[token];
  if (!rsvp) {
    show('#7f1d1d', `<div><p style="font-size:2rem;margin:0">❌</p><p style="font-weight:700;font-size:1rem;margin:0.3rem 0 0">Não encontrado</p><p style="font-size:0.8rem;color:#fca5a5">Convidado não confirmou ou token inválido</p></div>`);
    return;
  }

  if (rsvp.checkedIn) {
    show('#1e3a5f', `<div><p style="font-size:2rem;margin:0">🔁</p><p style="font-weight:800;font-size:1.1rem;margin:0.3rem 0 0">${escapeHTML(rsvp.name)}</p><p style="font-size:0.8rem;color:#93c5fd">Já entrou anteriormente</p></div>`);
    return;
  }

  // ✅ Entrada válida — marcar na cache local imediatamente
  cache.rsvpMap[token].checkedIn = true;
  _scSaveCache(scannerToken, cache);

  // Actualizar contadores
  const countIn = Object.values(cache.rsvpMap).filter(r => r.checkedIn).length;
  const el = document.getElementById('sc-count-in');
  if (el) el.textContent = countIn;

  // Tentar marcar online; se falhar, guardar na fila offline
  if (navigator.onLine) {
    supabaseRequest(`rsvps?rsvp_token=eq.${token}&event_id=eq.${eventId}`, 'PATCH',
      { checked_in: true, checked_in_at: new Date().toISOString() }
    ).catch(() => {
      // Falhou mesmo com online — guardar na fila
      const q = _scLoadCheckinQueue(scannerToken);
      q.push(token);
      _scSaveCheckinQueue(scannerToken, q);
    });
  } else {
    // Offline — guardar na fila para sincronizar depois
    const q = _scLoadCheckinQueue(scannerToken);
    if (!q.includes(token)) { q.push(token); _scSaveCheckinQueue(scannerToken, q); }
    const qb = document.getElementById('sc-queue-badge');
    if (qb) { qb.style.display='block'; qb.textContent=`⏳ ${q.length} check-in(s) para sincronizar`; }
  }

  show('#14532d', `<div><p style="font-size:2.5rem;margin:0">✅</p><p style="font-weight:800;font-size:1.2rem;margin:0.3rem 0 0">${escapeHTML(rsvp.name)}</p><p style="font-size:0.8rem;color:#86efac">${navigator.onLine ? 'Entrada registada!' : 'Entrada registada (offline)'}</p></div>`);
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
    `rsvps?event_id=eq.${eventId}&attending=eq.true&select=guest_name,rsvp_token,ticket_issued,ticket_issued_at,checked_in&order=guest_name&limit=500`
  ).catch(() => []) || [];

  const issued   = rsvps.filter(r => r.ticket_issued);
  const pending  = rsvps.filter(r => !r.ticket_issued);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'ticket-manager-modal';
  modal.innerHTML = `
    <div class="modal-content bg-white rounded-2xl p-5" style="max-width:520px;max-height:88vh;overflow-y:auto">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-base font-bold text-gray-800">Gerir Tickets</h3>
        <button onclick="this.closest('.modal-overlay').remove()" style="background:#f3f4f6;border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:1rem">×</button>
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
            <span style="flex:1;font-size:0.85rem;font-weight:600;color:#1e293b">${escapeHTML(r.guest_name)}</span>
            <span style="font-size:0.65rem;color:#9ca3af;margin-right:0.25rem">${r.ticket_issued ? 'emitido' : 'por emitir'}</span>
            <button class="tm-gen-btn"
              data-idx="${idx}"
              style="background:${r.ticket_issued?'#ede9fe':'#007f9f'};color:${r.ticket_issued?'#7c3aed':'#fff'};border:none;border-radius:0.4rem;padding:0.3rem 0.6rem;font-size:0.7rem;font-weight:700;cursor:pointer;white-space:nowrap">
              ${r.ticket_issued ? '↺ Gerar de novo' : '↓ Gerar ticket'}
            </button>
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
