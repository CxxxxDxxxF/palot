/**
 * Per-session last activity timestamps recorded from SSE event arrival.
 */
import { atom } from "jotai"
import { atomFamily } from "jotai-family"

export const sessionLastActivityFamily = atomFamily((_sessionId: string) => atom<number>(0))

export const recordSessionActivityAtom = atom(
	null,
	(_get, set, args: { sessionId: string; timestamp?: number }) => {
		set(sessionLastActivityFamily(args.sessionId), args.timestamp ?? Date.now())
	},
)
