import { ensureTargetTreeContainerItem } from './ensureTargetTreeContainerItem';
import { TargetTreeContainerItem } from '../../workloadPlacement/targetTreeContainerItem';
import { logger } from '../../util/logger';
import { ContainerItem } from '../../workloadPlacement/containersManager';

jest.mock('../../util/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    },
}));

describe('ensureTargetTreeContainerItem', () => {
    const errMsg = 'This operation cannot be performed on this item.';
    const loggerErrMsg = `Expected TargetTreeContainerItem but received`;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not throw for an object that is an instance of TargetTreeContainerItem', () => {
        const containerItem: ContainerItem = {
            id: 'test-id',
            name: 'test-name',
            image: 'test-image',
            state: 'running',
            status: 'Up',
            labels: '',
            runningFor: '',
            createdAt: '',
            runtime: '',
            ports: [],
            cpuUsage: '',
            memUsage: '',
            target: {
                host: 'test-host',
                id: 'abc123',
                ssh: 'root@test-host',
                displayName: '',
                toJSON: function (): { id: string; ssh: string; } {
                    throw new Error('Function not implemented.');
                }
            },
        };
        const instanceLike = new TargetTreeContainerItem(containerItem);

        const op = () => ensureTargetTreeContainerItem(instanceLike);

        expect(op).not.toThrow();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('throws and logs an error when given a non TargetTreeContainerItem object', () => {
        const bad = { some: 'object' };

        const op = () => ensureTargetTreeContainerItem(bad);

        expect(op).toThrow(errMsg);
        expect(logger.error).toHaveBeenCalledWith(errMsg, loggerErrMsg, bad);
    });

    it('throws and logs an error when given null', () => {
        const op = () => ensureTargetTreeContainerItem(null);

        expect(op).toThrow(errMsg);
        expect(logger.error).toHaveBeenCalledWith(errMsg, loggerErrMsg, null);
    });

    it('throws and logs an error when given undefined', () => {
        const op = () => ensureTargetTreeContainerItem(undefined);

        expect(op).toThrow(errMsg);
        expect(logger.error).toHaveBeenCalledWith(errMsg, loggerErrMsg, undefined);
    });
});
