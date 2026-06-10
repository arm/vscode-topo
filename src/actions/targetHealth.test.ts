import { mock } from 'vitest-mock-extended';
import * as vscode from 'vscode';
import { TargetHealth } from './targetHealth';
import { TargetTreeItem } from '../targetTreeView/targetTreeItem';
import { TopoCli } from '../topoCli';
import { HealthCheck } from '../topoCliSchema';
import { TransientDocumentProvider } from '../util/transientDocumentProvider';
import { showAndLogError } from '../util/showAndLogError';

vi.mock('../util/logger');
vi.mock('../util/showAndLogError');

const health: HealthCheck = {
    host: {
        dependencies: [],
    },
    target: {
        destination: 'ssh://topo.local',
        isLocalhost: false,
        connectivity: {
            name: 'Connectivity',
            status: 'ok',
            value: 'ok',
        },
        dependencies: [
            {
                name: 'Podman',
                status: 'ok',
                value: 'present',
            },
        ],
        subsystemDriver: {
            name: 'SubsystemDriver',
            status: 'ok',
            value: 'ready',
        },
    },
};

describe('TargetHealth', () => {
    const healthDocumentProvider = mock<TransientDocumentProvider>();

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('opens a target health document with the selected target health JSON', async () => {
        vi.spyOn(Date, 'now').mockReturnValue(123);
        const documentUri = mock<vscode.Uri>();
        healthDocumentProvider.createUri.mockReturnValue(documentUri);
        const topoCli = mock<TopoCli>({
            health: vi.fn().mockResolvedValue(health),
        });
        const targetHealth = new TargetHealth(topoCli, healthDocumentProvider);
        const targetItem = new TargetTreeItem({
            target: 'user@foobar',
            selected: true,
        });

        await targetHealth.inspectHealthCommandHandler(targetItem);

        expect(topoCli.health).toHaveBeenCalledWith('user@foobar');
        expect(healthDocumentProvider.createUri).toHaveBeenCalledWith(
            'topo-user_foobar-health-123.json',
        );
        expect(healthDocumentProvider.open).toHaveBeenCalledWith(
            documentUri,
            JSON.stringify(health.target, null, 4),
        );
    });

    it('does not open health document for non-selected target', async () => {
        const topoCli = mock<TopoCli>();
        const targetHealth = new TargetHealth(topoCli, healthDocumentProvider);
        const targetItem = new TargetTreeItem({
            target: 'abc.com',
            selected: false,
        });

        await targetHealth.inspectHealthCommandHandler(targetItem);

        expect(topoCli.health).not.toHaveBeenCalled();
        expect(healthDocumentProvider.open).not.toHaveBeenCalled();
    });

    it('shows an error when opening the target health document fails', async () => {
        const error = new Error('health unavailable');
        const topoCli = mock<TopoCli>();
        const targetHealth = new TargetHealth(topoCli, healthDocumentProvider);
        topoCli.health.mockRejectedValue(error);
        const targetItem = new TargetTreeItem({
            target: 'abc.com',
            selected: true,
        });

        await targetHealth.inspectHealthCommandHandler(targetItem);

        expect(showAndLogError).toHaveBeenCalledWith(
            'Failed to get health for target',
            error,
        );
    });
});
