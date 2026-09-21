<p align="center">
  <img src="imagi/Ativo 1-LinkValt.png" width="100" alt="LinkValt Logo">
</p>

<h1 align="center">LinkValt</h1>

<p align="center">
  Aplicação desktop de gerenciamento de bookmarks pessoais construída com Tauri 2, Rust e SQLite.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.0-blue?logo=tauri" alt="Tauri">
  <img src="https://img.shields.io/badge/Rust-1.70+-orange?logo=rust" alt="Rust">
  <img src="https://img.shields.io/badge/SQLite-3-blue?logo=sqlite" alt="SQLite">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/Windows-10%2F11-blue?logo=windows" alt="Windows">
</p>

---

## Visão Geral

LinkValt é uma aplicação desktop nativa para Windows que funciona como repositório pessoal de links (bookmarks). O sistema utiliza arquitetura client-server local com Tauri 2 no frontend e Rust no backend, persistindo dados em SQLite com criptografia AES-256-GCM.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (HTML/CSS/JS)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Interface   │  │   State     │  │   Tauri IPC Bridge  │ │
│  │  Raycast UI  │  │  Manager    │  │   (window.__TAURI__)│ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                     Backend (Rust/Tauri 2)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Tauri       │  │  Database   │  │   Crypto Engine     │ │
│  │  Commands    │  │  Manager    │  │   (AES-256-GCM)     │ │
│  │  (20+ APIs)  │  │  (SQLite)   │  │   (SHA-256)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                     Camada de Persistência                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              SQLite Database (linkvault.db)             ││
│  │  ┌─────────┐  ┌─────────────┐  ┌───────────────────┐  ││
│  │  │  links   │  │ categories  │  │     settings      │  ││
│  │  └─────────┘  └─────────────┘  └───────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Funcionalidades

### Core

| Módulo | Descrição | Técnicas |
|--------|-----------|----------|
| **CRUD Completo** | Operações Create, Read, Update, Delete para links e categorias | Tauri IPC, SQLite prepared statements |
| **Persistência** | Armazenamento local com SQLite 3 | rusqlite (bundled), WAL mode |
| **Criptografia** | Senhas hasheadas com SHA-256, dados sensíveis com AES-256-GCM | aes-gcm, sha2, base64 |
| **Busca** | Full-text search com filtros por categoria, favoritos, status | SQL LIKE com índices |
| **Validação HTTP** | Verificação assíncrona de disponibilidade de URLs | reqwest, tokio |

### Interface

| Componente | Descrição | Tecnologia |
|------------|-----------|------------|
| **Design System** | Interface dark minimalista baseada no Raycast | CSS Custom Properties |
| **Tipografia** | Fonte geométrica com pesos 300-600 | Space Grotesk (Google Fonts) |
| **Ícones** | Sprites SVG vetoriais | Lucide Icons |
| **Layout** | Grid responsivo com 3 modos de visualização | CSS Grid, Flexbox |
| **Modais** | Sistema de modais com backdrop blur | CSS transforms, transitions |

### Segurança

| Recurso | Implementação |
|---------|---------------|
| **Password Hashing** | SHA-256 com salt via `crypto.rs` |
| **Encryption at Rest** | AES-256-GCM para dados sensíveis |
| **Lock Screen** | Autenticação por senha com tentativas |
| **No telemetry** | Sem coleta de dados, 100% offline |

## Stack Tecnológica

### Backend (Rust)

```toml
[dependencies]
tauri = "2"                    # Framework desktop
rusqlite = "0.32"              # Driver SQLite
reqwest = "0.12"               # HTTP client (link checker)
tokio = "1"                    # Async runtime
aes-gcm = "0.10"               # Criptografia AES-256-GCM
sha2 = "0.10"                  # Hashing SHA-256
uuid = "1"                     # Geração de IDs únicos
chrono = "0.4"                 # Timestamps
regex-lite = "0.1"             # Parse de HTML (import)
serde_json = "1"               # Serialização JSON
base64 = "0.22"                # Encoding binário
rand = "0.8"                   # Geração de nonce aleatório
```

