# Interactive Tina4 page skill

## Build order
Establish the content and responsive layout using installed Tina4CSS utilities. Give each control a stable identifier. Then implement its event, state transition and visible output. A rendered control is not completed functionality.

## Diagnose a failed browser case
Read the existing template and loaded scripts. Trace the actual clicked element to its listener, dispatch branch, state update and render function. Verify the script is included in the rendered page. Missing script or missing control is a concrete implementation gap; do not speculate about a handler that does not exist.

## Repair
Retain the current page, route, visible content, control identifiers and styles. Add missing controls without replacing existing ones. For missing runtime behaviour, add executable JavaScript and wire every control needed by the agreed acceptance cases. Use the existing script if present. Otherwise insert a script inside the existing template content block after its markup; a script outside an inherited Twig block may not render. Initialise after its elements exist. Tina4 enforces Content Security Policy: inline scripts require nonce="{{ csp_nonce() }}"; never disable the policy. The harness owns this script wrapper. Preserve unrelated events and template blocks.

Use a few unique exact source anchors. Insert by replacing an anchor with itself plus the addition. Never rewrite the whole page, duplicate controls, change expected results, or substitute comments for code. Code strings must be valid JSON strings when the caller asks for JSON. Follow the output contract of the current stage exactly: selection returns the requested JSON names; function repair returns only the selected function declaration; patch generation returns the requested edit object. Do not mix these formats. At the diagnosis stage return a short source-grounded diagnosis, not a patch.

## Verify
Reload the actual page. Click the same controls and read the visible output for each acceptance case. Report console errors and exceptions with the triggering action. Fix the earliest failed transition and rerun unchanged expectations. A screenshot verifies appearance only; it cannot prove event handlers work. If a case cannot run because a required capability is missing, report and repair that gap before retrying. Never claim success from a source-only review.
