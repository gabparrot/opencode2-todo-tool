# Ecosystem listing guide

How to get `opencode2-todo` listed and discoverable in the OpenCode community.

> The original `opencode-ai/opencode` repo is archived. The live project is
> [anomalyco/opencode](https://github.com/anomalyco/opencode), with docs at
> [opencode.ai/docs](https://opencode.ai/docs) and V2 docs at
> [opencode.ai/v2/docs](https://opencode.ai/v2/docs).

## Prerequisite: npm publish

Listing sites link back to an npm package, so publishing comes first. As of this
writing `opencode2-todo` is **not** published — see [Verification in the README](../README.md#verification).

Best practices for the manifest:

- `keywords`: `opencode`, `opencode-plugin`, `plugin`, `todo`, `task`
- set `repository` (auto-corrected by npm to `git+https://...` if missing)
- clear one-line `description`
- a README with install/usage

Note: `opencode2-todo` deviates from the common `opencode-*` naming convention
(the bare `opencode-todo` name was taken-then-unpublished, so the `2` suffix was
chosen to signal V2-only). This is harmless but worth remembering when listing.

## Venues (ranked)

| # | Venue | Submission | Requirements | Effort | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | Official docs Ecosystem page | PR to `anomalyco/opencode` → `packages/web/src/content/docs/ecosystem.mdx`, one row under `## Plugins` | Issue-first policy: open an issue, link the PR | Medium | Highest trust / discoverability |
| 2 | awesome-opencode | PR adding `data/plugins/opencode2-todo.yaml` | `name`, `repo`, `tagline` ≤120 chars, `description`; automated validation, no issue-first policy | Low | Largest community audience |
| 3 | opencode.cafe | Web form at `opencode.cafe/submit` | Manual review | Low | Near-empty marketplace today |
| 4 | npm publish | `npm publish --access public` from `opencode2-todo/` | Valid auth token; manifest best practices above | Low–Medium | **Prerequisite**, currently blocked (E404/E401) |
| 5 | Discord / X | Post in `discord.gg/opencode`, tweet | None | Low | Announce after 1–3 venues land |

### Recommended order

```
npm publish → awesome-opencode PR → ecosystem.mdx PR → opencode.cafe form → Discord/X
```

Do not file the ecosystem PR(s) until npm publish succeeds — the listings link to
the package.

## Known limitations

### TUI rendering caveats

The sidebar list is a **partial** restoration of the V1 native todo dock. These
are the concrete constraints of the current implementation (`opencode2-todo/src/tui.tsx`).

- **Reads the transcript, not the store.** The sidebar derives todos by scanning
  `todowrite` tool parts in `context.data.session.message.list(sessionID)`. The
  server plugin also persists a per-session store (`todos/<sessionID>` via
  `ctx.storage`), but the sidebar does **not** consume that store directly.
- **Active session only.** There is no persistent always-visible dock. The list
  only shows the active session and only once its messages are synced into the TUI.
- **No native dock / projection / endpoint.** Plugins cannot re-create the
  deleted desktop dock, the `todo.updated` projection, or the `/api/todo`
  endpoint that V1 shipped.
- **Single-line truncation.** Each item renders with `wrapMode="none"` +
  `truncate`, so long `content` is ellipsized to one line rather than wrapped.
  The inline priority suffix `(high)` and `currently: <activeForm>` text are
  appended to the same line and truncate along with the content.
- **Collapsed by default for 3+ items.** When there are more than 2 todos the
  list renders only a `Todos (n/m done)` header; clicking the header toggles
  expand/collapse. With ≤2 items the list is always expanded and has no toggle.
- **All-completed lists are hidden.** A non-empty list where every item is
  `completed` renders nothing (matching V1 behavior); an empty list shows
  `none yet`.
- **Read-only.** No drag/drop, no inline editing, no click-to-toggle. Order is
  whatever the model last wrote — there is no sort by priority or status.
- **Tolerant parsing.** `latestTodos` scans tool parts in reverse and falls back
  across `output` → `state.output` → `metadata` → `content` text, including a
  Markdown checklist parser. It degrades gracefully when metadata is missing,
  but a pruned/compacted transcript (or a missing tool part) can leave the list
  stale or empty.
- **Status colors are fixed.** Markers and line colors are hard-mapped from
  status via semantic theme tokens (`text.feedback.success`/`warning`,
  `text.subdued`, `text.default`); they are not user-customizable.
- **`activeForm` only shown while in progress.** In the sidebar the
  `currently: <activeForm>` suffix renders only for `in_progress` items (the
  plain-text `formatTodos` output appends it for any status).

### Other limitations

- **V2 only.** Requires `opencode2` with TypeScript plugin loading; no
  pre-compiled bundle is shipped. Incompatible with opencode v1.
- **No `todoread`.** Read-back is via the sidebar or the session transcript only.
- **`todowrite` is hidden from the timeline.** V2 session-ui special-cases
  `todowrite` and does not render it as a normal tool card (web/desktop); the
  generic TUI shows a collapsed `todowrite …` one-liner whose full output is only
  visible after click-to-expand. The sidebar slot is the supported read surface.
