import * as vscode from 'vscode';
import { ProjectMetadata } from '../util/project';
import { Loadable, unloaded } from '../util/loadable';
import { ContainerItem } from '../util/types';

function getProjectKey(project: ProjectMetadata): string {
    return project.uri.fsPath;
}

export class ProjectModel implements vscode.Disposable {
    private _onProjectsChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onProjectsChanged: vscode.Event<void> =
        this._onProjectsChanged.event;

    private _onProjectContainersChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onProjectContainersChanged: vscode.Event<void> =
        this._onProjectContainersChanged.event;

    private _projects: Loadable<ProjectMetadata[]> = unloaded();
    private _projectContainers = new Map<string, Loadable<ContainerItem[]>>();

    public setProjects(projects: Loadable<ProjectMetadata[]>): void {
        if (projects === this._projects) {
            return;
        }

        this._projects = projects;
        this._onProjectsChanged.fire();
    }

    public setProjectContainers(
        project: ProjectMetadata,
        containers: Loadable<ContainerItem[]>,
    ): void {
        this._projectContainers.set(getProjectKey(project), containers);
        this._onProjectContainersChanged.fire();
    }

    public getProjectContainers(
        project: ProjectMetadata,
    ): Loadable<ContainerItem[]> {
        return (
            this._projectContainers.get(getProjectKey(project)) ?? unloaded()
        );
    }

    public clearProjectContainers(): void {
        if (this._projectContainers.size === 0) {
            return;
        }

        this._projectContainers.clear();
        this._onProjectContainersChanged.fire();
    }

    public get projects(): Loadable<ProjectMetadata[]> {
        return this._projects;
    }

    public dispose(): void {
        this._onProjectsChanged.dispose();
        this._onProjectContainersChanged.dispose();
    }
}
