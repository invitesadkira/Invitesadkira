// ============================================================================
// ASSISTENTE DE PREENCHIMENTO — passo a passo, uma pergunta de cada vez.
// Substitui o antigo formulário longo (openIntakeFormMain) pelo link que o
// admin God envia ao cliente. Suporta: avançar, saltar (quando opcional),
// e voltar atrás para editar qualquer resposta já dada.
//
// Ramificações:
//  - Se "Quer Save the Date?" = Sim â†’ pergunta nomes/data/prazo já aqui, e
//    essas perguntas NÃO voltam a aparecer mais tarde no fluxo principal.
//  - Se "Vai ter sugestões de presentes?" = Sim â†’ pergunta IBAN ou Lista, e
//    só mostra os campos do tipo escolhido.
// ============================================================================

let _iwState = {};
let _iwHistory = [];      // pilha de keys já visitadas, para o "Voltar"
let _iwForwardStack = []; // o que foi "desfeito" ao clicar Voltar — se a
                           // resposta não mudar ao confirmar outra vez,
                           // continua-se por aqui em vez de recomeçar o
                           // bloco de perguntas a partir do zero.
let _iwEventId = null;
let _iwSteps = [];         // recalculado a cada passo (por causa dos ramos)

// â”€â”€ Construção dos passos, em ordem, respeitando os ramos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _iwComputeSteps(state) {
  const isEngagement = state.event_type === 'engagement';
  const isBirthday   = state.event_type === 'birthday';
  const isWedding    = !isEngagement && !isBirthday;

  const steps = [];
  const seen  = new Set(); // ✅ nunca duplicar uma key — era isso que causava
                            // o loop de "voltar à pergunta 1": quando a lista
                            // de passos era recalculada a meio do fluxo, passos
                            // com a mesma key podiam aparecer 2× (ex: 'names'
                            // dentro do bloco STD E depois de novo no fluxo
                            // principal), e a navegação perdia-se.
  const add = (step) => {
    if (seen.has(step.key)) return; // ignorar duplicados silenciosamente
    seen.add(step.key);
    steps.push(step);
  };

  add({ key:'event_type', q:'Que tipo de evento é?', type:'select', skippable:false,
    options:[['wedding','Casamento'],['engagement','Noivado'],['birthday','Aniversário']] });

  add({ key:'colors', q:'Que cor (ou cores) gostaria para o evento?',
    sub:'Pode escrever o nome da cor ou descrever. É só uma indicação — o administrador define depois as cores exactas.',
    type:'colors_notes', skippable:false });

  // â”€â”€ Nomes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  add({ key:'names', q: isEngagement ? 'Nomes dos noivos' : isBirthday ? 'Nome do/a aniversariante' : 'Nomes dos noivos', type:'names', skippable:false });

  // â”€â”€ Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  add({ key:'date', q:'Data do evento', type:'date', skippable:false });
  add({ key:'confirm_by_date', q:'Até quando os convidados podem confirmar presença?', type:'date', skippable:true });

  // â”€â”€ Texto do convite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!isBirthday) {
    add({ key:'blessing', q:'Frase de bênção (opcional)', sub:'Ex: "Com a bênção de Deus e das nossas famílias"', type:'text', skippable:true });
    add({ key:'bible', q:'Texto bíblico (opcional)', type:'bible', skippable:true });
  }
  add({ key:'invite_text', q:'Texto do convite', sub:'Ex: "Temos a honra de convidar..."', type:'textarea', skippable:false });

  // Nomes dos pais — só para casamentos
  if (isWedding) {
    add({ key:'parents', q:'Nomes dos pais', type:'parents', skippable:true });
  }

  // â”€â”€ Foto e galeria â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  add({ key:'cover', q:'Foto de capa do convite', type:'image', skippable:true });
  add({ key:'gallery', q:'Fotos para a galeria', sub:'Até 8 fotos.', type:'images_multi', skippable:true });

  // â”€â”€ Locais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isWedding) {
    add({ key:'venue_civil',     q:'Cerimónia Civil',      sub:'Local, data e horário (se houver).', type:'venue',        skippable:true });
    add({ key:'venue_ceremony',  q:'Cerimónia Religiosa',  sub:'Local, data e horário (se houver).', type:'venue',        skippable:true });
  }
  if (isEngagement) {
    add({ key:'venue_reception', q:'Local do convívio (onde será a conversa/sentada)?', sub:'Local e horário.', type:'venue_simple', skippable:true });
  } else {
    add({ key:'venue_reception', q:"Copo d'Água / Receção", sub:'Local e horário.', type:'venue_simple', skippable:true });
  }

  // â”€â”€ Estilo e detalhes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  add({ key:'dresscode', q:'Dress Code (opcional)', type:'dresscode', skippable:true });
  add({ key:'manual',    q:'Manual do bom convidado (opcional)', sub:'Um item por linha.', type:'lines', skippable:true });
  add({ key:'schedule',  q:'Cronograma do dia (opcional)', sub:'Um momento por linha. Ex: "16h00 — Cerimónia"', type:'lines', skippable:true });
  if (!isBirthday) {
    add({ key:'story',   q:'A vossa história (opcional)', type:'textarea', skippable:true });
  }
  add({ key:'couplemsg', q:'Mensagem dos anfitriões para os convidados (opcional)', type:'textarea', skippable:true });
  add({ key:'faq',       q:'Perguntas frequentes (opcional)', sub:'Uma pergunta e resposta por linha, separadas por " | ".', type:'lines', skippable:true });
  add({ key:'music',     q:'Música do evento (opcional)', type:'music', skippable:true });
  add({ key:'youtube',   q:'Vídeo do YouTube (opcional)', sub:'Aparece embutido no convite — o convidado não é levado para o YouTube.', type:'youtube', skippable:true });
  add({ key:'final_photo', q:'Foto final (opcional)', sub:'Aparece no final do convite.', type:'image', skippable:true });

  // â”€â”€ RSVP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  add({ key:'companions', q:'Os convidados podem trazer acompanhantes?', type:'yesno_max', skippable:true });
  add({ key:'kids',       q:'Os convidados podem trazer crianças?',      type:'yesno_max', skippable:true });
  add({ key:'messages',   q:'Os convidados podem deixar felicitações/recados?', type:'yesno', skippable:true });
  add({ key:'edit_rsvp',  q:'Os convidados podem editar a resposta depois de confirmar?', type:'yesno', skippable:true });

  // â”€â”€ Presentes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  add({ key:'gifts', q:'Vai ter sugestões de presentes?', type:'yesno', skippable:false });
  if (state.gifts === 'yes') {
    add({ key:'gift_type', q:'Prefere indicar um IBAN, ou uma lista de presentes?', type:'select', skippable:false,
      options:[['iban','Dados Bancários (IBAN)'],['list','Lista de Presentes']] });
    if (state.gift_type === 'iban') {
      add({ key:'iban', q:'Dados bancários', type:'iban', skippable:false });
    } else if (state.gift_type === 'list') {
      add({ key:'gift_list', q:'Lista de presentes', sub:'Um presente por linha.', type:'lines', skippable:false });
    }
  }

  return steps;
}

