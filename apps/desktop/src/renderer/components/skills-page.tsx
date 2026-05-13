import { Button } from "@palot/ui/components/button"
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@palot/ui/components/dialog"
import { Input } from "@palot/ui/components/input"
import { Label } from "@palot/ui/components/label"
import {
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
} from "@palot/ui/components/sidebar"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon, GraduationCapIcon, Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import type { Skill } from "../../preload/api"
import { deleteSkill, listSkills, writeSkill } from "../services/backend"
import { useSetSidebarSlot } from "./sidebar-slot-context"

// ============================================================
// Helpers
// ============================================================

function buildRaw(name: string, description: string, tags: string[], author: string, content: string): string {
	const tagList = tags.map((t) => `"${t}"`).join(", ")
	const today = new Date().toISOString().slice(0, 10)
	return `---\nname: ${name}\ndescription: ${description}\ntags: [${tagList}]\nauthor: ${author}\ncreated: ${today}\n---\n\n${content}`
}

function filenameFromName(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

// ============================================================
// Skill modal (create / edit)
// ============================================================

interface SkillModalProps {
	open: boolean
	initial: Skill | null
	onClose: () => void
	onSaved: () => void
}

function SkillModal({ open, initial, onClose, onSaved }: SkillModalProps) {
	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [tagsRaw, setTagsRaw] = useState("")
	const [author, setAuthor] = useState("CJ")
	const [content, setContent] = useState("")
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (open) {
			setName(initial?.name ?? "")
			setDescription(initial?.description ?? "")
			setTagsRaw(initial?.tags.join(", ") ?? "")
			setAuthor(initial?.author ?? "CJ")
			setContent(initial?.content ?? "")
			setError(null)
		}
	}, [open, initial])

	const handleSave = useCallback(async () => {
		const trimmedName = name.trim()
		if (!trimmedName) { setError("Name is required."); return }
		setSaving(true)
		setError(null)
		try {
			const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean)
			const raw = buildRaw(trimmedName, description.trim(), tags, author.trim(), content)
			const filename = initial?.filename ?? filenameFromName(trimmedName)
			await writeSkill(filename, raw)
			onSaved()
			onClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save skill.")
		} finally {
			setSaving(false)
		}
	}, [name, description, tagsRaw, author, content, initial, onSaved, onClose])

	return (
		<Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
			<DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-0 p-0">
				<DialogHeader className="border-b border-border px-6 py-4">
					<DialogTitle>{initial ? "Edit Skill" : "New Skill"}</DialogTitle>
				</DialogHeader>

				<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="skill-name">Name</Label>
							<Input
								id="skill-name"
								placeholder="React Patterns"
								value={name}
								autoFocus
								onChange={(e) => { setName(e.target.value); setError(null) }}
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="skill-author">Author</Label>
							<Input
								id="skill-author"
								placeholder="CJ"
								value={author}
								onChange={(e) => setAuthor(e.target.value)}
							/>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="skill-description">Description</Label>
						<Input
							id="skill-description"
							placeholder="What this skill does and when to use it"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="skill-tags">Tags</Label>
						<Input
							id="skill-tags"
							placeholder="react, typescript, hooks"
							value={tagsRaw}
							onChange={(e) => setTagsRaw(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">Comma-separated. Used by the Lead Agent to match skills to tasks.</p>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="skill-content">Content (Markdown)</Label>
						<textarea
							id="skill-content"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							placeholder="# Skill content here&#10;Instructions, patterns, and examples the agent should follow."
							className="min-h-64 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>

					{error && (
						<p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{error}
						</p>
					)}
				</div>

				<DialogFooter className="border-t border-border px-6 py-4">
					<Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
					<Button onClick={handleSave} disabled={!name.trim() || saving}>
						{saving && <Loader2Icon className="size-3.5 animate-spin" />}
						Save Skill
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

// ============================================================
// Skill card
// ============================================================

interface SkillCardProps {
	skill: Skill
	onEdit: (skill: Skill) => void
	onDelete: (skill: Skill) => void
}

function SkillCard({ skill, onEdit, onDelete }: SkillCardProps) {
	const [confirming, setConfirming] = useState(false)

	return (
		<div className="group relative rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80 hover:bg-card/80">
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0 flex-1">
					<h3
						className="cursor-pointer text-sm font-medium text-foreground hover:text-foreground/80"
						onClick={() => onEdit(skill)}
					>
						{skill.name}
					</h3>
					{skill.description && (
						<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{skill.description}</p>
					)}
					{skill.tags.length > 0 && (
						<div className="mt-2 flex flex-wrap gap-1">
							{skill.tags.map((tag) => (
								<span
									key={tag}
									className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
								>
									{tag}
								</span>
							))}
						</div>
					)}
				</div>

				<div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
					<Button
						variant="ghost"
						size="icon"
						className="size-7"
						onClick={() => onEdit(skill)}
					>
						<span className="sr-only">Edit</span>
						<svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
					</Button>
					{confirming ? (
						<>
							<Button
								variant="destructive"
								size="icon"
								className="size-7"
								onClick={() => { setConfirming(false); onDelete(skill) }}
							>
								<Trash2Icon className="size-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								className="size-7"
								onClick={() => setConfirming(false)}
							>
								<span className="text-xs">✕</span>
							</Button>
						</>
					) : (
						<Button
							variant="ghost"
							size="icon"
							className="size-7 text-muted-foreground hover:text-destructive"
							onClick={() => setConfirming(true)}
						>
							<Trash2Icon className="size-3.5" />
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}

// ============================================================
// Skills sidebar content (injected via slot)
// ============================================================

function SkillsSidebarContent() {
	const navigate = useNavigate()
	return (
		<SidebarContent>
			<SidebarGroup>
				<SidebarGroupContent>
					<div className="px-2 py-1">
						<button
							type="button"
							onClick={() => navigate({ to: "/" })}
							className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							<ArrowLeftIcon aria-hidden="true" className="size-4" />
							Back to app
						</button>
					</div>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarContent>
	)
}

// ============================================================
// SkillsPage
// ============================================================

export function SkillsPage() {
	const { setContent, setFooter } = useSetSidebarSlot()

	useEffect(() => {
		setContent(<SkillsSidebarContent />)
		setFooter(false)
		return () => {
			setContent(null)
			setFooter(null)
		}
	}, [setContent, setFooter])

	const [skills, setSkills] = useState<Skill[]>([])
	const [loading, setLoading] = useState(true)
	const [modalOpen, setModalOpen] = useState(false)
	const [editingSkill, setEditingSkill] = useState<Skill | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const result = await listSkills()
			setSkills(result)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => { load() }, [load])

	const handleEdit = useCallback((skill: Skill) => {
		setEditingSkill(skill)
		setModalOpen(true)
	}, [])

	const handleNew = useCallback(() => {
		setEditingSkill(null)
		setModalOpen(true)
	}, [])

	const handleDelete = useCallback(async (skill: Skill) => {
		try {
			await deleteSkill(skill.filename)
			await load()
		} catch {
			// silently ignore
		}
	}, [load])

	return (
		<div className="h-full overflow-y-auto">
			<div className="mx-auto max-w-2xl px-8 py-6">
				<div className="mb-6 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<GraduationCapIcon className="size-5 text-muted-foreground" />
						<div>
							<h1 className="text-lg font-semibold text-foreground">Skills</h1>
							<p className="text-sm text-muted-foreground">
								Markdown files the Lead Agent reads before executing tasks.
							</p>
						</div>
					</div>
					<Button size="sm" onClick={handleNew}>
						<PlusIcon className="size-3.5" />
						New Skill
					</Button>
				</div>

				{loading ? (
					<div className="flex items-center justify-center py-16">
						<Loader2Icon className="size-5 animate-spin text-muted-foreground" />
					</div>
				) : skills.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
						<GraduationCapIcon className="size-8 text-muted-foreground/50" />
						<div>
							<p className="text-sm font-medium text-foreground">No skills yet</p>
							<p className="mt-0.5 text-xs text-muted-foreground">
								Create your first skill to give agents reusable context.
							</p>
						</div>
						<Button size="sm" variant="outline" onClick={handleNew}>
							<PlusIcon className="size-3.5" />
							New Skill
						</Button>
					</div>
				) : (
					<div className="space-y-3">
						{skills.map((skill) => (
							<SkillCard
								key={skill.filename}
								skill={skill}
								onEdit={handleEdit}
								onDelete={handleDelete}
							/>
						))}
					</div>
				)}
			</div>

			<SkillModal
				open={modalOpen}
				initial={editingSkill}
				onClose={() => setModalOpen(false)}
				onSaved={load}
			/>
		</div>
	)
}
