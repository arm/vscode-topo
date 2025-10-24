import * as vscode from 'vscode';
import { ComposeEditorProvider } from './composeEditorProvider';
import { TopoCli } from './topoCli';
import { OnBoardTopoConsoleOpener } from './onboardTopoConsoleOpener';
import { ProjectInit } from './projectInit';
import { TopoCliVersionChecker } from './topoCliVersionChecker';
import { MakefileGenerator } from './makefileGenerator';
import { ContainerExplorer } from './workloadPlacement/containerExplorer';
import { ContainerTreeDataProvider } from './workloadPlacement/containerTreeDataProvider';
import { ContainersManager } from './workloadPlacement/containersManager';
import { Deployer } from './deployer';
import { BoardDashboardMessageHandler } from './boardDashboard/boardDashboardMessageHandler';
import { BoardDashboardProvider } from './boardDashboard/boardDashboardProvider';
import { MessageHandler } from './messageHandler';
import { ContainerStart } from './actions/containerStart';
import { ContainerStop } from './actions/containerStop';
import { ContainerOpenInBrowser } from './actions/containerOpenInBrowser';
import { AttachVscode } from './actions/attachVscode';
import { AttachShell } from './actions/attachShell';
import { BoardConnectionChecker } from './util/boardConnectionChecker';
import { ContainerDelete } from './actions/containerDelete';
import { OpenSerial } from './actions/openSerial';
import { DockerCommands } from './workloadPlacement/dockerCommands';
import * as manifest from './manifest';

let topoCli: TopoCli;

export async function activate(context: vscode.ExtensionContext) {
    topoCli = new TopoCli(context.extensionPath, context.environmentVariableCollection, manifest.BOARD_SSH_TARGET);
    const topoCliVersionChecker = new TopoCliVersionChecker(topoCli, context.extensionPath);

    if (!topoCliVersionChecker.checkTopoCliVersion()) {
        return;
    }

    const deployer = new Deployer(topoCli);
    const onBoardTopoConsoleOpener = new OnBoardTopoConsoleOpener(context);
    const projectInit = new ProjectInit(context, topoCli);
    const messageHandler = new MessageHandler(topoCli, deployer);
    const composeEditorProvider = new ComposeEditorProvider(context, messageHandler);
    const makefileGenerator = new MakefileGenerator(context, topoCli);
    const boardConnectionChecker = new BoardConnectionChecker();
    const containerOpenInBrowser = new ContainerOpenInBrowser(context);
    const dockerCommands = new DockerCommands();
    const attachVscode = new AttachVscode(context, dockerCommands);
    const attachShell = new AttachShell(context, dockerCommands);
    const containersManager = new ContainersManager(boardConnectionChecker, dockerCommands);
    const containerTreeDataProvider = new ContainerTreeDataProvider(containersManager);
    const containerExplorer = new ContainerExplorer(context, containerTreeDataProvider);
    const boardDashboardMessageHandler = new BoardDashboardMessageHandler(containersManager, containerOpenInBrowser, attachVscode, attachShell);
    const boardDashboardProvider = new BoardDashboardProvider(context, boardDashboardMessageHandler, containersManager);
    const containerStart = new ContainerStart(context, containersManager);
    const containerStop = new ContainerStop(context, containersManager);
    const containerDelete = new ContainerDelete(context, containersManager);
    const openSerial = new OpenSerial(context);

    await topoCli.activate();
    await onBoardTopoConsoleOpener.activate();
    await composeEditorProvider.activate();
    await projectInit.activate();
    await makefileGenerator.activate();
    await attachVscode.activate();
    await attachShell.activate();
    await containerOpenInBrowser.activate();
    await containerExplorer.activate();
    await boardDashboardProvider.activate();
    await containersManager.activate();
    await containerStart.activate();
    await containerStop.activate();
    await containerDelete.activate();
    await openSerial.activate();
}

export async function deactivate(): Promise<void> {
    await topoCli.deactivate();
}
