import { assertTargetContainerTreeItem } from './assertTargetContainerTreeItem';
import { TargetContainerTreeItem } from './targetContainerTreeItem';
import { logger } from '../util/logger';
import { ContainerItem } from '../util/types';

jest.mock('../util/logger', () => ({
    logger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    },
}));

describe('assertTargetContainerTreeItem', () => {
    const errMsg = 'This operation cannot be performed on this item';
    const loggerErrMsg = `Expected TargetContainerTreeItem but received`;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not throw for an object that is an instance of TargetContainerTreeItem', () => {
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
            annotations: {},
            ports: {},
            target: 'root@test-host',
        };
        const instanceLike = new TargetContainerTreeItem(containerItem);

        const op = () => assertTargetContainerTreeItem(instanceLike);

        expect(op).not.toThrow();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('throws and logs an error when given a non TargetContainerTreeItem object', () => {
        const bad = { some: 'object' };

        const op = () => assertTargetContainerTreeItem(bad);

        expect(op).toThrow(errMsg);
        expect(logger.error).toHaveBeenCalledWith(errMsg, loggerErrMsg, bad);
    });

    it('throws and logs an error when given null', () => {
        const op = () => assertTargetContainerTreeItem(null);

        expect(op).toThrow(errMsg);
        expect(logger.error).toHaveBeenCalledWith(errMsg, loggerErrMsg, null);
    });

    it('throws and logs an error when given undefined', () => {
        const op = () => assertTargetContainerTreeItem(undefined);

        expect(op).toThrow(errMsg);
        expect(logger.error).toHaveBeenCalledWith(
            errMsg,
            loggerErrMsg,
            undefined,
        );
    });
});
