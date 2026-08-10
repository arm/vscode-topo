import * as vscode from 'vscode';
import * as commands from './commands';
import { TopoCli } from './services/topoCli';
import { TargetStatusBarItemView } from './views/targetStatusBarItemView';
import { TargetTreeView } from './views/targetTreeView';
import { ContainerLifecycle } from './actions/containerLifecycle';
import { OpenContainerShell } from './actions/openContainerShell';
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
import { TOPO_TASK_TYPE } from './manifest';
import { RefreshLoop } from './util/refreshLoop';
import { ProjectController } from './controllers/projectController';
import { TaskExecutor } from './util/taskExecutor';
import { ConnectViaSSH } from './actions/connectViaSSH';
import { OpenContainerInBrowser } from './actions/openContainerInBrowser';
import { OpenSettings } from './actions/openSettings';
import { Config } from './services/config';
import { Configure } from './actions/configure';
import { ProjectCloner } from './operations/projectCloner';
import { InstallSkill } from './actions/installSkill';
import { DeployTaskFactory } from './tasks/deployTaskFactory';
import { StopTaskFactory } from './tasks/stopTaskFactory';
import { TaskProvider } from './tasks/taskProvider';
import { TopoSkill } from './services/topoSkill';

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
    topoCli.activate();

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
    const topoSkill = new TopoSkill(context.extensionUri);
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

    const hostController = new HostController(hostModel, topoCli, topoSkill);
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

    const config = new Config();
    const taskExecutor = new TaskExecutor(topoCli);
    const deployTaskFactory = new DeployTaskFactory(topoCli);
    const stopTaskFactory = new StopTaskFactory(topoCli);
    const taskProvider = new TaskProvider([deployTaskFactory, stopTaskFactory]);
    const configure = new Configure(taskExecutor);
    const projectCloner = new ProjectCloner(taskExecutor);
    const projectClone = new ProjectClone(topoCli, targetModel, projectCloner);
    const deploy = new Deploy(targetModel, config, deployTaskFactory);
    const stop = new Stop(targetModel, stopTaskFactory);
    const openContainerShell = new OpenContainerShell(dockerCommands);
    const connectViaSSH = new ConnectViaSSH(targetModel);
    const openContainerInBrowser = new OpenContainerInBrowser();
    const containerLifecycle = new ContainerLifecycle(
        dockerCommands,
        projectController,
    );
    const fixIssue = new FixIssue(taskExecutor, targetModel, targetController);
    const openSettings = new OpenSettings();
    const installSkill = new InstallSkill(topoSkill, hostController);
    const protocolHandler = new ProtocolHandler(projectCloner);

    context.subscriptions.push(
        vscode.tasks.registerTaskProvider(TOPO_TASK_TYPE, taskProvider),
        commands.register({
            hostController,
            projectController,
            targetController,
            configure,
            deploy,
            stop,
            openContainerShell,
            connectViaSSH,
            openContainerInBrowser,
            containerLifecycle,
            fixIssue,
            projectClone,
            openSettings,
            installSkill,
        }),
        vscode.window.registerUriHandler(protocolHandler),
    );

    targetController.updateTargetsFromStore();
    void projectController.refreshProjects();
    selectedTargetRefreshLoop.start();
}