// â”€â”€ Entrada â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function openIntakeWizard(eventId) {
  _iwEventId = eventId || null;
  _iwState = {};
  _iwHistory = ['event_type'];
  _iwForwardStack = [];
  if (_iwEventId) Store.currentEventId = _iwEventId;

  // ✅ Se a página recarregar a meio (telemóvel a suspender/restaurar a
  // aba, refresh acidental, etc.), recuperar de onde tinha ficado em vez
  // de reiniciar do zero — antes disto, isso fazia parecer que as
  // perguntas "se repetiam" ou voltavam sempre à primeira.
  let _restoredProgress = false;
  try {
    const savedRaw = sessionStorage.getItem('iw_progress');
    if (savedRaw) {
      const saved = JSON.parse(savedRaw);
      if (saved && saved.token === (Store._intakeToken || null) && saved.eventId === (_iwEventId || null) && saved.history && saved.history.length) {
        _iwState = saved.state || {};
        _iwHistory = saved.history;
        _iwForwardStack = saved.forward || [];
        _restoredProgress = true;
      }
    }
  } catch(e) {}

  const ev = _iwEventId ? ((await supabaseRequest(`events?id=eq.${_iwEventId}&select=id,title&limit=1`))?.[0] || {}) : {};

  const modal = document.createElement('div');
  modal.id = 'iw-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:#f8fafc;z-index:9999;overflow-y:auto;display:flex;flex-direction:column';
  modal.innerHTML = `
    <div style="padding:1.25rem 1.25rem 0;text-align:center">
      <div style="font-size:1.15rem;font-weight:900;color:#007f9f">Invites Web-Convites</div>
      ${ev.title ? `<p style="color:#9ca3af;font-size:0.78rem;margin-top:0.15rem">Evento: ${escapeHTML(ev.title)}</p>` : ''}
    </div>
    <div style="padding:0 1.25rem;margin-top:0.75rem">
      <div style="height:6px;background:#e5e7eb;border-radius:999px;overflow:hidden">
        <div id="iw-progress-bar" style="height:100%;width:4%;background:#007f9f;border-radius:999px;transition:width 0.25s"></div>
      </div>
    </div>
    <div style="flex:1;display:flex;align-items:flex-start;justify-content:center;padding:1.5rem 1.25rem 7rem">
      <div id="iw-step-card" style="background:#fff;border-radius:1.25rem;padding:1.75rem 1.5rem;max-width:480px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,0.08)"></div>
    </div>
    <div id="iw-nav-bar" style="position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;padding:0.85rem 1.25rem;padding-bottom:max(0.85rem, env(safe-area-inset-bottom));display:flex;gap:0.6rem;max-width:480px;margin:0 auto;width:100%"></div>
  `;
  document.body.innerHTML = '';
  document.body.appendChild(modal);
  _iwRenderStep(_restoredProgress ? _iwHistory[_iwHistory.length - 1] : 'event_type');
}

function _iwCurrentStep(key) {
  _iwSteps = _iwComputeSteps(_iwState);
  return _iwSteps.find(s => s.key === key) || _iwSteps[0];
}

function _iwRenderStep(key) {
  const step = _iwCurrentStep(key);
  const idx = _iwSteps.findIndex(s => s.key === key);
  const pct = Math.min(96, Math.max(4, Math.round(((idx + 1) / _iwSteps.length) * 100)));
  const bar = document.getElementById('iw-progress-bar');
  if (bar) bar.style.width = pct + '%';

  const card = document.getElementById('iw-step-card');
  card.innerHTML = `
    <p style="font-size:0.7rem;color:#9ca3af;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:0.4rem">Pergunta ${idx + 1} de ${_iwSteps.length}</p>
    <h2 style="font-size:1.15rem;font-weight:800;color:#1e293b;margin-bottom:${step.sub ? '0.4rem' : '1.1rem'}">${escapeHTML(step.q)}</h2>
    ${step.sub ? `<p style="font-size:0.82rem;color:#6b7280;margin-bottom:1.1rem;line-height:1.5">${escapeHTML(step.sub)}</p>` : ''}
    <div id="iw-step-body"></div>
  `;
  _iwRenderBody(step);
  lucide.createIcons();

  const isFirst = idx === 0;
  const isLast = idx === _iwSteps.length - 1;
  const autoAdvances = (step.type === 'select' || step.type === 'yesno');
  const nav = document.getElementById('iw-nav-bar');
  nav.innerHTML = `
    ${!isFirst ? `<button type="button" onclick="_iwGoBack()" class="btn-outline" style="flex:0 0 auto">Voltar</button>` : ''}
    ${step.skippable ? `<button type="button" onclick="_iwSkip()" class="btn-outline" style="flex:1">Saltar</button>` : ''}
    ${autoAdvances ? '' : `<button type="button" onclick="_iwGoNext()" class="btn-main" style="flex:${step.skippable ? '1' : '2'}">${isLast ? 'Finalizar' : 'Avançar'}</button>`}
  `;
}

function _iwPersistProgress() {
  try {
    sessionStorage.setItem('iw_progress', JSON.stringify({
      token: Store._intakeToken || null,
      eventId: _iwEventId || null,
      state: _iwState,
      history: _iwHistory,
      forward: _iwForwardStack,
    }));
  } catch(e) {}
}

