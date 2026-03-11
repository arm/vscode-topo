import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { TargetDashboardProvider } from '../targetDashboard/targetDashboardProvider';

export class OpenTargetDashboard {
    public static readonly openTargetDashboardCommand = `${PACKAGE_NAME}.openTargetDashboard`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly targetDashboardProvider: TargetDashboardProvider,
    ) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                OpenTargetDashboard.openTargetDashboardCommand,
                this.openTargetDashboard.bind(this),
            ),
        );
    }

    private openTargetDashboard(): void {
        this.targetDashboardProvider.showDashboard();
    }
}
