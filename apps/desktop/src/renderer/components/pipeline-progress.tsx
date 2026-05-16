/**
 * Pipeline visualization — shows the Lead → Architect → Builder → Reviewer → Done
 * flow for the Hive Mind. Reads child session statuses from existing atoms
 * and renders a horizontal pipeline with stage cards connected by arrows.
 */

import { cn } from "@palot/ui/lib/utils"
import {
	AlertCircleIcon,
	CheckCircle2Icon,
	ChevronRightIcon,
	CircleDotIcon,
	Loader2Icon,
} from "lucide-react"
import { formatCost, formatTokens } from "../lib/session-metrics"
import type { SubAgentEntry } from "../atoms/sub-agents"

// ============================================================
// Pipeline stage definition
// ============================================================

interface StageInfo {
	key: string
	label: string
	icon: typeof Loader2Icon
	status: "pending" | "running" | "completed" | "failed" | "skipped"
	cost: number
	tokens: number
	duration: string
	agents: SubAgentEntry[]
}

/** Aggregate multiple sub-agent entries into a single stage status. */
function mergeStageStatus(agents: SubAgentEntry[]): StageInfo["status"] {
	if (agents.length === 0) return "skipped"
	const anyRunning = agents.some((a) => a.agentStatus === "running")
	const anyFailed = agents.some((a) => a.agentStatus === "failed")
	const allDone = agents.every(
		(a) => a.agentStatus === "completed" || a.agentStatus === "idle" || a.agentStatus === "paused",
	)
	if (anyRunning) return "running"
	if (anyFailed) return "failed"
	if (allDone) return "completed"
	return "pending"
}

// ============================================================
// Stage card
// ============================================================

const STAGE_ICONS: Record<StageInfo["status"], typeof Loader2Icon> = {
	pending: CircleDotIcon,
	running: Loader2Icon,
	completed: CheckCircle2Icon,
	failed: AlertCircleIcon,
	skipped: CircleDotIcon,
}

const STAGE_COLORS: Record<StageInfo["status"], string> = {
	pending: "text-muted-foreground/40 border-muted-foreground/20",
	running: "text-emerald-400 border-emerald-400/30 bg-emerald-400/5",
	completed: "text-emerald-500 border-emerald-500/20 bg-emerald-500/5",
	failed: "text-red-400 border-red-400/30 bg-red-400/10",
	skipped: "text-muted-foreground/30 border-muted-foreground/10",
}

const STAGE_BG: Record<StageInfo["status"], string> = {
	pending: "",
	running: "",
	completed: "",
	failed: "",
	skipped: "",
}

function StageCard({ stage }: { stage: StageInfo }) {
	const Icon = STAGE_ICONS[stage.status]
	const colorClass = STAGE_COLORS[stage.status]
	const SpinIcon = stage.status === "running" ? Loader2Icon : Icon
	const isRunning = stage.status === "running"
	const costFormatted = stage.cost > 0 ? formatCost(stage.cost) : null
	const tokensFormatted = stage.tokens > 0 ? formatTokens(stage.tokens) : null

	return (
		<div
			className={cn(
				"flex min-w-0 shrink-0 flex-col items-center gap-1.5 rounded-lg border px-3 py-2 transition-colors",
				colorClass,
				STAGE_BG[stage.status],
			)}
		>
			<div className="flex items-center gap-1.5">
				{isRunning ? (
					<SpinIcon className="size-3 animate-spin" aria-hidden="true" />
				) : (
					<Icon className="size-3" aria-hidden="true" />
				)}
				<span
					className={cn(
						"text-xs font-semibold",
						stage.status === "skipped" && "text-muted-foreground/40",
					)}
				>
					{stage.label}
				</span>
				{stage.agents.length > 1 && (
					<span className="text-[10px] text-muted-foreground/50">×{stage.agents.length}</span>
				)}
			</div>

			{(costFormatted || tokensFormatted) && (
				<div className="flex items-center gap-1.5 tabular-nums text-[10px] text-muted-foreground/60">
					{costFormatted && <span>{costFormatted}</span>}
					{tokensFormatted && (
						<>
							{costFormatted && <span className="text-muted-foreground/30">·</span>}
							<span>{tokensFormatted}</span>
						</>
					)}
				</div>
			)}

			{stage.agents.length > 1 && stage.status === "running" && (
				<div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
					{stage.agents.filter((a) => a.agentStatus === "running").length} active
				</div>
			)}

			{stage.status === "failed" && stage.agents[0]?.errorMessage && (
				<div className="max-w-[120px] truncate text-[9px] text-red-400/80" title={stage.agents[0].errorMessage}>
					{stage.agents[0].errorMessage}
				</div>
			)}
		</div>
	)
}

