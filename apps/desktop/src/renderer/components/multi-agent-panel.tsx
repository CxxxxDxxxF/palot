/**
 * Multi-agent progress panel for the sidebar.
 *
 * Appears when the currently selected session has spawned sub-agents (i.e.
 * it is a Lead Agent orchestration run). Shows each sub-agent's name, status,
 * and live token/cost data drawn from the existing sessionMetricsFamily atom.
 *
 * Hidden when the session has no direct child sessions.
 */
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
} from "@palot/ui/components/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@palot/ui/components/tooltip"
import { cn } from "@palot/ui/lib/utils"
import { useNavigate, useParams } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import {
	AlertCircleIcon,
	CheckCircle2Icon,
	CircleDotIcon,
	Loader2Icon,
	TimerIcon,
	ZapIcon,
} from "lucide-react"
import { memo } from "react"
import type { SubAgentEntry } from "../atoms/sub-agents"
import { childSessionsFamily } from "../atoms/sub-agents"
import { sessionMetricsFamily } from "../atoms/derived/session-metrics"
import { sessionFamily } from "../atoms/sessions"
import {
	getAgentStatusBadgeClass,
	getAgentStatusLabel,
	getBudgetDisplay,
} from "../lib/agent-progress-display"
import { supervisionEventsForWorkflowFamily } from "../atoms/supervision-events"
import type { AgentStatus } from "../lib/types"
import { formatCost, formatTokens } from "../lib/session-metrics"
import { DEFAULT_SUPERVISION_POLICY, evaluateSupervisionPolicy } from "../lib/supervision-policy"

// ============================================================
// Status display helpers
// ============================================================

function statusIcon(status: AgentStatus): typeof Loader2Icon {
	switch (status) {
		case "running":
			return Loader2Icon
		case "waiting":
			return TimerIcon
		case "failed":
			return AlertCircleIcon
		case "completed":
		case "idle":
		case "paused":
			return CheckCircle2Icon
		default:
			return CircleDotIcon
	}
}

function statusColor(status: AgentStatus): string {
	switch (status) {
		case "running":
			return "text-emerald-400"
		case "waiting":
			return "text-amber-400"
		case "failed":
			return "text-red-400"
		default:
			return "text-muted-foreground/50"
	}
}

function statusAnimate(status: AgentStatus): string {
	if (status === "running") return "animate-spin"
	if (status === "waiting") return "animate-pulse"
	return ""
}

// ============================================================
// MultiAgentPanel
// ============================================================

interface MultiAgentPanelProps {
	parentSessionId: string
}

/**
 * Sidebar panel showing live sub-agent status for a Lead Agent session.
 * Only renders when there are child sessions.
 */
