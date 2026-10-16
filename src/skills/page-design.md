# Default page design

Apply only to HTML/Twig presentation, never Python or unrelated code. Explicit user requirements and established project branding take precedence. For a small follow-up edit preserve the current design; these defaults do not authorize a redesign.

Before building a new page, choose its audience, primary purpose, content hierarchy, one accent role, and mobile stacking order. Make these choices in the layout brief, then use the same brief for markup and styles.

- Use a clear h1, a short useful introduction and one primary action only when there is a real destination or implemented behaviour. No invented routes, metrics, testimonials or placeholder buttons.
- Prefer open sections with a consistent container and comfortable vertical spacing. Never put the whole page inside a card. Use cards for genuinely separate items, not every paragraph. Avoid gratuitous nested containers.
- Use the installed font stack. Body copy should be comfortably readable, around 16–18px with 1.5–1.7 line height and about 60–70 characters per line. Give headings a clear, restrained hierarchy. Prefer natural alignment over centering every section.
- Use the installed theme's neutral surfaces and one accent for primary actions. Derive colour direction from supplied branding when available. Avoid large saturated backgrounds, decorative gradients, heavy shadows and arbitrary multicolour sections unless requested. Choose text/background pairs from the supplied contrast catalog.
- Use a consistent spacing rhythm: small gaps inside related groups, larger gaps between sections. Aim for 16–24px mobile side padding, 24px card padding and 48–72px section spacing where supported. Prefer installed utilities; use scoped SCSS only for a missing requirement.
- Grid columns stack on mobile. Buttons may wrap. Images use actual supplied public URLs, meaningful alt text and responsive sizing. Preserve aspect ratio; do not crop logos or stretch images. No fixed heights that clip content.
- Use Tina4CSS Bootstrap-style component anatomy: card contains optional card-header, one card-body and optional card-footer as siblings. Use btn with ONE variant. Use container > row > columns where a grid is needed. Class names must exist in the installed catalog. Do not load Bootstrap.
- Keep semantic HTML and source tidy: balanced tags, four-space indentation, at most one blank line between blocks, no duplicate wrappers, no directly nested li elements. Preserve whitespace-sensitive code/preformatted content and Twig expressions.
- Keep focus visible, controls labelled, links distinguishable and touch targets comfortable. Respect reduced motion. Check narrow and wide layouts, image loading and real navigation destinations before claiming completion.
