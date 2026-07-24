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

## Access the `topo` Binary

When the extension is loaded, the `topo` binary path is added to `PATH` and can be accessed directly from the VS Code terminal:

```bash
topo
```
