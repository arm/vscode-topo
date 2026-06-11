import * as vscode from 'vscode';
import * as commands from './commands';
import { TopoCli } from './topoCli';
import { ProjectInit } from './actions/projectInit';
import { TargetStatusBarItemView } from './views/targetStatusBarItemView';
import { TargetTreeView } from './views/targetTreeView';
import { ContainerStart } from './actions/containerStart';
import { ContainerStop } from './actions/containerStop';
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
import { HostModel } from './models/hostModel';
import { HostController } from './controllers/hostController';
import { TargetController } from './controllers/targetController';
import { TargetModel } from './models/targetModel';
import { ProjectClone } from './actions/projectClone';
import { showAndLogError } from './util/showAndLogError';
import { topo } from '../package.json';
import { RefreshLoop } from './util/refreshLoop';

export async function activate(
    context: vscode.ExtensionContext,
): Promise<void> {
    const topoCli = new TopoCli(
        context.extensionPath,
        context.environmentVariableCollection,
    );
    context.subscriptions.push(topoCli);

    try {
        topoCli.verifyVersion(topo.version);
    } catch (err) {
        showAndLogError(`Topo CLI version check failed`, err);
        return;
    }

    const dockerCommands = new DockerCommands();
    const targetStore = new TargetStore(context);
    const targetDescriptionStore = new TargetDescriptionStore(topoCli);
    context.subscriptions.push(targetStore);

    const targetModel = new TargetModel();
    const hostModel = new HostModel();

    const hostTreeView = new HostTreeView(hostModel);
    const targetTreeView = new TargetTreeView(
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
            targetController.updateTargetsFromStore(),
        ),
        targetModel.onSelectedChanged(() => {
            targetController.refreshSelectedTargetDataCommandHandler();
        }),
    );

    const projectInit = new ProjectInit(topoCli);
    const projectClone = new ProjectClone(topoCli, targetModel);
    const deploy = new Deploy(topoCli, targetModel);
    const stop = new Stop(topoCli, targetModel);
    const attachShell = new AttachShell(dockerCommands);
    const containerStart = new ContainerStart(dockerCommands);
    const containerStop = new ContainerStop(dockerCommands);
    const containerDelete = new ContainerDelete(dockerCommands);
    const fixIssue = new FixIssue(topoCli, targetModel);
    const protocolHandler = new ProtocolHandler(topoCli);

    context.subscriptions.push(
        commands.register({
            hostController,
            targetController,
            projectInit,
            deploy,
            stop,
            attachShell,
            containerStart,
            containerStop,
            containerDelete,
            fixIssue,
            projectClone,
        }),
        logger,
        vscode.window.registerUriHandler(protocolHandler),
    );

    targetController.updateTargetsFromStore();
    topoCli.activate();
    selectedTargetRefreshLoop.start();
}
