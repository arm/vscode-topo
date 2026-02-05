import * as vscode from 'vscode';
import { OpenBoardDashboard } from './openBoardDashboard';
import { BoardDashboardProvider } from '../boardDashboard/boardDashboardProvider';
import { mock } from 'jest-mock-extended';

jest.mock('vscode');

describe('OpenBoardDashboard', () => {
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('registers the openBoardDashboard command and pushes disposable to context', () => {
        const context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        const provider = mock<BoardDashboardProvider>();
        const action = new OpenBoardDashboard(context, provider);

        action.activate();

        expect(context.subscriptions.length).toBe(1);
        expect(registerCommandMock).toHaveBeenCalledWith(
            OpenBoardDashboard.openBoardDashboardCommand,
            expect.any(Function),
        );
    });

    it('calls showDashboard on the provider when invoking the registered command', async () => {
        const context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        const provider = mock<BoardDashboardProvider>();
        const action = new OpenBoardDashboard(context, provider);
        action.activate();
        const registerCall = registerCommandMock.mock.calls.find(
            ([cmd]) => cmd === OpenBoardDashboard.openBoardDashboardCommand,
        );
        const handler = registerCall![1];

        handler();

        expect(provider.showDashboard).toHaveBeenCalledTimes(1);
    });
});
