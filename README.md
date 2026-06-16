# AdKira — Confirmação de Presença

## Como abrir com VS Code Live Server

1. Descomprime o ZIP
2. Abre a pasta `adkira/` no VS Code (File → Open Folder → selecciona a pasta `adkira`)
3. Clica com o botão direito em `index.html` → "Open with Live Server"
4. O browser abre em `http://127.0.0.1:5500/index.html`

⚠️ **Importante:** Abre a pasta `adkira/` directamente, não a pasta que contém o ZIP.

## Estrutura

```
adkira/
├── index.html        ← Abre este ficheiro com Live Server
├── css/
│   └── main.css      ← Todos os estilos
└── js/
    ├── config.js     ← Supabase URL/Key + supabaseRequest (carrega 1.º)
    ├── store.js      ← Estado global (Store)
    ├── ui.js         ← Drawer, toast, music player, animações
    ├── auth.js       ← Login, registo, sessão
    ├── dashboard.js  ← Dashboard do utilizador
    ├── events.js     ← Criar/editar/eliminar eventos
    ├── guest.js      ← Página do convidado, RSVP, presentes
    ├── sections.js   ← Secções da página (bíblia, data, itinerário...)
    ├── admin.js      ← Painel admin, storage, fontes
    └── router.js     ← Router + inicialização (carrega por último)
```

## GitHub

```bash
# Na pasta adkira/:
git init
git add .
git commit -m "AdKira modular"
git branch -M main
git remote add origin https://github.com/SEU_USER/adkira.git
git push -u origin main
```

## Supabase

Os dados existentes continuam intactos.
Para activar as novas funcionalidades (cor do evento, história, etc.),
corre o `migracao_segura.sql` no SQL Editor do Supabase.
