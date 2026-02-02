import * as vscode from 'vscode';
import { OpenBoardDashboard } from './openBoardDashboard';

describe('OpenBoardDashboard', () => {
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);

    beforeEach(() => {
        jest.clearAllMocks();
        registerCommandMock.mockReturnValue({ dispose: jest.fn() });
    });

    it('registers the openBoardDashboard command and pushes disposable to context', () => {
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext;
        const fakeProvider = { showDashboard: () => {} };
        const action = new OpenBoardDashboard(context, fakeProvider);

        action.activate();

        expect(context.subscriptions.length).toBe(1);
        expect(registerCommandMock).toHaveBeenCalledWith(
            OpenBoardDashboard.openBoardDashboardCommand,
            expect.any(Function),
        );
    });

    it('calls showDashboard on the provider when invoking the registered command', async () => {
        const fakeProvider = { showDashboard: jest.fn() };
        const context = {
            subscriptions: [],
        } as unknown as vscode.ExtensionContext;
        const action = new OpenBoardDashboard(context, fakeProvider);
        action.activate();
        const registerCall = registerCommandMock.mock.calls.find(
            ([cmd]) => cmd === OpenBoardDashboard.openBoardDashboardCommand,
        );
        const handler = registerCall![1];

        handler();

        expect(fakeProvider.showDashboard).toHaveBeenCalledTimes(1);
    });
});
