import { describe, expect, test } from "bun:test"
import {
	buildSpawnRequestMarkdown,
	markRequestApproved,
	parseSpawnRequests,
	pendingRequests,
} from "./pending-spawn-queue"

const SAMPLE = [
	"# Agent Spawn Requests",
	"",
	"## REQUEST:researcher:2026-05-17T01:00:00.000Z",
	"- **Agent**: researcher",
	"- **Reason**: Analyze competitor API patterns",
	"- **Status**: pending",
	"",
	"## REQUEST:data-analyst:2026-05-17T02:00:00.000Z",
	"- **Agent**: data-analyst",
	"- **Reason**: Performance metrics",
	"- **Status**: approved",
	"",
	"## REQUEST:code-reviewer:2026-05-17T03:00:00.000Z",
	"- **Agent**: code-reviewer",
	"- **Reason**: Review the auth module",
	"- **Status**: pending",
].join("\n")

describe("parseSpawnRequests", () => {
	test("returns empty array for null content", () => {
		expect(parseSpawnRequests(null)).toEqual([])
	})

	test("returns empty array for content with no requests", () => {
		expect(parseSpawnRequests("# Just a header\n\nNo requests here.")).toEqual([])
	})

	test("parses all three requests from sample", () => {
		const requests = parseSpawnRequests(SAMPLE)
		expect(requests).toHaveLength(3)
	})

	test("parses agent name, reason, status, and requestedAt", () => {
		const requests = parseSpawnRequests(SAMPLE)
		const researcher = requests.find((r) => r.agent === "researcher")
		expect(researcher).toBeDefined()
		expect(researcher!.reason).toBe("Analyze competitor API patterns")
		expect(researcher!.status).toBe("pending")
		expect(researcher!.requestedAt).toBe("2026-05-17T01:00:00.000Z")
		expect(researcher!.id).toBe("researcher:2026-05-17T01:00:00.000Z")
	})

	test("parses approved status", () => {
		const requests = parseSpawnRequests(SAMPLE)
		const analyst = requests.find((r) => r.agent === "data-analyst")
		expect(analyst!.status).toBe("approved")
	})
})

describe("pendingRequests", () => {
	test("returns only pending requests", () => {
		const requests = parseSpawnRequests(SAMPLE)
		const pending = pendingRequests(requests)
		expect(pending).toHaveLength(2)
		expect(pending.every((r) => r.status === "pending")).toBe(true)
		expect(pending.map((r) => r.agent).sort()).toEqual(["code-reviewer", "researcher"])
	})

	test("returns empty array when all approved", () => {
		const content = [
			"## REQUEST:a:2026-01-01T00:00:00.000Z",
			"- **Agent**: a",
			"- **Reason**: test",
			"- **Status**: approved",
		].join("\n")
		expect(pendingRequests(parseSpawnRequests(content))).toEqual([])
	})
})

describe("markRequestApproved", () => {
	test("updates the matching pending status to approved", () => {
		const updated = markRequestApproved(SAMPLE, "researcher:2026-05-17T01:00:00.000Z")
		const requests = parseSpawnRequests(updated)
		const researcher = requests.find((r) => r.agent === "researcher")
		expect(researcher!.status).toBe("approved")
	})

	test("does not affect other requests", () => {
		const updated = markRequestApproved(SAMPLE, "researcher:2026-05-17T01:00:00.000Z")
		const requests = parseSpawnRequests(updated)
		const codeReviewer = requests.find((r) => r.agent === "code-reviewer")
		expect(codeReviewer!.status).toBe("pending")
	})

	test("leaves content unchanged for unknown id", () => {
		const updated = markRequestApproved(SAMPLE, "nonexistent:2026-01-01T00:00:00.000Z")
		expect(updated).toBe(SAMPLE)
	})
})

describe("buildSpawnRequestMarkdown", () => {
	test("produces parseable output with pending status", () => {
		const md = buildSpawnRequestMarkdown("architect", "Design the new auth flow")
		const requests = parseSpawnRequests(md)
		expect(requests).toHaveLength(1)
		expect(requests[0].agent).toBe("architect")
		expect(requests[0].reason).toBe("Design the new auth flow")
		expect(requests[0].status).toBe("pending")
	})
})
