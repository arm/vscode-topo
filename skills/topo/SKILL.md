name: topo
description: Use the Topo CLI, preferring the executable available on PATH and falling back to the one bundled with the Arm Topo VS Code extension. Use for any request to create, clone, configure, deploy, inspect, or stop Topo projects and services.
---

# Topo CLI

Use the `topo` executable available on `PATH` by default. Check with
`command -v topo` on Linux and macOS or `where topo` on Windows.

If `topo` is not available on `PATH`, use the executable inside the installed
Arm Topo VS Code extension:

- Linux and macOS: `~/.vscode/extensions/arm.topo-<version>/resources/topo`
- VS Code Remote: `~/.vscode-server/extensions/arm.topo-<version>/resources/topo`
- Windows: `%USERPROFILE%\.vscode\extensions\arm.topo-<version>\resources\topo.exe`

Use the equivalent path under the configured VS Code extensions directory when
it differs from these defaults. Select the installed `arm.topo` version and
resolve the fallback path to an absolute path before executing it.

Run `<topo-command> --help` to discover current operations and `<topo-command>
<command> --help` for command-specific arguments, where `<topo-command>` is
`topo` when available on `PATH` or the resolved extension path otherwise.
Follow the CLI's current help instead of duplicating its operation
documentation or invoking VS Code command IDs.

If neither executable is available, ask the user to install Topo or install or
activate the Arm Topo extension. Do not substitute raw `git`, `docker`, or
`docker compose` commands.
