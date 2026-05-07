# Arm Topo

The Arm® Topo extension for Visual Studio Code provides a graphical interface for managing [Topo](https://github.com/Arm/topo) projects. Use the extension to edit compose files visually, manage remote targets, deploy services, and monitor running containers — all from within VS Code.

This extension is [free to use](LICENSE) and can be installed from the VS Code Marketplace or from a `.vsix` package.

## Requirements

- Visual Studio Code v1.99.0 or newer

## Getting Started

1. Install the extension from the VS Code Marketplace or a `.vsix` package.
2. Add a target from the **Targets** view in the **Topo** activity bar container.
3. Configure a target, making sure all the dependencies are set up correctly.
4. Deploy your services to the target.

## Target Management

The **Targets** view appears in the **Topo** activity bar container and lets you manage remote devices where services are deployed.

### Add a Target

Click the **+** button in the Targets view title bar and enter an SSH connection string (for example `root@192.168.1.1`). The extension automatically selects the first target you add.

### Target Tree

Each target in the tree shows:

| Item                 | Description                                                           |
| -------------------- | --------------------------------------------------------------------- |
| **Subsystem groups** | Host and any remote processor subsystems detected on the target.      |
| **Services**         | Running or stopped containers under each subsystem, with state icons. |
| **Dependencies**     | Connectivity, driver, and target dependency health checks.            |

### Target Actions

Right-click a target in the tree to access these actions:

| Command            | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| **Select Target**  | Make the target active for deployments and actions.             |
| **Remove Target**  | Delete the target from the configuration.                       |
| **Inspect Health** | Run a health check and display the JSON results.                |
| **Setup Keys**     | Configure SSH key-based authentication for passwordless access. |

## Container Actions

Right-click a service in the Targets tree to manage individual containers:

| Command             | Description                                                              |
| ------------------- | ------------------------------------------------------------------------ |
| **Start**           | Start a stopped container.                                               |
| **Stop**            | Stop a running container.                                                |
| **Delete**          | Remove a container.                                                      |
| **Attach Shell**    | Open a VS Code terminal connected to the container.                      |
| **Attach VS Code**  | Open the container in a VS Code Remote Containers session.               |
| **Open in Browser** | Open the service in the default browser (auto-detects common web ports). |

## Deploy and Stop

Deploy or stop a compose file on the selected target. You can trigger either operation from:

- Right-clicking a compose YAML file in the Explorer or editor tab and selecting **Topo Deploy** or **Topo Stop**.

The extension runs the equivalent of `topo deploy --target <ssh>` or `topo stop --target <ssh>` in a task terminal and reports success or failure.

## Project Management

### Initialize a Project

Use the **Arm Topo: Initialize Project** command from the Command Palette to create a new Topo project in the current workspace.

### Clone a Project

Three clone commands are available from the Command Palette:

| Command                              | Description                                 |
| ------------------------------------ | ------------------------------------------- |
| **Arm Topo: Clone Remote Project**   | Clone from a Git repository.                |
| **Arm Topo: Clone Template Project** | Clone from a curated list of Arm templates. |
| **Arm Topo: Clone Local Project**    | Clone from a local directory.               |

After cloning, the extension offers to open the project in the current window, a new window, or add it to the workspace.

### Protocol Handler

The extension supports a URI scheme for cloning projects from external links:

```
vscode://arm.topo/clone?source=git:https://github.com/example/repo
```

## Host Health Check

The **Host** view appears in the **Topo** activity bar container and shows host dependency health for tools such as Docker and SSH. Missing or unhealthy dependencies are shown in the tree.

Use the refresh button in the Host view title bar to reload host dependency health. Use the **Arm Topo: Inspect Host Health** command to view a detailed JSON health report.

## Commands

All commands are under the **Arm Topo** category. Commands available from the Command Palette:

| Command                            | Description                                     |
| ---------------------------------- | ----------------------------------------------- |
| `Arm Topo: Initialize Project`     | Initialize a new Topo project in the workspace. |
| `Arm Topo: Clone Remote Project`   | Clone a project from a Git repository.          |
| `Arm Topo: Clone Template Project` | Clone a project from an Arm template.           |
| `Arm Topo: Clone Local Project`    | Clone a project from a local directory.         |
| `Arm Topo: Inspect Host Health`    | Display host dependency health report.          |

Additional commands are available through the Targets tree view context menus.

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