export const MultiAgentPanel = memo(function MultiAgentPanel({
	parentSessionId,
}: MultiAgentPanelProps) {
	const children = useAtomValue(childSessionsFamily(parentSessionId))
	const parentEntry = useAtomValue(sessionFamily(parentSessionId))
	const parentMetrics = useAtomValue(sessionMetricsFamily(parentSessionId))
	const recentEvents = useAtomValue(supervisionEventsForWorkflowFamily(parentSessionId))

	if (children.length === 0 && parentMetrics.tokensRaw === 0) return null

	const parentStatus: AgentStatus =
		(parentEntry?.permissions.length ?? 0) > 0 || (parentEntry?.questions.length ?? 0) > 0
			? "waiting"
			: parentEntry?.status.type === "busy" || parentEntry?.status.type === "retry"
				? "running"
				: parentMetrics.errorCount > 0
					? "failed"
					: parentMetrics.assistantMessageCount > 0
						? "completed"
						: "idle"

	const lead: SubAgentEntry = {
		sessionId: parentSessionId,
		name: "Lead-Agent",
		agentStatus: parentStatus,
		activity:
			parentStatus === "running"
				? "Coordinating the hive"
				: parentStatus === "waiting"
					? "Waiting for user input"
					: parentStatus === "completed"
						? "Ready for the next instruction"
						: parentStatus === "failed"
							? "Stopped with an error"
							: "Idle",
		model: parentMetrics.modelDistributionDisplay[0]?.name ?? null,
		duration: parentMetrics.workTime,
		costRaw: parentMetrics.costRaw,
		cost: parentMetrics.cost,
		tokensRaw: parentMetrics.tokensRaw,
		tokens: parentMetrics.tokens,
	}

	const entries = [lead, ...children]
	const totalCost = entries.reduce((sum, c) => sum + c.costRaw, 0)
	const totalTokens = entries.reduce((sum, c) => sum + c.tokensRaw, 0)
	const totalCostFormatted = formatCost(totalCost)
	const totalTokensFormatted = formatTokens(totalTokens)
	const anyRunning = entries.some((c) => c.agentStatus === "running")
	const budget = getBudgetDisplay(totalCost)
	const policy = evaluateSupervisionPolicy({
		workflowId: parentSessionId,
		parentAgentId: parentSessionId,
		totalCost,
		totalTokens,
		childAgentCount: children.length,
		runningAgentCount: children.filter((c) => c.agentStatus === "running").length,
		failedAgentCount: children.filter((c) => c.agentStatus === "failed").length,
		waitingAgentCount: children.filter((c) => c.agentStatus === "waiting").length,
		configuredBudget: DEFAULT_SUPERVISION_POLICY.configuredBudget,
		maxChildren: DEFAULT_SUPERVISION_POLICY.maxChildren,
		maxConcurrentAgents: DEFAULT_SUPERVISION_POLICY.maxConcurrentAgents,
		currentAgentState:
			parentStatus === "running"
				? "running"
				: parentStatus === "waiting"
					? "waiting"
					: parentStatus === "failed"
						? "failed"
						: parentStatus === "completed"
							? "completed"
							: "idle",
	})
	const supervisorClass =
		policy.severity === "critical"
			? "border-red-400/30 bg-red-400/10 text-red-200"
			: policy.severity === "warning"
				? "border-amber-400/30 bg-amber-400/10 text-amber-200"
				: "border-border/30 bg-muted/15 text-muted-foreground"

	return (
		<SidebarGroup>
			<SidebarGroupLabel className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
				<span
					className={cn(
						"size-2 rounded-full",
						anyRunning
							? "animate-pulse bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]"
							: "bg-muted-foreground/30",
					)}
					aria-hidden="true"
				/>
				Hive Mind
				<ZapIcon className="size-3 text-muted-foreground/40" aria-hidden="true" />
			</SidebarGroupLabel>
			<SidebarGroupContent>
				<div className="space-y-1 px-2 pb-1">
					{entries.map((entry) => (
						<SubAgentRow
							key={entry.sessionId}
							entry={entry}
							totalTokens={totalTokens}
						/>
					))}
					{policy.decision !== "allow" && (
						<div className={cn("rounded-md border px-2.5 py-2 text-[10px]", supervisorClass)}>
							<div className="flex items-center justify-between gap-2">
								<span className="font-semibold uppercase tracking-wide">
									{policy.decision.toUpperCase()}
								</span>
								<span className="tabular-nums">{policy.machineCode.replace("SUPERVISION_", "")}</span>
							</div>
							<p className="mt-1 leading-snug">{policy.operatorMessage}</p>
							<p className="mt-1 leading-snug opacity-80">{policy.recommendedAction}</p>
						</div>
					)}
					{recentEvents.length > 0 && (
						<div className="rounded-md border border-border/30 bg-muted/15 px-2.5 py-2 text-[10px]">
							<div className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
								Recent enforcement
							</div>
							<div className="space-y-1.5">
								{recentEvents.map((event) => (
									<div key={event.id} className="leading-snug">
										<div className="flex items-center justify-between gap-2">
											<span
												className={cn(
													"font-semibold uppercase",
													event.severity === "critical"
														? "text-red-300"
														: "text-amber-300",
												)}
											>
												{event.decision}
											</span>
											<span className="truncate text-muted-foreground/60">
												{event.machineCode.replace("SUPERVISION_", "")}
											</span>
										</div>
										<p className="text-muted-foreground/80">{event.operatorMessage}</p>
										<p className="text-muted-foreground/55">{event.recommendedAction}</p>
									</div>
								))}
							</div>
						</div>
					)}
					<div className="mt-2 rounded-md border border-border/30 bg-muted/15 px-2.5 py-2">
						<div className="flex items-center justify-between gap-2">
							<span className="text-[11px] text-muted-foreground">Session spend</span>
							<span className="text-sm font-semibold tabular-nums text-foreground">
								{totalCostFormatted}
							</span>
						</div>
						<div className="mt-1.5 flex items-center justify-between gap-2 text-[10px]">
							<span className="tabular-nums text-muted-foreground/60">
								{totalTokensFormatted} tokens
							</span>
							<span
								className={cn(
									"rounded-full border px-1.5 py-0.5 font-medium",
									budget.badgeClassName,
								)}
							>
								{budget.label}
							</span>
						</div>
					</div>
				</div>
			</SidebarGroupContent>
		</SidebarGroup>
	)
})

