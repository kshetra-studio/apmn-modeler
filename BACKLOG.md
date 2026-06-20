# APMN Modeler — Backlog

## Design

### Observability nodes as tier-2
`observeEvent` (and any future trace/span nodes) are cross-cutting concerns, not business process steps. They should be visually distinct from tier-1 nodes:
- Smaller dimensions (e.g. 100×60 instead of 120×80)
- Lighter stroke / lower saturation color
- Separate sidebar section: "Observability" below BPMN Standard
- In YAML export, emit them as a separate `observability` key parallel to `nodes`

### EscapeGate must always be connected
EscapeGate triggers on agent failure, timeout, or confidence floor. It must have:
- At least one incoming connection (from the agent being watched)
- At least one outgoing connection (to a humanInLoopTask or error handler)
Unconnected EscapeGates should show a validation warning in the properties panel.

### APMN formal spec adoption path (V3.0)
Consider submitting APMN as a formal extension request to OMG BPMN working group for V3.0 adoption. The moddleExtension approach (apmn: namespace with typed subtypes of bpmn:*) is already structured for this. Track at: https://github.com/kshetra-studio/apmn

### ⓘ popover links to exact spec anchor
Currently the ⓘ info button on each sidebar node links to the top of the spec page (`docsUrl`).
Should deep-link to the exact node section anchor, e.g.:
- `agentTask` → `https://github.com/kshetra-studio/apmn/blob/main/spec/apmn-v0.1.md#agenttask`
- `confidenceGate` → `...#confidencegate`
- etc.
Each `docsUrl` in `types.js` already has the correct anchor — the popover `<a>` tag just needs to use it directly. Also consider linking to the hosted `apmn.kshetra.studio` spec page once that domain is live.

## Implementation

### YAML duplicate ID validation
Currently deduplicated at import (suffixed `_2`, `_3`). Add a pre-import warning toast listing any IDs that were renamed.

### BPMN export: preserve APMN attributes
When exporting to BPMN XML, `apmn:*` attributes on tasks and gateways must round-trip correctly. Verify with a save→reload cycle after moddleExtension wiring is stable.

### Properties panel: typed APMN properties
After moddleExtension is stable, update properties panel to read/write typed `bo[key]` instead of `bo.$attrs['apmn:key']`.
