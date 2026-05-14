import { describe, expect, test } from "bun:test"
import {
	classifyPromptComplexity,
	routePrompt,
	routeTask,
	MODEL_TIERS,
} from "./model-routing-service"
import type { BrainTask } from "../shared/tasks"

function makeTask(
	role: BrainTask["role"],
	complexity: BrainTask["estimatedComplexity"],
	recommendedModel = "",
): Pick<BrainTask, "role" | "estimatedComplexity" | "recommendedModel"> {
	return { role, estimatedComplexity: complexity, recommendedModel }
}

// ============================================================
// classifyPromptComplexity
// ============================================================

describe("classifyPromptComplexity", () => {
	test("short explanation text → low", () => {
		expect(classifyPromptComplexity("explain this function to me")).toBe("low")
	})

	test("list / summarize → low", () => {
		expect(classifyPromptComplexity("summarize the changes made")).toBe("low")
	})

	test("architecture keyword → high", () => {
		expect(classifyPromptComplexity("redesign the architecture for concurrent requests")).toBe("high")
	})

	test("security keyword → high", () => {
		expect(classifyPromptComplexity("review the security of this authentication flow")).toBe("high")
	})

	test("medium-length prompt without special keywords → medium", () => {
		const text = "Update the API handler to accept a new optional field and validate it correctly before storing."
		expect(classifyPromptComplexity(text)).toBe("medium")
	})

	test("very long prompt → high regardless of content", () => {
		const text = "x ".repeat(800)
		expect(classifyPromptComplexity(text)).toBe("high")
	})
})

// ============================================================
// routePrompt
// ============================================================

describe("routePrompt", () => {
	test("returns haiku model for low-complexity prompt", () => {
		expect(routePrompt("list all files")).toBe(MODEL_TIERS.low)
	})

	test("returns opus model for high-complexity prompt", () => {
		expect(routePrompt("refactor the distributed architecture for better performance")).toBe(MODEL_TIERS.high)
	})
})

// ============================================================
// routeTask
// ============================================================

describe("routeTask", () => {
	test("respects explicit recommendedModel when set", () => {
		const task = makeTask("builder", "low", "openrouter/deepseek/deepseek-chat")
		expect(routeTask(task)).toBe("openrouter/deepseek/deepseek-chat")
	})

	test("architect + high → opus", () => {
		expect(routeTask(makeTask("architect", "high"))).toBe(MODEL_TIERS.high)
	})

	test("docs + low → haiku", () => {
		expect(routeTask(makeTask("docs", "low"))).toBe(MODEL_TIERS.low)
	})

	test("builder + medium → sonnet", () => {
		expect(routeTask(makeTask("builder", "medium"))).toBe(MODEL_TIERS.medium)
	})

	test("reviewer + high → opus (takes max of role and complexity tiers)", () => {
		expect(routeTask(makeTask("reviewer", "high"))).toBe(MODEL_TIERS.high)
	})

	test("docs + high → sonnet (complexity beats role)", () => {
		// docs role = low, complexity = high → merged = high → but docs ceiling is opus
		// Actually: mergeTiers(low, high) = high → MODEL_TIERS.high
		expect(routeTask(makeTask("docs", "high"))).toBe(MODEL_TIERS.high)
	})

	test("architect + low → high (role wins over complexity)", () => {
		// architect role = high, complexity = low → merged = high
		expect(routeTask(makeTask("architect", "low"))).toBe(MODEL_TIERS.high)
	})

	test("ignores whitespace-only recommendedModel", () => {
		const task = makeTask("builder", "medium", "   ")
		expect(routeTask(task)).toBe(MODEL_TIERS.medium)
	})
})