function _iwGoBack() {
  if (_iwHistory.length <= 1) return;
  const poppedKey = _iwHistory.pop();
  _iwForwardStack.push(poppedKey);
  const prevKey = _iwHistory[_iwHistory.length - 1];
  _iwPersistProgress();
  _iwRenderStep(prevKey);
}

function _iwSkip() {
  const step = _iwCurrentStep(_iwHistory[_iwHistory.length - 1]);
  delete _iwState[step.key];
  _iwForwardStack = []; // saltar é uma alteração — o caminho à frente já não é garantido
  _iwAdvance(step);
}

async function _iwGoNext() {
  const step = _iwCurrentStep(_iwHistory[_iwHistory.length - 1]);
  const oldValueStr = JSON.stringify(_iwState[step.key]);
  const { value, error } = _iwExtractValue(step);
  if (error) { toast(error); return; }
  if (value !== undefined) _iwState[step.key] = value;
  else if (!step.skippable) { toast('Por favor responde a esta pergunta, ou avança se não se aplicar.'); return; }
  const unchanged = oldValueStr === JSON.stringify(_iwState[step.key]);

  const idx = _iwSteps.findIndex(s => s.key === step.key);
  if (idx === _iwSteps.length - 1) { await _iwFinish(); return; }
  _iwAdvance(step, unchanged);
}

function _iwAdvance(step, unchanged) {
  // ✅ Se a pessoa usou "Voltar" para rever uma resposta e confirma a
  // MESMA resposta de novo (sem mudar nada), continuar pelo caminho que já
  // tinha percorrido antes — em vez de recalcular do zero, o que podia
  // mandar de volta para o início de um bloco de perguntas (ex: Save the
  // Date) só porque esse bloco volta a ser considerado "novo".
  if (unchanged && _iwForwardStack.length) {
    const next = _iwForwardStack.pop();
    _iwHistory.push(next);
    _iwPersistProgress();
    _iwRenderStep(next);
    return;
  }
  _iwForwardStack = []; // a resposta mudou (ou não há histórico à frente) — recalcular o caminho a partir de aqui
  const newSteps = _iwComputeSteps(_iwState);
  const idx = newSteps.findIndex(s => s.key === step.key);
  const next = newSteps[idx + 1] || newSteps[newSteps.length - 1];
  _iwHistory.push(next.key);
  _iwPersistProgress();
  _iwRenderStep(next.key);
}

