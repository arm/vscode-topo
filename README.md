[![Maintainability](https://qlty.sh/badges/8e1f1697-168c-4a5d-ad72-a9f3ff78f42f/maintainability.png)](https://qlty.sh/gh/Arm-Debug/projects/vscode-topo) [![Code Coverage](https://qlty.sh/badges/8e1f1697-168c-4a5d-ad72-a9f3ff78f42f/test_coverage.png)](https://qlty.sh/gh/Arm-Debug/projects/vscode-topo)
# vscode-topo

A Visual Studio Code extension for managing and editing a Topo project with ease and visualize the services running on a board.

## Features

- Custom editor for `compose.topo.yaml` files
- Visual form-based editing and YAML synchronization
- Subsystem-aware service grouping
- Integrated with VS Code’s custom editor API

## Requirements

- Visual Studio Code v1.99.0 or newer

## Getting Started

1. Install the extension from the VSIX or VS Code Marketplace.
2. Open a `compose.topo.yaml` file to launch the compose editor.
3. Use the form to add or remove services.
4. Use the deploy button or the makefile to deploy a project
5. Access the Topo view container to visualize the board services 


## Building from Source

Follow these steps to build and package the extension locally:

### Prerequisites
- Node.js (>=16.x)
- npm (>=6.x)
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

3. Download the `topo-cli` binary:
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

### Access the `topo-cli` binary
When the extension is loaded the `topo-cli` binary path is added to the `PATH` and can be directly accessed from the VS Code terminal:
```bash
topo-cli
```

## License

[MIT](LICENSE)

---
