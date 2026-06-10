# Refresh Loop Strategy

## Background

`vscode-topo` currently runs a refresh loop to keep internal state and user-facing UI information up to date.

Every 3 seconds the extension runs:

- `topo health --target <target>`
- `docker --host <target> ps -a --format {{json .}}`
- `docker --host <target> inspect <all containers from above> --format {{json .}}`

The current behaviour has these important properties:

- The Docker commands run in series because `inspect` depends on the container list from `ps`.
- Docker commands only run when `topo health` reports healthy connectivity to the target.
- Refresh executions do not overlap; there is always at least 3 seconds between executions.
- Users cannot disable the refresh loop.
- Users cannot easily tell when refresh work is happening without inspecting device, network, or process activity.

This keeps the UI relatively fresh, but it can spend device, network, and target resources even when the user is not actively using Topo. In fact, our current update cadence can quite easily hit ssh

## Goals

### Must

- The extension UI must make a best effort to display up-to-date information on target health and containers.
- The extension UI must make background work visible to the user.
- The extension must be respectful of user and target resources by default, especially when Topo is not being actively used.
- The user must be able to easily force a refresh of the UI.
- The UI must avoid presenting stale information as if it were known to be current.

### Should

- The user should be able to configure or disable automatic refresh behaviour.
- The UI should communicate the current refresh mode, frequency, and last refresh time.
- Mutating extension operations, such as deploy, stop, start, or remove, should trigger a refresh after completion.
- Refreshes should remain non-overlapping.
- Refresh frequency should degrade gracefully when connectivity is unhealthy or the target is expensive to query.

### Could

- The extension could support an `auto` refresh mode that adapts to user activity.
- The extension could refresh different data at different frequencies.
- The extension could pause or reduce automatic refreshes when the relevant view is hidden, the VS Code window is unfocused, or the workspace is idle.
- The extension could support per-target refresh settings.
- The extension could eventually consume a `topo events` stream instead of relying primarily on polling.

### Won't, for now

- The extension will not guarantee real-time state updates.
- The extension will not assume polling is free simply because each individual command is small.
- The extension will not hide background work from the user.

## Success Criteria

A successful refresh strategy should make these things true:

- Users can see when the extension is refreshing.
- Users can manually refresh at any time.
- Users can reduce or disable any automatic refresh behaviour.
- The UI clearly distinguishes fresh, refreshing, stale, and failed states.
- Mutating operations are followed by a best-effort state refresh.
- Refresh work never overlaps.

## Options

### 1. Keep fixed polling, but make it configurable

Continue polling on a fixed interval, but increase the default interval to something less aggressive, such as 10 or 15 seconds, and add settings for the interval and disablement.

**Pros**

- Straightforward mental model for users.
- Reduces default resource usage.
- Allows users with different workflows to choose their own tradeoff.
- Preserves the best-effort freshness model.
- Provides an explicit escape hatch for constrained environments.

**Cons**

- Still polls even when nothing has changed.
- Users may not know which interval is appropriate.
- A disabled loop can leave UI state stale unless the UI communicates that clearly.
- Fixed intervals do not account for actual user activity or target cost.

### 2. Add a manual refresh control

Add a visible refresh action in the UI. The same control can indicate an active refresh, for example by showing a loading state.

**Pros**

- Gives users direct control.
- Makes refresh behaviour discoverable.
- Provides an obvious fallback when automatic refresh is slow, disabled, or paused.
- The control can double as a background activity indicator.

**Cons**

- Manual refresh alone is not enough to keep the UI fresh.
- Users may overuse it if they do not trust automatic refresh.
- Requires clear disabled/loading/error states to avoid confusing repeated clicks.

### 3. Refresh after mutating operations

Trigger a best-effort refresh after extension operations that are expected to change target or container state, such as deploy, start, stop, restart, remove, or cleanup.

**Pros**

- Refreshes are aligned with moments when state is likely to change.
- Improves perceived responsiveness after user actions.
- Reduces reliance on waiting for the next polling interval.
- Works well with a slower default polling cadence.

**Cons**

