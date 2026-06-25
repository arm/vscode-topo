# Topo

The Topo extension makes it easy for application developers to deploy containers to Arm-based edge devices running Linux, including systems with additional remote processors such as Cortex-M or Cortex-R.

Features include:

- **Target management**: Connect to targets over SSH, inspect target status, and check target compatibility.
- **Example discovery**: Discover [Topo Templates](https://github.com/arm/topo-template-format) for your target.
- **Configure projects**: Topo Templates become standard Docker [Compose projects](https://compose-spec.io/), configured for your use case.
- **Deployment**: Build and deploy projects to your target.
- **Container actions**: Manage individual containers within a deployment.

## Who is this for?

**You just got a board and want to see what it can do.** Topo scans your target and finds [Topo Templates](https://github.com/arm/topo-template-format) that showcase its capabilities, from running an LLM to comparing SIMD performance. Each one deploys in minutes and is a real Compose project you can learn from or build on.

**You want a faster edit-build-deploy loop.** Build on your laptop and deploy to a Pi or Jetson over SSH. Rebuilds are incremental, so after the first deploy you're often iterating in seconds.

**You have a heterogeneous device and want to use all of it.** Your board has remote processors like a Cortex-M that normally need separate toolchains and manual firmware loading. Topo and [Remoteproc Runtime](https://github.com/arm/remoteproc-runtime) let you orchestrate the whole device as one Docker Compose project.

Not sure what these terms mean? The [glossary](https://github.com/arm/topo/blob/main/docs/glossary.md) defines Topo's core concepts.

## Requirements

**Host machine** (where this extension will run):

- Visual Studio Code v1.101.0 or newer
- [Docker](https://docs.docker.com/get-docker/)
- Curl

**Target machine** (the remote Arm system):

- Reachable with SSH
- Linux on ARM64
- Docker

The host and target can be the same system.

## Getting Started

1. Install the extension from the VS Code Marketplace or a `.vsix` package.
1. Select a target from the **Target** view in the **Topo** activity bar container.
1. Review any missing target dependencies and apply suggested fixes.
1. Clone a [Topo Template](https://github.com/arm/topo-template-format) from our catalog.
1. Deploy the configured project to your target.

---

## Target Management

The **Target** view appears in the **Topo** activity bar container and shows the currently selected target where deployments run.

### Select a Target

Click **Select a target** in the Target view title bar or status bar to open the target picker. The picker shows saved targets and hosts from your SSH config. Select an existing target, choose an SSH config host, or type an SSH destination (for example `root@192.168.1.1`) to add and select a new target.

### Remove a Target

Saved targets that do not come from SSH config can be removed from the picker with the inline trash button.

### Target Tree

The Target view header shows the selected SSH destination. The tree below it shows:

| Item                   | Description                                                                       |
| ---------------------- | --------------------------------------------------------------------------------- |
| **Connectivity**       | SSH or target health connectivity errors when the selected target cannot be used. |
| **Processing Domains** | Processing domains on the target, including the primary OS and remote processors. |
| **Services**           | Running or stopped containers grouped by processing domain, with state icons.     |
| **Dependencies**       | Required target components and driver health-check issues shown for the target.   |

If no target is selected, the view shows a **Select a target** button.

### Target Actions

Use the buttons in the Target view title bar to access these actions:

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| **Select a target** | Select, add, or remove saved manual targets. |
| **Refresh**         | Re-check health for the selected target.     |
| **Unselect Target** | Clear the active target without deleting it. |

### Dependency Actions

Use the inline **Fix** button on a fixable dependency item to run the executable fix command reported by the Topo health check. Use **Fix Issues** on the **Dependencies** row to select and run fixes for multiple target dependency issues.

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
- Using the inline **Deploy** or **Stop** buttons on a project in the **Projects** view.

## Project Management

The **Projects** view appears in the **Topo** activity bar container and lists workspace projects discovered from top-level `compose.yaml` or `compose.yml` files.

Use the inline buttons on a project row to deploy or stop that project's compose file on the selected target. These actions behave the same as running **Topo Deploy** or **Topo Stop** from the context menu of the project's compose file.

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

Additional commands are available through inline buttons in the Target, Host, and Projects tree views.

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
