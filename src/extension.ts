import * as vscode from 'vscode';
import { ComposeEditorProvider } from './composeEditorProvider';
import { TopoCli } from './topoCli';
import { OnBoardTopoConsoleOpener } from './onboardTopoConsoleOpener';
import { ProjectInit } from './projectInit';
import { TopoCliVersionChecker } from './topoCliVersionChecker';
import { TargetManager } from './workloadPlacement/targetManager';
import { TargetTreeDataProvider } from './workloadPlacement/targetTreeDataProvider';
import { ContainersManager } from './workloadPlacement/containersManager';
import { Deployer } from './deployer';
import { BoardDashboardMessageHandler } from './boardDashboard/boardDashboardMessageHandler';
import { BoardDashboardProvider } from './boardDashboard/boardDashboardProvider';
import { MessageHandler } from './messageHandler';
import { ContainerStart } from './actions/containerStart';
import { ContainerStop } from './actions/containerStop';
import { ContainerOpenInBrowser } from './actions/containerOpenInBrowser';
import { AttachVsCode } from './actions/attachVsCode';
import { AttachShell } from './actions/attachShell';
import { BoardConnectionChecker } from './util/boardConnectionChecker';
import { ContainerDelete } from './actions/containerDelete';
import { OpenSerial } from './actions/openSerial';
import { DockerCommands } from './workloadPlacement/dockerCommands';
import { OpenBoardDashboard } from './actions/openBoardDashboard';
import { TargetStore } from './workloadPlacement/targetStore';

let topoCli: TopoCli;
let targetTreeDataProvider: TargetTreeDataProvider;

export async function activate(context: vscode.ExtensionContext) {
    topoCli = new TopoCli(context.extensionPath, context.environmentVariableCollection);
    const topoCliVersionChecker = new TopoCliVersionChecker(topoCli, context.extensionPath);

    if (!topoCliVersionChecker.checkTopoCliVersion()) {
        return;
    }

    const targetStore = TargetStore.getInstance(context);
    const deployer = new Deployer();
    const onBoardTopoConsoleOpener = new OnBoardTopoConsoleOpener(context, targetStore);
    const projectInit = new ProjectInit(context, topoCli, targetStore);
    const messageHandler = new MessageHandler(topoCli, deployer);
    const composeEditorProvider = new ComposeEditorProvider(context, messageHandler);
    const boardConnectionChecker = new BoardConnectionChecker();
    const containerOpenInBrowser = new ContainerOpenInBrowser(context);
    const dockerCommands = new DockerCommands();
    const attachVsCode = new AttachVsCode(context, dockerCommands);
    const attachShell = new AttachShell(context, dockerCommands, targetStore);
    const containersManager = new ContainersManager(boardConnectionChecker, dockerCommands, targetStore);
    targetTreeDataProvider = new TargetTreeDataProvider(context, containersManager, targetStore);
    const targetManager = new TargetManager(context, targetTreeDataProvider, targetStore, containersManager);
    const boardDashboardMessageHandler = new BoardDashboardMessageHandler(containersManager, targetStore, containerOpenInBrowser, attachVsCode, attachShell);
    const boardDashboardProvider = new BoardDashboardProvider(context, boardDashboardMessageHandler, containersManager);
    const containerStart = new ContainerStart(context, containersManager);
    const containerStop = new ContainerStop(context, containersManager);
    const containerDelete = new ContainerDelete(context, containersManager);
    const openBoardDashboard = new OpenBoardDashboard(context, boardDashboardProvider);
    const openSerial = new OpenSerial(context);

    await topoCli.activate();
    await onBoardTopoConsoleOpener.activate();
    await composeEditorProvider.activate();
    await projectInit.activate();
    await attachVsCode.activate();
    await attachShell.activate();
    await containerOpenInBrowser.activate();
    await targetManager.activate();
    await boardDashboardProvider.activate();
    await containersManager.activate();
    await targetTreeDataProvider.activate();
    await containerStart.activate();
    await containerStop.activate();
    await containerDelete.activate();
    await openBoardDashboard.activate();
    await openSerial.activate();
}

export async function deactivate(): Promise<void> {
    await topoCli.deactivate();
    await TargetStore.getInstance().deactivate();
}
