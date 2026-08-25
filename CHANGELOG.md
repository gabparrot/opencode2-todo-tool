# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.2]

### Fixed

- The TUI never loaded the sidebar: V2's TUI only auto-imports UI plugins from `plugins/tui/` directories and ignores the config `plugins` array for UI parts. Documented the required bridge shim and hardened `src/index.ts` to exit cleanly when a TUI host imports it (its setup previously threw on the missing server context).
- Pointing a config entry at the plugin directory fails server-side on current builds; README now pins install to the file path explicitly.

## [0.2.1]

### Fixed

- `todowrite` is now registered as a native model tool by setting `codemode: false` on its options; previously it was silently routed into the CodeMode catalog and never appeared in an agent's tool list.

### Changed

- Pinned `@opencode-ai/plugin` to `0.0.0-beta-18155` for reproducible builds.

## [0.2.0]

### Added

- Fresh per-round todo snapshot via `ctx.session.hook("context")`. Before every normal model request, the plugin re-reads the session store and injects the current list as a system-context part, so writes between rounds are visible on the next round without another `todowrite` call.
- `injectEveryRound` option (default on). Set `false` to keep the `todowrite` tool but skip per-round injection.

An empty list injects nothing. `enabled: false` still disables the whole plugin (tool and injection).

## [0.1.0]

Initial release — `todowrite` tool with per-session persistence, enable/disable control, and a PARTIAL TUI sidebar list.
