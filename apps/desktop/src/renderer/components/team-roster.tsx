/**
 * Team Roster — shows available agent definitions from .opencode/agents/
 * as spawnable chips in the Hive Mind panel.
 *
 * Clicking an agent opens a spawn dialog showing the system prompt,
 * model, and a custom instruction field.
 */

import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@palot/ui/components/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@palot/ui/components/tooltip"
import { cn } from "@palot/ui/lib/utils"
import { AlertCircleIcon, BookOpenIcon, Loader2Icon, PlayIcon, UserIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { ManagedAgent } from "../../shared/agents"
import type { KnowledgeSource } from "../../shared/knowledge"
import { listAgents, listKnowledgeSources } from "../services/backend"

// ============================================================
// Color mapping
// ============================================================

const COLOR_DOT: Record<string, string> = {
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
			className={cn("inline-block size-1.5 rounded-full shrink-0", COLOR_DOT[color] ?? "bg-muted-foreground/30")}
			aria-hidden="true"
		/>
	)
}

/** Parse "providerID/modelID" from a model string like "openrouter/deepseek/deepseek-chat". */
function parseModelString(model: string): { providerID: string; modelID: string } | null {
	const parts = model.split("/")
	if (parts.length < 2) return null
	// providerID is the first part, modelID is everything after
	return { providerID: parts[0], modelID: parts.slice(1).join("/") }
}

// ============================================================
// Spawn detail dialog
// ============================================================

interface SpawnDialogProps {
	agent: ManagedAgent
	open: boolean
	onClose: () => void
	/** Project root directory — used to resolve knowledge sources. */
	directory: string
	onSpawn: (
		agentName: string,
		customInstruction: string,
		knowledgeFilenames?: string[],
	) => Promise<void>
}

