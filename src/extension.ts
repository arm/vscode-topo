import * as vscode from 'vscode';
import { TopoCli } from './topoCli';
import { ProjectInit } from './projectInit';
import { TopoCliVersionChecker } from './topoCliVersionChecker';
import { TargetManager } from './workloadPlacement/targetManager';
import { TargetTreeDataProvider } from './workloadPlacement/targetTreeDataProvider';
import { ContainersManager } from './workloadPlacement/containersManager';
import { ContainerStart } from './actions/containerStart';
import { ContainerStop } from './actions/containerStop';
import { ContainerOpenInBrowser } from './actions/containerOpenInBrowser';
import { AttachVsCode } from './actions/attachVsCode';
import { AttachShell } from './actions/attachShell';
import { ContainerDelete } from './actions/containerDelete';
import { DockerCommands } from './workloadPlacement/dockerCommands';
import { TargetStore } from './workloadPlacement/targetStore';
import { ProjectClone } from './projectClone';
import { Deploy } from './actions/deploy';
import { HostHealth } from './actions/hostHealth';
import { ProtocolHandler } from './protocolHandler';
import { SetupKeys } from './actions/setupKeys';
import { TargetDescriptionStore } from './workloadPlacement/targetDescriptionStore';

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

    const targetStore = new TargetStore(context);
    const targetDescriptionStore = new TargetDescriptionStore(topoCli);
    const projectInit = new ProjectInit(context, topoCli);
    const projectClone = new ProjectClone(context, topoCli, targetStore);
    const deploy = new Deploy(context, targetStore);
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
        targetDescriptionStore,
    );
    const targetManager = new TargetManager(
        context,
        targetTreeDataProvider,
        targetStore,
        containersManager,
    );
    const containerStart = new ContainerStart(context, containersManager);
    const containerStop = new ContainerStop(context, containersManager);
    const containerDelete = new ContainerDelete(context, containersManager);
    const health = new HostHealth(context, topoCli);
    const protocolHandler = new ProtocolHandler(projectClone);

    protocolHandler.activate(context);
    const setupKeys = new SetupKeys(context, targetStore);
    context.subscriptions.push(targetStore);
    await topoCli.activate();
    context.subscriptions.push(topoCli);
    await projectInit.activate();
    await projectClone.activate();
    deploy.activate();
    await containerOpenInBrowser.activate();
    await attachVsCode.activate();
    attachShell.activate();
    await containersManager.activate();
    await targetTreeDataProvider.activate();
    await targetManager.activate();
    containerStart.activate();
    await containerStop.activate();
    containerDelete.activate();
    health.activate();
    setupKeys.activate();
    health.checkHostDependencyHealth();
}
