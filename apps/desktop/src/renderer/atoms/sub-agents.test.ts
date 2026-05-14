import { describe, expect, test } from "bun:test"
import { getPendingPermissionLabel, getPendingQuestionHeader } from "./sub-agents"

describe("sub-agent data guards", () => {
	test("handles incomplete child question data without throwing", () => {
		expect(getPendingQuestionHeader([{ id: "q-1" }])).toBe("Question")
		expect(getPendingQuestionHeader([{ questions: [] }])).toBe("Question")
		expect(getPendingQuestionHeader([{ questions: [{ header: "Pick an option" }] }])).toBe(
			"Pick an option",
		)
	})

	test("handles incomplete child permission data without throwing", () => {
		expect(getPendingPermissionLabel([{ id: "p-1" }])).toBe("approval")
		expect(getPendingPermissionLabel([{ permission: "edit" }])).toBe("edit")
		expect(getPendingPermissionLabel(null)).toBe("approval")
	})
})
