import * as vscode from 'vscode';
import { ProcessingDomainTreeItem } from './processingDomainTreeItem';
import { ContainerItem } from '../util/types';
import { PRIMARY_PROCESSING_DOMAIN } from '../manifest';

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
    it('sets label, description, contextValue, icon, and containers', () => {
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
        expect(item.containers).toBe(containers);
    });

    it('pluralizes the container count', () => {
        const item = new ProcessingDomainTreeItem(PRIMARY_PROCESSING_DOMAIN, [
            containers[0],
            { ...containers[0], id: 'def456' },
        ]);

        expect(item.description).toBe('2 containers');
    });
});