// â”€â”€ Desenhar o corpo de cada tipo de pergunta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _iwRenderBody(step) {
  const body = document.getElementById('iw-step-body');
  const val = _iwState[step.key];
  const inputCls = 'class="input-field"';

  if (step.type === 'select') {
    body.dataset.selected = val || '';
    body.innerHTML = step.options.map(([v, label]) => `
      <button type="button" data-val="${v}" onclick="_iwSelectOption(this)" style="display:block;width:100%;text-align:left;padding:0.85rem 1rem;border-radius:0.65rem;border:1.5px solid ${val===v?'#007f9f':'#e5e7eb'};background:${val===v?'#f0f9fb':'#fff'};margin-bottom:0.5rem;cursor:pointer;font-weight:700;color:#1e293b;font-size:0.92rem">${escapeHTML(label)}</button>`).join('');
    return;
  }
  if (step.type === 'yesno') {
    body.dataset.selected = val || '';
    body.innerHTML = `<div style="display:flex;gap:0.7rem">
      <button type="button" data-val="yes" onclick="_iwSelectOption(this)" style="flex:1;padding:0.9rem;border-radius:0.65rem;border:1.5px solid ${val==='yes'?'#007f9f':'#e5e7eb'};background:${val==='yes'?'#f0f9fb':'#fff'};font-weight:800;cursor:pointer;color:#1e293b">Sim</button>
      <button type="button" data-val="no" onclick="_iwSelectOption(this)" style="flex:1;padding:0.9rem;border-radius:0.65rem;border:1.5px solid ${val==='no'?'#007f9f':'#e5e7eb'};background:${val==='no'?'#f0f9fb':'#fff'};font-weight:800;cursor:pointer;color:#1e293b">Não</button>
    </div>`;
    return;
  }
  if (step.type === 'yesno_max') {
    const yn = val ? val.yn : '';
    body.dataset.selected = yn;
    body.innerHTML = `<div style="display:flex;gap:0.7rem;margin-bottom:0.8rem">
      <button type="button" data-val="yes" onclick="_iwSelectOption(this,true)" style="flex:1;padding:0.9rem;border-radius:0.65rem;border:1.5px solid ${yn==='yes'?'#007f9f':'#e5e7eb'};background:${yn==='yes'?'#f0f9fb':'#fff'};font-weight:800;cursor:pointer;color:#1e293b">Sim</button>
      <button type="button" data-val="no" onclick="_iwSelectOption(this,true)" style="flex:1;padding:0.9rem;border-radius:0.65rem;border:1.5px solid ${yn==='no'?'#007f9f':'#e5e7eb'};background:${yn==='no'?'#f0f9fb':'#fff'};font-weight:800;cursor:pointer;color:#1e293b">Não</button>
    </div>
    <div id="iw-max-wrap" style="display:${yn==='yes'?'block':'none'}">
      <label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Máximo por convidado</label>
      <input id="iw-max-input" type="number" min="1" max="20" ${inputCls} value="${val&&val.max?val.max:''}" placeholder="Ex: 2">
    </div>`;
    return;
  }
  if (step.type === 'text') {
    body.innerHTML = `<input id="iw-text" type="text" ${inputCls} value="${escapeHTML(val||'')}">`;
    return;
  }
  if (step.type === 'textarea' || step.type === 'lines') {
    body.innerHTML = `<textarea id="iw-textarea" rows="5" ${inputCls}>${escapeHTML(val||'')}</textarea>`;
    return;
  }
  if (step.type === 'date') {
    body.innerHTML = `<input id="iw-date" type="date" ${inputCls} value="${escapeHTML(val||'')}">`;
    return;
  }
  if (step.type === 'colors_notes') {
    body.innerHTML = `<label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Cor principal</label>
      <input id="iw-color1" type="text" ${inputCls} value="${escapeHTML(val&&val.c1||'')}" placeholder="Ex: verde-oliva" style="margin-bottom:0.7rem">
      <label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">2ª cor (opcional)</label>
      <input id="iw-color2" type="text" ${inputCls} value="${escapeHTML(val&&val.c2||'')}" placeholder="Ex: dourado">`;
    return;
  }
  if (step.type === 'names') {
    body.innerHTML = `<label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Nome do Noivo</label>
      <input id="iw-groom" type="text" ${inputCls} value="${escapeHTML(val&&val.groom||'')}" style="margin-bottom:0.7rem">
      <label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Nome da Noiva</label>
      <input id="iw-bride" type="text" ${inputCls} value="${escapeHTML(val&&val.bride||'')}">`;
    return;
  }
  if (step.type === 'parents') {
    body.innerHTML = `<label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Pais do Noivo (um por linha)</label>
      <textarea id="iw-groom-parents" rows="2" ${inputCls} style="margin-bottom:0.7rem">${escapeHTML(val&&val.groomParents||'')}</textarea>
      <label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Pais da Noiva (um por linha)</label>
      <textarea id="iw-bride-parents" rows="2" ${inputCls}>${escapeHTML(val&&val.brideParents||'')}</textarea>`;
    return;
  }
  if (step.type === 'bible') {
    body.innerHTML = `<textarea id="iw-bible-text" rows="3" ${inputCls} placeholder="Ex: O amor é paciente, o amor é bondoso..." style="margin-bottom:0.6rem">${escapeHTML(val&&val.text||'')}</textarea>
      <input id="iw-bible-ref" type="text" ${inputCls} placeholder="Referência (ex: 1 Coríntios 13:4)" value="${escapeHTML(val&&val.ref||'')}">`;
    return;
  }
  if (step.type === 'image') {
    body.innerHTML = `<div id="iw-img-wrap" onclick="document.getElementById('iw-img-file').click()" style="border:2px dashed #cbd5e1;border-radius:0.75rem;padding:1.5rem;text-align:center;cursor:pointer;background:#f8fafc">
        ${val ? `<img src="${val}" style="max-height:160px;border-radius:0.5rem;object-fit:cover;width:100%">` : `<p style="color:#64748b;font-size:0.85rem;font-weight:600">Clica para escolher uma foto</p>`}
      </div>
      <input type="file" id="iw-img-file" accept="image/*" style="display:none" onchange="_iwUploadSingleImage(this,'${step.key}')">
      <p id="iw-img-status" style="font-size:0.75rem;color:#9ca3af;margin-top:0.4rem"></p>`;
    return;
  }
  if (step.type === 'images_multi') {
    const urls = Array.isArray(val) ? val : [];
    body.dataset.urls = JSON.stringify(urls);
    body.innerHTML = `<div id="iw-gallery-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;margin-bottom:0.5rem"></div>
      <button type="button" onclick="document.getElementById('iw-gallery-file').click()" class="btn-outline text-sm">+ Adicionar Fotos</button>
      <input type="file" id="iw-gallery-file" accept="image/*" multiple style="display:none" onchange="_iwUploadGalleryImages(this)">
      <p id="iw-gallery-status" style="font-size:0.75rem;color:#9ca3af;margin-top:0.4rem"></p>`;
    _iwRenderGalleryGrid(urls);
    return;
  }
  if (step.type === 'venue' || step.type === 'venue_simple') {
    body.innerHTML = `<label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Local</label>
      <input id="iw-venue-name" type="text" ${inputCls} value="${escapeHTML(val&&val.name||'')}" style="margin-bottom:0.7rem">
      ${step.type==='venue' ? `<label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Data (se diferente da data do evento)</label>
      <input id="iw-venue-date" type="date" ${inputCls} value="${escapeHTML(val&&val.date||'')}" style="margin-bottom:0.7rem">` : ''}
      <label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Horário</label>
      <input id="iw-venue-time" type="time" ${inputCls} value="${escapeHTML(val&&val.time||'')}">`;
    return;
  }
  if (step.type === 'dresscode') {
    body.innerHTML = `<textarea id="iw-dresscode-text" rows="3" ${inputCls} placeholder="Ex: Traje social. Pedimos cores em tons terrosos.">${escapeHTML(val||'')}</textarea>`;
    return;
  }
  if (step.type === 'music') {
    body.innerHTML = `<label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Link (YouTube ou áudio directo)</label>
      <input id="iw-music-url" type="text" ${inputCls} value="${escapeHTML(val&&val.url||'')}" style="margin-bottom:0.7rem">
      <label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Título da música</label>
      <input id="iw-music-title" type="text" ${inputCls} value="${escapeHTML(val&&val.title||'')}" style="margin-bottom:0.7rem">
      <label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Cantor/Artista</label>
      <input id="iw-music-artist" type="text" ${inputCls} value="${escapeHTML(val&&val.artist||'')}">`;
    return;
  }
  if (step.type === 'youtube') {
    body.innerHTML = `<label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Link do vídeo</label>
      <input id="iw-yt-url" type="text" ${inputCls} value="${escapeHTML(val&&val.url||'')}" style="margin-bottom:0.7rem">
      <label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Título (opcional)</label>
      <input id="iw-yt-title" type="text" ${inputCls} value="${escapeHTML(val&&val.title||'')}">`;
    return;
  }
  if (step.type === 'iban') {
    body.innerHTML = `<label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Mensagem (opcional)</label>
      <textarea id="iw-iban-msg" rows="2" ${inputCls} style="margin-bottom:0.7rem">${escapeHTML(val&&val.msg||'')}</textarea>
      <label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Titular</label>
      <input id="iw-iban-holder" type="text" ${inputCls} value="${escapeHTML(val&&val.holder||'')}" style="margin-bottom:0.7rem">
      <label style="font-size:0.8rem;color:#6b7280;display:block;margin-bottom:0.3rem">Número de IBAN</label>
      <input id="iw-iban-number" type="text" ${inputCls} value="${escapeHTML(val&&val.number||'')}">`;
    return;
  }
  body.innerHTML = '';
}

