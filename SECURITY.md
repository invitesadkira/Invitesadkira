# Segurança do AdKira — o que foi feito e o que falta

Este documento resume tudo o que foi corrigido directamente no código, e o
que precisa da tua acção no painel do Supabase (eu não tenho acesso a esse
painel nem à tua base de dados — só ao código-fonte).

---

## ✅ Já corrigido no código (não precisas de fazer nada)

### 1. XSS — texto de convidados a executar código no browser de outra pessoa
Vários sítios inseriam nomes de convidados, mensagens, nomes de presentes,
etc. directamente em HTML sem escapar. Isto significava que um convidado
podia preencher o nome com algo como `<img src=x onerror=...>` e esse
código corria no ecrã do **organizador** (ou de outros convidados) quando
esses dados eram mostrados. Corrigido em:
- Lista de confirmações do organizador (`events.js`)
- Exportação em PDF da lista de presentes (`events.js`)
- Lista pública de presentes vista por todos os convidados (`guest.js`)
- Modais de editar/remover presente e reserva (`guest.js`)
- Painel de gestão de contas do admin (`admin.js`)

A função `escapeHTML()` passou a viver num único sítio (`config.js`,
carregado primeiro) em vez de estar duplicada — qualquer texto novo que
adicionares no futuro deve passar por ela antes de ir para `innerHTML`.

### 2. Senhas em texto simples visíveis no painel admin
O painel admin mostrava a senha de qualquer utilizador em texto simples na
lista de contas. Agora mostra `••••••••` com um botão "redefinir" (que já
existia, só não estava ligado ali). A senha continua a ser guardada em
texto simples na base de dados — ver Fase 2/3 abaixo para resolver isso de
raiz.

### 3. "CSV injection" nas exportações
Se um convidado pusesse `=ALGUMACOISA(...)` como nome, o Excel podia tentar
executar isso como fórmula ao abrir o ficheiro exportado (lista de
convidados, backup do admin). Agora esses valores são prefixados
automaticamente para serem lidos como texto simples.

### 4. Registos sensíveis na consola do browser
O login registava na consola a conta inteira encontrada — incluindo a
senha em texto simples — visível a qualquer pessoa com a consola aberta
(ex: computador partilhado, partilha de ecrã). Todos os `console.log`
informativos foram trocados por `dlog()`, que só imprime se ligares
manualmente `DEBUG_NETWORK = true` no início de `config.js`. Os
`console.error` continuam visíveis (úteis para diagnosticar problemas
reais).

### 5. Política de senha fraca
Mínimo passou de 4 para 6 caracteres (registo e redefinição pelo admin).

### 6. Sem proteção contra tentativa-e-erro no login
Adicionado um bloqueio temporário (2 min) depois de 5 tentativas falhadas
com o mesmo número de telefone, guardado no browser.

⚠️ **Limite desta protecção:** isto só dificulta quem usa o teu formulário
de login normalmente. Alguém com conhecimentos técnicos pode continuar a
tentar senhas directamente contra a API do Supabase, sem passar pelo
formulário — por isso o ponto seguinte (RLS) é tão importante.

---

## 🟡 Precisa da tua acção no Supabase (eu não tenho acesso)

Criei dois ficheiros SQL na pasta `supabase/`:

### `supabase/01_rls_fase1.sql` — fazer isto assim que possível
Activa "Row Level Security" (RLS) em todas as tabelas. **Se isto ainda não
estiver activado no teu projecto, qualquer pessoa com a chave pública (que
está visível no código-fonte do site, isso é normal) pode hoje ler, alterar
ou apagar tabelas inteiras directamente pela API do Supabase — sem nunca
passar pelo teu site.** Isto é o risco mais urgente de todos, mais do que
as senhas em texto simples.

Como aplicar:
1. Abre o **SQL Editor** no painel do Supabase.
2. Confirma os nomes de tabelas/colunas no ficheiro contra o teu **Table
   Editor** real (eu inferi os nomes a partir do código, não vi o teu
   esquema real — podem faltar colunas ou ter nomes ligeiramente diferentes).
3. Corre o ficheiro.
4. Testa pela ordem indicada no fim do próprio ficheiro (landing page,
   login, registo, RSVP de convidado, reservar presente, painel admin).

Isto **não muda nenhum comportamento da app** — replica exactamente o que
já é permitido hoje, só que de forma explícita e fechada a mais nada.

### `supabase/02_rpc_login_fase2.sql` — fazer depois, com calma
Resolve a fuga de senhas em texto simples no login (consola do browser).
Tem instruções detalhadas no topo do próprio ficheiro — **não corras isto
sem seguir a sequência exacta indicada**, porque está emparelhado com uma
função nova em `js/auth.js` (`handleLoginSecure`, já escrita mas **não
activada** — o login continua a funcionar como sempre até decidires
trocar).

---

## 🔵 Fase 3 — a correcção arquitectural completa (não fiz, fica para decidires)

Tanto o RLS da Fase 1 como o RPC da Fase 2 são melhorias reais, mas têm um
limite estrutural que vale a pena entenderes: **hoje, a base de dados não
consegue distinguir o admin, o organizador de um evento, e um visitante
qualquer — todos usam exactamente a mesma chave pública.** Isso significa
que nenhuma regra de segurança no Supabase consegue dizer "só o dono deste
evento pode editá-lo", porque a base de dados não sabe quem é "o dono" —
só o teu JavaScript sabe, e isso pode ser contornado por quem souber.

A correcção completa é mudar para o **Supabase Auth** (em vez do sistema de
login próprio com tabela `accounts`). Isto resolveria de vez:
- Sessões reais com expiração (hoje a "sessão" é só o ID guardado no
  browser, para sempre).
- `auth.uid()` disponível nas políticas de RLS, permitindo regras como
  "só o dono pode editar o seu evento".
- Hash de senha automático (zero texto simples na base de dados).

**Não fiz esta migração automaticamente** porque:
- Não tenho acesso ao teu projecto Supabase real para testar — só vejo o
  código-fonte. Uma migração deste tipo, feita "a ciegas", arrisca
  impedir todos os utilizadores actuais de fazer login.
- É uma mudança de fundo (login, registo, sessão, e potencialmente como
  os IDs de conta funcionam) que merece ser feita com testes num ambiente
  separado antes de ir para produção.

Se quiseres avançar com isto, o próximo passo natural é planeares comigo a
migração de dados das contas existentes (criar os utilizadores
correspondentes no Supabase Auth, mapear os IDs antigos para os novos) —
posso ajudar a desenhar esse plano quando estiveres pronto.

---

## Nota sobre o que NÃO foi alterado

- A função de **backup/exportar schema completo** do admin continua a
  incluir a coluna `password` no ficheiro exportado (é um backup deliberado
  de tudo). Trata esse ficheiro como sensível — não o partilhes por canais
  inseguros.
- Não foi feita uma auditoria linha-a-linha às 15 mil linhas de JavaScript
  à procura de XSS — cobri os pontos onde texto de **convidados** (não
  controlado por ti) chega a outras pessoas: lista de confirmações, lista
  de presentes, exportações. Pontos onde só o admin vê o que o próprio
  admin escreveu (auto-XSS) foram deixados de fora por serem risco residual
  muito menor.
