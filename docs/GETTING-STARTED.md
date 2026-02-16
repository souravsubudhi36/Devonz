# Getting Started

> Setup, environment variables, and run commands for Devonz.

---

## Prerequisites

| Requirement | Version |
| ----------- | ------- |
| Node.js | ≥ 18.18.0 |
| pnpm | 9.14.4 (exact, managed via `packageManager` field) |
| Git | Any recent version |

---

## Installation

```bash
# Clone the repository
git clone https://github.com/zebbern/Devonz.git
cd Devonz/bolt.diy

# Install dependencies
pnpm install
```

---

## Environment Variables

Create a `.env.local` file in `bolt.diy/` (gitignored). The app loads env files in this priority:

1. `.env.local` (highest priority)
2. `.env`
3. Process environment

### LLM Provider Keys

Set the API key for whichever provider(s) you want to use:

```env
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google (Gemini)
GOOGLE_GENERATIVE_AI_API_KEY=...

# Mistral
MISTRAL_API_KEY=...

# Groq
GROQ_API_KEY=gsk_...

# OpenRouter
OPEN_ROUTER_API_KEY=sk-or-...

# DeepSeek
DEEPSEEK_API_KEY=...

# Together
TOGETHER_API_KEY=...

# XAI (Grok)
XAI_API_KEY=...

# Cohere
COHERE_API_KEY=...

# HuggingFace
HuggingFace_API_KEY=...

# Perplexity
PERPLEXITY_API_KEY=...

# Amazon Bedrock
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

### Local Model URLs

For self-hosted models, you can also set API keys via the UI settings panel.

```env
# Ollama (default: http://localhost:11434)
OLLAMA_API_BASE_URL=http://localhost:11434

# LM Studio (default: http://localhost:1234)
LMSTUDIO_API_BASE_URL=http://localhost:1234

# OpenAI-compatible servers
OPENAI_LIKE_API_BASE_URL=http://localhost:8080
OPENAI_LIKE_API_MODELS=model-name-1,model-name-2
```

### Deployment Keys (Optional)

```env
# GitHub (for push-to-repo features)
# Set via UI settings panel — stored in browser cookies

# Vercel
# Set via UI settings panel

# Netlify
# Set via UI settings panel
```

> **Note**: API keys can also be set through the UI settings panel at runtime. They are stored in browser cookies, not on the server.

---

## Running the App

### Development

```bash
pnpm dev
```

This runs `pre-start.cjs` (prints version/commit info) then starts the Vite dev server. Open `http://localhost:5173` (default Vite port).

### Production Build

```bash
pnpm build
pnpm start
```

Builds with Remix + Vite, then serves via `remix-serve` on `http://localhost:3000`.

### Preview (Build + Serve)

```bash
pnpm preview
```

Runs build and start in sequence.

---

## Other Commands

| Command | Purpose |
| ------- | ------- |
| `pnpm test` | Run Vitest test suite (single run) |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm lint` | Lint `app/` with ESLint (cached) |
| `pnpm lint:fix` | Auto-fix lint issues + format with Prettier |
| `pnpm typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `pnpm clean` | Remove build artifacts |

---

## Project Structure Quick Reference

```text
bolt.diy/
├── app/                  # Application source code
│   ├── components/       # React components
│   ├── lib/              # Core logic
│   ├── routes/           # Pages + API endpoints
│   ├── styles/           # Global styles
│   ├── types/            # Shared types
│   └── utils/            # Utilities
├── docs/                 # Documentation (you are here)
├── icons/                # Custom SVG icons
├── public/               # Static files
├── scripts/              # Build scripts
└── supabase/             # Supabase configuration
```

---

## Troubleshooting

### Chrome 129 Issue

Chrome version 129 has a known issue with Vite's JavaScript modules in dev mode. The app detects this and shows a warning. Use Chrome Canary or another browser for development, or use the production build (`pnpm preview`).

### WebContainer Initialization

WebContainer API requires specific browser features. If the preview/terminal doesn't load:
- Ensure you're using a Chromium-based browser
- SharedArrayBuffer must be available (requires cross-origin isolation headers in production)
- Service Workers must be enabled

### Missing Dependencies

```bash
# If you see module resolution errors after pulling
pnpm install

# Nuclear option — clear everything and reinstall
pnpm clean
rm -rf node_modules
pnpm install
```
