/**
 * Pending-spawn queue — parses structured spawn requests the Lead Agent
 * writes to brain/spawn-requests.md and provides helpers to update them.
 *
 * Format the Lead Agent should write (via brain_append):
 *
 * ## REQUEST:agent-name:ISO-timestamp
 * - **Agent**: agent-name
 * - **Reason**: one-line reason
 * - **Status**: pending
 */

export interface SpawnRequest {
	/** Unique identifier: "<agent>:<requestedAt>" */
	id: string
	agent: string
	reason: string
	status: "pending" | "approved" | "rejected"
	requestedAt: string
}

const SECTION_RE = /^## REQUEST:([^:\n]+):([^\n]+)/gm
const FIELD_RE = /^- \*\*(\w+)\*\*:\s*(.+)$/m

/** Parse all spawn requests from the brain slug content. */
export function parseSpawnRequests(content: string | null): SpawnRequest[] {
	if (!content) return []
	const requests: SpawnRequest[] = []
	const sections = content.split(/(?=^## REQUEST:)/m).filter((s) => s.startsWith("## REQUEST:"))

	for (const section of sections) {
		const headerMatch = section.match(/^## REQUEST:([^:\n]+):([^\n]+)/)
		if (!headerMatch) continue
		const [, agentFromHeader, requestedAt] = headerMatch

		const agentMatch = section.match(/- \*\*Agent\*\*:\s*(.+)/)
		const reasonMatch = section.match(/- \*\*Reason\*\*:\s*(.+)/)
		const statusMatch = section.match(/- \*\*Status\*\*:\s*(pending|approved|rejected)/)

		const agent = (agentMatch?.[1] ?? agentFromHeader).trim()
		const reason = reasonMatch?.[1]?.trim() ?? ""
		const status = (statusMatch?.[1]?.trim() ?? "pending") as SpawnRequest["status"]

		requests.push({ id: `${agent}:${requestedAt.trim()}`, agent, reason, status, requestedAt: requestedAt.trim() })
	}

	return requests
}

/** Returns only pending requests. */
export function pendingRequests(requests: SpawnRequest[]): SpawnRequest[] {
	return requests.filter((r) => r.status === "pending")
}

/** Returns updated content with the given request ID marked as approved. */
export function markRequestApproved(content: string, id: string): string {
	const [agent, requestedAt] = id.split(/:(.+)/)
	const headerEscaped = `## REQUEST:${agent}:${requestedAt}`

	return content.replace(
		new RegExp(`(${escapeRegex(headerEscaped)}[\\s\\S]*?)- \\*\\*Status\\*\\*: pending`, "m"),
		"$1- **Status**: approved",
	)
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Build a brain_append payload the Lead Agent should use to request a spawn. */
export function buildSpawnRequestMarkdown(agent: string, reason: string): string {
	const ts = new Date().toISOString()
	return [
		`## REQUEST:${agent}:${ts}`,
		`- **Agent**: ${agent}`,
		`- **Reason**: ${reason}`,
		`- **Status**: pending`,
		"",
	].join("\n")
}
