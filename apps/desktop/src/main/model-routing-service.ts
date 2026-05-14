import type { BrainTask } from "../shared/tasks"

export type ModelComplexity = "low" | "medium" | "high"

// Cost tiers (ascending). Keys match opencode model IDs.
export const MODEL_TIERS = {
	low: "claude-haiku-4-5-20251001",
	medium: "claude-sonnet-4-6",
	high: "claude-opus-4-7",
} as const satisfies Record<ModelComplexity, string>

const ROLE_COMPLEXITY: Record<BrainTask["role"], ModelComplexity> = {
	docs: "low",
	fixer: "medium",
	builder: "medium",
	reviewer: "medium",
	architect: "high",
}

const COMPLEXITY_OVERRIDE: Record<BrainTask["estimatedComplexity"], ModelComplexity> = {
	low: "low",
	medium: "medium",
	high: "high",
}

// Keywords that bump complexity up one tier
const HIGH_COMPLEXITY_KEYWORDS =
	/\b(architect|refactor|design|migration|security|performance|concurrent|distributed|algorithm|complex)\b/i
const LOW_COMPLEXITY_KEYWORDS =
	/\b(explain|summarize|list|describe|document|rename|format|comment|typo)\b/i

export function classifyPromptComplexity(text: string): ModelComplexity {
	if (LOW_COMPLEXITY_KEYWORDS.test(text) && text.length < 400) return "low"
	if (HIGH_COMPLEXITY_KEYWORDS.test(text) || text.length > 1500) return "high"
	if (text.length > 60) return "medium"
	return "low"
}

export function routeTask(task: Pick<BrainTask, "role" | "estimatedComplexity" | "recommendedModel">): string {
	// Honour explicit recommendedModel when set
	if (task.recommendedModel && task.recommendedModel.trim()) {
		return task.recommendedModel.trim()
	}
	// Merge role-based and complexity-based signals — take the higher tier
	const roleLevel = ROLE_COMPLEXITY[task.role]
	const complexityLevel = COMPLEXITY_OVERRIDE[task.estimatedComplexity]
	const tier = mergeTiers(roleLevel, complexityLevel)
	return MODEL_TIERS[tier]
}

export function routePrompt(text: string): string {
	const complexity = classifyPromptComplexity(text)
	return MODEL_TIERS[complexity]
}

function tierRank(t: ModelComplexity): number {
	return t === "low" ? 0 : t === "medium" ? 1 : 2
}

function mergeTiers(a: ModelComplexity, b: ModelComplexity): ModelComplexity {
	const rank = Math.max(tierRank(a), tierRank(b))
	return (["low", "medium", "high"] as const)[rank]
}
