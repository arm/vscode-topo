import * as vscode from 'vscode';
import * as commands from './commands';
import { TopoCli } from './topoCli';
import { ProjectInit } from './actions/projectInit';
import { TopoCliVersionChecker } from './topoCliVersionChecker';
import { TargetStatusBarItemView } from './views/targetStatusBarItemView';
import { TargetTreeView } from './views/targetTreeView';
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
import { ProtocolHandler } from './protocolHandler';
import { SetupKeys } from './actions/setupKeys';
import { TargetDescriptionStore } from './target/targetDescriptionStore';
import { FixIssue } from './actions/fixIssue';
import { HostTreeView } from './views/hostTreeView';
import { logger } from './util/logger';
import { TargetHealth } from './actions/targetHealth';
import { HostHealth } from './actions/hostHealth';
import { HostModel } from './models/hostModel';
import { HostController } from './controllers/hostController';
import { TransientDocumentProvider } from './util/transientDocumentProvider';
import { TargetController } from './controllers/targetController';
import { TargetModel } from './models/targetModel';

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

    const targetHealthDocProvider = new TransientDocumentProvider(
        'target-health',
    );
    const hostHealthDocProvider = new TransientDocumentProvider('host-health');
    const dockerCommands = new DockerCommands();
    const targetStore = new TargetStore(context);
    const targetDescriptionStore = new TargetDescriptionStore(topoCli);
    context.subscriptions.push(targetStore, hostHealthDocProvider);

    const targetModel = new TargetModel();
    const hostModel = new HostModel();

    const containersManager = new ContainersManager(
        topoCli,
        dockerCommands,
        targetModel,
    );
    await containersManager.activate();
    context.subscriptions.push(containersManager);

    const hostTreeView = new HostTreeView(hostModel);
    const targetTreeView = new TargetTreeView(
        containersManager,
        targetModel,
        targetDescriptionStore,
    );
    const targetStatusBarItemView = new TargetStatusBarItemView(
        targetModel,
        containersManager,
    );
    context.subscriptions.push(
        hostTreeView,
        targetTreeView,
        targetStatusBarItemView,
    );

    const hostHealthController = new HostController(hostModel, topoCli);
    const targetsController = new TargetController(targetModel, targetStore);
    context.subscriptions.push(
        targetStore.onChanged(() => targetsController.updateFromStore()),
    );

    const disposeCommands = commands.register(
        hostHealthController,
        targetsController,
    );
    context.subscriptions.push(disposeCommands);

    const projectInit = new ProjectInit(topoCli);
    context.subscriptions.push(projectInit);
    const projectClone = new ProjectClone(context, topoCli, targetModel);
    const deploy = new Deploy(context, topoCli, targetModel);
    const stop = new Stop(context, topoCli, targetModel);
    const containerOpenInBrowser = new ContainerOpenInBrowser(context);
    const attachVsCode = new AttachVsCode(context, dockerCommands);
    const attachShell = new AttachShell(context, dockerCommands);
    const setupKeys = new SetupKeys(context, topoCli, targetModel);
    const containerStart = new ContainerStart(context, dockerCommands);
    const containerStop = new ContainerStop(context, dockerCommands);
    const containerDelete = new ContainerDelete(context, dockerCommands);
    const targetHealth = new TargetHealth(topoCli, targetHealthDocProvider);
    const hostHealth = new HostHealth(topoCli, hostHealthDocProvider);
    context.subscriptions.push(targetHealth, hostHealth);
    const protocolHandler = new ProtocolHandler(projectClone);
    const fixIssue = new FixIssue(topoCli, targetModel);
    context.subscriptions.push(fixIssue);
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
    containerStart.activate();
    containerStop.activate();
    containerDelete.activate();
    targetHealth.activate();
    hostHealth.activate();
    setupKeys.activate();
}
