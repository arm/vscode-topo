# Development Guide

This document covers how to build, test, and package the Topo VS Code extension from source.

## Prerequisites

- Node.js (^22.0.0)
- npm (^10.0.0)

## Setup

1. Clone the repository:

    ```bash
    git clone https://github.com/Arm/vscode-topo.git
    cd vscode-topo
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

3. Download the `topo` binary:

    ```bash
    npm run download
    ```

## Build

Compile the extension bundle:

```bash
npm run build
```

To watch for changes during development:

```bash
npm run watch
```

## Telemetry

Local builds disable telemetry unless `AZURE_ANALYTICS_CONNECTION_STRING` is set when building. To enable it, copy the connection string from the Azure Application Insights resource's **Overview** page (the Arm resource is **VSCode-Extensions**) and set that environment variable before running `npm run build` or `npm run watch`.

Telemetry always respects VS Code's global `telemetry.telemetryLevel` setting. It must be set to `all` to send usage events, including activation events.

All telemetry events include an `extensionMode` property from VS Code's `ExtensionContext.extensionMode`, captured when the telemetry client is constructed:

- `production`: installed normally, including Marketplace and manually installed VSIX packages.
- `development`: launched with `--extensionDevelopmentPath`, including this repository's F5 launch configuration.
- `test`: launched with `--extensionTestsPath` to run extension tests.

Pass event arguments as the third argument to `TelemetryClient.track`. They are stored as strings under `args.*` in `customDimensions`, separate from automatic metadata such as `extensionMode` and `outcome`. Undefined arguments are omitted. Duration is stored in `customMeasurements.durationSeconds`.

## Lint

Run the full lint suite (Prettier, ESLint, and TypeScript checks):

```bash
npm run lint
```

## Run Tests

Execute unit tests and generate a coverage report:

```bash
npm test
```

## Package

Generate a `.vsix` package for distribution:

```bash
npm run package
```

## Update the Topo CLI Version

To update the Topo CLI version bundled with the extension, pass the new version
as a positional argument:

```bash
npm run bump-topo -- 9.1.0
```

The `--` forwards the version argument from npm to the script. The command
checks that the version has artifacts for every supported platform, then updates
the Topo version and platform checksums in `package.json`. If any artifact is
missing, `package.json` is left unchanged.

## Access the `topo` Binary

When the extension is loaded, the `topo` binary path is added to `PATH` and can be accessed directly from the VS Code terminal:

```bash
topo
```
