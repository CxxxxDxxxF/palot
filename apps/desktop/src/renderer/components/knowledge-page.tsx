/**
 * KnowledgePage — browse and read agent knowledge sources (.agents/knowledge/*.md).
 *
 * Shows all available knowledge documents (Obsidian API, Mem9 API, etc.)
 * with their titles, descriptions, tags, and full content in a detail view.
 */

import { cn } from "@palot/ui/lib/utils"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeftIcon, BookOpenIcon, Loader2Icon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import type { KnowledgeSource } from "../../shared/knowledge"
import { listKnowledgeSources } from "../services/backend"

export function KnowledgePage() {
	const navigate = useNavigate()
	const [sources, setSources] = useState<KnowledgeSource[]>([])
	const [loading, setLoading] = useState(true)
	const [selected, setSelected] = useState<KnowledgeSource | null>(null)

	useEffect(() => {
		let cancelled = false
		setLoading(true)
		listKnowledgeSources()
			.then((list) => {
				if (!cancelled) setSources(list.sort((a, b) => a.title.localeCompare(b.title)))
			})
			.catch(() => {
				if (!cancelled) setSources([])
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})
		return () => {
			cancelled = true
		}
	}, [])

	const handleSelect = useCallback((source: KnowledgeSource) => {
		setSelected((prev) => (prev?.filename === source.filename ? null : source))
	}, [])

	const handleBack = useCallback(() => {
		navigate({ to: "/" })
	}, [navigate])

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex items-center gap-3 border-b border-border px-5 py-3">
				<button
					type="button"
					onClick={handleBack}
					className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Back"
				>
					<ArrowLeftIcon className="size-4" />
				</button>
				<div>
					<h1 className="text-sm font-semibold text-foreground">Knowledge</h1>
					<p className="text-[11px] text-muted-foreground/60">
						Reference docs injected into agent prompts at spawn time
					</p>
				</div>
			</div>

			{/* List or detail view */}
			<div className="min-h-0 flex-1 overflow-y-auto">
				{loading ? (
					<div className="flex items-center justify-center py-10">
						<Loader2Icon className="size-4 animate-spin text-muted-foreground/50" />
					</div>
				) : sources.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
						<BookOpenIcon className="size-8 text-muted-foreground/30" aria-hidden="true" />
						<p className="text-xs text-muted-foreground/60">No knowledge sources found</p>
						<p className="text-[10px] text-muted-foreground/40">
							Add .md files with frontmatter to .agents/knowledge/
						</p>
					</div>
				) : (
					<div className="divide-y divide-border/30">
						{sources.map((source) => {
							const isSelected = selected?.filename === source.filename
							return (
								<button
									key={source.filename}
									type="button"
									onClick={() => handleSelect(source)}
									className={cn(
										"w-full text-left transition-colors hover:bg-muted/20",
										isSelected && "bg-muted/15",
									)}
								>
									<div className="px-5 py-3">
										<div className="flex items-center gap-2">
											<BookOpenIcon className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
											<span className="text-sm font-medium text-foreground/85">{source.title}</span>
										</div>
										{source.description && (
											<p className="mt-1 text-xs text-muted-foreground/70 line-clamp-2">
												{source.description}
											</p>
										)}
										<div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/50">
											<span className="rounded-full border border-border/30 px-1.5 py-0.5">{source.source}</span>
											{source.tags && source.tags.split(",").map((tag) => (
												<span key={tag.trim()} className="rounded-full border border-border/20 px-1.5 py-0.5 bg-muted/10">
													{tag.trim()}
												</span>
											))}
											<span className="ml-auto">{source.updated}</span>
										</div>
									</div>

									{/* Expanded detail */}
									{isSelected && (
										<div className="border-t border-border/20 bg-muted/10 px-5 py-3">
											<p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50">
												Content
											</p>
											<div className="max-h-96 overflow-y-auto rounded-md border border-border/20 bg-muted/20 p-3">
												<pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/80">
													{source.prompt}
												</pre>
											</div>
											<p className="mt-2 text-[10px] text-muted-foreground/40">
												{source.prompt.length.toLocaleString()} chars — injected into agent prompts when selected at spawn time
											</p>
										</div>
									)}
								</button>
							)
						})}
					</div>
				)}
			</div>
		</div>
	)
}
