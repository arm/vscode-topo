import * as vscode from 'vscode';
import { ProjectMetadata } from '../util/project';
import { Loadable, loaded } from '../util/loadable';

const defaultProjects: Loadable<ProjectMetadata[]> = loaded([]);

export class ProjectModel {
    private _onProjectsChanged: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onProjectsChanged: vscode.Event<void> =
        this._onProjectsChanged.event;

    private _projects: Loadable<ProjectMetadata[]> = defaultProjects;

    public setProjects(projects: Loadable<ProjectMetadata[]>): void {
        this._projects = projects;
        this._onProjectsChanged.fire();
    }

    public get projects(): Loadable<ProjectMetadata[]> {
        return this._projects;
    }
}
