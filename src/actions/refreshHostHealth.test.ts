import { mock } from 'jest-mock-extended';
import { RefreshHostHealth } from './refreshHostHealth';
import { HostHealthModel } from '../models/hostHealthModel';
import { TopoCli } from '../topoCli';
import * as vscode from 'vscode';
import { HostHealthCheckResult } from '../topoCliSchema';

async function executeCommand(command: string, ...args: unknown[]) {
    const calls = jest.mocked(vscode.commands.registerCommand).mock.calls;
    const addCall = calls.find((call: unknown[]) => call[0] === command);
    if (!addCall) {
        throw new Error(`No handler registered for command ${command}`);
    }
    const handler = addCall[1] as (...handlerArgs: unknown[]) => Promise<void>;
    await handler(...args);
}

const health: HostHealthCheckResult = {
    host: {
        dependencies: [
            {
                name: 'Zed',
                status: 'warning',
                value: 'missing',
                fix: 'run `topo install zed`',
            },
            {
                name: 'Alpha',
                status: 'ok',
                value: 'installed',
            },
        ],
    },
};

describe('RefreshHostHealth', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('registers the refresh host health command and refreshes host health on activation', () => {
        const topoCli = mock<TopoCli>();
        const refreshHostHealth = new RefreshHostHealth(
            new HostHealthModel(),
            topoCli,
        );

        refreshHostHealth.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            RefreshHostHealth.refreshHostHealthCommand,
            expect.any(Function),
        );
        expect(topoCli.hostHealth).toHaveBeenCalled();
    });

    it('refreshes host health on command execution', async () => {
        const hostHealthModel = new HostHealthModel();
        const topoCli = mock<TopoCli>({
            hostHealth: jest.fn().mockResolvedValue(health),
        });
        const refreshHostHealth = new RefreshHostHealth(
            hostHealthModel,
            topoCli,
        );
        refreshHostHealth.activate();

        await executeCommand(RefreshHostHealth.refreshHostHealthCommand);

        expect(topoCli.hostHealth).toHaveBeenCalled();
        await expect(hostHealthModel.health).resolves.toBe(health);
    });
});
