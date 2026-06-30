# BPB Action Mesh

Decentralized mesh of ephemeral proxy nodes (VLESS/Hysteria2) on GitHub Actions runners, discovered via libp2p Kademlia DHT. Research experiment — not production.

---

## 1. Dispatch Matrix (Tool Routing + Fallback)

This is the **binding routing table**. Every task MUST go through MCP when the server is loaded in the current session. Native tools are **only** the last-resort fallback.

| Intent | Primary MCP | Secondary MCP | Native fallback |
|---|---|---|---|
| Symbol discovery / search | jcodemunch `search_symbols` | serena `symbol_full` | Grep / Glob |
| Jump to definition / read symbol | jcodemunch `get_symbol_source` | serena `symbol_full` | Grep `-n` |
| Read a file for editing | — | — | Read tool (native only) |
| Blast radius / who uses | jcodemunch `get_blast_radius` | serena `find_refs` | Grep |
| Full-text / literal / comment search | jcodemunch `search_text` | serena `text_search` | Grep |
| Call chain / data flow | jcodemunch `get_call_hierarchy` | serena `outline` | Read + Grep |
| "Does X exist?" preflight | jcodemunch `search_symbols` | serena `symbol_lite` | Grep / Glob |
| Multi-symbol context bundle | jcodemunch `get_context_bundle` | — | Read (targeted section only) |
| Anti-pattern scan | jcodemunch `search_ast` | — | Grep |
| Refactor preflight | jcodemunch `check_safe` + `plan_refactoring` | — | Manual trace (avoid) |

### Fallback Policy

1. **Prefer MCP**: when the MCP server is loaded in the current session, call the listed MCP tool first.
2. **Cross-MCP fallback**: if the primary MCP call errors or times out, try the secondary MCP alternative.
3. **Native last**: use Read/Grep/Glob **only** when both MCPs are absent (e.g., MCP server not wired in this session).
4. **Never downgrade**: do **not** use Grep instead of MCP when the MCP result returns `_meta.confidence` ≥ 0.4. The routing table is binding.

---

## 2. Delegate-Verify Loop v2

Follow this for every code-change task.

### Step 1 — Bootstrap (session start)

```
# Confirm repo is indexed — first call of every session
resolve_repo(path=".")
# if not indexed:
index_folder(path=".")
```

### Step 2 — Assemble intent

```
assemble_task_context(repo="animamesh/backend", task="<user task>", token_budget=4000)
```

This auto-classifies intent (explore/debug/refactor/extend/audit/review) and returns ranked symbols + context. Do not manually hunt for entry points.

### Step 3 — Map blast radius

For every target symbol:
```
check_safe(repo="animamesh/backend", symbol="<symbol>", mode="edit")
```
- `verdict: "blocked"` — stop, report to user, await decision.
- `verdict: "safe"` — proceed to delegation.

### Step 4 — Delegate ONE step

Sub-agent prompts MUST include:

1. **Repo identifier** — `animamesh/backend`
2. **Tool contract** — "Use `search_symbols`, `get_symbol_source`, `get_context_bundle` for code nav. Never `Grep` or `read_file` for symbol lookups. Use `get_blast_radius` before direct calls."
3. **Target symbols** — exact `<symbol_id>` list
4. **All required context** — stateless sub-agent
5. **Token budget** — set a cap

Delegate **one** step only. Fan out across disjoint files only when instructed.

**Recursive safety**: spawned sub-droids — do your job directly. Do not recursively spawn.

### Step 5 — ❗ Verify the Result (CRITICAL)

After EVERY delegated task:

1. **Read actual source** — `Grep` / `Read` confirms the expected code is present.
2. **Blast radius** — `get_blast_radius` confirms no unexpected dependents.
3. **No broken call sites** — trace references to changed symbols.
4. **Invalidate caches** — `register_edit(repo="animamesh/backend", file_paths=[...], reindex=true)` after every mutation.
5. **Test** — `npm test`.

### Step 6 — Iterate

- Approved → next step.
- Revision → re-delegate with corrective feedback. **Do not fix code yourself** — delegate the fix.

---

## 3. Hard MCP Anti-Patterns

These are **binding violations** — not suggestions.

- Using `Read` for full files instead of `get_context_bundle` in read-only exploration.
- Using `Grep` for symbol search when `search_symbols` is loaded and returns `_meta.confidence` ≥ 0.4.
- Skipping `check_safe` before edits/deletes.
- Skipping `register_edit` after file mutations.
- Re-searching after `verdict: "no_implementation_found"` — the absence is confirmed.
- Manual blast-radius tracing when `get_blast_radius` exists.
- Ignoring `confidence` tiers — low confidence means report the gap, not proceed.

---

## 4. Session Bootstrap

```
# 1. Confirm repo index
resolve_repo(path=".")

# 2. Cold-start triage
get_repo_map(group_by="flat", top_n=30)
get_tectonic_map()
get_repo_health(detailed=true)
```

After this, move directly to `assemble_task_context` for the user's task.

---

## 5. MCP Profiles + Reference

### 5a. jcodemunch (available when MCP server is wired)

**Anti-ban**: do not Read/Grep instead of these.

