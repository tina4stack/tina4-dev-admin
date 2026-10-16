# Generated-page design defaults

## Scope
A reusable baseline for the local harness, not a new brand or a fixed website template. The user wants useful defaults without writing long design prompts. Applies to new HTML/Twig pages and explicitly requested redesigns. Existing project identity and narrow-edit scope take precedence. Separate brand and component demo sites are omitted: the deliverable is guidance used by the live generator.

## Direction and rationale
- Open, readable sections instead of one large card: separates page hierarchy from component grouping.
- Installed system typography: fast, local and consistent with Tina4CSS; no external font dependency.
- One semantic accent and neutral surfaces: makes the primary action clear while allowing each project's brand to change the palette.
- 16–18px body type, 60–70ch reading width, restrained heading scale: prioritizes readable generated copy.
- Spacing rhythm: 16–24px mobile gutters, 24px card padding, 48–72px section gaps as targets, mapped to installed utilities first.
- Theme radius, borders and shadows: reuse installed values instead of inventing a parallel token system.
- Mobile stacking and responsive images: content determines height; logos retain their aspect ratio.
- Cards have one body; buttons have one variant: avoids the invalid and redundant nesting observed in playground output.
- No default hero imagery, claims or destination URLs: imagery must come from actual assets and links must have real targets.

## Evidence
Tina4 documents built-in styling and SCSS composition: https://tina4.com/general/css/
Bootstrap's component anatomy separates card body, header and footer: https://getbootstrap.com/docs/5.0/components/card/
These are structural references only. The installed Tina4CSS class catalog is the authority for available classes; Bootstrap is not added.

## Integration
`src/skills/page-design.md` is imported into layout planning and both page-generation and styling guidance. The editor and style stages share the defaults. Defaults are advisory design choices, not prompt-specific page code. Python generation receives none of this guidance.

## Validation limits
The existing runtime contrast catalog computes valid text/background pairs. No new fixed palette is introduced. Build success does not establish visual quality; a generated page still needs live preview verification. No new model quality run is claimed for this change.
