# Topo

Discover and deploy containerised software to Arm hardware over SSH.

Bring [Topo](https://github.com/Arm/topo) CLI workflows into VS Code. Clone [Topo Templates](https://github.com/arm/topo-template-format/blob/main/01-authoring-templates.md), manage SSH targets, deploy projects, and visualise containers across processing domains.

## Requirements

- Visual Studio Code v1.101.0 or newer

## Getting Started

1. Install the extension from the VS Code Marketplace or a `.vsix` package.
1. Select a target from the **Target** view in the **Topo** activity bar container.
1. Review any missing target dependencies and apply suggested fixes.
1. Clone a [Topo Template](https://github.com/arm/topo-template-format/blob/main/01-authoring-templates.md) from our catalog.
1. Deploy the configured project to your target.

----


## Target Management

The **Target** view appears in the **Topo** activity bar container and shows the currently selected target where deployments run.

### Select a Target

Click **Select a target** in the Target view title bar or status bar to open the target picker. The picker shows saved targets and hosts from your SSH config. Select an existing target, choose an SSH config host, or type an SSH destination (for example `root@192.168.1.1`) to add and select a new target.

### Remove a Target

Saved targets that do not come from SSH config can be removed from the picker with the inline trash button.

### Target Tree

The selected target in the tree shows:

| Item                   | Description                                                                       |
| ---------------------- | --------------------------------------------------------------------------------- |
| **Processing Domains** | Processing domains on the target, including the primary OS and remote processors. |
| **Services**           | Running or stopped containers grouped by processing domain, with state icons.     |
| **Dependencies**       | Required target components and driver health-check issues shown for the target.   |

### Target Actions

Use the inline buttons on the selected target row to access these actions:

| Command             | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| **Unselect Target** | Clear the active target without deleting it.                 |
| **Fix Issues**      | Select and run available fixes for target dependency issues. |

### Dependency Actions

Use the inline **Fix** button on a fixable dependency item to run the executable fix command reported by the Topo health check.

## Container Actions

Use the inline buttons on a service in the Target tree to manage individual containers:

| Command                  | Description                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------ |
| **Start**                | Start a stopped container.                                                           |
| **Stop**                 | Stop a running container.                                                            |
| **Delete**               | Remove a container.                                                                  |
| **Open Container Shell** | Open a VS Code terminal connected to a running container in the target's primary OS. |

## Deploy and Stop

Deploy or stop a project on the selected target. A deploy operation builds container images, transfers them to the target, and starts services. You can trigger either operation from:

- Running **Topo: Deploy** from the Command Palette, then selecting a `compose.yaml` file from the workspace.
- Right-clicking `compose.yaml` in the Explorer or editor tab and selecting **Topo Deploy** or **Topo Stop**.

## Project Management

### Initialize a Project

Use the **Topo: Initialize Project** command from the Command Palette to create a new Topo project in the current workspace.

### Clone a Project

Three clone commands are available from the Command Palette:

| Command                          | Description                                 |
| -------------------------------- | ------------------------------------------- |
| **Topo: Clone Remote Project**   | Clone from a Git repository.                |
| **Topo: Clone Template Project** | Clone from a curated list of Arm Templates. |
| **Topo: Clone Local Project**    | Clone from a local directory.               |

After cloning, the extension offers to open the project in the current window, a new window, or add it to the workspace.

### Protocol Handler

The extension supports a URI scheme for cloning projects from external links:

```
vscode://arm.topo/clone?source=git:https://github.com/example/repo
```

## Host Health Check

The **Host** view appears in the **Topo** activity bar container and shows host dependency health for tools such as Docker and SSH. Missing or unhealthy dependencies are shown in the tree.

Use the refresh button in the Host view title bar to reload host dependency health.

## Commands

Commands available from the Command Palette:

| Command                        | Description                                     |
| ------------------------------ | ----------------------------------------------- |
| `Topo: Initialize Project`     | Initialize a new Topo project in the workspace. |
| `Topo: Clone Remote Project`   | Clone a project from a Git repository.          |
| `Topo: Clone Template Project` | Clone a project from an Arm Template.           |
| `Topo: Clone Local Project`    | Clone a project from a local directory.         |
| `Topo: Deploy`                 | Select and deploy a compose file to the target. |

Additional commands are available through inline buttons in the Target and Host tree views.

## Settings

| Setting                 | Type                                            | Default | Description                                     |
| ----------------------- | ----------------------------------------------- | ------- | ----------------------------------------------- |
| `topo.loggingVerbosity` | `off` \| `error` \| `warn` \| `info` \| `debug` | `warn`  | Control the logging verbosity of the extension. |

## Development

See the [Development Guide](docs/development.md) for instructions on building, testing, and packaging the extension from source.

## Submit Feedback or Report Issues

To submit feedback or report issues, please use [GitHub Issues](https://github.com/Arm/vscode-topo/issues) in the extension repository.

## License

[Apache 2.0](LICENSE)
