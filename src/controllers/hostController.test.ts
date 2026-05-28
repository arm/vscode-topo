import { mock } from 'vitest-mock-extended';
import * as vscode from 'vscode';
import { HostModel } from '../models/hostModel';
import { TopoCli } from '../topoCli';
import { HostController } from './hostController';
import { HostHealthCheckResult } from '../topoCliSchema';
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

describe('HostController', () => {
    const healthDocumentProvider = mock<TransientDocumentProvider>();

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('refreshes host health on creation', async () => {
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const model = new HostModel();

        new HostController(model, topoCli, healthDocumentProvider);
        await Promise.resolve();

        expect(topoCli.hostHealth).toHaveBeenCalled();
        expect(model.health).toStrictEqual({
            status: 'loaded',
            data: hostHealth,
        });
    });

    it('opens a host health document with the latest host health JSON', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(123);
        const documentUri = mock<vscode.Uri>();
        healthDocumentProvider.createUri.mockReturnValue(documentUri);
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const controller = new HostController(
            new HostModel(),
            topoCli,
            healthDocumentProvider,
        );

        await controller.openHealthDocument();

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
        const controller = new HostController(
            new HostModel(),
            topoCli,
            healthDocumentProvider,
        );
        topoCli.hostHealth.mockRejectedValue(error);

        await controller.openHealthDocument();

        expect(showAndLogError).toHaveBeenCalledWith(
            'Failed to inspect host health',
            error,
        );
    });
});
