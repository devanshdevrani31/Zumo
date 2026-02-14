# Zumo

Zumo is a platform that removes the complexity of deploying and managing AI employees. It provides a single UI to onboard LLM providers, provision secure sandboxed environments, enforce policies, and manage AI agents — built on OpenClaw by default.

Users can bring their own API keys (OpenAI, Anthropic, Gemini, or local models), and Zumo handles secure configuration, policy enforcement, audit logging, and container orchestration.

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Docker Desktop** (optional, for running real AI agents in containers)

### Install & Run

```bash
git clone https://github.com/devanshdevrani31/Zumo.git
cd Zumo
npm install
cp .env.example .env
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

Open **http://localhost:3000** in your browser.

**Demo login**: `demo@zumo.ai` / `password123`

### Build for Production

```bash
npm run build
npm start
```

### Run Tests

```bash
npm test
```

50 tests across 9 test suites covering policy enforcement, org isolation, audit chain integrity, spending limits, secrets encryption, runtime switching, and more.

---

## Architecture

```
Zumo/
├── agent/                    # OpenClaw agent runtime (runs in Docker)
│   ├── Dockerfile            # Secure container image (non-root, caps dropped)
│   ├── agent.js              # Agent loop: receives tasks, calls LLM, uses tools
│   ├── tools.js              # Sandboxed tools (file I/O, web fetch, shell)
│   └── package.json
├── prisma/
│   ├── schema.prisma         # Database schema (SQLite)
│   ├── seed.ts               # Demo data seeder
│   └── migrations/           # Database migrations
├── src/
│   ├── app/
│   │   ├── (auth)/           # Login & signup pages
│   │   ├── (app)/            # Main app pages (protected)
│   │   │   ├── page.tsx              # Dashboard
│   │   │   ├── onboarding/page.tsx   # 4-step setup wizard
│   │   │   ├── employees/            # Employee list, create, detail
│   │   │   ├── policies/page.tsx     # Policy management
│   │   │   ├── approvals/page.tsx    # Approval inbox
│   │   │   ├── orchestration/page.tsx# Team workflows
│   │   │   ├── audit/page.tsx        # Audit log viewer
│   │   │   └── privacy/page.tsx      # EU privacy controls
│   │   └── api/
│   │       ├── auth/         # Login, signup, logout, session
│   │       ├── employees/    # CRUD + Docker container management
│   │       ├── policies/     # Policy CRUD
│   │       ├── approvals/    # Approval workflow
│   │       ├── audit/        # Audit log + chain verification
│   │       ├── gateway/      # Policy gateway (agent -> Zumo bridge)
│   │       ├── docker/       # Docker availability check
│   │       ├── validate-key/ # Real LLM API key validation
│   │       ├── onboarding/   # Onboarding state management
│   │       ├── orchestration/# Team workflows + demo
│   │       ├── simulation/   # Simulated events for demo
│   │       ├── spending/     # Spending limits
│   │       ├── connectors/   # Connected accounts
│   │       └── providers/    # Provider configs
│   ├── components/           # Shared UI components
│   └── lib/
│       ├── llm-providers.ts  # Real LLM API integration (OpenAI, Anthropic, Gemini)
│       ├── docker.ts         # Docker container lifecycle management
│       ├── policy-engine.ts  # Policy evaluation engine (REAL)
│       ├── audit.ts          # SHA-256 hash-chained audit logging (REAL)
│       ├── spending.ts       # Budget enforcement (REAL)
│       ├── secrets.ts        # AES-256-GCM encryption for API keys
│       ├── runtime.ts        # Runtime registry (OpenClaw, AutoGPT, Planner, External)
│       ├── simulation.ts     # Deterministic event simulation
│       ├── auth.ts           # JWT sessions + bcrypt passwords
│       ├── api-auth.ts       # API middleware
│       ├── auth-context.ts   # Client-side auth context
│       ├── network-posture.ts# VPN/network security checks
│       └── db.ts             # Prisma client singleton
├── __tests__/                # 50 tests across 9 files
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── .env.example
```

## Tech Stack

- **Next.js 14** (App Router) — full-stack React framework
- **TypeScript** — type safety throughout
- **Tailwind CSS 4** — utility-first styling
- **Prisma** + **SQLite** — ORM + database
- **Docker** (via dockerode) — container management for agents
- **bcryptjs** — password hashing
- **jose** — JWT session tokens
- **Node.js crypto** — AES-256-GCM encryption, SHA-256 audit chain

---

## Onboarding Flow

When a new user signs up, they go through a 4-step setup wizard:

### Step 1: LLM Provider

Choose how to access AI models:

- **Bring Your Own**: Enter an API key for OpenAI, Anthropic, Gemini, or a local OpenAI-compatible endpoint (e.g., Ollama)
- **Buy Through Zumo**: Select a marketplace plan (simulated billing)

Each provider has a **"What's an API key?"** help guide with step-by-step instructions. The **Test Connection** button validates the key against the real provider API and shows available models.

Budget configuration: org daily spend cap, per-employee cap, hard stop behavior (pause/notify/shutdown).

### Step 2: Agent Environment

Choose where AI agents run:

- **This Machine (Recommended)**: Agents run in Docker containers on the local machine. Zumo checks if Docker is installed and provides install instructions if not.
- **Cloud Server**: Select a cloud provider (Hetzner, OVH, AWS, GCP) with region and plan selection (simulated provisioning).

Docker containers are secure by default: non-root execution, memory limits, network isolation, capabilities dropped.

### Step 3: VPN & Network Security

- **Tailscale Overlay** (Recommended): Zero-config mesh VPN
- **WireGuard** (Advanced): Manual configuration
- **None** (Not Recommended): Shows risk warnings, restricts autonomy to Observe mode

### Step 4: Connectors

Connect tools via simulated OAuth:
- Slack, Gmail, HubSpot, GitHub, Google Calendar, Sentry, Linear
- Each connector shows risk level (Low/Medium/High)
- Default to read-only; write access requires acknowledgment
- High-risk + write access shows a danger checklist modal

---

## Creating AI Employees

7-step wizard:

1. **Name & Role** — Choose from 9 role templates (Customer Support, Developer, Security Analyst, etc.) or custom
2. **Runtime** — OpenClaw (default), AutoGPT Loop, Custom Planner, External Runtime
3. **Model Provider** — Uses the provider configured in onboarding
4. **Tool Access** — Select which connectors this employee can use
5. **Autonomy Mode** — Observe (deny by default), Assist (approval required), Autopilot (allow by default)
6. **Team** — Assign to a team for orchestration workflows
7. **Security Review** — Summary of all settings before creation

On creation:
- Default policies are auto-generated based on role
- If Docker is available and the agent image is built, a real container is started
- Otherwise, the employee operates in simulation mode

---

## Running Real AI Agents

### Build the Agent Image

```bash
cd agent
docker build -t zumo-openclaw-agent .
```

### How It Works

1. When you create an employee, Zumo starts a Docker container with:
   - The LLM API key (decrypted from the database, injected as env var)
   - The gateway URL pointing back to Zumo's policy engine
   - Autonomy mode and instructions configured in the wizard
   - Memory limits (512MB default) and CPU shares

2. The agent container runs an HTTP server on port 3100 with:
   - `POST /task` — submit a task (description + context)
   - `GET /health` — health check (status, uptime, tasks completed)
   - `GET /history` — recent task results

3. When the agent needs to use a tool, it calls Zumo's **Policy Gateway** (`/api/gateway`) which:
   - Checks the policy engine (allow/deny/approval_required)
   - Enforces rate limits
   - Logs the decision to the audit trail
   - Returns the result to the agent

4. The agent loop:
   - Sends the task to the real LLM (OpenAI, Anthropic, or Gemini)
   - If the LLM requests tool calls, checks policy gateway first
   - Executes allowed tools in the sandboxed container
   - Returns the result to Zumo

### Agent Tools (Sandboxed)

- `read_file` / `write_file` / `list_files` — file operations in `/workspace`
- `web_fetch` — HTTP GET with timeout
- `run_command` — shell commands in workspace (30s timeout)
- `think` — internal reasoning (not shown to user)

All file operations are confined to `/workspace` inside the container.

---

## Security

### What's Real (Not Simulated)

| Feature | Implementation |
|---------|---------------|
| **Policy Engine** | Evaluates every agent action: allow / deny / approval_required. Supports per-employee per-capability policies with rate limiting. |
| **Audit Logging** | SHA-256 hash-chained tamper-evident log. Each entry links to the previous via hash. Chain integrity can be verified at any time. |
| **Spending Limits** | Org-level daily cap + per-employee cap. Checked before operations. Hard stop behavior configurable. |
| **API Key Encryption** | AES-256-GCM with scrypt key derivation. Keys stored encrypted at rest. |
| **API Key Validation** | Real API calls to OpenAI/Anthropic/Gemini to verify keys work. |
| **Container Isolation** | Docker containers with: non-root user, all capabilities dropped, `no-new-privileges`, memory limits, dedicated network. |
| **Policy Gateway** | Agents must check permissions before every tool use. Denied by default if gateway is unreachable. |
| **Authentication** | bcrypt password hashing (10 rounds), JWT sessions (HS256, 7-day expiry), HttpOnly cookies. |
| **Org Tenant Isolation** | All database queries filtered by `orgId`. Enforced in every API route. |

### Autonomy Modes

- **Observe**: Deny by default. Agent can only read and report.
- **Assist**: Actions require human approval. Creates approval requests in the inbox.
- **Autopilot**: Allow by default. Agent operates autonomously within policy limits.

### Default Policies by Role

| Role | Policies |
|------|----------|
| Support Agent | `send_email`: approval required (10/min), `access_database`: deny |
| Developer | `modify_code`: allow, `deploy`: approval required, `send_email`: deny |
| Security Analyst | `api_call`: allow (200/min), `send_email`: approval required, `modify_code`: deny, `file_write`: deny |
| DevOps Engineer | `deploy`: approval required, `modify_code`: allow, `file_write`: allow |

---

## EU Privacy (MVP)

- **Tenant Isolation**: Org-scoped queries on every table
- **Data Region**: `DATA_REGION=EU` environment flag
- **Retention Settings**: 30 / 90 / 365 days or unlimited
- **Export Data**: Download all employee data as JSON (GDPR export)
- **Delete Employee**: Soft delete (recoverable) or permanent delete
- **GDPR Checklist**: 8-item compliance tracker in the Privacy page

---

## Pages

| Page | Path | Description |
|------|------|-------------|
| Dashboard | `/` | Stats, activity feed, infrastructure status, quick actions |
| Onboarding | `/onboarding` | 4-step setup wizard (LLM, server, VPN, connectors) |
| Employees | `/employees` | List all AI employees with search/filter |
| Create Employee | `/employees/new` | 7-step employee creation wizard |
| Employee Detail | `/employees/[id]` | Dashboard with tabs: Overview, Activity, Inbox, Infrastructure, Audit |
| Policies | `/policies` | Manage capability permissions and rate limits |
| Approvals | `/approvals` | Approve/deny pending actions with diff preview |
| Orchestration | `/orchestration` | Team workflows, multi-agent coordination, demo scenario |
| Audit Log | `/audit` | Full hash-chained audit trail with integrity verification |
| Privacy | `/privacy` | EU data controls: retention, export, delete |

---

## API Routes

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/auth/signup` | POST | Create account + organization |
| `/api/auth/login` | POST | Login with email/password |
| `/api/auth/logout` | POST | Clear session |
| `/api/auth/me` | GET | Current user info |
| `/api/onboarding` | GET, PUT | Onboarding state (4 steps) |
| `/api/validate-key` | POST | Validate LLM API key against real provider |
| `/api/docker` | GET | Check Docker availability + agent image |
| `/api/employees` | GET, POST | List / create employees (with Docker provisioning) |
| `/api/employees/[id]` | GET, PUT, DELETE | Employee detail, update, container actions, soft delete |
| `/api/policies` | GET, POST | List / create policies |
| `/api/policies/[id]` | GET, PUT, DELETE | Single policy management |
| `/api/approvals` | GET, POST | List / create approval requests |
| `/api/approvals/[id]` | GET, PUT | Resolve approval (approve/deny) |
| `/api/audit` | GET | Audit logs + chain verification |
| `/api/gateway` | POST | Policy gateway for Docker agents |
| `/api/orchestration` | GET, POST | Teams + workflow rules |
| `/api/orchestration/demo` | POST | Run demo orchestration scenario |
| `/api/simulation` | GET | Simulated events for demo |
| `/api/spending` | GET | Spending summary |
| `/api/connectors` | GET | Connected accounts |
| `/api/providers` | GET | Provider configs |

