import { mock } from 'vitest-mock-extended';
import * as vscode from 'vscode';
import { HostHealth } from './hostHealth';
import { TopoCli } from '../topoCli';
import { HostHealthCheckResult } from '../topoCliSchema';
import { executeCommand } from '../util/test/executeCommand';
import { showAndLogError } from '../util/showAndLogError';
import { TransientDocumentProvider } from '../util/transientDocumentProvider';

vi.mock('../util/showAndLogError');

const hostHealth: HostHealthCheckResult = {
    host: {
        dependencies: [
            {
                name: 'Container Engine',
                status: 'ok',
                value: 'docker',
            },
        ],
    },
};

describe('HostHealth', () => {
    const healthDocumentProvider = mock<TransientDocumentProvider>();

    afterEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
    });

    it('registers inspectHostHealth command when activated', async () => {
        const action = new HostHealth(mock<TopoCli>(), healthDocumentProvider);

        action.activate();

        expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
            HostHealth.inspectHostHealthCommand,
            expect.any(Function),
        );
    });

    it('opens a host health document with the latest host health JSON', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(123);
        const documentUri = mock<vscode.Uri>();
        healthDocumentProvider.createUri.mockReturnValue(documentUri);
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const action = new HostHealth(topoCli, healthDocumentProvider);
        action.activate();

        await executeCommand(HostHealth.inspectHostHealthCommand);

        expect(topoCli.hostHealth).toHaveBeenCalledWith();
        expect(healthDocumentProvider.createUri).toHaveBeenCalledWith(
            'topo-host-health-123.json',
        );
        expect(healthDocumentProvider.open).toHaveBeenCalledWith(
            documentUri,
            JSON.stringify(hostHealth.host, null, 4),
        );
    });

    it('shows an error when opening the host health document fails', async () => {
        const error = new Error('health unavailable');
        const topoCli = mock<TopoCli>();
        topoCli.hostHealth.mockRejectedValue(error);
        const action = new HostHealth(topoCli, healthDocumentProvider);
        action.activate();

        await executeCommand(HostHealth.inspectHostHealthCommand);

        expect(showAndLogError).toHaveBeenCalledWith(
            'Failed to inspect host health',
            error,
        );
    });
});
