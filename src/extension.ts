import * as vscode from 'vscode';
import * as commands from './commands';
import { TopoCli } from './topoCli';
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
import { ProtocolHandler } from './protocolHandler';
import { SetupKeys } from './actions/setupKeys';
import { TargetDescriptionStore } from './target/targetDescriptionStore';
import { FixIssue } from './actions/fixIssue';
import { HostTreeView } from './views/hostTreeView';
import { logger } from './util/logger';
import { TargetHealth } from './actions/targetHealth';
import { HostModel } from './models/hostModel';
import { HostController } from './controllers/hostController';
import { TransientDocumentProvider } from './util/transientDocumentProvider';
import { TargetController } from './controllers/targetController';
import { ProjectController } from './controllers/projectController';

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

    const hostHealthDocProvider = new TransientDocumentProvider('host-health');
    const dockerCommands = new DockerCommands();
    const targetStore = new TargetStore(context);
    const containersManager = new ContainersManager(
        topoCli,
        dockerCommands,
        targetStore,
    );
    await containersManager.activate();
    const targetDescriptionStore = new TargetDescriptionStore(topoCli);
    context.subscriptions.push(
        targetStore,
        containersManager,
        hostHealthDocProvider,
    );

    const hostModel = new HostModel();

    const hostTreeView = new HostTreeView(hostModel);
    const targetTreeView = new TargetTreeView(
        containersManager,
        targetStore,
        targetDescriptionStore,
    );
    const targetStatusBarItemView = new TargetStatusBarItemView(
        targetStore,
        containersManager,
    );
    context.subscriptions.push(
        hostTreeView,
        targetTreeView,
        targetStatusBarItemView,
    );

    const hostHealthController = new HostController(
        hostModel,
        topoCli,
        hostHealthDocProvider,
    );
    const targetsController = new TargetController(targetStore);
    const projectController = new ProjectController(topoCli, targetStore);

    const disposeCommands = commands.register(
        hostHealthController,
        targetsController,
        projectController,
    );
    context.subscriptions.push(disposeCommands);

    const projectClone = new ProjectClone(context, topoCli, targetStore);
    const containerOpenInBrowser = new ContainerOpenInBrowser(context);
    const attachVsCode = new AttachVsCode(context, dockerCommands);
    const attachShell = new AttachShell(context, dockerCommands);
    const setupKeys = new SetupKeys(context, targetStore);
    const containerStart = new ContainerStart(context, dockerCommands);
    const containerStop = new ContainerStop(context, dockerCommands);
    const containerDelete = new ContainerDelete(context, dockerCommands);
    const targetHealth = new TargetHealth(containersManager);
    context.subscriptions.push(targetHealth);
    const protocolHandler = new ProtocolHandler(projectClone);
    const fixIssue = new FixIssue(targetStore, containersManager);
    context.subscriptions.push(fixIssue);
    context.subscriptions.push(logger);

    protocolHandler.activate(context);
    topoCli.activate();
    projectClone.activate();
    containerOpenInBrowser.activate();
    attachVsCode.activate();
    attachShell.activate();
    containerStart.activate();
    containerStop.activate();
    containerDelete.activate();
    targetHealth.activate();
    setupKeys.activate();
    fixIssue.activate();
}
