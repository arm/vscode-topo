import * as vscode from 'vscode';
import { ProjectMetadata } from '../util/project';
import { Loadable, unloaded } from '../util/loadable';

export class ProjectModel {
    private _onProjectsChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onProjectsChanged: vscode.Event<void> =
        this._onProjectsChanged.event;

    private _projects: Loadable<ProjectMetadata[]> = unloaded();

    public setProjects(projects: Loadable<ProjectMetadata[]>): void {
        if (projects === this._projects) {
            return;
        }

        this._projects = projects;
        this._onProjectsChanged.fire();
    }

    public get projects(): Loadable<ProjectMetadata[]> {
        return this._projects;
    }
}
