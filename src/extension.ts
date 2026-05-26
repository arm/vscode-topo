import * as vscode from 'vscode';
import * as commands from './commands';
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
import { HostTreeView } from './views/hostTreeView';
import { logger } from './util/logger';
import { TargetHealth } from './actions/targetHealth';
import { ShowOutput } from './actions/showOutput';
import { HostModel } from './models/hostModel';
import { HostController } from './controllers/hostController';
import { TargetController } from './controllers/targetController';

export async function activate(
    context: vscode.ExtensionContext,
): Promise<void> {
    const topoCli = new TopoCli(
        context.extensionPath,
        context.environmentVariableCollection,
    );
    context.subscriptions.push(topoCli);
    const topoCliVersionChecker = new TopoCliVersionChecker(
        topoCli,
        context.extensionPath,
    );

    if (!topoCliVersionChecker.checkTopoCliVersion()) {
        return;
    }

    const targetStore = new TargetStore(context);
    context.subscriptions.push(targetStore);

    const hostModel = new HostModel();

    const hostTreeView = new HostTreeView(hostModel);
    context.subscriptions.push(hostTreeView);

    const hostHealthController = new HostController(hostModel, topoCli);
    const targetsController = new TargetController(targetStore);

    const disposeCommands = commands.register(
        hostHealthController,
        targetsController,
    );
    context.subscriptions.push(disposeCommands);

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
    const setupKeys = new SetupKeys(context, targetStore);
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
    context.subscriptions.push(targetHealth);
    const protocolHandler = new ProtocolHandler(projectClone);
    const installDependency = new InstallDependency(
        targetStore,
        containersManager,
    );
    context.subscriptions.push(installDependency);
    context.subscriptions.push(logger);

    protocolHandler.activate(context);
    topoCli.activate();
    projectInit.activate();
    projectClone.activate();
    deploy.activate();
    stop.activate();
    containerOpenInBrowser.activate();
    attachVsCode.activate();
    attachShell.activate();
    await containersManager.activate();
    targetTreeDataProvider.activate();
    targetManager.activate();
    containerStart.activate();
    containerStop.activate();
    containerDelete.activate();
    hostHealth.activate();
    targetHealth.activate();
    setupKeys.activate();
    showOutput.activate();
    await installDependency.activate();
}