```
CORE LOOKUP
  search_symbols     — symbol discovery (mode {context,winnow}, semantic, fusion, detail_level)
  search_text        — literals, comments, configs across files
  search_ast         — structural anti-pattern scan
  assemble_task_context — ranked symbols + context from task statement
  get_symbol_source  — targeted code retrieval
  get_context_bundle — multi-symbol context in one call
  get_file_outline    — file structure without full read

IMPACT & SAFETY
  get_blast_radius   — call_depth 0-3, include_decisions, source_budget
  find_references    — mode {refs,importers,related}, quick={true,false}
  get_call_hierarchy — direction, chains=true for HTTP/CLI/event paths
  check_safe         — mode {edit,delete}, composite preflight
  plan_refactoring   — rename/move/extract/signature, returns {old_text,new_text}

REPO INTELLIGENCE
  get_repo_health    — dead code %, complexity, cycles, hotspots
  get_repo_map       — PageRank-ranked signatures; mode="outline" for lightweight
  get_tectonic_map   — logical module topology, drifters, nexus plates
  find_similar_symbols — consolidation candidates (threshold, semantic_weight)
  get_dead_code_v2   — multi-signal dead code detection
  get_pr_risk_profile — unified PR/branch risk score

RUNTIME & INDEX
  register_edit      — invalidate caches after file edits (REQUIRED after any mutation)
  index_file         — surgical single-file reindex
  index_folder       — full reindex
  embed_repo         — precompute embeddings for semantic search
```

### 5b. serena (loaded when available in session)

Anti-ban: do not use Grep/Glob/Read-FMD instead of these when serena is wired.

```
symbol_full   — symbol discovery + first occurrence
symbol_lite   — lightweight symbol existence check
find_refs     — who references a symbol
text_search   — full-text / literal / comment search
outline      — file or top-level tree outline
```

### 5c. Confidence + Negative-Evidence Routing

| MCP `_meta.confidence` | Action |
|---|---|
| `high` (≥ 0.8) | Act directly; max 2 supplementary reads |
| `medium` (0.4–0.79) | Explore recommended files; max 5 supplementary reads |
| `low` (< 0.4) | Report the gap — do not proceed |

**Negative evidence**: `verdict: "no_implementation_found"` → **stop**. Report to user; do not re-query.

### 5d. After Editing Files

**Required immediately after any mutation:**
```
register_edit(repo="animamesh/backend", file_paths=[<paths>], reindex=true)
```
Without it, later searches return stale data.

### 5e. Token Budget Defaults

```
assemble_task_context(token_budget=4000)
get_context_bundle(token_budget=6000, budget_strategy="core_first")
search_symbols(token_budget=3000, detail_level="compact")
```

---

## 6. Structure & Commands

```
src/        Express + Socket.IO dashboard (server.ts, assets/panel/)
node/       libp2p DHT mesh node — discovery + lifecycle
worker/     Cloudflare Worker coordinator — register, heartbeat, subscription
scripts/    CLI: proxy-up.sh, animamesh-connect.sh, proxy-down.sh, proxy-status.sh
.github/    proxy.yml (GHA runner), panel.yml (build/deploy dashboard)
docs/       SPEC-V2-MESH.md, SPEC-V3-ANIMAMESH-BACKEND.md, ANIMAMESH-CLIENT.md
```

| Action | Command |
|---|---|
| Dev dashboard | `npm run dev` |
| Dev mesh node | `cd node && npm run dev` |
| Dev coordinator | `cd worker && npm run dev` |
| Build all | `npm run build` |
| Build panel | `npm run build:panel` |
| Test | `npm test` (no-op stub) |
| Lint | `npm run lint` |
| Launch proxy | `./scripts/proxy-up.sh --protocol hysteria2` |
| Deploy coordinator | `cd worker && npm run deploy` |
| P2P connect | `./scripts/animamesh-connect.sh --coordinator URL --auth-token TOKEN` |

---

## 7. Git Rules

| Rule | Detail |
|---|---|
| Default branch | `main` — push triggers proxy workflow via GHA |
| Layout | Monorepo: root `package.json` owns dashboard; `node/` and `worker/` have own packages |
| Sync | `proxy.yml` runs on `ubuntu-latest`, 45-min timeout; DHT node step is commented out — do not re-enable |

Emergency recovery: push to main or `workflow_dispatch` → `proxy-up.sh` → `curl $COORDINATOR_URL/health` → `proxy-down.sh` to cancel stuck runs.

---

## 8. Testing Rules

- `npm test` exits 0 (no tests yet)
- When adding tests: place adjacent to source (e.g. `node/src/lifecycle.test.ts`), use same module system as the source package, update the relevant `package.json` test script
- `panel.yml` has `continue-on-error: true` on deploy/release — failures are silently ignored

---

## 9. Architecture Landmines

