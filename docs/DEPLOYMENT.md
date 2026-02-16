# Deployment

> Deploy integrations for Vercel, Netlify, GitHub, and GitLab in Devonz.

---

## Overview

Devonz supports deploying generated projects to four platforms directly from the UI. All deployment credentials are managed through browser cookies (set via the Settings panel).

---

## Supported Platforms

| Platform | Push Code | Deploy | Custom Domains | Status Check |
| -------- | --------- | ------ | -------------- | ------------ |
| GitHub | Yes | Via GitHub Pages/Actions | No | Yes |
| GitLab | Yes | Via GitLab CI | No | Yes |
| Vercel | Yes | Yes (direct) | Yes | Yes |
| Netlify | No | Yes (direct) | No | Yes |

---

## GitHub Integration

### Setup

1. Open Settings (sidebar menu) → GitHub tab
2. Enter your GitHub **Personal Access Token** (needs `repo` scope)
3. Optionally set a default username

### Features

- **Push to Repository**: Push generated code to a new or existing GitHub repo
- **Clone from GitHub**: Start a project from any public/private repo
- **Branch Management**: Create branches, push to branches
- **Template Loading**: Load starter templates from GitHub

### API Routes

| Route | Purpose |
| ----- | ------- |
| `/api/github-user` | Validate token and get user info |
| `/api/github-branches` | List repository branches |
| `/api/github-stats` | Repository statistics |
| `/api/github-template` | Clone/template a repository |

### Components

| Component | Location |
| --------- | -------- |
| `GitHubDeploy.client.tsx` | `components/deploy/` |
| `GitHubDeploymentDialog.tsx` | `components/deploy/` |
| GitHub Settings Tab | `components/@settings/tabs/github/` |

### State

| Store | Purpose |
| ----- | ------- |
| `stores/github.ts` | Repository selection, push state |
| `stores/githubConnection.ts` | Auth token, user info |

---

## GitLab Integration

### Setup

1. Open Settings → GitLab tab
2. Enter your GitLab **Personal Access Token** (needs `api` scope)
3. Set your GitLab instance URL (defaults to `gitlab.com`)

### Features

- **Push to Project**: Push code to GitLab projects
- **Clone from GitLab**: Import existing projects
- **Branch Management**: List and create branches

### API Routes

| Route | Purpose |
| ----- | ------- |
| `/api/gitlab-projects` | List user's projects |
| `/api/gitlab-branches` | List project branches |

### State

| Store | Purpose |
| ----- | ------- |
| `stores/gitlabConnection.ts` | Auth token, instance URL, user info |

---

## Vercel Integration

### Setup

1. Open Settings → Vercel tab
2. Enter your Vercel **API Token** ([vercel.com/account/tokens](https://vercel.com/account/tokens))

### Features

- **Direct Deploy**: Deploy projects directly to Vercel
- **Domain Management**: Add/manage custom domains
- **Deployment Status**: Track deployment progress

### API Routes

| Route | Purpose |
| ----- | ------- |
| `/api/vercel-deploy` | Deploy project / check status |
| `/api/vercel-user` | Validate token, get user info |
| `/api/vercel-domains` | List/manage domains |
| `/api/vercel-proxy` | Proxy API requests |

### Components

| Component | Location |
| --------- | -------- |
| `VercelDeploy.client.tsx` | `components/deploy/` |
| `VercelDomainModal.tsx` | `components/deploy/` |
| Vercel Settings Tab | `components/@settings/tabs/vercel/` |

### State

| Store | Purpose |
| ----- | ------- |
| `stores/vercel.ts` | Deployment state, project info |

---

## Netlify Integration

### Setup

1. Open Settings → Netlify tab
2. Enter your Netlify **Personal Access Token** ([app.netlify.com/user/applications](https://app.netlify.com/user/applications))

### Features

- **Direct Deploy**: Deploy projects directly to Netlify
- **Site Status**: Track deployment status

### API Routes

| Route | Purpose |
| ----- | ------- |
| `/api/netlify-deploy` | Deploy project |
| `/api/netlify-user` | Validate token, get user info |

### Components

| Component | Location |
| --------- | -------- |
| `NetlifyDeploy.client.tsx` | `components/deploy/` |
| Netlify Settings Tab | `components/@settings/tabs/netlify/` |

### State

| Store | Purpose |
| ----- | ------- |
| `stores/netlify.ts` | Deployment state |

---

## Supabase Integration

### Setup

1. Open Settings → Supabase tab
2. Enter your Supabase **Project URL** and **Anon Key**

### Features

- **Database Queries**: Execute SQL queries against Supabase
- **Environment Variables**: Manage project environment variables
- **Connection Status**: Monitor Supabase connectivity

### API Routes

| Route | Purpose |
| ----- | ------- |
| `/api/supabase` | Project management |
| `/api/supabase-user` | User info |
| `/api/supabase/query` | Execute SQL queries |
| `/api/supabase/variables` | Environment variable management |

---

## Credential Management

All deployment credentials follow the same pattern:

1. **Set via Settings UI** — user enters token in the appropriate settings tab
2. **Stored in cookies** — credentials saved in browser cookies (client-side)
3. **Sent per request** — API routes read credentials from the `Cookie` header
4. **No server storage** — credentials never persist on the server

```typescript
// How API routes read credentials:
const cookieHeader = request.headers.get('Cookie') || '';
const cookies = parseCookies(cookieHeader);
const token = cookies['githubToken'] || '';
```

---

## Deploy Button

The header contains a **Deploy** button (`DeployButton.tsx`) that opens a dropdown with available deployment options. Each option opens a modal dialog for that platform's deployment workflow.

```text
[Deploy ▾]
├── Push to GitHub
├── Push to GitLab
├── Deploy to Vercel
└── Deploy to Netlify
```

Only platforms with configured credentials are shown as active options.
