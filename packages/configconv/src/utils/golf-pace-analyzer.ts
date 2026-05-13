/**
 * Golf pace analyzer utility.
 *
 * Analyzes golf groups to determine which are behind pace based on average time per hole.
 */

/**
 * Representation of a golf group with start time and current hole.
 */
export interface GolfGroup {
	startTime: Date
	currentHole: number
}

/**
 * Pace status for a golf group.
 */
export type PaceStatus = "on-pace" | "behind"

/**
 * Analyzes golf groups to determine which are behind pace.
 *
 * @param groups - Array of golf groups to analyze
 * @param thresholdMinutes - Threshold in minutes per hole (default: 14)
 * @returns Array of groups that are behind pace, in original input order
 * @throws {RangeError} When currentHole ≤ 0
 * @throws {TypeError} When invalid Date objects are provided
 */
export function analyzeGolfPace(groups: GolfGroup[], thresholdMinutes: number = 14): GolfGroup[] {
	// Validate threshold is positive
	if (thresholdMinutes <= 0) {
		throw new RangeError("thresholdMinutes must be positive")
	}

	const now = new Date()
	const behindPaceGroups: GolfGroup[] = []

	for (const group of groups) {
		// Validate currentHole
		if (group.currentHole <= 0) {
			throw new RangeError(`currentHole must be > 0, got ${group.currentHole}`)
		}

		// Validate Date objects
		if (!(group.startTime instanceof Date) || Number.isNaN(group.startTime.getTime())) {
			throw new TypeError("Invalid Date object in startTime")
		}

		// Calculate elapsed time in milliseconds
		const elapsedMs = now.getTime() - group.startTime.getTime()

		// Calculate average minutes per hole
		// elapsedMs / (currentHole * 60,000 ms per minute)
		const avgMinutesPerHole = elapsedMs / (group.currentHole * 60_000)

		// Check if behind pace
		if (avgMinutesPerHole > thresholdMinutes) {
			behindPaceGroups.push(group)
		}
	}

	return behindPaceGroups
}
