import * as vscode from 'vscode';
import { ProjectModel } from '../models/projectModel';
import { errored, loaded, loading } from '../util/loadable';
import { findTopLevelComposeProjects } from '../util/project';
import { DisposableCollector } from '../util/disposableCollector';
import { COMPOSE_FILE_GLOB } from '../util/composeFile';
import { LatestAbortableWork } from '../util/latestAbortableWork';

export class ProjectController implements vscode.Disposable {
    private readonly disposables = new DisposableCollector();
    private readonly projectRefresh = new LatestAbortableWork();

    constructor(private readonly model: ProjectModel) {
        const composeFileWatcher =
            vscode.workspace.createFileSystemWatcher(COMPOSE_FILE_GLOB);
        const refresh = (): void => {
            void this.refreshProjects();
        };

        this.disposables.collect(
            this.projectRefresh,
            composeFileWatcher,
            composeFileWatcher.onDidCreate(refresh),
            composeFileWatcher.onDidChange(refresh),
            composeFileWatcher.onDidDelete(refresh),
            vscode.workspace.onDidChangeWorkspaceFolders(refresh),
        );

        refresh();
    }

    public async refreshProjects(): Promise<void> {
        this.model.setProjects(loading(this.model.projects));

        try {
            const projects = await this.projectRefresh.run(() =>
                findTopLevelComposeProjects(),
            );
            if (projects === undefined) {
                return;
            }

            this.model.setProjects(loaded(projects));
        } catch (error) {
            this.model.setProjects(errored(error));
        }
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
