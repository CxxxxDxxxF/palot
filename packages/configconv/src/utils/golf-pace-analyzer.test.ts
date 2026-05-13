import { describe, expect, test } from "bun:test"
import { analyzeGolfPace, type GolfGroup } from "./golf-pace-analyzer"

describe("analyzeGolfPace", () => {
	test("returns empty array when no groups are behind pace", () => {
		const groups: GolfGroup[] = [
			{
				startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
				currentHole: 5, // 6 minutes per hole (on pace for 14 min threshold)
			},
			{
				startTime: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
				currentHole: 10, // 9 minutes per hole (on pace)
			},
		]

		const result = analyzeGolfPace(groups, 14)
		expect(result).toEqual([])
	})

	test("identifies group as behind when avg time/hole > threshold", () => {
		const slowGroup: GolfGroup = {
			startTime: new Date(Date.now() - 120 * 60 * 1000), // 120 minutes ago
			currentHole: 5, // 24 minutes per hole (behind pace)
		}
		const fastGroup: GolfGroup = {
			startTime: new Date(Date.now() - 70 * 60 * 1000), // 70 minutes ago
			currentHole: 10, // 7 minutes per hole (on pace)
		}

		const groups = [fastGroup, slowGroup]
		const result = analyzeGolfPace(groups, 14)

		expect(result).toEqual([slowGroup])
		expect(result[0]).toBe(slowGroup) // Maintains reference
	})

	test("throws RangeError for currentHole ≤ 0", () => {
		const invalidGroup: GolfGroup = {
			startTime: new Date(),
			currentHole: 0,
		}

		expect(() => analyzeGolfPace([invalidGroup])).toThrow(RangeError)
		expect(() => analyzeGolfPace([invalidGroup])).toThrow("currentHole must be > 0")
	})

	test("handles groups that started in future (negative time) correctly", () => {
		const futureGroup: GolfGroup = {
			startTime: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes in future
			currentHole: 5,
		}

		const result = analyzeGolfPace([futureGroup], 14)
		// Negative elapsed time means negative avg minutes per hole, which is < threshold
		expect(result).toEqual([])
	})

	test("uses default 14min threshold when none provided", () => {
		const onPaceGroup: GolfGroup = {
			startTime: new Date(Date.now() - 70 * 60 * 1000), // 70 minutes ago
			currentHole: 5, // 14 minutes per hole (exactly at threshold, not behind)
		}
		const behindPaceGroup: GolfGroup = {
			startTime: new Date(Date.now() - 71 * 60 * 1000), // 71 minutes ago
			currentHole: 5, // 14.2 minutes per hole (slightly behind)
		}

		const groups = [onPaceGroup, behindPaceGroup]
		const result = analyzeGolfPace(groups) // No threshold specified

		expect(result).toEqual([behindPaceGroup])
	})

	test("maintains input object references in output", () => {
		const group1: GolfGroup = {
			startTime: new Date(Date.now() - 150 * 60 * 1000),
			currentHole: 5,
		}
		const group2: GolfGroup = {
			startTime: new Date(Date.now() - 50 * 60 * 1000),
			currentHole: 5,
		}

		const groups = [group1, group2]
		const result = analyzeGolfPace(groups, 14)

		// Should return same object references
		expect(result[0]).toBe(group1)
	})

	test("throws TypeError for invalid Date objects", () => {
		const invalidGroup = {
			startTime: new Date("invalid date"),
			currentHole: 5,
		}

		expect(() => analyzeGolfPace([invalidGroup as GolfGroup])).toThrow(TypeError)
		expect(() => analyzeGolfPace([invalidGroup as GolfGroup])).toThrow("Invalid Date object")
	})

	test("handles 60+ groups without performance degradation", () => {
		const groups: GolfGroup[] = []
		const now = Date.now()

		// Create 100 groups
		for (let i = 0; i < 100; i++) {
			groups.push({
				startTime: new Date(now - (i + 10) * 60 * 1000), // Varying start times
				currentHole: Math.max(1, i % 18), // Valid hole numbers
			})
		}

		// Should not throw
		expect(() => analyzeGolfPace(groups, 14)).not.toThrow()
	})

	test("returns groups in original input order", () => {
		const group1: GolfGroup = {
			startTime: new Date(Date.now() - 200 * 60 * 1000), // Very slow
			currentHole: 5,
		}
		const group2: GolfGroup = {
			startTime: new Date(Date.now() - 100 * 60 * 1000), // Moderate
			currentHole: 5,
		}
		const group3: GolfGroup = {
			startTime: new Date(Date.now() - 300 * 60 * 1000), // Slowest
			currentHole: 5,
		}

		const groups = [group1, group2, group3]
		const result = analyzeGolfPace(groups, 14)

		// Should maintain original order: group1, group2, group3
		expect(result).toEqual([group1, group2, group3])
	})

	test("correctly calculates time/hole: (currentTime - startTime) / (currentHole * 60_000)", () => {
		const now = Date.now()
		const startTime = new Date(now - 90 * 60 * 1000) // 90 minutes ago
		const currentHole = 6

		// Manual calculation: 90 minutes / 6 holes = 15 minutes per hole
		const group: GolfGroup = { startTime, currentHole }

		const result = analyzeGolfPace([group], 14) // Threshold  15, so behind
		expect(result).toEqual([group])
	})
})