function _iwSelectOption(btn, isMaxType) {
  if (btn.disabled) return;
  const wrap = btn.parentElement;
  wrap.querySelectorAll('button[data-val]').forEach(b => {
    const active = b === btn;
    b.style.borderColor = active ? '#007f9f' : '#e5e7eb';
    b.style.background = active ? '#f0f9fb' : '#fff';
  });
  document.getElementById('iw-step-body').dataset.selected = btn.dataset.val;
  if (isMaxType) {
    const maxWrap = document.getElementById('iw-max-wrap');
    if (maxWrap) maxWrap.style.display = btn.dataset.val === 'yes' ? 'block' : 'none';
  } else {
    // ✅ Perguntas de escolha simples (Sim/Não, ou opções predefinidas) —
    // ao escolher, avança logo por si. Desactivar os botões logo a seguir
    // evita um duplo-toque acidental disparar dois avanços em fila.
    wrap.querySelectorAll('button[data-val]').forEach(b => b.disabled = true);
    setTimeout(_iwGoNext, 180);
  }
}

async function _iwUploadSingleImage(input, stepKey) {
  const file = input.files[0];
  if (!file) return;
  const status = document.getElementById('iw-img-status');
  if (status) status.textContent = 'A carregar...';
  try {
    const url = await uploadImageToStorage(file, 'event-covers', 'Foto do assistente');
    _iwState[stepKey] = url;
    const wrap = document.getElementById('iw-img-wrap');
    if (wrap) wrap.innerHTML = `<img src="${url}" style="max-height:160px;border-radius:0.5rem;object-fit:cover;width:100%">`;
    if (status) status.textContent = 'Foto carregada!';
    _iwPersistProgress();
  } catch(e) {
    if (status) status.textContent = 'Erro ao carregar — tenta de novo.';
  }
}

function _iwRenderGalleryGrid(urls) {
  const grid = document.getElementById('iw-gallery-grid');
  if (!grid) return;
  grid.innerHTML = urls.map((url, i) => `
    <div style="position:relative;aspect-ratio:1">
      <img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:0.5rem">
      <button type="button" onclick="_iwRemoveGalleryImage(${i})" style="position:absolute;top:2px;right:2px;background:rgba(239,68,68,0.9);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:1">✕</button>
    </div>`).join('');
}

async function _iwUploadGalleryImages(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const body = document.getElementById('iw-step-body');
  let urls = JSON.parse(body.dataset.urls || '[]');
  const status = document.getElementById('iw-gallery-status');
  for (const file of files) {
    if (urls.length >= 8) { if (status) status.textContent = 'Máximo de 8 fotos.'; break; }
    if (status) status.textContent = `A carregar ${urls.length + 1}...`;
    try {
      const url = await uploadImageToStorage(file, 'event-covers', 'Foto da galeria');
      urls.push(url);
    } catch(e) {}
  }
  body.dataset.urls = JSON.stringify(urls);
  _iwState['gallery'] = urls;
  _iwRenderGalleryGrid(urls);
  if (status) status.textContent = urls.length + ' foto(s) carregada(s).';
  input.value = '';
  _iwPersistProgress();
}

function _iwRemoveGalleryImage(index) {
  const body = document.getElementById('iw-step-body');
  let urls = JSON.parse(body.dataset.urls || '[]');
  urls.splice(index, 1);
  body.dataset.urls = JSON.stringify(urls);
  _iwState['gallery'] = urls;
  _iwRenderGalleryGrid(urls);
  _iwPersistProgress();
}

// â”€â”€ Ler a resposta actual do ecrã â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _iwExtractValue(step) {
  const g = id => document.getElementById(id)?.value?.trim() || '';
  const body = document.getElementById('iw-step-body');

  if (step.type === 'select' || step.type === 'yesno') {
    const sel = body?.dataset?.selected || '';
    if (!sel && !step.skippable) return { error: 'Por favor escolhe uma opção.' };
    return { value: sel || undefined };
  }
  if (step.type === 'yesno_max') {
    const sel = body?.dataset?.selected || '';
    if (!sel) return step.skippable ? { value: undefined } : { error: 'Por favor escolhe Sim ou Não.' };
    const max = sel === 'yes' ? (g('iw-max-input') || null) : null;
    return { value: { yn: sel, max } };
  }
  if (step.type === 'text') {
    const v = g('iw-text');
    return { value: v || undefined };
  }
  if (step.type === 'textarea' || step.type === 'lines') {
    const v = document.getElementById('iw-textarea')?.value?.trim() || '';
    return { value: v || undefined };
  }
  if (step.type === 'date') {
    const v = g('iw-date');
    if (!v && !step.skippable) return { error: 'Por favor indica a data.' };
    return { value: v || undefined };
  }
  if (step.type === 'colors_notes') {
    const c1 = g('iw-color1'), c2 = g('iw-color2');
    if (!c1) return { error: 'Por favor indica pelo menos uma cor.' };
    return { value: { c1, c2 } };
  }
  if (step.type === 'names') {
    const groom = g('iw-groom'), bride = g('iw-bride');
    if (!groom && !bride) return { error: 'Por favor indica pelo menos um dos nomes.' };
    return { value: { groom, bride } };
  }
  if (step.type === 'parents') {
    const groomParents = g('iw-groom-parents'), brideParents = g('iw-bride-parents');
    if (!groomParents && !brideParents) return { value: undefined };
    return { value: { groomParents, brideParents } };
  }
  if (step.type === 'bible') {
    const text = document.getElementById('iw-bible-text')?.value?.trim() || '', ref = g('iw-bible-ref');
    if (!text) return { value: undefined };
    return { value: { text, ref } };
  }
  if (step.type === 'image') {
    return { value: _iwState[step.key] || undefined };
  }
  if (step.type === 'images_multi') {
    const urls = JSON.parse(body?.dataset?.urls || '[]');
    return { value: urls.length ? urls : undefined };
  }
  if (step.type === 'venue' || step.type === 'venue_simple') {
    const name = g('iw-venue-name');
    if (!name) return { value: undefined };
    const date = step.type === 'venue' ? g('iw-venue-date') : '';
    const time = g('iw-venue-time');
    return { value: { name, date, time } };
  }
  if (step.type === 'dresscode') {
    const v = document.getElementById('iw-dresscode-text')?.value?.trim() || '';
    return { value: v || undefined };
  }
  if (step.type === 'music') {
    const url = g('iw-music-url'), title = g('iw-music-title'), artist = g('iw-music-artist');
    if (!url) return { value: undefined };
    return { value: { url, title, artist } };
  }
  if (step.type === 'youtube') {
    const url = g('iw-yt-url'), title = g('iw-yt-title');
    if (!url) return { value: undefined };
    return { value: { url, title } };
  }
  if (step.type === 'iban') {
    const msg = document.getElementById('iw-iban-msg')?.value?.trim() || '', holder = g('iw-iban-holder'), number = g('iw-iban-number');
    if (!number) return { error: 'Por favor indica o número de IBAN.' };
    return { value: { msg, holder, number } };
  }
  return { value: undefined };
}

