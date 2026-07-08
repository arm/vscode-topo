import * as vscode from 'vscode';
import * as commands from './commands';
import { TopoCli } from './services/topoCli';
import { ProjectInit } from './actions/projectInit';
import { TargetStatusBarItemView } from './views/targetStatusBarItemView';
import { TargetTreeView } from './views/targetTreeView';
import { ContainerStart } from './actions/containerStart';
import { ContainerStop } from './actions/containerStop';
import { OpenContainerShell } from './actions/openContainerShell';
import { ContainerDelete } from './actions/containerDelete';
import { DockerCommands } from './services/dockerCommands';
import { TargetStore } from './services/targetStore';
import { Deploy } from './actions/deploy';
import { Stop } from './actions/stop';
import { ProtocolHandler } from './protocolHandler';
import { FixIssue } from './actions/fixIssue';
import { HostTreeView } from './views/hostTreeView';
import { ProjectsTreeView } from './views/projectsTreeView';
import { logger } from './util/logger';
import { HostModel } from './models/hostModel';
import { HostController } from './controllers/hostController';
import { TargetController } from './controllers/targetController';
import { TargetModel } from './models/targetModel';
import { ProjectModel } from './models/projectModel';
import { ProjectClone } from './actions/projectClone';
import { showAndLogError } from './util/showAndLog';
import { topo } from '../package.json';
import { RefreshLoop } from './util/refreshLoop';
import { ProjectController } from './controllers/projectController';
import { TaskExecutor } from './util/taskExecutor';
import { ConnectViaSSH } from './actions/connectViaSSH';

const SELECTED_TARGET_REFRESH_INTERVAL_MS = 60_000;

export async function activate(
    context: vscode.ExtensionContext,
): Promise<void> {
    context.subscriptions.push(logger);

    const topoCli = new TopoCli(
        context.extensionPath,
        context.environmentVariableCollection,
    );
    context.subscriptions.push(topoCli);

    try {
        await topoCli.assertVersion(topo.version);
    } catch (err) {
        showAndLogError(`Topo CLI version check failed`, err);
        return;
    }

    const dockerCommands = new DockerCommands();
    const targetStore = new TargetStore(context);
    context.subscriptions.push(targetStore);

    const targetModel = new TargetModel();
    const hostModel = new HostModel();
    const projectModel = new ProjectModel();
    context.subscriptions.push(targetModel, hostModel, projectModel);

    const hostTreeView = new HostTreeView(hostModel);
    const projectsTreeView = new ProjectsTreeView(projectModel);
    const targetTreeView = new TargetTreeView(targetModel);
    const targetStatusBarItemView = new TargetStatusBarItemView(targetModel);
    context.subscriptions.push(
        hostTreeView,
        projectsTreeView,
        targetTreeView,
        targetStatusBarItemView,
    );

    const hostController = new HostController(hostModel, topoCli);
    const projectController = new ProjectController(
        projectModel,
        topoCli,
        targetModel,
    );
    const targetController = new TargetController(
        targetModel,
        targetStore,
        topoCli,
    );

    const selectedTargetRefreshLoop = new RefreshLoop(async () => {
        if (!targetController.isRefreshingSelectedTargetHealth()) {
            await targetController.refreshSelectedTargetHealthCommandHandler();
        }
    }, SELECTED_TARGET_REFRESH_INTERVAL_MS);

    context.subscriptions.push(
        projectController,
        targetController,
        selectedTargetRefreshLoop,
        targetStore.onExternalTargetsChanged(() =>
            targetController.updateTargetsFromStore(),
        ),
        targetModel.onSelectedChanged(() => {
            void targetController.loadSelectedTargetDescriptionCommandHandler();
            void targetController.refreshSelectedTargetHealthCommandHandler();
        }),
    );

    const projectInit = new ProjectInit(topoCli);
    const taskExecutor = new TaskExecutor(topoCli);
    const projectClone = new ProjectClone(topoCli, targetModel, taskExecutor);
    const deploy = new Deploy(taskExecutor, targetModel, projectController);
    const stop = new Stop(taskExecutor, targetModel, projectController);
    const openContainerShell = new OpenContainerShell(dockerCommands);
    const connectViaSSH = new ConnectViaSSH(targetModel);
    const containerStart = new ContainerStart(
        dockerCommands,
        projectController,
    );
    const containerStop = new ContainerStop(dockerCommands, projectController);
    const containerDelete = new ContainerDelete(
        dockerCommands,
        projectController,
    );
    const fixIssue = new FixIssue(taskExecutor, targetModel, targetController);
    const protocolHandler = new ProtocolHandler(taskExecutor);

    context.subscriptions.push(
        commands.register({
            hostController,
            projectController,
            targetController,
            projectInit,
            deploy,
            stop,
            openContainerShell,
            connectViaSSH,
            containerStart,
            containerStop,
            containerDelete,
            fixIssue,
            projectClone,
        }),
        vscode.window.registerUriHandler(protocolHandler),
    );

    targetController.updateTargetsFromStore();
    void projectController.refreshProjects();
    topoCli.activate();
    selectedTargetRefreshLoop.start();
}