---

## Seed Data

The database comes pre-seeded with:

- **1 organization**: Zumo Demo (onboarding completed)
- **1 user**: `demo@zumo.ai` / `password123`
- **3 provider configs**: LLM (Anthropic), Server (Hetzner EU), VPN (Tailscale)
- **5 connected accounts**: Slack, GitHub, HubSpot, Gmail, Google Calendar
- **3 teams**: Customer Support, Engineering, Security
- **5 employees**: Emma (Support), Alex (Developer), Sentinel (Security), Maya (Data Analyst), Otto (DevOps)
- **20 policies**: Role-based capability controls + inter-agent communication
- **3 workflow rules**: Multi-agent orchestration
- **3 approval requests**: Pending actions
- **24 audit log entries**: Hash-chained activity trail

---

## Environment Variables

```env
JWT_SECRET=zumo-dev-jwt-secret-change-in-production
ENCRYPTION_SECRET=zumo-dev-secret-change-in-prod-32c
DATA_REGION=EU
GATEWAY_URL=http://host.docker.internal:3000/api/gateway  # optional
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Generate Prisma client + migrate + seed + build Next.js |
| `npm start` | Start production server |
| `npm test` | Run all 50 tests |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:seed` | Seed the database with demo data |

---

## License

See [LICENSE](LICENSE) for details.
