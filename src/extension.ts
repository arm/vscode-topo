import * as vscode from 'vscode';
import { ComposeEditorProvider } from './composeEditorProvider';
import { TopoCli } from './topoCli';
import { OnTargetTopoConsoleOpener } from './onTargetTopoConsoleOpener';
import { ProjectInit } from './projectInit';
import { TopoCliVersionChecker } from './topoCliVersionChecker';
import { TargetManager } from './workloadPlacement/targetManager';
import { TargetTreeDataProvider } from './workloadPlacement/targetTreeDataProvider';
import { ContainersManager } from './workloadPlacement/containersManager';
import { Deployer } from './deployer';
import { TargetDashboardMessageHandler } from './targetDashboard/targetDashboardMessageHandler';
import { TargetDashboardProvider } from './targetDashboard/targetDashboardProvider';
import { ComposeEditorMessageHandler } from './composeEditorMessageHandler';
import { ContainerStart } from './actions/containerStart';
import { ContainerStop } from './actions/containerStop';
import { ContainerOpenInBrowser } from './actions/containerOpenInBrowser';
import { AttachVsCode } from './actions/attachVsCode';
import { AttachShell } from './actions/attachShell';
import { ContainerDelete } from './actions/containerDelete';
import { OpenSerial } from './actions/openSerial';
import { DockerCommands } from './workloadPlacement/dockerCommands';
import { OpenTargetDashboard } from './actions/openTargetDashboard';
import { TargetStore } from './workloadPlacement/targetStore';
import { ProjectClone } from './projectClone';
import { Deploy } from './actions/deploy';
import { HostHealth } from './actions/hostHealth';

export async function activate(
    context: vscode.ExtensionContext,
): Promise<void> {
    const topoCli = new TopoCli(
        context.extensionPath,
        context.environmentVariableCollection,
    );
    const topoCliVersionChecker = new TopoCliVersionChecker(
        topoCli,
        context.extensionPath,
    );

    if (!topoCliVersionChecker.checkTopoCliVersion()) {
        return;
    }

    const targetStore = TargetStore.getInstance(context);
    const deployer = new Deployer(topoCli, targetStore);
    const onTargetTopoConsoleOpener = new OnTargetTopoConsoleOpener(
        context,
        targetStore,
    );
    const projectInit = new ProjectInit(context, topoCli);
    const projectClone = new ProjectClone(context, topoCli);
    const deploy = new Deploy(context, deployer);
    const composeEditorMessageHandler = new ComposeEditorMessageHandler(
        topoCli,
        deploy,
        targetStore,
    );
    const composeEditorProvider = new ComposeEditorProvider(
        context,
        composeEditorMessageHandler,
    );
    const containerOpenInBrowser = new ContainerOpenInBrowser(context);
    const dockerCommands = new DockerCommands();
    const attachVsCode = new AttachVsCode(context, dockerCommands);
    const attachShell = new AttachShell(context, dockerCommands, targetStore);
    const containersManager = new ContainersManager(
        topoCli,
        dockerCommands,
        targetStore,
    );
    context.subscriptions.push(containersManager);
    const targetTreeDataProvider = new TargetTreeDataProvider(
        context,
        containersManager,
        targetStore,
    );
    const targetManager = new TargetManager(
        context,
        targetTreeDataProvider,
        targetStore,
        containersManager,
        topoCli,
    );
    const targetDashboardMessageHandler = new TargetDashboardMessageHandler(
        containersManager,
        targetStore,
        containerOpenInBrowser,
        attachVsCode,
        attachShell,
    );
    const targetDashboardProvider = new TargetDashboardProvider(
        context,
        targetDashboardMessageHandler,
        containersManager,
    );
    const containerStart = new ContainerStart(context, containersManager);
    const containerStop = new ContainerStop(context, containersManager);
    const containerDelete = new ContainerDelete(context, containersManager);
    const openTargetDashboard = new OpenTargetDashboard(
        context,
        targetDashboardProvider,
    );
    const openSerial = new OpenSerial(context);
    const health = new HostHealth(context, topoCli);
    context.subscriptions.push(targetStore);
    await topoCli.activate();
    context.subscriptions.push(topoCli);
    await onTargetTopoConsoleOpener.activate();
    await projectInit.activate();
    await projectClone.activate();
    deploy.activate();
    await composeEditorProvider.activate();
    await containerOpenInBrowser.activate();
    await attachVsCode.activate();
    attachShell.activate();
    await containersManager.activate();
    await targetTreeDataProvider.activate();
    await targetManager.activate();
    await targetDashboardProvider.activate();
    containerStart.activate();
    await containerStop.activate();
    containerDelete.activate();
    openTargetDashboard.activate();
    openSerial.activate();
    health.activate();
    health.checkHostDependencyHealth();
}
