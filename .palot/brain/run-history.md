---
title: Agent Run History
tags: [run-history, audit]
updated: 2026-05-13
---

# Agent Run History

| timestamp | agent | task | status | cost | tokens | notes |
|-----------|-------|------|--------|------|--------|-------|
| 2026-05-13 | lead-agent + architect + builder + reviewer | feat/agent-overhaul: Add Hive Mind panel, skills system, budget badge, supervision policy, chat input decomposition | completed | ~$0.50 est | ~200k est | Branch `feat/agent-overhaul`. Commits: `de6c823` (skills+panel), `d1b1193` (budget badge), `cfec2d4` (slop cleanup). |
| 2026-05-14 | lead-agent + architect + builder | heartbeat-recovery: Auto-recovery loop for stalled/unresponsive child sessions | completed | ~$0.15 est | ~30k est | New files: `lib/agent-recovery.ts`, `lib/agent-recovery.test.ts`, `hooks/use-agent-recovery.ts`. Modified: `atoms/session-heartbeats.ts`, `components/multi-agent-panel.tsx`. |
| 2026-05-14 | lead-agent + builder | pipeline-integration-test: 42-test integration suite covering 8 verification areas | completed | ~$0.15 est | ~25k est | New file: `lib/pipeline-integration.test.ts` (42 tests, 107 assertions). Tests: task decomposition, subagent spawning, permissions, heartbeats, auto-recovery, watchdog, supervision policy, workflow policy, compaction policy, full lifecycle scenario. |

## 2026-05-16T14:36:42.645Z — Productize Brain MCP — auto-register globally

Removed the palot-brain MCP server from the repo-local `opencode.json` and replaced it with auto-registration in the global OpenCode config (~/.config/opencode/opencode.json) at Palot app startup.

**Changes:**
- Created `apps/desktop/resources/palot-mcp-server.mjs` — standalone Node.js ESM script (no Bun, no TS). Same 8 tools (brain_list/read/write/append/record_event/search + mem9_store/recall). Runs with just `node`.
- Created `apps/desktop/src/main/brain-mcp-registrar.ts` — reads/writes global OpenCode config. Merges with existing MCP entries. Updates path on version changes.
- Wired `registerBrainMcpServer()` into `index.ts` at app startup (after IPC handlers).
- Added `resources/palot-mcp-server.mjs` to `electron-builder.yml` extraResources so it's bundled in production.
- Removed `mcp.palot-brain` block from repo `opencode.json` (now globally registered for all projects).

**Impact:** Any OpenCode session spawned from any project directory now has brain/mem9 tools available via the palot-brain MCP server, without manual config.

## 2026-05-16T14:40:49.538Z — Smart knowledge relevance — tag-based scoring for spawn dialog

Replaced the naive substring-based knowledge filtering in the spawn dialog with a multi-signal relevance scoring system.

**What changed:**
- Created `shared/knowledge-scorer.ts` — pure-function scoring module with 5 signals:
  - Agent name exact match in `agents:` frontmatter (+3)
  - Agent team match in `agents:` field (+2)
  - Agent team found in `tags:` field (+2)
  - Tag overlap with agent description (up to +3, +1 bonus for all)
  - Agent name in knowledge title/description (+1)
- Updated `team-roster.tsx`:
  - Uses `scoreKnowledgeSources()` to filter and sort by relevance
  - Pre-selects highly relevant sources (score ≥ 3) automatically
  - Shows a numeric score badge next to each knowledge item (sky-blue for ≥3, muted for 1-2)
- Works offline, no external service needed
- Mem9 semantic search can be added as an additional signal layer in the future

**Impact:** Spawn dialog now shows knowledge sources ranked by relevance, with the most pertinent docs pre-checked. The old substring match was too broad and gave equal weight to all matches.
