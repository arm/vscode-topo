import { assertContainerTreeItem } from './assertContainerTreeItem';
import { ContainerTreeItem } from './containerTreeItem';
import { logger } from '../util/logger';
import { ContainerItem } from '../util/types';

vi.mock('../util/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('assertContainerTreeItem', () => {
    const errMsg = 'This operation cannot be performed on this item';
    const loggerErrMsg = `Expected ContainerTreeItem but received`;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not throw for an object that is an instance of ContainerTreeItem', () => {
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
        const instanceLike = new ContainerTreeItem(containerItem);

        const op = () => assertContainerTreeItem(instanceLike);

        expect(op).not.toThrow();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('throws and logs an error when given a non ContainerTreeItem object', () => {
        const bad = { some: 'object' };

        const op = () => assertContainerTreeItem(bad);

        expect(op).toThrow(errMsg);
        expect(logger.error).toHaveBeenCalledWith(errMsg, loggerErrMsg, bad);
    });

    it('throws and logs an error when given null', () => {
        const op = () => assertContainerTreeItem(null);

        expect(op).toThrow(errMsg);
        expect(logger.error).toHaveBeenCalledWith(errMsg, loggerErrMsg, null);
    });

    it('throws and logs an error when given undefined', () => {
        const op = () => assertContainerTreeItem(undefined);

        expect(op).toThrow(errMsg);
        expect(logger.error).toHaveBeenCalledWith(
            errMsg,
            loggerErrMsg,
            undefined,
        );
    });
});
