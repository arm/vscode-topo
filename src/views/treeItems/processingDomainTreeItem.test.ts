import * as vscode from 'vscode';
import { ProcessingDomainTreeItem } from './processingDomainTreeItem';
import { ContainerItem } from '../../util/types';
import { PRIMARY_PROCESSING_DOMAIN } from '../../manifest';

const containers: ContainerItem[] = [
    {
        id: 'abc123',
        names: 'app',
        image: 'demo-app',
        status: 'Up 1 minute',
        state: 'running',
        processingDomain: PRIMARY_PROCESSING_DOMAIN,
        address: 'localhost:8000',
        target: 'user@topo.local',
    },
];

describe('ProcessingDomainTreeItem', () => {
    it('shows the domain name and container count as an expanded group', () => {
        const item = new ProcessingDomainTreeItem(
            PRIMARY_PROCESSING_DOMAIN,
            containers,
        );

        expect(item.label).toBe(PRIMARY_PROCESSING_DOMAIN);
        expect(item.description).toBe('1 container');
        expect(item.contextValue).toBe(
            `ProcessingDomain ${PRIMARY_PROCESSING_DOMAIN}`,
        );
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon('multiple-windows'),
        );
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });

    it('orders running containers first, then names case-insensitively without mutating the input', () => {
        const input = Object.freeze<ContainerItem[]>([
            {
                ...containers[0],
                id: 'c',
                names: 'Charlie',
                state: 'exited',
                status: 'Exited (0)',
            },
            { ...containers[0], id: 'z', names: 'Zulu' },
            {
                ...containers[0],
                id: 'b',
                names: 'bravo',
                state: 'paused',
                status: 'Paused',
            },
            { ...containers[0], id: 'a', names: 'alpha' },
        ]);
        const item = new ProcessingDomainTreeItem(
            PRIMARY_PROCESSING_DOMAIN,
            input,
        );

        expect(item.description).toBe('4 containers');
        expect(
            item.getChildren().map((child) => child.containerItem.names),
        ).toEqual(['alpha', 'Zulu', 'bravo', 'Charlie']);
    });

    it('omits container UI when containers are not provided', () => {
        const item = new ProcessingDomainTreeItem(PRIMARY_PROCESSING_DOMAIN);

        expect(item.description).toBeUndefined();
        expect(item.getChildren()).toEqual([]);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });
});
