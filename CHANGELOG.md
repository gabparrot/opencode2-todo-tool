# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0]

### Added

- Fresh per-round todo snapshot via `ctx.session.hook("context")`. Before every normal model request, the plugin re-reads the session store and injects the current list as a system-context part, so writes between rounds are visible on the next round without another `todowrite` call.
- `injectEveryRound` option (default on). Set `false` to keep the `todowrite` tool but skip per-round injection.

An empty list injects nothing. `enabled: false` still disables the whole plugin (tool and injection).

## [0.1.0]

Initial release — `todowrite` tool with per-session persistence, enable/disable control, and a PARTIAL TUI sidebar list.