function SpawnDialog({ agent, open, onClose, onSpawn, directory }: SpawnDialogProps) {
	const [customInstruction, setCustomInstruction] = useState("")
	const [spawning, setSpawning] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([])
	const [selectedKnowledge, setSelectedKnowledge] = useState<string[]>([])

	useEffect(() => {
		if (!open) return
		setCustomInstruction("")
		setSpawning(false)
		setError(null)
		setSelectedKnowledge([])
		// Load knowledge sources from the project directory
		listKnowledgeSources(directory)
			.then((sources) => {
				// Filter: only show knowledge relevant to this agent type or all agents
				const agentSlug = agent.name.toLowerCase()
				const relevant = sources.filter(
					(s) => !s.agents || s.agents === "" || s.agents.split(",").some((a) => agentSlug.includes(a.trim())),
				)
				setKnowledgeSources(relevant)
			})
			.catch(() => setKnowledgeSources([]))
	}, [open, agent.name, directory])

	const toggleKnowledge = useCallback((filename: string) => {
		setSelectedKnowledge((prev) =>
			prev.includes(filename) ? prev.filter((f) => f !== filename) : [...prev, filename],
		)
	}, [])

	const handleSpawn = useCallback(async () => {
		setSpawning(true)
		setError(null)
		try {
			await onSpawn(agent.name, customInstruction, selectedKnowledge.length > 0 ? selectedKnowledge : undefined)
			onClose()
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to spawn agent.")
		} finally {
			setSpawning(false)
		}
	}, [agent.name, customInstruction, selectedKnowledge, onSpawn, onClose])

	const modelRef = useMemo(() => (agent.model ? parseModelString(agent.model) : null), [agent.model])

	return (
		<Dialog open={open} onOpenChange={(value) => { if (!value) onClose() }}>
			<DialogContent className="flex max-h-[80vh] w-full max-w-xl flex-col gap-0 p-0">
				<DialogHeader className="border-b border-border px-5 py-3">
					<div className="flex items-center gap-2.5">
						<ColorDot color={agent.color} />
						<div>
							<DialogTitle className="text-sm">{agent.name}</DialogTitle>
							{agent.description && (
								<p className="text-xs text-muted-foreground">{agent.description}</p>
							)}
						</div>
					</div>
				</DialogHeader>

				<div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
					{error && (
						<div className="flex items-start gap-2 rounded-md border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-400">
							<AlertCircleIcon className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
							<span>{error}</span>
						</div>
					)}
					{/* Model info */}
					{modelRef && (
						<div className="rounded-md border border-border/30 bg-muted/15 px-3 py-2">
							<p className="text-[10px] font-medium text-muted-foreground/60">Model</p>
							<p className="mt-0.5 text-xs font-mono">{agent.model}</p>
						</div>
					)}

					{/* Mode + origin */}
					<div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
						<span className="rounded-full border border-border/30 px-1.5 py-0.5">{agent.mode}</span>
						<span>{agent.origin}</span>
					</div>

					{/* System prompt (read-only) */}
					<div>
						<p className="mb-1 text-[10px] font-medium text-muted-foreground/60">System Prompt</p>
						<div className="max-h-48 overflow-y-auto rounded-md border border-border/30 bg-muted/20 p-3">
							<pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/80">
								{agent.prompt || "(empty)"}
							</pre>
						</div>
					</div>

					{/* Custom instruction */}
					<div>
						<p className="mb-1 text-[10px] font-medium text-muted-foreground/60">
							Custom Instruction <span className="text-muted-foreground/40">(optional)</span>
						</p>
						<textarea
							value={customInstruction}
							onChange={(e) => setCustomInstruction(e.target.value)}
							placeholder="e.g. Focus on the database schema first"
							className="min-h-16 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
							disabled={spawning}
						/>
					</div>

					{/* Knowledge sources */}
					{knowledgeSources.length > 0 && (
						<div>
							<p className="mb-1 text-[10px] font-medium text-muted-foreground/60">
								<BookOpenIcon className="mr-1 inline size-2.5" aria-hidden="true" />
								Knowledge <span className="text-muted-foreground/40">(attach reference docs)</span>
							</p>
							<div className="space-y-1">
								{knowledgeSources.map((ks) => {
									const isSelected = selectedKnowledge.includes(ks.filename)
									return (
										<label
											key={ks.filename}
											className={cn(
												"flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 transition-colors",
												isSelected
													? "border-sky-400/30 bg-sky-400/10"
													: "border-border/20 hover:border-border/40",
											)}
										>
											<input
												type="checkbox"
												checked={isSelected}
												onChange={() => toggleKnowledge(ks.filename)}
												className="mt-0.5 size-3 rounded border-border accent-sky-500"
												disabled={spawning}
											/>
											<div className="min-w-0 flex-1">
												<p className="text-xs font-medium text-foreground/85">{ks.title}</p>
												{ks.description && (
													<p className="mt-0.5 truncate text-[10px] text-muted-foreground/60">{ks.description}</p>
												)}
												<p className="mt-0.5 text-[9px] text-muted-foreground/40">{ks.source}</p>
											</div>
										</label>
									)
								})}
							</div>
						</div>
					)}
				</div>

				<DialogFooter className="border-t border-border px-5 py-3">
					<button
						type="button"
						onClick={onClose}
						disabled={spawning}
						className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSpawn}
						disabled={spawning}
						className={cn(
							"flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
							spawning
								? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
								: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20",
						)}
					>
						{spawning ? (
							<Loader2Icon className="size-3 animate-spin" />
						) : (
							<PlayIcon className="size-3" />
						)}
						{spawning ? "Spawning..." : `Spawn ${agent.name}`}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

// ============================================================
// TeamRoster
// ============================================================

export interface TeamRosterProps {
	/** The parent (Lead) session directory — used to send spawn prompts. */
	directory: string
	/** The parent (Lead) session ID — used to send spawn prompts. */
	sessionId: string
	/** Called when a spawn is confirmed. Receives agent details + custom instruction. */
	onSpawn: (
		directory: string,
		sessionId: string,
		agentName: string,
		agentDescription: string,
		agentModel: string,
		agentPrompt: string,
		customInstruction: string,
		knowledgeFilenames?: string[],
	) => Promise<void>
	/** Whether the lead session is ready to accept commands. */
	disabled?: boolean
}

export function TeamRoster({ directory, sessionId, onSpawn, disabled }: TeamRosterProps) {
	const [agents, setAgents] = useState<ManagedAgent[]>([])
	const [loading, setLoading] = useState(true)
	const [selectedAgent, setSelectedAgent] = useState<ManagedAgent | null>(null)
	const [dialogOpen, setDialogOpen] = useState(false)

	useEffect(() => {
		let cancelled = false
		setLoading(true)
		listAgents(directory || undefined)
			.then((list) => {
				if (cancelled) return
				// Filter out the lead agent — it's the orchestrator, not a team member
				const team = list.filter(
					(a) => !a.name.toLowerCase().includes("lead") && a.filename !== "lead-agent",
				)
				setAgents(team)
			})
			.catch(() => {
				if (cancelled) return
				setAgents([])
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [])

	const handleOpenDialog = useCallback((agent: ManagedAgent) => {
		setSelectedAgent(agent)
		setDialogOpen(true)
	}, [])

	const handleCloseDialog = useCallback(() => {
		setDialogOpen(false)
		setSelectedAgent(null)
	}, [])

	const handleSpawnFromDialog = useCallback(
		async (agentName: string, customInstruction: string, knowledgeFilenames?: string[]) => {
			const agent = selectedAgent
			if (!agent) return
			await onSpawn(
				directory,
				sessionId,
				agentName,
				agent.description,
				agent.model,
				agent.prompt,
				customInstruction,
				knowledgeFilenames,
			)
		},
		[directory, sessionId, selectedAgent, onSpawn],
	)

	if (loading) {
		return (
			<div className="flex items-center justify-center py-3">
				<Loader2Icon className="size-3 animate-spin text-muted-foreground/50" />
			</div>
		)
	}

	if (agents.length === 0) return null

	return (
		<>
			<div className="rounded-md border border-border/30 bg-muted/10 px-2.5 py-2">
				<div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
					<UserIcon className="size-3" aria-hidden="true" />
					Team
				</div>
				<div className="space-y-1">
					{agents.map((agent) => (
						<Tooltip key={agent.filename}>
							<TooltipTrigger
								render={
									<div
										className={cn(
											"flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors",
											"hover:border-border/40 hover:bg-muted/45",
											disabled && "opacity-50",
										)}
									/>
								}
							>
								<div className="flex w-full items-center gap-2">
									<ColorDot color={agent.color} />
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-1.5">
											<span className="text-xs font-medium text-foreground/85">{agent.name}</span>
											<span className="rounded-full border border-border/30 px-1 py-0.5 text-[9px] font-medium text-muted-foreground/60">
												{agent.mode}
											</span>
										</div>
										{agent.model && (
											<p className="truncate text-[10px] text-muted-foreground/50">{agent.model}</p>
										)}
									</div>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation()
											handleOpenDialog(agent)
										}}
										disabled={disabled}
										className="flex shrink-0 items-center gap-1 rounded-md border border-border/30 px-2 py-1 text-[10px] font-medium text-muted-foreground/70 transition-colors hover:border-emerald-400/30 hover:bg-emerald-400/10 hover:text-emerald-300"
									>
										<PlayIcon className="size-2.5" />
										Spawn
									</button>
								</div>
							</TooltipTrigger>
							<TooltipContent side="right" className="max-w-64">
								<p className="mb-1 text-xs font-medium">{agent.name}</p>
								<p className="mb-1 text-[11px] leading-tight text-muted-foreground">
									{agent.description || "No description"}
								</p>
								{agent.model && (
									<p className="mb-1 text-[10px] text-muted-foreground/60">Model: {agent.model}</p>
								)}
							</TooltipContent>
						</Tooltip>
					))}
				</div>
			</div>

			{selectedAgent && (
				<SpawnDialog
					agent={selectedAgent}
					open={dialogOpen}
					onClose={handleCloseDialog}
					onSpawn={handleSpawnFromDialog}
					directory={directory}
				/>
			)}
		</>
	)
}
