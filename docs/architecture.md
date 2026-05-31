# Codebase Architecture

As a VSCode extension, interaction is mostly [command](https://code.visualstudio.com/api/extension-guides/command)-based. Our responsibility is to handle commands from the user, their agent(s) or other parts of the extension and do something useful.

There are two primary types of command - ones that need to directly update the UI by querying the outside world, and those that are side-effect only that are mostly designed to surface useful operations the user may want to perform in VSCode. The former type of commands are handled by **controllers**, while the latter are handled by **actions**.

```mermaid
flowchart LR
    vscode["VSCode Commands<br/>(user/app/agent)"] --> router["Command Router<br/>(commands.ts)"]

    subgraph controllers["Controllers"]
        direction TB
        controllerX["ControllerX"]
        controllerY["ControllerY"]
        controllerZ["ControllerZ"]
    end

    subgraph actions["Actions"]
        direction TB
        actionA["ActionA"]
        actionB["ActionB"]
        actionC["ActionC"]
    end

    subgraph models["Models"]
        direction TB
        modelX["ModelX"]
        modelY["ModelY"]
        modelZ["ModelZ"]
    end

    subgraph views["Views"]
        direction TB
        viewW["ViewW"]
        viewX["ViewX"]
        viewY["ViewY"]
        viewZ["ViewZ"]
    end

    router --> controllerX
    router --> controllerY
    router --> controllerZ

    router --> actionA
    router --> actionB
    router --> actionC

    controllerX --> modelX
    controllerY --> modelY
    controllerZ --> modelZ

    modelX --> viewW
    modelX --> viewX
    modelY --> viewX
    modelY --> viewY
    modelZ --> viewY
    modelZ --> viewZ

    actionB --> fireVscode1["Invoke more VSCode commands"]
    viewY --> fireVscode2["Invoke more VSCode commands"]
```

## Actions

Actions are standalone operations that users may want to perform that we surface as commands. Commands can be invoked by a variety of means including the command palette, tree view buttons, agents or custom task definitions.

The important distinction for us is that actions are command handlers that do not need to directly update the state of UI. This means they're usually side-effect-like operations like launching terminals or displaying the output of a given topo command in an editor tab. However, they can invoke other commands which may mutate the UI if required.

## MVC

MVC; model, view controller is a common pattern for UI applications and the approach we take in this extension to manipulate the UI. The intention behind moving to an MVC architecture is to keep data flowing strictly in one direction, making the application easier to reason about and change. Each component, as well as full concrete example of how they interact with eachother, is described below.

### Models

Models are a representation of the current state of the world. They are simple data containers that emit events when mutated. They are mutated by controllers and read from by views.

Models must only ever be mutated by controllers, never directly by views.

### Views

Views take a reference to a model (or models) and render them to the UI in some way. As a VSCode extension, this boils down to working with various vscode APIs to do things like construct status bar items or building tree views in the sidebar that visualize the state of our models.

Views subscribe to the events emitted by models to trigger re-renders and can optionally render data from multiple models if required.

Some views may need to invoke mutations of the model as a result of user interaction. VSCode mostly handles this via [commands](https://code.visualstudio.com/api/extension-guides/command) (discussed more below). While commands should be favoured for controller invocations to keep a consistent API surface, rarely, commands may not be applicable for a given UI. For example, if you create a webview containing a list of targets where clicking on one selects it (don't do this). In this case it's acceptable to pass a reference to the relevant controller to the view and perform the mutation there. Do not use the result of the mutation, wait for the model get updated and trigger a re-render.

### Controllers

Controllers are the top-level orchestrators that actually talk to the outside world (topo CLI, vscode memento objects, docker CLI etc.) to query the state of the world. It has the responsibility of converting the world state into domain objects that can be passed to the models.

Our UIs need to render these domain objects in three distinct states:

- Loading - with a placeholder (note: the placeholder is often the previously loaded data to avoid visual jitter)
- Loaded - with the freshly loaded domain object
- Error - with some data related to the error to render

Since the controller is the object with the power to query the outside world, orchestrating error and loading states is solely its responsbility. Furthermore, it's a good idea to only mutate each model from one controller to make orchestration async operations easier by virtue of centralization of control.

### Diagram

```mermaid
flowchart TD
    A["VSCode Commands<br/>(from user, from elsewhere in the app,<br/>from polling — whatever)"] --> B["Controller"]

    B -- "Inspect via TopoCli,<br/>DockerCommands etc." --> C["World<br/>(host health, target health,<br/>containers etc.)"]

    B -- "Mutates" --> D["Model"]

    D -- "Pulls data by R/O reference" --> E["View<br/>(tree data provider,<br/>status bar item etc.)"]

    D -- "Subscribes to change events" --> E

    E --> F["User invokes<br/>commands presented<br/>on view"]
```