// â”€â”€ Guardar tudo, no final â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function _iwFinish() {
  const s = _iwState;
  const card = document.getElementById('iw-step-card');
  const nav = document.getElementById('iw-nav-bar');
  card.innerHTML = `<div style="text-align:center;padding:1rem 0"><p style="font-weight:700;color:#1e293b">A guardar tudo...</p><p id="iw-finish-status" style="font-size:0.82rem;color:#9ca3af;margin-top:0.5rem"></p></div>`;
  nav.innerHTML = '';
  const status = (t) => { const el = document.getElementById('iw-finish-status'); if (el) el.textContent = t; };

  try {
    if (_iwEventId) {
      // Já existe um evento — aplicar tudo directamente, como antes.
      await _iwApplyStateToEvent(s, _iwEventId, status);
    } else {
      // ✅ Ainda não há evento (nem talvez conta de cliente) — guardar as
      // respostas como "pendente". O admin associa isto a um evento mais
      // tarde, no painel de administrador.
      status('A guardar as respostas...');
      await supabaseRequest('intake_submissions', 'POST', {
        token: Store._intakeToken || null,
        answers: s,
        status: 'pending',
      });
    }

    status('A finalizar...');
    if (Store._intakeToken) {
      await markIntakeTokenUsed(Store._intakeToken).catch(() => {});
    }
    try { sessionStorage.removeItem('iw_progress'); } catch(e) {}

    card.innerHTML = `<div style="text-align:center;padding:1.5rem 0">
      <div style="width:60px;height:60px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h2 style="font-size:1.2rem;font-weight:800;color:#1e293b;margin-bottom:0.5rem">Tudo guardado!</h2>
      <p style="color:#6b7280;font-size:0.9rem">Obrigado por preencher os detalhes do seu evento. O nosso administrador vai agora finalizar o convite com as cores e os últimos toques.</p>
    </div>`;
  } catch(err) {
    console.error('Erro ao guardar assistente:', err);
    card.innerHTML = `<div style="text-align:center;padding:1.5rem 0">
      <p style="font-weight:700;color:#dc2626;margin-bottom:0.5rem">Ocorreu um erro ao guardar.</p>
      <p style="color:#6b7280;font-size:0.85rem;margin-bottom:1rem">Verifica a tua ligação à internet e tenta novamente.</p>
      <button type="button" onclick="_iwFinish()" class="btn-main">Tentar de novo</button>
    </div>`;
  }
}