- Does not catch changes made outside the extension.
- Some mutations may have delayed effects, so a single immediate refresh may still observe intermediate state.
- Requires all mutating actions to consistently participate in the refresh policy.

### 4. Surface refresh status and staleness

Show whether data is fresh, refreshing, stale, or failed. Include the last successful refresh time and, where useful, the configured refresh mode or interval.

**Pros**

- Makes background work and data age visible.
- Helps users understand whether the UI can be trusted.
- Complements both automatic and manual refresh modes.
- Makes disabled or paused refresh modes safer because stale data is explicit.

**Cons**

- Adds UI surface area.
- Too much status detail can become noisy.
- Requires careful language so users understand stale data is not necessarily incorrect.

### 5. Adaptive `auto` refresh mode

Adjust refresh frequency based on activity. For example, refresh more often shortly after user interaction or mutating operations, and less often when the user is idle.

**Pros**

- Better balances freshness and resource usage.
- Reduces work when Topo is not actively used.
- Can feel more responsive than a slow fixed interval.
- Gives the extension room to behave well by default without requiring users to tune settings.

**Cons**

- More complex product behaviour to explain.
- Users may find the cadence unpredictable.
- Needs clear status indicators so users understand when auto-refresh is active, idle, or paused.
- Poorly chosen activity signals could either waste resources or allow data to become stale unexpectedly.

### 6. Pause or slow refresh when inactive

Reduce or suspend automatic refresh when the relevant view is hidden, the VS Code window is unfocused, or the workspace has been idle for some time.

**Pros**

- Strongly aligns resource usage with active user attention.
- Avoids background work when the extension is unlikely to be useful.
- Can be combined with manual refresh and mutation-triggered refresh.

**Cons**

- Returning to the view may initially show stale data.
- Activity detection can be imperfect.
- Users may expect background state to remain current even while they are away.
- Needs clear stale-state handling when refresh resumes.

### 7. Back off when health checks fail

When `topo health` reports unhealthy connectivity, reduce refresh frequency rather than continuing at the normal cadence.

**Pros**

- Avoids repeatedly probing an unavailable or expensive target.
- Reduces noise during known-bad connectivity periods.
- Preserves the existing rule that Docker queries only run after healthy connectivity.
- Makes unhealthy states less costly by default.

**Cons**

- Recovery from an unhealthy state may be detected later.
- Users may need a manual refresh to force an immediate retry.
- Backoff state must be visible enough that users understand why refreshes are less frequent.

### 8. Refresh different data at different frequencies

Separate health and container inspection into different freshness policies.

**Pros**

- Avoids expensive detailed inspection when cheaper state is sufficient.
- Allows health to be checked more frequently than detailed Docker state.
- Can reduce target and network load while preserving useful freshness.

**Cons**

- More complex freshness model.
- Different parts of the UI may represent data from different times.
- Requires clear staleness indicators to avoid misleading users.

### 9. Event-driven updates through `topo events`

Introduce a future `topo events` command, similar to `docker events`, that reports target health changes, connectivity changes, and Docker state changes.

**Pros**

- Avoids polling when nothing changes.
- Can provide faster updates than fixed polling.
- Better long-term fit for efficient, responsive UI state.
- Creates a single Topo-level abstraction for state changes instead of the extension coordinating multiple commands.

**Cons**

- Requires new `topo` capability.
- Event streams need lifecycle, reconnection, and error handling policies.
- Some state may still require periodic reconciliation to recover from missed events.
- More future-looking than the immediate extension refresh problem.

## Proposed Solution

A practical near-term direction is to combine several smaller changes:

- Keep automatic refresh, but increase the default interval to 10 or 15 seconds (1)
- Add settings for refresh interval and automatic refresh disablement (1)
- Add a manual refresh control that also indicates active refresh work (2)
- Trigger a refresh after mutating extension operations (3)

## Open Questions

- Should refresh settings be global, workspace-specific, target-specific, or some combination?
- What counts as active Topo usage if we were to go some more intelligent polling cadence?
- How stale can data become before the UI should visibly warn the user?
- Should failed refreshes produce notifications, inline status, logs, or some combination?
