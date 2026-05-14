---
title: Known Issues and Blockers
tags: [issues, risks]
updated: 2026-05-14
---

# Known Issues and Blockers

| id | severity | description | status | workaround |
|----|----------|-------------|--------|-----------|
| enforcement-boundary | high | Supervision policy fires at Palot's prompt submission hook, not inside OpenCode's `task` tool spawn. A lead agent that spawns sub-agents autonomously mid-turn bypasses all enforcement. | open | Policy is advisory only; user must act on warnings manually |
| heartbeat-recovery | medium | Palot detects stalled/unresponsive child sessions in Hive Mind and exposes restart/terminate actions, but there is still no automatic recovery loop. | open | Use the Hive Mind restart/terminate controls or manually navigate to the child session |
| no-kill-switch | medium | OpenCode exposes no API to terminate a running child session from outside. Budget overruns can only be surfaced to the user, not stopped automatically. | open | User must abort from inside the child session |
| hardcoded-thresholds | low | `DEFAULT_SUPERVISION_POLICY` defines `configuredBudget: 1.0`, `maxChildren: 12`, `maxConcurrentAgents: 3`. Not user-configurable. | open | Edit `supervision-policy.ts` manually; see [[tasks]] for `budget-thresholds-ui` task |
| runtime-agent-sync | medium | OpenCode reads runtime agent files outside the repo. Updating `.opencode/agents/` improves version control, but existing local runtime copies may still be stale. | open | Sync `.opencode/agents/*.md` to the configured OpenCode agent directory after edits |
| no-integration-test | medium | No automated test covers the full Lead → Architect → Builder → Reviewer flow end-to-end. | open | Manual smoke test only; see [[tasks]] for `pipeline-integration-test` task |
| event-persistence | low | `supervisionEventsAtom` uses `atomWithStorage` (renderer localStorage). Not durable across devices, capped at 50 events, not a reliable audit log. | open | Acceptable for now; see [[decisions]] for rationale |
| manual-agent-sync | low | Agent config files must be manually synced between `.opencode/agents/` (repo) and `~/.config/opencode/agents/` (runtime). | open | Copy files after editing; a future app-launch sync hook would resolve this |