// â”€â”€ Aplicar um conjunto de respostas (do assistente) a um evento real —
// reaproveitado tanto pelo fim do assistente (quando já há evento) como
// pelo admin, mais tarde, ao associar uma submissão pendente a um evento
// (novo ou já existente). â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function _iwApplyStateToEvent(s, eventId, statusFn) {
  const status = statusFn || (() => {});

  // â”€â”€ Tabela events â”€â”€
  const eventsPatch = { event_type: s.event_type || null, invite_layout: s.layout || 'sections' };
  if (s.names) { eventsPatch.groom_name = s.names.groom || null; eventsPatch.bride_name = s.names.bride || null; }
  if (s.date) eventsPatch.date = s.date;
  if (s.confirm_by_date) eventsPatch.confirm_by_date = s.confirm_by_date;
  if (s.cover) eventsPatch.cover_image = s.cover;
  if (s.music) { eventsPatch.music_url = s.music.url; }
  eventsPatch.save_the_date_enabled = s.want_std === 'yes' ? 'yes' : 'no';
  if (s.want_std === 'yes') {
    if (s.std_cover) eventsPatch.std_cover_url = s.std_cover;
    if (s.std_text) { eventsPatch.std_extra_phrase = s.std_text; eventsPatch.std_extra_phrase_enabled = 'yes'; }
  }
  if (s.companions) { eventsPatch.allow_companions = s.companions.yn === 'yes' ? 'yes' : 'no'; if (s.companions.max) eventsPatch.max_companions = s.companions.max; }
  if (s.kids) { eventsPatch.allow_kids = s.kids.yn === 'yes' ? 'yes' : 'no'; if (s.kids.max) eventsPatch.max_kids = s.kids.max; }
  if (s.messages) { eventsPatch.allow_messages = s.messages === 'yes' ? 'yes' : 'no'; eventsPatch.show_guest_messages = s.messages === 'yes' ? 'yes' : 'no'; }
  if (s.edit_rsvp) eventsPatch.allow_edit_rsvp = s.edit_rsvp === 'yes' ? 'yes' : 'no';
  eventsPatch.allow_gifts = s.gifts === 'yes' ? 'yes' : 'no';
  if (s.gift_type === 'iban' && s.iban) {
    eventsPatch.iban_message = s.iban.msg || null;
    eventsPatch.iban_holder = s.iban.holder || null;
    eventsPatch.iban_number = s.iban.number || null;
  }

  status('A guardar dados principais...');
  await supabaseRequest(`events?id=eq.${eventId}`, 'PATCH', eventsPatch);

  if ((s.date || s.confirm_by_date) && typeof saveEventDates === 'function') {
    await saveEventDates(eventId, { event_date: s.date || null, confirm_by_date: s.confirm_by_date || null }).catch(() => {});
  }

  // â”€â”€ event_visuals â”€â”€
  status('A guardar conteúdo do convite...');
  const visualsPatch = {};
  if (s.colors) visualsPatch.intake_color_notes = `Cor principal: ${s.colors.c1}${s.colors.c2 ? ` | 2ª cor: ${s.colors.c2}` : ''}`;
  if (s.blessing) visualsPatch.invite_blessing = s.blessing;
  if (s.bible) { visualsPatch.bible_text = s.bible.text; visualsPatch.bible_ref = s.bible.ref || null; visualsPatch.show_bible = 'yes'; }
  if (s.invite_text) { visualsPatch.invite_text = s.invite_text; visualsPatch.show_invite = 'yes'; }
  if (s.parents) { visualsPatch.groom_parents = s.parents.groomParents || null; visualsPatch.bride_parents = s.parents.brideParents || null; visualsPatch.show_parents = 'yes'; }
  if (s.gallery && s.gallery.length) { visualsPatch.gallery_urls = s.gallery.join('\n'); visualsPatch.show_gallery = 'yes'; }
  if (s.dresscode) { visualsPatch.dresscode_text = s.dresscode; visualsPatch.show_dresscode = 'yes'; }
  if (s.manual) { visualsPatch.manual_items = s.manual; visualsPatch.show_manual = 'yes'; }
  if (s.schedule) { visualsPatch.schedule_items = s.schedule; visualsPatch.show_schedule = 'yes'; }
  if (s.story) { visualsPatch.story_text = s.story; visualsPatch.show_story = 'yes'; }
  if (s.couplemsg) { visualsPatch.couplemsg_text = s.couplemsg; visualsPatch.show_couplemsg = 'yes'; }
  if (s.faq) {
    const items = s.faq.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [q, a] = l.split('|').map(p => p && p.trim());
      return { q: q || l, a: a || '' };
    });
    if (items.length) { visualsPatch.event_faq_items = JSON.stringify(items); visualsPatch.show_event_faq = 'yes'; }
  }
  if (s.music) visualsPatch.music_title = [s.music.title, s.music.artist].filter(Boolean).join(' — ') || null;
  if (s.youtube) { visualsPatch.youtube_video_url = s.youtube.url; visualsPatch.youtube_video_title = s.youtube.title || null; visualsPatch.show_youtube_video = 'yes'; }
  if (s.final_photo) { visualsPatch.final_photo_url = s.final_photo; visualsPatch.show_final_photo = 'yes'; }
  if (s.gift_type) visualsPatch.show_dress_gifts = s.gift_type === 'list' ? 'yes' : 'no';

  if (Object.keys(visualsPatch).length) await saveEventVisuals(eventId, visualsPatch);

  // â”€â”€ Lista de presentes (tabela dedicada "gifts") â”€â”€
  if (s.gift_type === 'list' && s.gift_list) {
    status('A guardar lista de presentes...');
    const giftNames = s.gift_list.split('\n').map(l => l.trim().replace(/^[\s\-\*â€¢\.]+/, '')).filter(l => l && l.length > 1);
    for (const name of giftNames) {
      await supabaseRequest('gifts', 'POST', { event_id: eventId, name, category: 'Sem categoria', reserved: false }).catch(() => {});
    }
  }

  // â”€â”€ event_venues â”€â”€
  status('A guardar locais...');
  const venuesPatch = {};
  if (s.venue_civil) { venuesPatch.venue_civil = s.venue_civil.name; venuesPatch.venue_civil_date = s.venue_civil.date || null; venuesPatch.venue_civil_time = s.venue_civil.time || null; }
  if (s.venue_ceremony) { venuesPatch.venue_ceremony = s.venue_ceremony.name; venuesPatch.venue_ceremony_date = s.venue_ceremony.date || null; venuesPatch.venue_ceremony_time = s.venue_ceremony.time || null; }
  if (s.venue_reception) { venuesPatch.venue_reception = s.venue_reception.name; venuesPatch.venue_reception_time = s.venue_reception.time || null; }
  if (Object.keys(venuesPatch).length) { venuesPatch.show_venues = 'yes'; await saveEventVenues(eventId, venuesPatch).catch(() => {}); }
}

// â”€â”€ Painel do admin: submissões pendentes (ainda sem evento) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function renderAdminPendingSubmissions() {
  const container = document.getElementById('admin-pending-submissions');
  if (!container) return;
  try {
    const rows = await supabaseRequest(`intake_submissions?status=eq.pending&select=id,answers,created_at&order=created_at.desc`);
    if (!rows || !rows.length) { container.innerHTML = ''; return; }
    container.innerHTML = `<h3 class="text-sm font-bold text-gray-700 mb-2">Pedidos Pendentes — sem evento associado (${rows.length})</h3>` +
      rows.map(r => {
        const a = r.answers || {};
        const names = a.names ? [a.names.groom, a.names.bride].filter(Boolean).join(' & ') : null;
        const when = new Date(r.created_at).toLocaleDateString('pt-PT');
        return `<div class="bg-white rounded-xl shadow-sm p-4 mb-2 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p class="font-semibold text-gray-800">${escapeHTML(names || '(nomes ainda não preenchidos)')}</p>
            <p class="text-xs text-gray-400">Recebido em ${when}</p>
          </div>
          <div class="flex gap-2">
            <button class="btn-outline text-xs" onclick="_iwViewSubmission('${r.id}')">Ver Respostas</button>
            <button class="btn-outline text-xs" onclick="_iwOpenApplyToExisting('${r.id}')">Evento Existente</button>
            <button class="btn-main text-xs" onclick="_iwCreateEventFromSubmission('${r.id}')">Criar Evento</button>
            <button class="text-xs" style="background:#fee2e2;color:#dc2626;border:none;border-radius:0.5rem;padding:0.4rem 0.7rem;font-weight:700;cursor:pointer" onclick="_iwDeleteSubmission('${r.id}')">Eliminar</button>
          </div>
        </div>`;
      }).join('');
    lucide.createIcons();
  } catch(e) { console.warn('Erro ao carregar submissões pendentes:', e); }
}

async function _iwDeleteSubmission(id) {
  if (!confirm('Eliminar este pedido permanentemente? Esta acção não pode ser desfeita — use isto quando o cliente não avançar com o pedido.')) return;
  try {
    await supabaseRequest(`intake_submissions?id=eq.${id}`, 'DELETE', {});
    toast('Pedido eliminado.');
    renderAdminPendingSubmissions();
  } catch(e) {
    console.error('Erro ao eliminar submissão:', e);
    toast('Erro ao eliminar. Tenta novamente.');
  }
}

