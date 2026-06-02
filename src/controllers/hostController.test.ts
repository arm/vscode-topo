import { mock } from 'vitest-mock-extended';
import { HostModel } from '../models/hostModel';
import { TopoCli } from '../topoCli';
import { HostController } from './hostController';
import { HostHealthCheckResult } from '../topoCliSchema';

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
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('refreshes host health on creation', async () => {
        const topoCli = mock<TopoCli>({
            hostHealth: vi.fn().mockResolvedValue(hostHealth),
        });
        const model = new HostModel();

        new HostController(model, topoCli);
        await Promise.resolve();

        expect(topoCli.hostHealth).toHaveBeenCalled();
        expect(model.health).toStrictEqual({
            status: 'loaded',
            data: hostHealth,
        });
    });
});
