import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useRef } from "react"
import { appendSubagentOutputAtom } from "../atoms/supervisor-state"
import { childSessionsFamily } from "../atoms/sub-agents"
import { messagesFamily } from "../atoms/messages"
import { partsFamily } from "../atoms/parts"
import { appStore } from "../atoms/store"
import { recordAgentPerformance } from "../services/backend"
import type { ManagedAgent } from "../../shared/agents"
import type { AgentStatus } from "../lib/types"

/**
 * Watches child sessions for `parentSessionId` and automatically records
 * each child's completion to the supervisor state when it transitions from
 * running → idle/completed. This is the Feature 7 integration point:
 * supervisor state is updated without any manual bookkeeping in the lead agent.
 */
export function useSubAgentCompletion(
	parentSessionId: string,
	projectPath: string | undefined,
	knownAgents: ManagedAgent[] = [],
): void {
	const children = useAtomValue(childSessionsFamily(parentSessionId))
	const appendOutput = useSetAtom(appendSubagentOutputAtom)

	// Track which sessions we've already recorded so we don't double-record
	const recordedRef = useRef(new Set<string>())
	// Track previous statuses to detect transitions
	const prevStatusRef = useRef(new Map<string, AgentStatus>())

	useEffect(() => {
		if (!projectPath) return

		for (const child of children) {
			const prev = prevStatusRef.current.get(child.sessionId)
			const curr = child.agentStatus

			// Detect running → terminal transition
			if (
				prev === "running" &&
				(curr === "completed" || curr === "idle" || curr === "failed") &&
				!recordedRef.current.has(child.sessionId)
			) {
				recordedRef.current.add(child.sessionId)

				// Extract text from the last assistant message parts
				const messages = appStore.get(messagesFamily(child.sessionId))
				const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant")
				let summary = `Agent ${child.name} completed.`
				if (lastAssistant) {
					const parts = appStore.get(partsFamily(lastAssistant.id))
					const text = parts
						.filter((p) => p.type === "text")
						.map((p) => ("text" in p ? p.text : ""))
						.join(" ")
						.trim()
					if (text) summary = text.slice(0, 500)
				}

				const completedAt = new Date()
				const knownAgent = knownAgents.find((agent) => {
					const name = agent.name.toLowerCase()
					const filename = agent.filename.toLowerCase()
					const childName = child.name.toLowerCase()
					return name === childName || filename === childName.replace(/\s+/g, "-")
				})

				appendOutput({
					projectPath,
					output: {
						sessionId: child.sessionId,
						taskId: child.sessionId,
						summary,
						completedAt: completedAt.toISOString(),
					},
				})

				recordAgentPerformance(projectPath, {
					sessionId: child.sessionId,
					parentSessionId,
					agentName: child.name,
					team: knownAgent?.team,
					teamRole: knownAgent?.teamRole,
					model: child.model,
					status: curr === "failed" ? "failed" : "completed",
					startedAt: new Date(completedAt.getTime() - child.durationMs).toISOString(),
					completedAt: completedAt.toISOString(),
					durationMs: child.durationMs,
					costUsd: child.costRaw,
					tokens: child.tokensRaw,
					toolCallCount: child.toolCallCount,
					errorCount: child.errorCount,
					retryCount: child.retryCount,
					summary,
					failureReason: curr === "failed" ? child.errorMessage : null,
				}).catch(() => {})
			}

			prevStatusRef.current.set(child.sessionId, curr)
		}
	}, [children, projectPath, parentSessionId, knownAgents, appendOutput])
}
