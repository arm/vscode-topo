import * as vscode from 'vscode';
import { PACKAGE_NAME } from '../manifest';
import { BoardDashboardProvider } from '../boardDashboard/boardDashboardProvider';

export class OpenBoardDashboard {

    public static readonly openBoardDashboardCommand = `${PACKAGE_NAME}.openBoardDashboard`;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly boardDashboardProvider: Pick<BoardDashboardProvider, 'showDashboard'>,
    ) {}

    public activate(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(OpenBoardDashboard.openBoardDashboardCommand, this.openBoardDashboard.bind(this))
        );
    }

    private openBoardDashboard(): void {
        this.boardDashboardProvider.showDashboard();
    }

}
