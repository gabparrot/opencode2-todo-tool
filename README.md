# opencode2-todo

OpenCode V2 plugin that restores the `todowrite` tool and shows a live todo list in the session sidebar.

> **V2 only.** This plugin requires `opencode2` (the V2 runtime) and is **not** compatible with opencode v1. It uses only the V2 `@opencode-ai/plugin` Promise and TUI APIs — `Plugin.define`, `ctx.tool.transform`, `ctx.session.hook`, and `context.ui.slot`. None of the v1 hook names (`tool.execute.before`, `chat.message`, the singular `plugin` config key, etc.) are used.

## Features

- **`todowrite` tool** — restores the tool that was removed from V2. It has replace-full-list semantics: each call replaces the entire session todo list with the array you pass.
  - **Statuses:** `pending` | `in_progress` | `completed` | `cancelled`
  - **Priorities:** `high` | `medium` | `low`
  - **Optional `activeForm`:** a present-tense description of the work currently underway.
- **Per-session persistence** — the latest list is stored per session via the plugin-scoped `ctx.storage` KV (`todos/<sessionID>`), so concurrent sessions stay isolated.
- **Fresh per-round todo injection** — before every LLM round, the plugin re-reads the session store and injects the current list as a system-context part (empty lists inject nothing).
- **Optional TUI sidebar list** — a live checklist in the session sidebar, derived from the session transcript.
- **Enable/disable control** — turn the whole plugin off, or keep the tool and disable only per-round injection, through sanctioned config surfaces.

## Install

### From npm

After the package is published, install it in the directory `opencode2` runs from so it resolves from `node_modules`:

```sh
npm install opencode2-todo
```

Then add it to the `plugins` array in your opencode config (`opencode.json` or `.opencode/opencode.json`):

```json
{ "plugins": ["opencode2-todo"] }
```

### Local development

Clone the repo and reference the package by absolute path:

```json
{ "plugins": ["/absolute/path/to/opencode2-todo-tool/opencode2-todo"] }
```

`opencode2` loads the TypeScript entry directly (`src/index.ts`), so the runtime must be able to resolve and transpile it — no build step is required.

## Fresh per-round todo injection

The plugin injects the **current** todo list as a system-context part at **every** LLM round, freshly re-read from the store. The model therefore "re-reads" the todos each round — including writes made between rounds without a new `todowrite` call.

This is compaction-proof for the **model**: even if compaction drops old `todowrite` tool results from the model's view, the injected snapshot still shows the current todos. (The TUI sidebar still reads the transcript and can go empty after compaction.)

Stale historical `todowrite` tool results remain in history as normal — the latest snapshot is always injected fresh. An empty list injects nothing.

## Enable / disable

The plugin is **enabled by default**, including per-round injection. Two options flags:

- `enabled` — whole plugin on/off (tool + injection + TUI). Default on. Set `false` to disable everything.
- `injectEveryRound` — per-round system injection. Default `true`. Set `false` to keep the `todowrite` tool but skip injection.

```json
{
  "plugins": [
    {
      "package": "opencode2-todo",
      "options": {
        "enabled": true,
        "injectEveryRound": true
      }
    }
  ]
}
```

Disable the whole plugin:

```json
{ "plugins": [{ "package": "opencode2-todo", "options": { "enabled": false } }] }
```

Keep the tool, skip injection:

```json
{ "plugins": [{ "package": "opencode2-todo", "options": { "injectEveryRound": false } }] }
```

Two other sanctioned ways to change behavior:

1. **Disable directive** — disable by plugin id (`opencode2.todo`):

   ```json
   { "plugins": ["-opencode2.todo"] }
   ```

2. **Permissions deny** — keep the tool registered but block the model from running it:

   ```json
   { "permissions": [{ "action": "todowrite", "resource": "*", "effect": "deny" }] }
   ```

The disable directive and `enabled: false` remove the tool entirely; permissions deny leaves it visible but denied.

## TUI visibility (partial)

The sidebar list shows todos for the **active** session, derived from the session transcript's `todowrite` tool metadata. It is **not** a persistent always-visible dock: it depends on the session being active and its messages being synced into the TUI.

This is an honest limitation of the V2 plugin surface. Plugins cannot re-create the native desktop dock, the `todo.updated` projection, or the `/api/todo` endpoint that V1 shipped. A future `todoread` or public API could surface the server-persisted per-session list directly; today the sidebar reads the same data back through the transcript.

## No `todoread`

This plugin provides only `todowrite`. There is intentionally no `todoread` tool — the model sees the current list via per-round system injection; humans see it via the sidebar or the session transcript.

## `activeForm` note

The `activeForm` field is a deliberate superset beyond the original V1 schema. V1's `todowrite` accepted only `content`, `status`, and `priority`; this plugin adds an optional `activeForm` string describing work in progress.

## Tool schema

```jsonc
{
  "todos": [
    {
      "content": "string",          // required — brief description of the task
      "status": "pending",          // required — pending | in_progress | completed | cancelled
      "priority": "high",           // required — high | medium | low
      "activeForm": "string"        // optional — present-tense "currently underway" text
    }
  ]
}
```

Each call replaces the full session list. An empty `todos: []` clears it.

## Known limitations

- **TUI is partial** — see [TUI visibility](#tui-visibility-partial) above. The sidebar still reads from the transcript, not from the per-session store. Compaction can empty the sidebar even though the model still receives the injected snapshot.
- **Requires opencode2** with TypeScript plugin loading (no pre-compiled bundle is shipped).
- **Server hook consumes the store; TUI does not** — per-round injection re-reads `todos/<sessionID>` on every model request. The sidebar still sees the same data only via the transcript.

## Verification

- **Tests** — `bun test` from `opencode2-todo/`: **27 pass, 0 fail** across 2
  files (`test/todowrite.test.ts` + `test/injection.test.ts`). Covers schema
  validation, `formatTodos`, persistence round-trip/filtering, `todowrite`
  execute, plugin registration, and per-round injection (store re-read at prompt
  assembly + `injectEveryRound` flag).
- **Typecheck** — `bun typecheck` (tsc `--noEmit`): clean, exit 0.
- **Version** — plugin is at `0.2.0`.
- Ecosystem listing next steps: see [docs/ECOSYSTEM.md](docs/ECOSYSTEM.md).

## License

MIT