### Frontend

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| HTML5 | - | Estrutura semântica |
| CSS3 | - | Design system com custom properties |
| JavaScript | ES2022+ | Lógica de aplicação, módulos |
| Tauri API | v2 | Bridge frontend-backend |

### Design System

| Token | Valor | Uso |
|-------|-------|-----|
| `--canvas` | `#07080a` | Background principal |
| `--surface` | `#0d0d0d` | Cards e painéis |
| `--surface-elevated` | `#101111` | Inputs e botões |
| `--hairline` | `#242728` | Bordas de 1px |
| `--primary` | `#ffffff` | CTAs e ações principais |
| `--ink` | `#f4f4f6` | Texto principal |
| `--body` | `#cdcdcd` | Texto secundário |
| `--mute` | `#9c9c9d` | Metadados |

## API Tauri (20+ Comandos)

```rust
// Links
get_links(search, category, favorites_only, include_archived) -> Vec<Link>
add_link(title, url, description, category, tags, priority, notes) -> Link
update_link(id, title, url, ...) -> Link
delete_link(id) -> ()
toggle_favorite(id) -> bool
archive_link(id, archived) -> ()
open_link(id) -> ()  // incrementa access_count

// Categorias
get_categories() -> Vec<Category>
add_category(name, icon, color) -> Category
update_category(id, name, icon, color) -> Category
delete_category(id) -> ()

// Utilidades
get_stats() -> { total, favorites, categories, broken }
export_links() -> String (JSON)
import_links(json_data) -> u32 (count)
import_html(html_data) -> u32 (count)
check_links(links) -> Vec<LinkCheckResult>

// Configurações
get_settings() -> { theme, view_mode, sort_by, has_password }
save_settings(settings) -> ()
set_password(password) -> ()
verify_password_cmd(password) -> bool
```

## Modelo de Dados

### Link

```rust
pub struct Link {
    pub id: String,              // UUID v4
    pub title: String,           // Título do bookmark
    pub url: String,             // URL completa
    pub description: String,     // Descrição opcional
    pub category: String,        // Nome da categoria
    pub tags: Vec<String>,       // Tags para organização
    pub favicon: String,         // URL do favicon (Google S2)
    pub status: String,          // "active" | "broken"
    pub priority: String,        // "low" | "medium" | "high"
    pub notes: String,           // Notas adicionais
    pub is_favorite: bool,       // Favorito flag
    pub is_archived: bool,       // Arquivado flag
    pub access_count: u32,       // Contador de acessos
    pub created_at: String,      // ISO 8601 timestamp
    pub updated_at: String,      // ISO 8601 timestamp
}
```

### Category

```rust
pub struct Category {
    pub id: String,              // UUID v4
    pub name: String,            // Nome da categoria
    pub icon: String,            // Identificador do ícone
    pub color: String,           // Cor hex (#RRGGBB)
    pub created_at: String,      // ISO 8601 timestamp
}
```

## Estrutura de Diretórios

```
LinkValt/
├── src-tauri/                  # Backend Rust
│   ├── src/
│   │   ├── main.rs             # Entry point do Tauri
│   │   ├── lib.rs              # 20+ comandos Tauri expostos via IPC
│   │   ├── database.rs         # Conexão SQLite, CRUD, queries
│   │   ├── models.rs           # Structs Link, Category, LinkCheckResult
│   │   ├── crypto.rs           # AES-256-GCM encryption, SHA-256 hashing
│   │   └── link_checker.rs     # HTTP HEAD requests assíncronos
│   ├── icons/                  # Ícones do sistema (.ico, .png)
│   ├── capabilities/           # Permissões Tauri 2
│   ├── tauri.conf.json         # Configuração do Tauri
│   ├── build.rs                # Build script
│   └── Cargo.toml              # Dependências Rust
├── src/                        # Frontend
│   ├── index.html              # Markup principal
│   ├── styles.css              # Design Raycast (700+ linhas)
│   ├── app.js                  # Lógica de aplicação (660+ linhas)
│   └── icons.svg               # Sprite de ícones Lucide
├── mobile/                     # PWA Mobile
│   ├── index.html              # Layout responsivo
│   ├── mobile.css              # Estilos touch-friendly
│   ├── mobile.js               # CRUD via localStorage
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service worker (offline)
├── extension/                  # Browser extension
│   ├── manifest.json           # Manifest V3
│   ├── popup.html              # Interface do popup
│   └── popup.js                # Lógica de captura
├── imagi/                      # Logos oficiais
│   ├── Ativo 1-LinkValt.ico    # Ícone Windows
│   └── Ativo 1-LinkValt.png    # Logo PNG
├── mobile/                     # PWA
├── extension/                  # Browser extension
├── .gitignore                  # Arquivos ignorados pelo git
├── LICENSE                     # MIT License
├── README.md                   # Esta documentação
└── package.json                # Configuração npm
```

