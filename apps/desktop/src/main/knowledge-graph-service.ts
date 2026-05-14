import { randomUUID } from "node:crypto"
import type { ProjectBrainService } from "./project-brain-service"

export type KnowledgeEntryType = "goal" | "decision" | "lesson" | "file-relationship"

export interface KnowledgeEntry {
	id: string
	type: KnowledgeEntryType
	title: string
	body: string
	tags: string[]
	relatedFiles: string[]
	createdAt: string
	updatedAt: string
}

export interface KnowledgeQueryOptions {
	type?: KnowledgeEntryType
	keyword?: string
	relatedFile?: string
	limit?: number
}

const SLUG_PREFIX = "kg-"

function entryToMarkdown(entry: KnowledgeEntry): string {
	const frontmatter = [
		"---",
		`id: ${entry.id}`,
		`type: ${entry.type}`,
		`title: ${entry.title}`,
		`tags: [${entry.tags.join(", ")}]`,
		`relatedFiles: [${entry.relatedFiles.join(", ")}]`,
		`createdAt: ${entry.createdAt}`,
		`updatedAt: ${entry.updatedAt}`,
		"---",
		"",
		entry.body,
	]
	return frontmatter.join("\n")
}

function markdownToEntry(slug: string, content: string): KnowledgeEntry | null {
	const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
	if (!match) return null
	const [, fm, body] = match

	const get = (key: string): string => {
		const line = fm.split("\n").find((l) => l.startsWith(`${key}:`))
		return line ? line.slice(key.length + 1).trim() : ""
	}
	const getList = (key: string): string[] => {
		const raw = get(key)
		const inner = raw.replace(/^\[/, "").replace(/\]$/, "").trim()
		return inner ? inner.split(",").map((s) => s.trim()).filter(Boolean) : []
	}

	const id = get("id") || slug.replace(SLUG_PREFIX, "")
	const type = get("type") as KnowledgeEntryType
	if (!["goal", "decision", "lesson", "file-relationship"].includes(type)) return null

	return {
		id,
		type,
		title: get("title"),
		body: body.trim(),
		tags: getList("tags"),
		relatedFiles: getList("relatedFiles"),
		createdAt: get("createdAt"),
		updatedAt: get("updatedAt"),
	}
}

function makeSlug(type: KnowledgeEntryType, id: string): string {
	return `${SLUG_PREFIX}${type}-${id}`
}

export class KnowledgeGraphService {
	constructor(private readonly brain: ProjectBrainService) {}

	async add(
		entry: Omit<KnowledgeEntry, "id" | "createdAt" | "updatedAt">,
	): Promise<KnowledgeEntry> {
		const now = new Date().toISOString()
		const full: KnowledgeEntry = {
			...entry,
			id: randomUUID().slice(0, 8),
			createdAt: now,
			updatedAt: now,
		}
		await this.brain.writeFile(makeSlug(full.type, full.id), entryToMarkdown(full))
		return full
	}

	async get(id: string): Promise<KnowledgeEntry | null> {
		// Try all types to find by ID
		for (const type of ["goal", "decision", "lesson", "file-relationship"] as KnowledgeEntryType[]) {
			const content = await this.brain.readFile(makeSlug(type, id))
			if (content) {
				return markdownToEntry(makeSlug(type, id), content)
			}
		}
		return null
	}

	async query(options: KnowledgeQueryOptions = {}): Promise<KnowledgeEntry[]> {
		const { type, keyword, relatedFile, limit = 20 } = options
		const slugs = await this.brain.listFiles()
		const kgSlugs = slugs.filter((s) => s.startsWith(SLUG_PREFIX))

		const entries: KnowledgeEntry[] = []
		for (const slug of kgSlugs) {
			const content = await this.brain.readFile(slug)
			if (!content) continue
			const entry = markdownToEntry(slug, content)
			if (!entry) continue

			if (type && entry.type !== type) continue
			if (keyword) {
				const lower = `${entry.title} ${entry.body} ${entry.tags.join(" ")}`.toLowerCase()
				const words = keyword.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
				const match = words.length === 0
					? lower.includes(keyword.toLowerCase())
					: words.some((w) => lower.includes(w))
				if (!match) continue
			}
			if (relatedFile) {
				const norm = relatedFile.replace(/\\/g, "/")
				if (!entry.relatedFiles.some((f) => f.replace(/\\/g, "/").includes(norm))) continue
			}

			entries.push(entry)
			if (entries.length >= limit) break
		}

		return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
	}

	async remove(id: string): Promise<boolean> {
		for (const type of ["goal", "decision", "lesson", "file-relationship"] as KnowledgeEntryType[]) {
			const deleted = await this.brain.deleteFile(makeSlug(type, id))
			if (deleted) return true
		}
		return false
	}

	/** Build a prompt-ready context string from recent relevant knowledge entries. */
	async getContext(forPrompt?: string): Promise<string> {
		const goals = await this.query({ type: "goal", limit: 5 })
		const decisions = await this.query({ type: "decision", limit: 5 })

		let relevant: KnowledgeEntry[] = []
		if (forPrompt) {
			const lessons = await this.query({ type: "lesson", keyword: forPrompt, limit: 3 })
			relevant = lessons
		}

		const sections: string[] = []
		if (goals.length > 0) {
			sections.push(
				`## Project Goals\n${goals.map((g) => `- **${g.title}**: ${g.body.slice(0, 200)}`).join("\n")}`,
			)
		}
		if (decisions.length > 0) {
			sections.push(
				`## Key Decisions\n${decisions.map((d) => `- **${d.title}**: ${d.body.slice(0, 200)}`).join("\n")}`,
			)
		}
		if (relevant.length > 0) {
			sections.push(
				`## Relevant Lessons\n${relevant.map((l) => `- **${l.title}**: ${l.body.slice(0, 200)}`).join("\n")}`,
			)
		}

		return sections.join("\n\n")
	}
}
