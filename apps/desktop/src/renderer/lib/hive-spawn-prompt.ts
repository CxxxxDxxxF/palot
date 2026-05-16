/**
 * Builds the task prompt sent to spawned Hive agents.
 *
 * The named OpenCode agent file supplies role/model identity. This prompt supplies
 * Palot-specific operating rules: Brain memory, hive reporting, tools, skills,
 * and selected knowledge references.
 */

import type { ManagedSkill } from "../../shared/skills"

export interface HiveSpawnPromptInput {
	agentName: string
	agentDescription: string
	customInstruction: string
	brainContext?: string | null
	memories?: string | null
	knowledgeSections?: Array<{ title: string; prompt: string }>
	skills?: ManagedSkill[]
	warnings?: string[]
}

function normalize(text: string): string {
	return text.trim()
}

function findRelevantSkills(agentName: string, task: string, skills: ManagedSkill[]): ManagedSkill[] {
	if (skills.length === 0) return []
	const haystack = `${agentName} ${task}`.toLowerCase()
	const scored = skills.map((skill) => {
		const terms = [
			skill.name,
			skill.filename,
			skill.description,
			...skill.tags,
		].filter(Boolean)
		const score = terms.reduce((sum, term) => {
			const words = term.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2)
			return sum + words.filter((word) => haystack.includes(word)).length
		}, 0)
		return { skill, score }
	})

	return scored
		.filter((item) => item.score > 0)
		.sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
		.slice(0, 6)
		.map((item) => item.skill)
}

function formatSkills(agentName: string, task: string, skills: ManagedSkill[] | undefined): string[] {
	const relevant = findRelevantSkills(agentName, task, skills ?? [])
	if (relevant.length === 0) {
		return [
			"## Skills",
			"",
			"- If a project skill applies, load and follow it before making changes.",
			"- Prefer project-specific skill instructions over generic assumptions.",
		]
	}

	return [
		"## Relevant Skills",
		"",
		...relevant.map((skill) => `- ${skill.name}: ${skill.description || "No description"}`),
		"",
		"Use these skills when applicable before implementation or review.",
	]
}

export function buildHiveSpawnPrompt(input: HiveSpawnPromptInput): string {
	const task = normalize(input.customInstruction) || `Begin your work as ${input.agentName}.`
	const parts: string[] = [
		"## Palot Hive Operating Protocol",
		"",
		`You are **${input.agentName}**, spawned by the Lead Agent (Boss) inside Palot's Hive Mind.`,
		input.agentDescription ? `Role: ${input.agentDescription}` : "",
		"",
		"### Required workflow",
		"",
		"1. Start by checking shared context. Use `brain_search`, `brain_list`, and `brain_read` when available before making decisions.",
		"2. Use tools directly when they materially reduce uncertainty: inspect files, run focused tests, search code, and verify outputs.",
		"3. Use `brain_append` or `brain_record_event` for durable findings, blockers, decisions, or handoff notes. Use `brain_write` only when replacing a whole file is intentional.",
		"4. Coordinate through the Boss. Ask clear questions when blocked; do not silently guess around missing business or safety decisions.",
		"5. End with a concise report: status, files touched or evidence checked, result, blockers, and recommended next step.",
		"",
		"### Shared memory tools",
		"",
		"- `brain_list`: discover shared project memory files.",
		"- `brain_read`: read project memory such as tasks, decisions, issues, models, run-history, skills, and agent-performance.",
		"- `brain_search`: find relevant prior decisions or failures before acting.",
		"- `brain_append`: safely add notes without overwriting other agents.",
		"- `brain_record_event`: safely add timestamped run-history, decision, blocker, and handoff events.",
		"- `brain_write`: replace a whole brain file only when that is intentional.",
		"- `mem9_recall` / `mem9_store`: use semantic memory when configured.",
		"",
		"### Tool discipline",
		"",
		"- Prefer read/search tools before edits.",
		"- Run the smallest meaningful verification for your change.",
		"- If a tool needs approval, ask once with the exact reason and wait.",
	]

	if (input.brainContext) {
		parts.push("", "## Current Brain Context", "", input.brainContext.slice(0, 5000))
	}

	if (input.memories) {
		parts.push("", input.memories)
	}

	if (input.warnings && input.warnings.length > 0) {
		parts.push(
			"",
			"## Context Warnings",
			"",
			...input.warnings.map((warning) => `- ${warning}`),
			"",
			"Continue if safe, but report these warnings back to the Boss.",
		)
	}

	parts.push("", ...formatSkills(input.agentName, task, input.skills))

	if (input.knowledgeSections && input.knowledgeSections.length > 0) {
		parts.push("", "## Reference Knowledge", "")
		for (const section of input.knowledgeSections) {
			parts.push(`### ${section.title}`, "", section.prompt, "")
		}
	}

	parts.push("", "## Task", "", task)

	return parts.filter((part) => part !== "").join("\n")
}
