import fs from "node:fs/promises"
import path from "node:path"

export interface BrainSearchResult {
	slug: string
	excerpt: string
	matchCount: number
}

export class ProjectBrainService {
	constructor(private readonly brainDir: string) {}

	static fromRepoRoot(repoRoot: string): ProjectBrainService {
		return new ProjectBrainService(path.join(repoRoot, ".palot", "brain"))
	}

	private async ensureDirectory(): Promise<void> {
		await fs.mkdir(this.brainDir, { recursive: true })
	}

	async listFiles(): Promise<string[]> {
		await this.ensureDirectory()
		const entries = await fs.readdir(this.brainDir)
		return entries
			.filter((f) => f.endsWith(".md"))
			.map((f) => f.replace(/\.md$/, ""))
			.sort()
	}

	async readFile(slug: string): Promise<string | null> {
		const filePath = path.join(this.brainDir, `${slug}.md`)
		try {
			return await fs.readFile(filePath, "utf-8")
		} catch {
			return null
		}
	}

	async writeFile(slug: string, content: string): Promise<void> {
		await this.ensureDirectory()
		await fs.writeFile(path.join(this.brainDir, `${slug}.md`), content, "utf-8")
	}

	async deleteFile(slug: string): Promise<boolean> {
		const filePath = path.join(this.brainDir, `${slug}.md`)
		try {
			await fs.unlink(filePath)
			return true
		} catch {
			return false
		}
	}

	async searchFiles(keyword: string): Promise<BrainSearchResult[]> {
		if (!keyword.trim()) return []
		const slugs = await this.listFiles()
		const needle = keyword.toLowerCase()
		const results: BrainSearchResult[] = []

		for (const slug of slugs) {
			const content = await this.readFile(slug)
			if (!content) continue
			const lower = content.toLowerCase()
			let matchCount = 0
			let pos = 0
			while ((pos = lower.indexOf(needle, pos)) !== -1) {
				matchCount++
				pos += needle.length
			}
			if (matchCount === 0) continue
			// Extract a short excerpt around the first match
			const firstMatch = lower.indexOf(needle)
			const start = Math.max(0, firstMatch - 60)
			const end = Math.min(content.length, firstMatch + keyword.length + 60)
			const excerpt = (start > 0 ? "…" : "") + content.slice(start, end).trim() + (end < content.length ? "…" : "")
			results.push({ slug, excerpt, matchCount })
		}

		return results.sort((a, b) => b.matchCount - a.matchCount)
	}

	async buildSummary(maxLength = 2000): Promise<string> {
		const parts: string[] = []

		const readme = await this.readFile("README")
		if (readme) parts.push(`## README\n${readme}`)

		const goals = await this.readFile("goals")
		if (goals) parts.push(`## goals\n${goals}`)

		const arch = await this.readFile("architecture")
		if (arch) parts.push(`## architecture\n${arch.slice(0, 500)}`)

		const decisions = await this.readFile("decisions")
		if (decisions) parts.push(`## decisions\n${decisions.slice(0, 400)}`)

		const tasks = await this.readFile("tasks")
		if (tasks) parts.push(`## tasks\n${tasks}`)

		const issues = await this.readFile("issues")
		if (issues) parts.push(`## issues\n${issues}`)

		const combined = parts.join("\n\n")
		return combined.slice(0, maxLength)
	}

	async buildContextSummary(sessionId?: string): Promise<string> {
		const base = await this.buildSummary(3000)
		if (!sessionId) return base

		const snapshot = await this.readFile(`compaction-snapshot-${sessionId}`)
		if (!snapshot) return base
		return `${base}\n\n## Previous Context (restored after compaction)\n${snapshot}`.slice(0, 4000)
	}
}
