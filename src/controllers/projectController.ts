import * as vscode from 'vscode';
import { ProjectModel } from '../models/projectModel';
import { errored, loaded, loading } from '../util/loadable';
import { findTopLevelComposeProjects } from '../util/project';
import { DisposableCollector } from '../util/disposableCollector';
import { COMPOSE_FILE_GLOB } from '../util/composeFile';

export class ProjectController implements vscode.Disposable {
    private readonly disposables = new DisposableCollector();

    constructor(private readonly model: ProjectModel) {
        const composeFileWatcher =
            vscode.workspace.createFileSystemWatcher(COMPOSE_FILE_GLOB);
        const refresh = (): void => {
            void this.refreshProjects();
        };

        this.disposables.collect(
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

        let projects;
        try {
            projects = await findTopLevelComposeProjects();
        } catch (error) {
            this.model.setProjects(errored(error));
            return;
        }

        this.model.setProjects(loaded(projects));
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
