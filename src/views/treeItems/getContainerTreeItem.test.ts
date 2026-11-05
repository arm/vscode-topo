import * as vscode from 'vscode';
import { ContainerItem } from '../../util/types';
import { ContainerTreeItem } from './containerTreeItem';
import { getContainerTreeItem } from './getContainerTreeItem';
import { ServiceTreeItem } from './serviceTreeItem';

vi.mock('../../util/logger');

const container: ContainerItem = {
    id: 'abc123',
    names: 'app-1',
    image: 'demo-app',
    status: 'Up',
    state: 'running',
    processingDomain: 'Linux Host',
    address: '',
    target: 'user@topo.local',
    service: 'app',
    composeFileUri: vscode.Uri.file('/projects/demo/compose.yaml'),
};

describe('getContainerTreeItem', () => {
    it.each([
        ['container', new ContainerTreeItem(container)],
        [
            'single-container service',
            new ServiceTreeItem({ name: 'app', containers: [container] }),
        ],
    ])('resolves a %s to its container for actions', (_, item) => {
        expect(getContainerTreeItem(item).containerItem).toBe(container);
    });

    it('rejects a replicated service instead of choosing an arbitrary container', () => {
        const service = new ServiceTreeItem({
            name: 'app',
            containers: [container, { ...container, id: 'second' }],
        });

        expect(() => getContainerTreeItem(service)).toThrow(
            'This operation cannot be performed on this item',
        );
    });
});