// ============================================================
// Arrow between stages
// ============================================================

function StageArrow() {
	return (
		<div className="flex shrink-0 items-center text-muted-foreground/25">
			<ChevronRightIcon className="size-4" aria-hidden="true" />
		</div>
	)
}

// ============================================================
// PipelineProgress
// ============================================================

export interface PipelineProgressProps {
	children: SubAgentEntry[]
	parentStatus?: StageInfo["status"]
	parentCost?: number
	parentTokens?: number
}

/**
 * Renders a horizontal pipeline: Lead → Architect → Builder(s) → Reviewer(s) → Done.
 *
 * Stage membership is determined by each child's name (via getAgentDisplayName).
 * - Sessions named "Lead*" are never children, but the parent session is shown.
 * - Sessions matching "architect" → Architect stage
 * - Sessions matching "builder" → Builder stage
 * - Sessions matching "reviewer" → Reviewer stage
 * - Unknown names → grouped into Builder stage (likely spawned builders)
 *
 * When no children exist, returns null (hidden).
 */
export function PipelineProgress({
	children,
	parentStatus = "pending",
	parentCost = 0,
	parentTokens = 0,
}: PipelineProgressProps) {
	if (children.length === 0) return null

	// Classify children into pipeline stages by name
	const architectAgents = children.filter((c) => c.name.toLowerCase().includes("architect"))
	const builderAgents = children.filter(
		(c) => c.name.toLowerCase().includes("builder") && !c.name.toLowerCase().includes("reviewer"),
	)
	const reviewerAgents = children.filter((c) => c.name.toLowerCase().includes("reviewer"))

	// Any child that doesn't match known stages goes to Builder (likely spawned builder sessions)
	const otherAgents = children.filter((c) => {
		const name = c.name.toLowerCase()
		return !name.includes("architect") && !name.includes("builder") && !name.includes("reviewer")
	})
	const allBuilderAgents = [...builderAgents, ...otherAgents]

	const workStages: StageInfo[] = [
		{
			key: "lead",
			label: "Lead",
			icon: CircleDotIcon,
			status: parentStatus,
			cost: parentCost,
			tokens: parentTokens,
			duration: "",
			agents: [],
		},
		{
			key: "architect",
			label: "Architect",
			icon: CircleDotIcon,
			status: mergeStageStatus(architectAgents),
			cost: architectAgents.reduce((s, a) => s + a.costRaw, 0),
			tokens: architectAgents.reduce((s, a) => s + a.tokensRaw, 0),
			duration: "",
			agents: architectAgents,
		},
		{
			key: "builder",
			label: "Builder",
			icon: CircleDotIcon,
			status: mergeStageStatus(allBuilderAgents),
			cost: allBuilderAgents.reduce((s, a) => s + a.costRaw, 0),
			tokens: allBuilderAgents.reduce((s, a) => s + a.tokensRaw, 0),
			duration: "",
			agents: allBuilderAgents,
		},
		{
			key: "reviewer",
			label: "Reviewer",
			icon: CircleDotIcon,
			status: mergeStageStatus(reviewerAgents),
			cost: reviewerAgents.reduce((s, a) => s + a.costRaw, 0),
			tokens: reviewerAgents.reduce((s, a) => s + a.tokensRaw, 0),
			duration: "",
			agents: reviewerAgents,
		},
	]

	// Compute "Done" status based on all prior stages
	const hasAnyWork = workStages.slice(1).some((s) => s.status !== "skipped")
	const allWorkDone = workStages.every((s) => s.status === "completed" || s.status === "skipped")

	const stages: StageInfo[] = [
		...workStages,
		{
			key: "done",
			label: "Done",
			icon: CheckCircle2Icon,
			status: !hasAnyWork ? "skipped" : allWorkDone ? "completed" : "pending",
			cost: 0,
			tokens: 0,
			duration: "",
			agents: [],
		},
	]

	return (
		<div className="rounded-md border border-border/30 bg-muted/10 px-3 py-2.5">
			<div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
				Pipeline
			</div>
			<div className="flex items-center gap-1 overflow-x-auto">
				{stages.map((stage, i) => (
					<div key={stage.key} className="flex items-center gap-1">
						{i > 0 && <StageArrow />}
						<StageCard stage={stage} />
					</div>
				))}
			</div>
		</div>
	)
}
