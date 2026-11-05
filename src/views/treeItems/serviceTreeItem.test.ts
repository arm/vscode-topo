import * as vscode from 'vscode';
import { ContainerItem } from '../../util/types';
import { ServiceTreeItem } from './serviceTreeItem';

const container: ContainerItem = {
    id: 'abc123',
    names: 'worker-1',
    image: 'demo-worker',
    status: 'Up 1 minute',
    state: 'running',
    processingDomain: 'Linux Host',
    address: 'localhost:8000',
    target: 'user@topo.local',
    service: 'worker',
    composeFileUri: vscode.Uri.file('/projects/demo/compose.yaml'),
};

describe('ServiceTreeItem', () => {
    it('summarizes mixed replicas and orders them by running state, then name', () => {
        const item = new ServiceTreeItem({
            name: 'worker',
            containers: [
                { ...container, id: 'b', names: 'bravo', state: 'exited' },
                { ...container, id: 'c', names: 'Charlie' },
                { ...container, id: 'a', names: 'alpha' },
                { ...container, id: 'd', names: 'delta', state: 'paused' },
            ],
        });

        expect(item.label).toBe('worker');
        expect(item.description).toBe('2 running, 1 exited, 1 paused');
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Collapsed,
        );
        expect(item.contextValue).toBe('service');
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'warning',
                new vscode.ThemeColor('terminal.ansiYellow'),
            ),
        );
        expect(item.tooltip).toContain('Replicas: 4');
        expect(item.tooltip).toContain('Images: demo-worker');
        expect(item.tooltip).toContain('Processing Domain: Linux Host');
        expect(item.getChildren().map((child) => child.label)).toEqual([
            'alpha',
            'Charlie',
            'bravo',
            'delta',
        ]);
    });

    it('shows a green icon when all replicas are running', () => {
        const item = new ServiceTreeItem({
            name: 'worker',
            containers: [container, { ...container, id: 'second' }],
        });

        expect(item.description).toBe('2 running');
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon(
                'debug-breakpoint-log',
                new vscode.ThemeColor('terminal.ansiGreen'),
            ),
        );
    });
});
