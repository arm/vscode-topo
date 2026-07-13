import * as vscode from 'vscode';
import { ProjectModel } from '../models/projectModel';
import { errored, Loadable, loaded, loading } from '../util/loadable';
import { findTopLevelComposeProjects, ProjectMetadata } from '../util/project';
import { DisposableCollector } from '../util/disposableCollector';
import { COMPOSE_FILE_GLOB } from '../util/composeFile';
import { LatestAbortableWork } from '../util/latestAbortableWork';
import { TopoCli } from '../services/topoCli';
import { PsEntry } from '../services/topoCliSchema';
import { ContainerItem } from '../util/types';
import { TargetModel } from '../models/targetModel';
import { showAndLogError } from '../util/showAndLog';

function createContainerItem(item: PsEntry, target: string): ContainerItem {
    return {
        ...item,
        target,
    };
}

async function loadContainers(
    topoCli: TopoCli,
    target: string,
    project: ProjectMetadata,
): Promise<Loadable<ContainerItem[]>> {
    const psResults = await Promise.allSettled(
        project.composeFileUris.map(({ fsPath }) => topoCli.ps(target, fsPath)),
    );
    const containersById = new Map<string, ContainerItem>();
    let successfulRequests = 0;
    let firstError: unknown;

    for (const psResult of psResults) {
        if (psResult.status === 'rejected') {
            firstError ??= psResult.reason;
            continue;
        }

        successfulRequests += 1;
        for (const container of psResult.value.containers) {
            const containerItem = createContainerItem(container, target);
            containersById.set(containerItem.id, containerItem);
        }
    }

    return successfulRequests === 0
        ? errored(firstError)
        : loaded([...containersById.values()]);
}

export class ProjectController implements vscode.Disposable {
    private readonly disposables = new DisposableCollector();
    private readonly projectRefresh = new LatestAbortableWork();
    private readonly projectContainersRefresh = new LatestAbortableWork();

    constructor(
        private readonly model: ProjectModel,
        private readonly topoCli: TopoCli,
        private readonly targetModel: TargetModel,
    ) {
        const composeFileWatcher =
            vscode.workspace.createFileSystemWatcher(COMPOSE_FILE_GLOB);
        const refresh = async (): Promise<void> => {
            await this.refreshProjects();
        };

        this.disposables.collect(
            this.projectRefresh,
            this.projectContainersRefresh,
            composeFileWatcher,
            composeFileWatcher.onDidCreate(refresh),
            composeFileWatcher.onDidChange(refresh),
            composeFileWatcher.onDidDelete(refresh),
            vscode.workspace.onDidChangeWorkspaceFolders(refresh),
            this.targetModel.onSelectedChanged(() => {
                this.clearProjectContainers();
            }),
            this.targetModel.onHealthChanged(() => {
                void this.refreshProjectContainersCommandHandler();
            }),
        );
    }

    public async refreshProjects(): Promise<void> {
        this.model.setProjects(loading(this.model.projects));

        try {
            const projects = await this.projectRefresh.run(() =>
                findTopLevelComposeProjects(
                    vscode.workspace.workspaceFolders ?? [],
                ),
            );
            if (projects === undefined) {
                return;
            }

            this.model.setProjects(loaded(projects));
            await this.refreshProjectContainersCommandHandler();
        } catch (error) {
            this.model.setProjects(errored(error));
            this.clearProjectContainers();
        }
    }

    public async refreshProjectContainersCommandHandler(): Promise<void> {
        const target = this.targetModel.selected;
        const projects = this.model.projects;
        if (!target || projects.status !== 'loaded') {
            return this.clearProjectContainers();
        }

        const health = this.targetModel.selectedTargetHealth;
        if (health.loading) {
            return;
        } else if (
            health.status !== 'loaded' ||
            health.data.connectivity.status !== 'ok'
        ) {
            return this.clearProjectContainers();
        }

        try {
            await this.projectContainersRefresh.run(async (signal) => {
                const promises = projects.data.map((project) =>
                    this.loadProjectContainers(project, target, signal),
                );
                await Promise.all(promises);
            });
        } catch (err) {
            showAndLogError('Failed to refresh project containers', err);
        }
    }

    public clearProjectContainers(): void {
        this.projectContainersRefresh.abort();
        this.model.clearProjectContainers();
    }

    private async loadProjectContainers(
        project: ProjectMetadata,
        target: string,
        signal: AbortSignal,
    ): Promise<void> {
        const oldContainers = this.model.getProjectContainers(project);
        this.model.setProjectContainers(project, loading(oldContainers));
        const containers = await loadContainers(this.topoCli, target, project);
        signal.throwIfAborted();
        this.model.setProjectContainers(project, containers);
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
