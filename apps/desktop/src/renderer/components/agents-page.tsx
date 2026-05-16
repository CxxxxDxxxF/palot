/**
 * Agents Dashboard page.
 *
 * Lists agent definitions from .opencode/agents/*.md, with the ability
 * to view raw content, create new agents, and delete existing ones.
 *
 * Route: /agents
 */

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
	BotIcon,
	Loader2Icon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import type { ManagedAgent } from "../../shared/agents"
import { buildAgentRaw, filenameFromAgentName } from "../../shared/agents"
import { deleteAgent, listAgents, writeAgent } from "../services/backend"

// ============================================================
// Mode badge colors
// ============================================================

const MODE_BADGES: Record<string, string> = {
	primary: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25",
	subagent: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25",
	all: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25",
}

function ModeBadge({ mode }: { mode: string }) {
	return (
		<span
			className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
				MODE_BADGES[mode] ?? "bg-muted text-muted-foreground"
			}`}
		>
			{mode}
		</span>
	)
}

// ============================================================
// Color dot
// ============================================================

const COLOR_MAP: Record<string, string> = {
	accent: "bg-foreground",
	info: "bg-sky-500",
	warning: "bg-amber-500",
	danger: "bg-red-500",
	success: "bg-emerald-500",
}

function ColorDot({ color }: { color: string }) {
	if (!color) return null
	return (
		<span
			className={`inline-block size-2 rounded-full ${COLOR_MAP[color] ?? "bg-muted-foreground/30"}`}
			title={`Color: ${color}`}
		/>
	)
}

// ============================================================
// Create agent dialog
// ============================================================

interface CreateDialogProps {
	open: boolean
	onClose: () => void
	onSaved: () => void
}

function CreateAgentDialog({ open, onClose, onSaved }: CreateDialogProps) {
	const [name, setName] = useState("")
	const [description, setDescription] = useState("")
	const [model, setModel] = useState("")
	const [mode, setMode] = useState<"primary" | "subagent" | "all">("subagent")
	const [color, setColor] = useState("")
	const [prompt, setPrompt] = useState("")
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		if (!open) return
		setName("")
		setDescription("")
		setModel("")
		setMode("subagent")
		setColor("")
		setPrompt("")
		setSaving(false)
		setError(null)
	}, [open])

	const handleSave = useCallback(async () => {
		if (!name.trim()) {
			setError("Agent name is required.")
			return
		}
		setSaving(true)
		setError(null)
		try {
			const raw = buildAgentRaw({ description, model, mode, color, prompt })
			const filename = filenameFromAgentName(name)
			await writeAgent(filename, raw)
			onSaved()
			onClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save agent.")
		} finally {
			setSaving(false)
		}
	}, [name, description, model, mode, color, prompt, onSaved, onClose])

	return (
		<Dialog open={open} onOpenChange={(value) => { if (!value) onClose() }}>
			<DialogContent className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 p-0">
				<DialogHeader className="border-b border-border px-6 py-4">
					<DialogTitle>Create Agent</DialogTitle>
				</DialogHeader>

				<div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
					{error && (
						<div className="rounded-md border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
							{error}
						</div>
					)}

					<div className="space-y-1.5">
						<Label htmlFor="agent-name">Name</Label>
						<Input
							id="agent-name"
							value={name}
							placeholder="My Custom Agent"
							onChange={(e) => setName(e.target.value)}
							disabled={saving}
							autoFocus
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="agent-description">Description</Label>
						<Input
							id="agent-description"
							value={description}
							placeholder="What this agent does..."
							onChange={(e) => setDescription(e.target.value)}
							disabled={saving}
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="agent-model">Model</Label>
						<Input
							id="agent-model"
							value={model}
							placeholder="openrouter/deepseek/deepseek-chat"
							onChange={(e) => setModel(e.target.value)}
							disabled={saving}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="agent-mode">Mode</Label>
							<select
								id="agent-mode"
								value={mode}
								onChange={(e) => setMode(e.target.value as "primary" | "subagent" | "all")}
								className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
								disabled={saving}
							>
								<option value="primary">Primary</option>
								<option value="subagent">Subagent</option>
								<option value="all">All</option>
							</select>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="agent-color">Color</Label>
							<select
								id="agent-color"
								value={color}
								onChange={(e) => setColor(e.target.value)}
								className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
								disabled={saving}
							>
								<option value="">None</option>
								<option value="accent">Accent</option>
								<option value="info">Info</option>
								<option value="warning">Warning</option>
								<option value="danger">Danger</option>
								<option value="success">Success</option>
							</select>
						</div>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="agent-prompt">System Prompt</Label>
						<textarea
							id="agent-prompt"
							value={prompt}
							placeholder="You are an agent that..."
							onChange={(e) => setPrompt(e.target.value)}
							className="min-h-48 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
							disabled={saving}
						/>
					</div>
				</div>

				<DialogFooter className="border-t border-border px-6 py-4">
					<Button variant="outline" onClick={onClose} disabled={saving}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={saving}>
						{saving && <Loader2Icon className="mr-1 size-3.5 animate-spin" />}
						Save Agent
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

// ============================================================
// AgentDetailPanel
// ============================================================

interface AgentDetailPanelProps {
	agent: ManagedAgent
	onDelete: () => void
}

function AgentDetailPanel({ agent, onDelete }: AgentDetailPanelProps) {
	const [confirmDelete, setConfirmDelete] = useState(false)

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-border px-6 py-4">
				<div className="flex items-center gap-3">
					<ColorDot color={agent.color} />
					<div>
						<h2 className="text-lg font-semibold">{agent.name}</h2>
						<p className="text-sm text-muted-foreground">{agent.description || "No description"}</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<ModeBadge mode={agent.mode} />
				</div>
			</div>

			{/* Metadata */}
			<div className="grid grid-cols-2 gap-4 border-b border-border px-6 py-3 text-sm">
				<div>
					<span className="text-muted-foreground">Filename:</span>{" "}
					<code className="rounded bg-muted px-1 py-0.5 text-xs">{agent.filename}.md</code>
				</div>
				{agent.model && (
					<div>
						<span className="text-muted-foreground">Model:</span>{" "}
						<code className="rounded bg-muted px-1 py-0.5 text-xs">{agent.model}</code>
					</div>
				)}
				<div>
					<span className="text-muted-foreground">Origin:</span> {agent.origin}
				</div>
				{agent.color && (
					<div>
						<span className="text-muted-foreground">Color:</span> {agent.color}
					</div>
				)}
			</div>

			{/* Prompt body */}
			<div className="flex-1 overflow-y-auto px-6 py-4">
				<h3 className="mb-2 text-sm font-medium text-muted-foreground">System Prompt</h3>
				<pre className="min-h-[200px] whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed text-foreground">
					{agent.prompt || "(empty)"}
				</pre>

				<h3 className="mb-2 mt-6 text-sm font-medium text-muted-foreground">Raw Source</h3>
				<pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 font-mono text-xs leading-relaxed text-muted-foreground">
					{agent.raw}
				</pre>
			</div>

			{/* Footer actions */}
			<div className="flex items-center justify-between border-t border-border px-6 py-3">
				<div />
				<div className="flex items-center gap-2">
					{confirmDelete ? (
						<div className="flex items-center gap-2">
							<span className="text-xs text-destructive">Delete {agent.filename}.md?</span>
							<Button size="sm" variant="destructive" onClick={onDelete}>
								Confirm
							</Button>
							<Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>
								Cancel
							</Button>
						</div>
					) : (
						<Button
							size="sm"
							variant="ghost"
							className="text-destructive hover:text-destructive"
							onClick={() => setConfirmDelete(true)}
						>
							<Trash2Icon className="mr-1 size-3.5" />
							Delete
						</Button>
					)}
				</div>
			</div>
		</div>
	)
}

// ============================================================
// AgentsPage
// ============================================================

export function AgentsPage() {
	const [agents, setAgents] = useState<ManagedAgent[]>([])
	const [selected, setSelected] = useState<ManagedAgent | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [createOpen, setCreateOpen] = useState(false)

	const loadAgents = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const list = await listAgents()
			setAgents(list)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load agents.")
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		loadAgents()
	}, [loadAgents])

	const handleDelete = useCallback(
		async (agent: ManagedAgent) => {
			try {
				await deleteAgent(agent.filename)
				setSelected(null)
				await loadAgents()
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to delete agent.")
			}
		},
		[loadAgents],
	)

	return (
		<div className="flex h-full">
			{/* Agent list sidebar */}
			<div className="flex w-64 shrink-0 flex-col border-r border-border">
				<div className="flex items-center justify-between border-b border-border px-4 py-3">
					<h1 className="text-sm font-semibold">Agent Definitions</h1>
					<Button size="sm" variant="ghost" onClick={() => setCreateOpen(true)}>
						<PlusIcon className="size-3.5" />
					</Button>
				</div>

				<div className="flex-1 overflow-y-auto">
					{loading && (
						<div className="flex items-center justify-center py-8">
							<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
						</div>
					)}

					{error && (
						<div className="mx-4 mt-4 rounded-md border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
							{error}
						</div>
					)}

					{!loading && agents.length === 0 && !error && (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<BotIcon className="mb-2 size-8 text-muted-foreground/40" aria-hidden="true" />
							<p className="text-sm text-muted-foreground">No agents yet</p>
							<p className="mt-1 text-xs text-muted-foreground/60">
								Create one to get started
							</p>
							<Button size="sm" variant="outline" className="mt-4" onClick={() => setCreateOpen(true)}>
								<PlusIcon className="mr-1 size-3.5" />
								Create Agent
							</Button>
						</div>
					)}

					{agents.map((agent) => (
						<button
							key={agent.filename}
							type="button"
							onClick={() => setSelected(agent)}
							className={`w-full border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
								selected?.filename === agent.filename ? "bg-muted" : ""
							}`}
						>
							<div className="flex items-center gap-2">
								<ColorDot color={agent.color} />
								<span className="text-sm font-medium truncate">{agent.name}</span>
							</div>
							<p className="mt-0.5 truncate text-xs text-muted-foreground">
								{agent.description || "No description"}
							</p>
							<div className="mt-1.5 flex items-center gap-2">
								<ModeBadge mode={agent.mode} />
								{agent.model && (
									<span className="truncate text-[10px] text-muted-foreground/60">
										{agent.model}
									</span>
								)}
							</div>
						</button>
					))}
				</div>
			</div>

			{/* Detail panel or empty state */}
			<div className="flex-1 overflow-hidden">
				{selected ? (
					<AgentDetailPanel agent={selected} onDelete={() => handleDelete(selected)} />
				) : (
					<div className="flex h-full items-center justify-center">
						<div className="text-center">
							<BotIcon className="mx-auto mb-3 size-10 text-muted-foreground/30" aria-hidden="true" />
							<p className="text-sm text-muted-foreground">Select an agent to view details</p>
						</div>
					</div>
				)}
			</div>

			{/* Create dialog */}
			<CreateAgentDialog
				open={createOpen}
				onClose={() => setCreateOpen(false)}
				onSaved={() => {
					loadAgents()
				}}
			/>
		</div>
	)
}
