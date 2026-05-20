import { mock } from 'jest-mock-extended';
import { HostModel } from '../models/hostModel';
import { TopoCli } from '../topoCli';
import { HostController } from './hostController';

describe('HostController', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('refreshes host health on activation', () => {
        const topoCli = mock<TopoCli>();
        const controller = new HostController(new HostModel(), topoCli);

        controller.activate();

        expect(topoCli.hostHealth).toHaveBeenCalled();
    });
});