// ============================================================
// Per-sub-agent row
// ============================================================

function SubAgentRow({ entry, totalTokens }: { entry: SubAgentEntry; totalTokens: number }) {
	const navigate = useNavigate()
	const { projectSlug } = useParams({ strict: false }) as { projectSlug?: string }

	const Icon = statusIcon(entry.agentStatus)
	const iconColor = statusColor(entry.agentStatus)
	const iconAnim = statusAnimate(entry.agentStatus)
	const progress =
		totalTokens > 0 ? Math.max(4, Math.min(100, (entry.tokensRaw / totalTokens) * 100)) : 0

	const handleClick = () => {
		if (!projectSlug) return
		navigate({
			to: "/project/$projectSlug/session/$sessionId",
			params: { projectSlug, sessionId: entry.sessionId },
		})
	}

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<button
						type="button"
						onClick={handleClick}
						className="group/agent w-full rounded-md border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border/40 hover:bg-muted/45"
					/>
				}
			>
				<div className="space-y-1">
					<div className="flex items-center gap-2">
						<Icon
							className={`size-3 shrink-0 ${iconColor} ${iconAnim}`}
							aria-hidden="true"
						/>
						<span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/85">
							{entry.name}
						</span>
						<span
							className={cn(
								"rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-none tracking-wide",
								getAgentStatusBadgeClass(entry.agentStatus),
							)}
						>
							{entry.agentStatus === "running" && (
								<span className="mr-1 inline-block size-1.5 rounded-full bg-current align-0 animate-pulse" />
							)}
							{getAgentStatusLabel(entry.agentStatus)}
						</span>
					</div>
					<div className="truncate pl-5 text-[11px] leading-tight text-muted-foreground/65">
						{entry.activity ?? "Waiting for work"}
					</div>
					<div className="flex items-center gap-1.5 pl-5 tabular-nums text-[10px] text-muted-foreground/45">
						<span>{entry.tokensRaw > 0 ? entry.tokens : "0 tok"}</span>
						<span>·</span>
						<span>{entry.costRaw > 0 ? entry.cost : "$0.00"}</span>
						{entry.model && (
							<>
								<span>·</span>
								<span className="min-w-0 truncate">{entry.model}</span>
							</>
						)}
					</div>
					<div className="ml-5 h-1 overflow-hidden rounded-full bg-muted/50">
						<div
							className={cn(
								"h-full rounded-full transition-all duration-500",
								entry.agentStatus === "failed"
									? "bg-red-400/70"
									: entry.agentStatus === "waiting"
										? "bg-amber-400/70"
										: "bg-emerald-400/70",
							)}
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>
			</TooltipTrigger>
			<TooltipContent side="right">
				<p className="font-medium">{entry.name}</p>
				{entry.activity && <p className="text-muted-foreground">{entry.activity}</p>}
				{entry.tokensRaw > 0 && (
					<p className="text-muted-foreground">
						{entry.tokens} tokens · {entry.cost}
					</p>
				)}
			</TooltipContent>
		</Tooltip>
	)
}
