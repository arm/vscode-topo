import * as vscode from 'vscode';
import {
    CONTEXT_HAS_PROJECTS,
    CONTEXT_HAS_SELECTED_TARGET,
    CONTEXT_INITIALIZED,
    CONTEXT_TARGET_DATA_ISSUE,
} from '../manifest';
import { ProjectModel } from '../models/projectModel';
import { TargetModel } from '../models/targetModel';
import { DisposableCollector } from '../util/disposableCollector';

async function setContext(key: string, value: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', key, value);
}

export class ContextView implements vscode.Disposable {
    private readonly disposables = new DisposableCollector();

    constructor(
        private readonly targetModel: TargetModel,
        private readonly projectModel: ProjectModel,
    ) {
        this.disposables.collect(
            this.targetModel.onSelectedChanged(() => {
                void this.syncSelectedTargetContext();
            }),
            this.targetModel.onTargetsChanged(() => {
                void this.syncTargetDataIssueContext();
            }),
            this.projectModel.onProjectsChanged(() => {
                void this.syncProjectsContext();
            }),
        );
    }

    public async initialize(): Promise<void> {
        await Promise.all([
            this.syncSelectedTargetContext(),
            this.syncTargetDataIssueContext(),
            this.syncProjectsContext(),
        ]);
        return setContext(CONTEXT_INITIALIZED, true);
    }

    private syncSelectedTargetContext(): Promise<void> {
        const hasSelected = Boolean(this.targetModel.selected);
        return setContext(CONTEXT_HAS_SELECTED_TARGET, hasSelected);
    }

    private syncTargetDataIssueContext(): Promise<void> {
        const hasError = this.targetModel.targets.status === 'errored';
        return setContext(CONTEXT_TARGET_DATA_ISSUE, hasError);
    }

    private syncProjectsContext(): Promise<void> {
        const projects = this.projectModel.projects;
        const hasProjects =
            projects.status === 'loaded' && projects.data.length > 0;
        return setContext(CONTEXT_HAS_PROJECTS, hasProjects);
    }

    public dispose(): void {
        this.disposables.dispose();
    }
}
