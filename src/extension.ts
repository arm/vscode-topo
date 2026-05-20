import * as vscode from 'vscode';
import { TopoCli } from './topoCli';
import { ProjectInit } from './actions/projectInit';
import { TopoCliVersionChecker } from './topoCliVersionChecker';
import { TargetManager } from './targetTreeView/targetManager';
import { TargetTreeDataProvider } from './targetTreeView/targetTreeDataProvider';
import { ContainersManager } from './target/containersManager';
import { ContainerStart } from './actions/containerStart';
import { ContainerStop } from './actions/containerStop';
import { ContainerOpenInBrowser } from './actions/containerOpenInBrowser';
import { AttachVsCode } from './actions/attachVsCode';
import { AttachShell } from './actions/attachShell';
import { ContainerDelete } from './actions/containerDelete';
import { DockerCommands } from './target/dockerCommands';
import { TargetStore } from './target/targetStore';
import { ProjectClone } from './projectClone';
import { Deploy } from './actions/deploy';
import { Stop } from './actions/stop';
import { HostHealth } from './actions/hostHealth';
import { ProtocolHandler } from './protocolHandler';
import { SetupKeys } from './actions/setupKeys';
import { TargetDescriptionStore } from './target/targetDescriptionStore';
import { InstallDependency } from './actions/installDependency';
import { HostTreeView } from './hostTreeView/hostTreeView';
import { logger } from './util/logger';
import { TargetHealth } from './actions/targetHealth';
import { ShowOutput } from './actions/showOutput';
import { SelectTarget } from './actions/selectTarget';
import { RemoveTarget } from './actions/removeTarget';
import { HostModel } from './models/hostModel';
import { HostController } from './controllers/hostController';
import { PACKAGE_NAME } from './manifest';

function command(id: string): string {
    return `${PACKAGE_NAME}.${id}`;
}

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

    const hostModel = new HostModel();

    const hostHealthController = new HostController(hostModel, topoCli);

    context.subscriptions.push(
        vscode.commands.registerCommand(command('refreshHostHealth'), () =>
            hostHealthController.refreshHealth(),
        ),
    );

    const hostTreeView = new HostTreeView(hostModel);
    context.subscriptions.push(hostTreeView);

    hostHealthController.activate();

    hostTreeView.activate();

    const targetStore = new TargetStore(context);
    const targetDescriptionStore = new TargetDescriptionStore(topoCli);
    const projectInit = new ProjectInit(topoCli);
    context.subscriptions.push(projectInit);
    const projectClone = new ProjectClone(context, topoCli, targetStore);
    const deploy = new Deploy(context, targetStore);
    const stop = new Stop(context, targetStore);
    const showOutput = new ShowOutput();
    context.subscriptions.push(showOutput);
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
    const containerStart = new ContainerStart(context, dockerCommands);
    const containerStop = new ContainerStop(context, dockerCommands);
    const containerDelete = new ContainerDelete(context, dockerCommands);
    const hostHealth = new HostHealth(context, topoCli);
    const targetHealth = new TargetHealth(containersManager);
    const selectTarget = new SelectTarget(targetStore);
    const removeTarget = new RemoveTarget(targetStore);
    context.subscriptions.push(targetHealth, selectTarget, removeTarget);
    const protocolHandler = new ProtocolHandler(projectClone);
    const installDependency = new InstallDependency(
        targetStore,
        containersManager,
    );
    context.subscriptions.push(installDependency);
    context.subscriptions.push(logger);

    protocolHandler.activate(context);
    const setupKeys = new SetupKeys(context, targetStore);
    context.subscriptions.push(targetStore);
    await topoCli.activate();
    context.subscriptions.push(topoCli);
    projectInit.activate();
    await projectClone.activate();
    deploy.activate();
    stop.activate();
    await containerOpenInBrowser.activate();
    await attachVsCode.activate();
    attachShell.activate();
    await containersManager.activate();
    await targetTreeDataProvider.activate();
    targetManager.activate();
    containerStart.activate();
    await containerStop.activate();
    containerDelete.activate();
    hostHealth.activate();
    targetHealth.activate();
    selectTarget.activate();
    removeTarget.activate();
    setupKeys.activate();
    showOutput.activate();
    await installDependency.activate();
}