function _iwViewSubmission(id) {
  supabaseRequest(`intake_submissions?id=eq.${id}&select=answers&limit=1`).then(rows => {
    const a = (rows && rows[0] && rows[0].answers) || {};
    const lines = Object.keys(a).map(k => `<p style="margin-bottom:0.5rem"><strong style="color:#374151">${escapeHTML(k)}:</strong> <span style="color:#6b7280">${escapeHTML(JSON.stringify(a[k]))}</span></p>`).join('');
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-6" style="max-width:560px;max-height:80vh;overflow-y:auto">
      <h3 class="text-base font-bold text-gray-800 mb-3">Respostas recebidas</h3>
      <div style="font-size:0.82rem">${lines || '<p>Sem respostas.</p>'}</div>
      <button class="btn-outline text-sm w-full mt-3" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
    </div>`;
    document.body.appendChild(modal);
  });
}

async function _iwCreateEventFromSubmission(submissionId) {
  // ✅ Recarregar lista de utilizadores do Supabase em vez de usar o cache
  // — o admin pode ter criado uma conta nova nesta mesma sessão, e essa
  // conta só existe no Supabase, não no Store.users em memória.
  toast('A carregar contas...');
  try {
    const freshUsers = await supabaseRequest('accounts?select=id,phone,role,status,admin_label&order=created_at.desc');
    if (freshUsers) Store.users = freshUsers;
  } catch(e) {}

  const clients = (Store.users || []).filter(u => !isAdminRole(u.role) && u.status !== 'deleted');
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-6" style="max-width:420px">
    <h3 class="text-base font-bold text-gray-800 mb-2">A que conta pertence este evento?</h3>
    <p class="text-xs text-gray-500 mb-3">Escolhe o cliente já registado, ou cria o evento na tua própria conta (podes transferir depois).</p>
    <select id="iw-create-owner" class="input-field text-sm mb-3">
      <option value="${Store.currentUser.id}">— A minha conta (admin) —</option>
      ${clients.map(u => `<option value="${u.id}">${escapeHTML(u.phone || u.id)}${u.admin_label ? ' — ' + escapeHTML(u.admin_label) : ''}</option>`).join('')}
    </select>
    <div class="flex gap-2">
      <button class="flex-1 btn-main" onclick="_iwConfirmCreateEvent('${submissionId}', document.getElementById('iw-create-owner').value, this.closest('.modal-overlay'))">Criar Evento</button>
      <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function _iwConfirmCreateEvent(submissionId, ownerUserId, modalEl) {
  modalEl.remove();
  toast('A criar evento...');
  try {
    const rows = await supabaseRequest(`intake_submissions?id=eq.${submissionId}&select=answers&limit=1`);
    const s = (rows && rows[0] && rows[0].answers) || {};
    const title = [s.names && s.names.groom, s.names && s.names.bride].filter(Boolean).join(' & ') || 'Novo Evento (assistente)';
    const newId = uid();
    const created = await supabaseRequest('events', 'POST', {
      id: newId, user_id: ownerUserId, title, event_code: newId,
      date: s.date || null,
    });
    if (!created) { toast('Erro ao criar o evento. Tenta novamente.'); return; }
    await _iwApplyStateToEvent(s, newId, () => {});
    await supabaseRequest(`intake_submissions?id=eq.${submissionId}`, 'PATCH', { status: 'applied', applied_to_event_id: newId, applied_at: new Date().toISOString() });

    // ✅ Recarregar TODOS os eventos do Supabase (não só os do admin) para
    // que o evento novo apareça imediatamente no painel, mesmo que pertença
    // a outro utilizador.
    try {
      const freshEvents = await supabaseRequest('events?select=id,user_id,title,date,event_code,is_example_event,scanner_token,ticket_template_url,ticket_name_x,ticket_name_y,ticket_qr_x,ticket_qr_y,ticket_name_size,ticket_qr_size&order=created_at.desc&limit=500');
      if (freshEvents) Store.events = freshEvents;
    } catch(e) {}

    toast('Evento criado e associado com sucesso!');
    renderAdmin();
  } catch(e) {
    console.error('Erro ao criar evento a partir da submissão:', e);
    toast('Erro ao criar o evento. Tenta novamente.');
  }
}

async function _iwOpenApplyToExisting(submissionId) {
  toast('A carregar eventos...');
  // Recarregar eventos frescos — o evento criado para este cliente pode
  // ainda não estar no Store.events se foi criado nesta sessão
  try {
    const freshEvents = await supabaseRequest('events?select=id,user_id,title,date,event_code,scanner_token,ticket_template_url,ticket_name_x,ticket_name_y,ticket_qr_x,ticket_qr_y,ticket_name_size,ticket_qr_size&order=created_at.desc&limit=500');
    if (freshEvents) Store.events = freshEvents;
  } catch(e) {}

  const events = Store.events || [];
  if (!events.length) { toast('Não há eventos existentes.'); return; }
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `<div class="modal-content bg-white rounded-2xl p-6" style="max-width:420px">
    <h3 class="text-base font-bold text-gray-800 mb-2">Aplicar a qual evento?</h3>
    <p class="text-xs text-gray-500 mb-3">As respostas vão preencher/substituir os campos correspondentes nesse evento.</p>
    <select id="iw-apply-target" class="input-field text-sm mb-3">
      ${events.map(e => `<option value="${e.id}">${escapeHTML(e.title || e.id)}${e.date ? ' — ' + e.date : ''}</option>`).join('')}
    </select>
    <div class="flex gap-2">
      <button class="flex-1 btn-main" onclick="_iwConfirmApplyToExisting('${submissionId}', document.getElementById('iw-apply-target').value, this.closest('.modal-overlay'))">Aplicar</button>
      <button class="flex-1 btn-outline" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function _iwConfirmApplyToExisting(submissionId, eventId, modalEl) {
  modalEl.remove();
  toast('A aplicar respostas...');
  try {
    const rows = await supabaseRequest(`intake_submissions?id=eq.${submissionId}&select=answers&limit=1`);
    const s = (rows && rows[0] && rows[0].answers) || {};
    await _iwApplyStateToEvent(s, eventId, () => {});
    await supabaseRequest(`intake_submissions?id=eq.${submissionId}`, 'PATCH', { status: 'applied', applied_to_event_id: eventId, applied_at: new Date().toISOString() });
    toast('Respostas aplicadas com sucesso!');
    renderAdmin();
  } catch(e) {
    console.error('Erro ao aplicar submissão a evento existente:', e);
    toast('Erro ao aplicar. Tenta novamente.');
  }
}