| Constraint | Why it matters |
|---|---|
| **DHT is discovery-only** | Never route proxy traffic through libp2p — unanimous consillium agreement |
| **Coordinator is optional** | Every feature must work DHT-only — graceful degradation |
| **No serial multi-hop** | `route: []` was killed by consillium — parallel multiplexing is the resilience model |
| **Ephemeral by design** | Nodes live 15-60 min, no persistent state, identity is per-lifecycle PeerId |
| **Stagger, don't sync** | Random TTLs, jittered announces — no herd behavior |
| **DHT key schema** | `/bpb/v2/{network-id}/{protocol}/{peer-id}` — changing it requires updating both `node/announce.ts` and the spec |
| **Module system mismatch** | Root tsconfig = CommonJS, `node/tsconfig.json` = ES2022 — never mix import styles across packages |
| **`/sub/all` format** | Consumed by Hiddify/v2ray clients — any output change breaks existing subscriptions |

### Coordinator API to preserve:

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/register` | POST | Bearer | Runner registers proxy config |
| `/heartbeat` | POST | Bearer | Runner refreshes TTL |
| `/sub/all` | GET | None | Hiddify subscription (all proxies) |
| `/sub/{id}` | GET | None | Single proxy subscription |
| `/proxies` | GET | None | JSON list of active proxies |
| `/delete/{id}` | DELETE | Bearer | Remove a proxy record |
| `/health` | GET | None | Service health check |

---

## 10. Fleet Architecture

Animamesh operates across a fleet of throwaway GitHub accounts (`vi70x5`–`vi70x20`) to distribute proxy runners, avoid rate limits, and reduce blast radius.

### Fleet Coordination (Shared Coordinator Model)

```
                          ┌──────────────────────┐
                          │  Cloudflare Worker    │
                          │  vi70x3 account       │
                          │  (single coordinator)  │
                          │  KV: proxies, config  │
                          └──────┬───────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │ vi70x5 fork  │      │ vi70x6 fork  │      │ vi70x7 fork  │
   │ retry-queue  │      │ cloud-sync   │      │ data-pipe    │
   └──────┬───────┘      └──────┬───────┘      └──────┬───────┘
          │ POST /register      │                      │
          └─────────────────────┴──────────────────────┘
                                      │
                              KV: shared pool
                                      │
                                      ▼
                             ┌──────────────────┐
                             │  End user client  │
                             │  (Hiddify, curl)  │
                             └──────────────────┘
```

### Authentication Matrix

| Secret | Scope | Where stored | Rotated |
|---|---|---|---|
| GitHub PAT | Per-account | `~/.animamesh/accounts/<name>/token` (chmod 600) + `gh/hosts.yml` | Per-session |
| CF API Token | Per-account | `~/.animamesh/accounts/<name>/cf_token` (chmod 600) | If leaked |
| CF Account ID | Per-account | `~/.animamesh/accounts/<name>/cf_account_id` | Rarely |
| COORDINATOR_URL | Fleet-wide | `~/.animamesh/fleet.env` + GH Actions secret on every repo | Rarely |
| AUTH_TOKEN | Fleet-wide | `~/.animamesh/fleet.env` + GH Actions secret on every repo | If leaked |
| N2N_COMMUNITY | Fleet-wide | `~/.animamesh/fleet.env` + GH Actions secret on every repo | Per-deployment |
| N2N_KEY | Fleet-wide | `~/.animamesh/fleet.env` + GH Actions secret on every repo | Per-deployment |
| CLOUDFLARE_API_TOKEN | Per-account | GH Actions secret on repo | If leaked |
| CLOUDFLARE_TUNNEL_CREDS | Per-account | GH Actions secret on repo | If leaked |
| VLESS_UUID / HY2_PASSWORD | Per-run | Generated in workflow, posted to coordinator | Every run |

### Repo Obfuscation

- Repo name: random descriptive CI name (no fork relationship).
- README: innocent CI-pipeline description only.
- Workflow title: "CI Pipeline" with generic step names.
- Minimal footprint: only `.github/workflows/proxy.yml`, `README.md`, fake source.

### Storage Layout

```
~/.animamesh/
├── gh/token
├── fleet.env
├── accounts/<name>/{token,cf_token,cf_account_id,gh/hosts.yml,repo/}
├── repos/<name>.meta
└── .gitignore  # *token*,*secret*,fleet.env,hosts.yml
```

---

## 11. Credential Rules

- `COORDINATOR_URL`, `AUTH_TOKEN`, `NETWORK_ID` → `~/.animamesh/fleet.env` locally + GH Actions secrets. Never in source.
- Worker `AUTH_TOKEN` set via `wrangler secret put AUTH_TOKEN`. Dev mode = absent.
- `wrangler.toml` KV namespace id is a placeholder — replace after `wrangler kv:namespace create BPB_KV`. Don't commit real ids.
- `chmod 600` on all token files under `~/.animamesh/accounts/`.
- CF tokens (`cf_token`, `cf_account_id`) are optional.

---

## 12. Further Reference

- `docs/SPEC-V2-MESH.md` — Full architecture (DHT topology, lifecycle, threat model, consillium decisions)
- `docs/SPEC-V3-ANIMAMESH-BACKEND.md` — V3 architecture (n2P2P overlay, coordinator, signing)
- `docs/ANIMAMESH-CLIENT.md` — n2n P2P Linux client documentation
- `README.md` — Quick start, threat model, FAQ, roadmap