## Pré-requisitos

| Software | Versão Mínima | Propósito |
|----------|---------------|-----------|
| [Rust](https://rustup.rs/) | 1.70+ | Compiler backend |
| [Node.js](https://nodejs.org/) | 18+ | Gerenciador de pacotes |
| [Tauri CLI](https://v2.tauri.app/start/prerequisites/) | 2.0 | Build system |

## Instalação

### Opção 1: Binário Pré-compilado (Recomendado)

1. Baixe `LinkValt_1.0.0_x64-setup.exe` em [Releases](https://github.com/Diogogg27/LinkValt/releases)
2. Execute o instalador
3. Acesse pelo Menu Iniciar

### Opção 2: Compilar do Fonte

```bash
# 1. Clonar repositório
git clone https://github.com/Diogogg27/LinkValt.git
cd LinkValt

# 2. Instalar dependências npm
npm install

# 3. Compilar para produção
npm run build

# 4. Executável gerado em:
#    src-tauri/target/release/bundle/nsis/LinkValt_1.0.0_x64-setup.exe
```

### Opção 3: Modo Desenvolvimento

```bash
# Inicia o servidor de desenvolvimento com hot reload
npm run dev
```

## Extensão do Navegador

A extensão permite salvar links diretamente do navegador:

1. Abra `chrome://extensions/` ou `edge://extensions/`
2. Ative **Modo desenvolvedor**
3. Clique em **Carregar extensão sem empacotamento**
4. Navegue até a pasta `extension/` deste repositório
5. O ícone do LinkValt aparecerá na barra de ferramentas

## Build e Distribuição

```bash
# Build completo (compila + empacota + gera instalador)
npm run build

# Saídas geradas:
# - src-tauri/target/release/linkvault.exe          (executável portátil)
# - src-tauri/target/release/bundle/nsis/*.exe       (instalador NSIS)
# - src-tauri/target/release/bundle/msi/*.msi        (instalador MSI)
```

## 💖 Apoiar o Projeto

Se este projeto te ajudou, considere apoiar o desenvolvimento:

### Opções de Doação

| Plataforma | Link |
|------------|------|
| ☕ **Buy Me a Coffee** | [buymeacoffee.com/Diogogg27](https://buymeacoffee.com/Diogogg27) |
| 💰 **GitHub Sponsors** | [github.com/sponsors/Diogogg27](https://github.com/sponsors/Diogogg27) |
| 🏦 **PIX** | `sua-chave-pix@exemplo.com` |
| 📱 **PayPal** | [paypal.me/Diogogg27](https://paypal.me/Diogogg27) |

### Contribuição Recorrente

Se prefere apoiar mensalmente:

- **GitHub Sponsors** — Assine e receba atualizações exclusivas
- **Patreon** — Acesso a conteúdo bonus e suporte prioritário

### Doação Única

- **PIX** — Escaneie o QR Code ou use a chave acima
- **Buy Me a Coffee** — Doação rápida sem necessidade de conta

> Toda doação é Voluntária e ajuda a manter o projeto ativo e atualizado.

---

## Licença

Licenciado sob a MIT License. Veja [LICENSE](LICENSE) para detalhes.

---

<p align="center">
  Feito com ❤️ por <a href="https://github.com/Diogogg27">Diogo</a>
</p>
