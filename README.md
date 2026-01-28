# Auto Code Review AI 🤖

Este projeto é uma ferramenta de automação para Code Review que utiliza a API da OpenAI (GPT-4) para analisar Pull Requests no GitHub. Ele identifica problemas de código, segurança e boas práticas, fornecendo feedback detalhado diretamente no PR.

## 🚀 Como Funciona

1. **Detecção**: O script identifica os arquivos modificados entre o branch atual e a base do PR.
2. **Filtragem**: Ignora arquivos configurados em `.review/ignore.yml` e foca em linguagens suportadas.
3. **Análise**: Envia o `diff` de cada arquivo para a IA, junto com regras personalizadas definidas em `.review/rules.yml`.
4. **Relatório**:
   - Agrega os feedbacks em categorias (Crítico, Aviso, Sugestão).
   - Posta um comentário consolidado no PR.
   - Submete uma revisão formal (Aprova, Comenta ou Solicita Mudanças).

## 🛠️ Tecnologias

- **Node.js**: Runtime do ambiente.
- **OpenAI API**: Motor de inteligência para análise de código.
- **GitHub API (Octokit)**: Interação com PRs e comentários.
- **Git**: Para comparação de diffs.

## 📋 Pré-requisitos

- Node.js (v18+)
- Uma conta na OpenAI com créditos (API Key).
- Token de Acesso Pessoal (PAT) do GitHub com permissões de repositório.

## ⚙️ Configuração

### 1. Variáveis de Ambiente
Crie um arquivo `.env` na raiz baseado no exemplo abaixo:

```env
GITHUB_TOKEN=seu_github_pat
OPENAI_API_KEY=sua_openai_key
REPO_FULL_NAME=usuario/repositorio
PR_NUMBER=123
BASE_REF=main
```

> **Nota**: Em ambientes de CI/CD (como GitHub Actions), estas variáveis são injetadas automaticamente.

### 2. Regras de Review
As regras de análise podem ser personalizadas em `.review/rules.yml`. Você pode definir regras gerais, de segurança e específicas por linguagem.

### 3. Ignorar Arquivos
Configure padrões de arquivos para ignorar em `.review/ignore.yml` (ex: arquivos de lock, imagens, configurações geradas).

## 📦 Instalação

```bash
npm install
```

## ▶️ Como Usar

Para rodar a análise manualmente (localmente):

1. Certifique-se de estar em um branch com alterações comitadas.
2. Configure o `.env` corretamente.
3. Execute:

```bash
npm run review
```

## 📂 Estrutura do Projeto

```
.
├── .review/               # Configurações do Reviewer
│   ├── rules.yml          # Regras de lint e boas práticas
│   ├── ignore.yml         # Arquivos a serem ignorados
│   └── prompts/           # Prompts do sistema para a IA
├── scripts/
│   └── main_review.js     # Lógica principal do bot
├── backend/               # (Diretório de exemplo/alvo)
├── frontend/              # (Diretório de exemplo/alvo)
└── package.json           # Dependências e scripts
```
