import { mock } from 'jest-mock-extended';
import { HostHealthModel } from '../models/hostHealthModel';
import { TopoCli } from '../topoCli';
import { HostHealthController } from './HostHealthController';

describe('HostHealthController', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('refreshes host health on activation', () => {
        const topoCli = mock<TopoCli>();
        const hostHealthController = new HostHealthController(
            new HostHealthModel(),
            topoCli,
        );

        hostHealthController.activate();

        expect(topoCli.hostHealth).toHaveBeenCalled();
    });
});
