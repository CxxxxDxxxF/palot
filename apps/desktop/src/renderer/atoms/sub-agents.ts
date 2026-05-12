/**
 * Derived atom family for per-session child (sub-agent) session data.
 *
 * Uses the existing `childrenMapAtom` parent→children map and enriches each
 * child with live metrics so the MultiAgentPanel can render without
 * subscribing to the full agents list on every update.
 */
import { atom } from "jotai"
import { atomFamily } from "jotai-family"
import type { AgentStatus } from "../lib/types"
import { sessionFamily } from "./sessions"
import { childrenMapAtom } from "./derived/session-requests"
import { sessionMetricsFamily } from "./derived/session-metrics"

// ============================================================
// Types
// ============================================================

export interface SubAgentEntry {
	sessionId: string
	name: string
	agentStatus: AgentStatus
	activity: string | null
	costRaw: number
	cost: string
	tokensRaw: number
	tokens: string
}

// ============================================================
// Atom family — child sessions for a given parent
// ============================================================

/**
 * Returns live sub-agent entries for all direct children of `parentSessionId`.
 * Re-evaluates when the children map, any child's session entry, or any child's
 * metrics change. Only direct children are included (not grand-children).
 */
export const childSessionsFamily = atomFamily((parentSessionId: string) => {
	let prev: SubAgentEntry[] = []

	return atom((get): SubAgentEntry[] => {
		const childrenMap = get(childrenMapAtom)
		const childIds = childrenMap.get(parentSessionId) ?? []

		if (childIds.length === 0) {
			prev = []
			return prev
		}

		const next: SubAgentEntry[] = []

		for (const id of childIds) {
			const entry = get(sessionFamily(id))
			if (!entry) continue

			const metrics = get(sessionMetricsFamily(id))
			const { session, status, permissions, questions } = entry

			let agentStatus: AgentStatus = "idle"
			if (permissions.length > 0 || questions.length > 0) {
				agentStatus = "waiting"
			} else if (status.type === "busy" || status.type === "retry") {
				agentStatus = "running"
			}

			let activity: string | null = null
			if (questions.length > 0) {
				activity = `Asking: ${questions[0]?.questions[0]?.header ?? "Question"}`
			} else if (permissions.length > 0) {
				activity = `Needs approval: ${permissions[0]?.permission}`
			} else if (status.type === "busy") {
				activity = "Working..."
			}

			next.push({
				sessionId: id,
				name: session.title || "Sub-agent",
				agentStatus,
				activity,
				costRaw: metrics.costRaw,
				cost: metrics.cost,
				tokensRaw: metrics.tokensRaw,
				tokens: metrics.tokens,
			})
		}

		// Structural equality: return prev if nothing changed
		if (
			next.length === prev.length &&
			next.every(
				(n, i) =>
					n.sessionId === prev[i].sessionId &&
					n.name === prev[i].name &&
					n.agentStatus === prev[i].agentStatus &&
					n.activity === prev[i].activity &&
					n.costRaw === prev[i].costRaw &&
					n.tokensRaw === prev[i].tokensRaw,
			)
		) {
			return prev
		}

		prev = next
		return next
	})
})
