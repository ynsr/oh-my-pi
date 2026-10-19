import { register } from "../config/registry";
import type { Settings } from "../config/settings";

export const cfgFeaturesUnexpectedStopMaxRetries = register({
	id: "features.unexpectedStopMaxRetries",
	type: "number",
	default: 20,
	ui: {
		tab: "interaction",
		group: "Agent",
		label: "Unexpected Stop Retries",
		description: "Maximum consecutive retry injections when the assistant stops unexpectedly. 0 disables recovery.",
	},
});

export const cfgFeaturesTurnRecoveryMaxRetries = register({
	id: "features.turnRecoveryMaxRetries",
	type: "number",
	default: 20,
	ui: {
		tab: "interaction",
		group: "Agent",
		label: "Turn Recovery Retries",
		description:
			"Shared retry cap for empty-stop, malformed-function-call, and stream-stall recovery injections. 0 disables them.",
	},
});

/**
 * Fork overlay for turn-recovery tuning (`dev` branch).
 *
 * Everything here lives in one fork-owned file so the diff against
 * `upstream/main` stays a single import line plus one-line call sites.
 * Upstream owns `turn-recovery.ts`; this module owns the fork's deviations:
 *
 * - configurable retry caps (`features.unexpectedStopMaxRetries`,
 *   `features.turnRecoveryMaxRetries`), replacing upstream's hardcoded 3s;
 * - a 60s judge verdict budget (upstream: 15s) for gateway-routed judges;
 * - truncated-suffix detection: a text stop ending in `:` / `...` / `…`
 *   ended mid-thought and skips the mechanical/smart gates straight to the
 *   nudge.
 */

/** Judge verdict budget. Upstream default is 15s; the fork allows 60s. */
export const FORK_UNEXPECTED_STOP_TIMEOUT_MS = 60_000;

/**
 * A text turn ending here stopped mid-thought rather than finished: a trailing
 * colon introduces content that never arrived, and a trailing ellipsis trails
 * off into content that never arrived. Either is truncation, not completion.
 */
export function forkHasTruncatedSuffix(value: string): boolean {
	const trimmed = value.trimEnd();
	return trimmed.endsWith(":") || trimmed.endsWith("...") || trimmed.endsWith("…");
}

/** Configured unexpected-stop retry cap (default 20; 0 disables recovery). */
export function forkUnexpectedStopMaxRetries(settings: Settings): number {
	return Math.max(0, cfgFeaturesUnexpectedStopMaxRetries.get(settings));
}

/** Shared cap for empty-stop, malformed-call, and stream-stall recovery (default 20). */
export function forkTurnRecoveryMaxRetries(settings: Settings): number {
	return Math.max(0, cfgFeaturesTurnRecoveryMaxRetries.get(settings));
}
