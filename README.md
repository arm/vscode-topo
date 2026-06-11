# Topo

Discover, configure, and deploy containerised software to Arm hardware over SSH.

Integrate [Topo](https://github.com/Arm/topo) CLI workflows into VS Code.

Topo connects to your Arm device over SSH, checks what it can run, and recommends compatible [Topo Templates](https://github.com/arm/topo-template-format). Clone a Template and Topo helps you configure it for your use case, and deploy to your target over SSH. The configured result is a normal Docker Compose project that you can learn from, modify, or use as the starting point for your own application.

Already have a Compose project? Topo gives you a fast, incremental build-deploy loop over SSH.

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
2. Add a target from the **Targets** view in the **Topo** activity bar container.
3. Let Topo check the target for missing dependencies and apply any suggested fixes.
4. Clone a [Topo Template](https://github.com/arm/topo-template-format) from our catalog.
5. Deploy the configured project to your target.

---

## Target Management

The **Targets** view appears in the **Topo** activity bar container and lets you manage targets where deployments run.

### Add a Target

Click the **+** button in the Targets view title bar and enter an SSH destination string (for example `root@192.168.1.1`). The extension automatically selects the first target you add.

### Target Tree

Each target in the tree shows:

| Item                   | Description                                                                       |
| ---------------------- | --------------------------------------------------------------------------------- |
| **Processing Domains** | Processing domains on the target, including the primary OS and remote processors. |
| **Services**           | Running or stopped containers grouped by processing domain, with state icons.     |
| **Dependencies**       | Required target components and driver health-check issues shown for the target.   |

Connectivity errors are shown on the selected target row.

### Target Actions

Use the inline buttons on each target row to access these actions:

| Command            | Description                                                  |
| ------------------ | ------------------------------------------------------------ |
| **Select Target**  | Make the target active for deployments and actions.          |
| **Remove Target**  | Delete the target from the configuration.                    |
| **Inspect Health** | Display health-check JSON results for the selected target.   |
| **Fix Issues**     | Select and run available fixes for target dependency issues. |

### Dependency Actions

Use the inline **Fix** button on a fixable dependency item to run the executable fix command reported by the Topo health check.

## Container Actions

Use the inline buttons on a service in the Targets tree to manage individual containers:

| Command             | Description                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Start**           | Start a stopped container.                                                                  |
| **Stop**            | Stop a running container.                                                                   |
| **Delete**          | Remove a container.                                                                         |
| **Attach Shell**    | Open a VS Code terminal connected to a running container in the target's primary OS.        |
| **Attach VS Code**  | Open a running container in the target's primary OS in a VS Code Remote Containers session. |
| **Open in Browser** | Open a running service in the target's primary OS by auto-detecting common published ports. |

## Deploy and Stop

Deploy or stop the `compose.yaml` file in a project directory on the selected target. A deploy operation builds container images, transfers them to the target, and starts services. You can trigger either operation from:

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

Use the refresh button in the Host view title bar to reload host dependency health. Use the inspect button in the Host view title bar to view a detailed JSON health report.

## Commands

All commands are under the **Topo** category. Commands available from the Command Palette:

| Command                        | Description                                     |
| ------------------------------ | ----------------------------------------------- |
| `Topo: Initialize Project`     | Initialize a new Topo project in the workspace. |
| `Topo: Clone Remote Project`   | Clone a project from a Git repository.          |
| `Topo: Clone Template Project` | Clone a project from an Arm Template.           |
| `Topo: Clone Local Project`    | Clone a project from a local directory.         |
| `Topo: Deploy`                 | Select and deploy a compose file to the target. |
| `Topo: Inspect Host Health`    | Display host dependency health report.          |

Additional commands are available through inline buttons in the Targets and Host tree views.

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
