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
import { useNavigate, useParams } from "@tanstack/react-router"
import { useAtomValue } from "jotai"
import {
	AlertCircleIcon,
	CheckCircle2Icon,
	CircleDotIcon,
	CoinsIcon,
	Loader2Icon,
	TimerIcon,
	ZapIcon,
} from "lucide-react"
import { memo } from "react"
import type { SubAgentEntry } from "../atoms/sub-agents"
import { childSessionsFamily } from "../atoms/sub-agents"
import type { AgentStatus } from "../lib/types"

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
			return "text-green-500"
		case "waiting":
			return "text-amber-400"
		case "failed":
			return "text-red-500"
		default:
			return "text-muted-foreground/40"
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

	if (children.length === 0) return null

	const totalCost = children.reduce((sum, c) => sum + c.costRaw, 0)
	const totalCostFormatted = totalCost < 0.005 ? "$0.00" : `$${totalCost.toFixed(2)}`
	const anyRunning = children.some((c) => c.agentStatus === "running")

	return (
		<SidebarGroup>
			<SidebarGroupLabel className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
				<ZapIcon
					className={`size-3 ${anyRunning ? "text-violet-400 animate-pulse" : "text-muted-foreground/50"}`}
					aria-hidden="true"
				/>
				Hive Mind
				<span className="ml-auto text-[10px] tabular-nums text-muted-foreground/50 font-normal normal-case tracking-normal">
					{totalCostFormatted}
				</span>
			</SidebarGroupLabel>
			<SidebarGroupContent>
				<div className="space-y-0.5 px-2 pb-1">
					{children.map((child) => (
						<SubAgentRow key={child.sessionId} entry={child} />
					))}
				</div>
			</SidebarGroupContent>
		</SidebarGroup>
	)
})

// ============================================================
// Per-sub-agent row
// ============================================================

function SubAgentRow({ entry }: { entry: SubAgentEntry }) {
	const navigate = useNavigate()
	const { projectSlug } = useParams({ strict: false }) as { projectSlug?: string }

	const Icon = statusIcon(entry.agentStatus)
	const iconColor = statusColor(entry.agentStatus)
	const iconAnim = statusAnimate(entry.agentStatus)

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
						className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60"
					/>
				}
			>
				<Icon
					className={`size-3 shrink-0 ${iconColor} ${iconAnim}`}
					aria-hidden="true"
				/>
				<span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.name}</span>
				{entry.tokensRaw > 0 && (
					<div className="flex shrink-0 items-center gap-1.5 tabular-nums text-[10px] text-muted-foreground/50">
						<span>{entry.tokens}</span>
						{entry.costRaw > 0 && (
							<>
								<CoinsIcon className="size-2.5" aria-hidden="true" />
								<span>{entry.cost}</span>
							</>
						)}
					</div>
				)}
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
