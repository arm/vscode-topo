import * as vscode from 'vscode';
import { logger } from '../../util/logger';
import { unloaded } from '../../util/loadable';
import { assertProjectTreeItem } from './assertProjectTreeItem';
import { ProjectTreeItem } from '../../views/treeItems/projectTreeItem';

vi.mock('../../util/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    },
}));

describe('assertProjectTreeItem', () => {
    const errMsg = 'This operation cannot be performed on this item';
    const loggerErrMsg = `Expected ProjectTreeItem but received`;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('does not throw for a ProjectTreeItem', () => {
        const projectTreeItem = new ProjectTreeItem(
            {
                name: 'demo',
                uri: vscode.Uri.file('/fake/workspace/demo'),
                composeFileUri: vscode.Uri.file(
                    '/fake/workspace/demo/compose.yaml',
                ),
                workspaceIndex: 0,
                workspaceName: 'workspace',
            },
            false,
            unloaded(),
        );

        const op = () => assertProjectTreeItem(projectTreeItem);

        expect(op).not.toThrow();
        expect(logger.error).not.toHaveBeenCalled();
    });

    it.each([
        { label: 'an object', value: { some: 'object' } },
        { label: 'null', value: null },
        { label: 'undefined', value: undefined },
    ])('throws and logs an error when given $label', ({ value }) => {
        const op = () => assertProjectTreeItem(value);

        expect(op).toThrow(errMsg);
        expect(logger.error).toHaveBeenCalledWith(errMsg, loggerErrMsg, value);
    });
});
