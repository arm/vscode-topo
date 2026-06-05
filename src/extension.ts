import * as vscode from 'vscode';
import * as commands from './commands';
import { TopoCli } from './topoCli';
import { ProjectInit } from './actions/projectInit';
import { TopoCliVersionChecker } from './topoCliVersionChecker';
import { TargetStatusBarItemView } from './views/targetStatusBarItemView';
import { TargetTreeView } from './views/targetTreeView';
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
import { RefreshLoop } from './util/refreshLoop';
import { SelectedTargetModel } from './models/selectedTargetModel';
import { SelectedTargetController } from './controllers/selectedTargetController';

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
    const selectedTargetModel = new SelectedTargetModel();

    const hostTreeView = new HostTreeView(hostModel);
    const targetTreeView = new TargetTreeView(
        selectedTargetModel,
        targetModel,
        targetDescriptionStore,
    );
    const targetStatusBarItemView = new TargetStatusBarItemView(
        targetModel,
        selectedTargetModel,
    );
    context.subscriptions.push(
        hostTreeView,
        targetTreeView,
        targetStatusBarItemView,
    );

    const hostController = new HostController(hostModel, topoCli);
    const hostHealth = new HostHealth(topoCli, hostHealthDocProvider);
    const targetController = new TargetController(targetModel, targetStore);
    const selectedTargetController = new SelectedTargetController(
        selectedTargetModel,
        targetModel,
        topoCli,
        dockerCommands,
    );

    const selectedTargetRefreshLoop = new RefreshLoop(async () => {
        if (!selectedTargetController.isRefreshing()) {
            await selectedTargetController.refreshCommandHandler();
        }
    }, 3000);

    context.subscriptions.push(
        selectedTargetController,
        selectedTargetRefreshLoop,
        targetModel.onSelectedChanged(() => {
            selectedTargetModel.clear();
            selectedTargetController.refreshCommandHandler();
        }),
        targetStore.onExternalTargetsChanged(() =>
            targetController.updateFromStore(),
        ),
    );

    const projectInit = new ProjectInit(topoCli);
    const projectClone = new ProjectClone(context, topoCli, targetModel);
    const deploy = new Deploy(topoCli, targetModel);
    const stop = new Stop(topoCli, targetModel);
    const containerOpenInBrowser = new ContainerOpenInBrowser();
    const attachVsCode = new AttachVsCode(dockerCommands);
    const attachShell = new AttachShell(dockerCommands);
    const setupKeys = new SetupKeys(topoCli, targetModel);
    const containerStart = new ContainerStart(dockerCommands);
    const containerStop = new ContainerStop(dockerCommands);
    const containerDelete = new ContainerDelete(dockerCommands);
    const targetHealth = new TargetHealth(topoCli, targetHealthDocProvider);
    const fixIssue = new FixIssue(topoCli, targetModel);
    const protocolHandler = new ProtocolHandler(projectClone);

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
            setupKeys,
            containerStart,
            containerStop,
            containerDelete,
            targetHealth,
            fixIssue,
        }),
        logger,
        vscode.window.registerUriHandler(protocolHandler),
    );

    topoCli.activate();
    projectClone.activate();
    selectedTargetRefreshLoop.start();
}
