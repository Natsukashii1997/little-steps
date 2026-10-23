# Issue tracker: Local Markdown

Issues and specs for this solo repository live as Markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket under `.scratch/<feature-slug>/issues/`, numbered from `01` in dependency order.
- Every ticket includes `Status:` and `Blocked by:` lines.
- `ready-for-agent` means the ticket is specified and may be implemented.

## Operations

When a skill says “publish to the issue tracker”, write or update the corresponding local Markdown file. Work blockers-first and keep completed acceptance evidence in the ticket rather than inventing an external issue number.
