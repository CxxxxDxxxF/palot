/**
 * BrainPage — browse and read .palot/brain/ files (README, tasks, issues, decisions, etc.).
 *
 * Each brain file is a markdown document that provides project context to agents.
 * The page lists all files, shows content on click, and includes a search bar.
 */

import { cn } from "@palot/ui/lib/utils"
import { useNavigate } from "@tanstack/react-router"
import {
	ArrowLeftIcon,
	BrainIcon,
	FileTextIcon,
	Loader2Icon,
	SearchIcon,
	XIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { listBrainFiles, readBrainFile, searchBrainFiles } from "../services/backend"

interface BrainFile {
	slug: string
	title: string
}

interface SearchResult {
	slug: string
	excerpt: string
	matchCount: number
}

const TITLE_OVERRIDES: Record<string, string> = {
	readme: "README",
	"run-history": "Run History",
	"coding-conventions": "Coding Conventions",
	"file-ownership": "File Ownership",
}

function deriveTitle(slug: string): string {
	return TITLE_OVERRIDES[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " ")
}

export function BrainPage() {
	const navigate = useNavigate()
	const [files, setFiles] = useState<BrainFile[]>([])
	const [loading, setLoading] = useState(true)
	const [selected, setSelected] = useState<string | null>(null)
	const [content, setContent] = useState<string | null>(null)
	const [contentLoading, setContentLoading] = useState(false)
	const [searchQuery, setSearchQuery] = useState("")
	const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		setLoading(true)
		setError(null)
		listBrainFiles()
			.then((slugs) => {
				if (!cancelled) setFiles(slugs.map((s) => ({ slug: s, title: deriveTitle(s) })))
			})
			.catch((err) => {
				if (cancelled) return
				setFiles([])
				setError(err instanceof Error ? err.message : "Failed to load brain files.")
			})
			.finally(() => { if (!cancelled) setLoading(false) })
		return () => { cancelled = true }
	}, [])

	const handleSelect = useCallback(async (slug: string) => {
		if (selected === slug) {
			setSelected(null)
			setContent(null)
			return
		}
		setSelected(slug)
		setContentLoading(true)
		setError(null)
		try {
			const text = await readBrainFile(slug)
			setContent(text)
		} catch (err) {
			setContent("(failed to load)")
			setError(err instanceof Error ? err.message : `Failed to load ${slug}.`)
		} finally {
			setContentLoading(false)
		}
	}, [selected])

	const handleSearch = useCallback(async () => {
		if (!searchQuery.trim()) {
			setSearchResults(null)
			return
		}
		try {
			const results = await searchBrainFiles(searchQuery)
			setSearchResults(results)
			setError(null)
		} catch (err) {
			setSearchResults([])
			setError(err instanceof Error ? err.message : "Failed to search brain files.")
		}
	}, [searchQuery])

	// Debounced search
	useEffect(() => {
		if (!searchQuery.trim()) {
			setSearchResults(null)
			return
		}
		const timer = setTimeout(() => {
			handleSearch()
		}, 300)
		return () => clearTimeout(timer)
	}, [searchQuery, handleSearch])

	const handleBack = useCallback(() => {
		navigate({ to: "/" })
	}, [navigate])

	// Build file list, optionally filtered by search
	const displayFiles = useMemo(() => {
		if (searchResults) {
			const resultSlugs = new Set(searchResults.map((r) => r.slug))
			return files.filter((f) => resultSlugs.has(f.slug))
		}
		return files
	}, [files, searchResults])

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
				<div className="min-w-0 flex-1">
					<h1 className="text-sm font-semibold text-foreground">Brain</h1>
					<p className="text-[11px] text-muted-foreground/60">
						Project context files (.palot/brain/)
					</p>
				</div>
			</div>

			{/* Search bar */}
			<div className="border-b border-border/30 px-5 py-2.5">
				<div className="relative">
					<SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/40" aria-hidden="true" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search brain files..."
						className="w-full rounded-md border border-input bg-transparent py-1.5 pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
					/>
					{searchQuery && (
						<button
							type="button"
							onClick={() => setSearchQuery("")}
							className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
						>
							<XIcon className="size-3.5" />
						</button>
					)}
				</div>
			</div>

			{/* List + detail */}
			<div className="min-h-0 flex-1 overflow-y-auto">
				{error ? (
					<div className="mx-5 mt-4 rounded-md border border-destructive/25 bg-destructive/10 p-3 text-xs text-destructive">
						{error}
					</div>
				) : loading ? (
					<div className="flex items-center justify-center py-10">
						<Loader2Icon className="size-4 animate-spin text-muted-foreground/50" />
					</div>
				) : displayFiles.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
						<BrainIcon className="size-8 text-muted-foreground/30" aria-hidden="true" />
						<p className="text-xs text-muted-foreground/60">
							{searchResults ? "No matches found" : "No brain files found"}
						</p>
						<p className="text-[10px] text-muted-foreground/40">
							{searchResults
								? "Try a different search query"
								: "Brain files are auto-generated in .palot/brain/"}
						</p>
					</div>
				) : (
					<div className="divide-y divide-border/30">
						{/* Search results count */}
						{searchResults && searchResults.length > 0 && (
							<div className="px-5 py-2 text-[10px] text-muted-foreground/50">
								{searchResults.length} file{searchResults.length !== 1 ? "s" : ""} match
								{searchResults.length !== 1 ? "" : "es"}
								{searchResults.some((r) => r.matchCount > 0) && (
									<>
										{" · "}
										{searchResults.reduce((sum, r) => sum + r.matchCount, 0)} total matches
									</>
								)}
							</div>
						)}

						{displayFiles.map((file) => {
							const isSelected = selected === file.slug
							const searchMatch = searchResults?.find((r) => r.slug === file.slug)
							return (
								<button
									key={file.slug}
									type="button"
									onClick={() => handleSelect(file.slug)}
									className={cn(
										"w-full text-left transition-colors hover:bg-muted/20",
										isSelected && "bg-muted/15",
									)}
								>
									<div className="px-5 py-3">
										<div className="flex items-center gap-2">
											<FileTextIcon className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
											<span className="text-sm font-medium text-foreground/85">{file.title}</span>
											<span className="text-[10px] text-muted-foreground/40">.md</span>
											{searchMatch && (
												<span className="ml-auto text-[10px] text-muted-foreground/50">
													{searchMatch.matchCount} match{searchMatch.matchCount !== 1 ? "es" : ""}
												</span>
											)}
										</div>

										{/* Search excerpt */}
										{searchMatch && !isSelected && (
											<p className="mt-1 text-[11px] text-muted-foreground/60 line-clamp-2">
												{searchMatch.excerpt}
											</p>
										)}
									</div>

									{/* Expanded content */}
									{isSelected && (
										<div className="border-t border-border/20 bg-muted/10 px-5 py-3">
											{contentLoading ? (
												<div className="flex items-center justify-center py-6">
													<Loader2Icon className="size-3.5 animate-spin text-muted-foreground/50" />
												</div>
											) : content !== null ? (
												<div className="rounded-md border border-border/20 bg-muted/20 p-3">
													<pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground/80">
														{content}
													</pre>
												</div>
											) : (
												<p className="text-xs text-muted-foreground/60">(empty)</p>
											)}
											{content && (
												<p className="mt-2 text-[10px] text-muted-foreground/40">
													{content.length.toLocaleString()} chars
												</p>
											)}
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
