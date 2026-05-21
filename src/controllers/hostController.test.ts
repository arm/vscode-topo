import { mock } from 'jest-mock-extended';
import { HostModel } from '../models/hostModel';
import { TopoCli } from '../topoCli';
import { HostController } from './hostController';

describe('HostController', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('refreshes host health on creation', () => {
        const healthPromise = Promise.resolve();
        const topoCli = mock<TopoCli>({
            hostHealth: jest.fn().mockResolvedValue(healthPromise),
        });
        const model = new HostModel();

        new HostController(model, topoCli);

        expect(topoCli.hostHealth).toHaveBeenCalled();
        expect(model.health).toBe(healthPromise);
    });
});
