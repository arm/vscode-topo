import { mock } from 'jest-mock-extended';
import { HostModel } from '../models/hostModel';
import { TopoCli } from '../topoCli';
import { HostController } from './hostController';

describe('HostController', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('refreshes host health on creation', () => {
        const topoCli = mock<TopoCli>();

        new HostController(new HostModel(), topoCli);

        expect(topoCli.hostHealth).toHaveBeenCalled();
    });
});
