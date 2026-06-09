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
import { Deploy } from './actions/deploy';
import { Stop } from './actions/stop';
import { ProtocolHandler } from './protocolHandler';
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
import { ProjectClone } from './actions/projectClone';
import { RefreshLoop } from './util/refreshLoop';

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
    context.subscriptions.push(
        targetStore,
        hostHealthDocProvider,
        targetHealthDocProvider,
    );

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
    const targetStatusBarItemView = new TargetStatusBarItemView(targetModel);
    context.subscriptions.push(
        hostTreeView,
        targetTreeView,
        targetStatusBarItemView,
    );

    const hostController = new HostController(hostModel, topoCli);
    const hostHealth = new HostHealth(topoCli, hostHealthDocProvider);
    const targetController = new TargetController(
        targetModel,
        targetStore,
        topoCli,
        dockerCommands,
    );

    const selectedTargetRefreshLoop = new RefreshLoop(async () => {
        if (!targetController.isRefreshingSelectedTargetData()) {
            await targetController.refreshSelectedTargetDataCommandHandler();
        }
    }, 3000);

    context.subscriptions.push(
        targetController,
        selectedTargetRefreshLoop,
        targetStore.onExternalTargetsChanged(() =>
            targetController.updateFromTargetStore(),
        ),
        targetModel.onSelectedChanged(() => {
            targetController.refreshSelectedTargetDataCommandHandler();
        }),
    );

    const projectInit = new ProjectInit(topoCli);
    const projectClone = new ProjectClone(topoCli, targetModel);
    const deploy = new Deploy(topoCli, targetModel);
    const stop = new Stop(topoCli, targetModel);
    const containerOpenInBrowser = new ContainerOpenInBrowser();
    const attachVsCode = new AttachVsCode(dockerCommands);
    const attachShell = new AttachShell(dockerCommands);
    const containerStart = new ContainerStart(dockerCommands);
    const containerStop = new ContainerStop(dockerCommands);
    const containerDelete = new ContainerDelete(dockerCommands);
    const targetHealth = new TargetHealth(topoCli, targetHealthDocProvider);
    const fixIssue = new FixIssue(topoCli, targetModel);
    const protocolHandler = new ProtocolHandler(topoCli);

    context.subscriptions.push(
        commands.register({
            hostController,
            hostHealth,
            targetController,
            projectInit,
            deploy,
            stop,
            containerOpenInBrowser,
            attachVsCode,
            attachShell,
            containerStart,
            containerStop,
            containerDelete,
            targetHealth,
            fixIssue,
            projectClone,
        }),
        logger,
        vscode.window.registerUriHandler(protocolHandler),
    );

    targetController.activate();
    topoCli.activate();
    selectedTargetRefreshLoop.start();
}
