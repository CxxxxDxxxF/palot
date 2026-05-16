import { describe, expect, test } from "bun:test"
import { buildHiveSpawnPrompt } from "./hive-spawn-prompt"
import type { ManagedSkill } from "../../shared/skills"

const reactSkill: ManagedSkill = {
	filename: "react-best-practices",
	name: "react-best-practices",
	description: "React performance optimization guidelines",
	tags: ["react", "frontend", "performance"],
	author: "",
	created: "",
	content: "",
	raw: "",
	origin: "project",
}

describe("buildHiveSpawnPrompt", () => {
	test("always includes brain, tools, hive reporting, and task sections", () => {
		const prompt = buildHiveSpawnPrompt({
			agentName: "frontend-developer",
			agentDescription: "Builds UI",
			customInstruction: "Fix the Brain page render state.",
			brainContext: "## issues\nKnown issue",
			memories: "## Relevant Memories\nPrior run",
			skills: [reactSkill],
		})

		expect(prompt).toContain("Palot Hive Operating Protocol")
		expect(prompt).toContain("brain_search")
		expect(prompt).toContain("brain_write")
		expect(prompt).toContain("Use tools directly")
		expect(prompt).toContain("End with a concise report")
		expect(prompt).toContain("## Current Brain Context")
		expect(prompt).toContain("## Relevant Memories")
		expect(prompt).toContain("react-best-practices")
		expect(prompt).toContain("## Task")
		expect(prompt).toContain("Fix the Brain page render state.")
	})

	test("falls back to a useful task when no custom instruction is provided", () => {
		const prompt = buildHiveSpawnPrompt({
			agentName: "qa-expert",
			agentDescription: "",
			customInstruction: "",
		})

		expect(prompt).toContain("Begin your work as qa-expert.")
		expect(prompt).toContain("If a project skill applies")
	})
})
