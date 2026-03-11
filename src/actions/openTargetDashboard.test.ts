import * as vscode from 'vscode';
import { OpenTargetDashboard } from './openTargetDashboard';
import { TargetDashboardProvider } from '../targetDashboard/targetDashboardProvider';
import { mock } from 'jest-mock-extended';

describe('OpenTargetDashboard', () => {
    const registerCommandMock = jest.mocked(vscode.commands.registerCommand);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('registers the openTargetDashboard command and pushes disposable to context', () => {
        const context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        const provider = mock<TargetDashboardProvider>();
        const action = new OpenTargetDashboard(context, provider);

        action.activate();

        expect(context.subscriptions.length).toBe(1);
        expect(registerCommandMock).toHaveBeenCalledWith(
            OpenTargetDashboard.openTargetDashboardCommand,
            expect.any(Function),
        );
    });

    it('calls showDashboard on the provider when invoking the registered command', async () => {
        const context = mock<vscode.ExtensionContext>({ subscriptions: [] });
        const provider = mock<TargetDashboardProvider>();
        const action = new OpenTargetDashboard(context, provider);
        action.activate();
        const registerCall = registerCommandMock.mock.calls.find(
            ([cmd]) => cmd === OpenTargetDashboard.openTargetDashboardCommand,
        );
        const handler = registerCall![1];

        handler();

        expect(provider.showDashboard).toHaveBeenCalledTimes(1);
    });
});
