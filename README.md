# vscode-topo

A Visual Studio Code extension for managing and editing a Topo project with ease and visualize the services running on a target.

## Features

- Custom editor for `compose.topo.yaml` files
- Visual form-based editing and YAML synchronization
- Dynamic target management
- Subsystem-aware service grouping

## Requirements

- Visual Studio Code v1.99.0 or newer

## Getting Started

1. Install the extension from the VSIX or VS Code Marketplace.
2. Open a `compose.topo.yaml` file to launch the compose editor.
3. Use the form to add or remove services.
4. Use the deploy button
5. Access the target-manager view to visualize the target services

## Building from Source

Follow these steps to build and package the extension locally:

### Prerequisites

- Node.js (^22.0.0)
- npm (^10.0.0)
- VS Code Extension Manager (vsce) for packaging (`npm install -g vsce`)

### Setup

1. Clone the repository:
    ```bash
    git clone https://github.com/Arm-Debug/vscode-topo.git
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

### Build

Compile the extension and webview bundles:

```bash
npm run build
```

### Package

Generate a .vsix package for distribution:

```bash
npm run package
```

(This requires `vsce` to be installed globally.)

### Run Tests

Execute unit tests and generate coverage report:

```bash
npm test
```

### Access the `topo` binary

When the extension is loaded the `topo` binary path is added to the `PATH` and can be directly accessed from the VS Code terminal:

```bash
topo
```

## License

[MIT](LICENSE)

---
