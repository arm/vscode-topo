import * as vscode from 'vscode';
import { ProcessingDomainTreeItem } from './processingDomainTreeItem';
import { ContainerItem } from '../../util/types';
import { PRIMARY_PROCESSING_DOMAIN } from '../../manifest';

const container: ContainerItem = {
    id: 'abc123',
    names: 'app',
    image: 'demo-app',
    status: 'Up 1 minute',
    state: 'running',
    processingDomain: PRIMARY_PROCESSING_DOMAIN,
    address: 'localhost:8000',
    target: 'user@topo.local',
    service: 'app',
    composeFileUri: vscode.Uri.file('/projects/demo/compose.yaml'),
};

describe('ProcessingDomainTreeItem', () => {
    it('shows the domain name and service count as an expanded group', () => {
        const item = new ProcessingDomainTreeItem(PRIMARY_PROCESSING_DOMAIN, [
            container,
        ]);

        expect(item.label).toBe(PRIMARY_PROCESSING_DOMAIN);
        expect(item.description).toBe('1 service');
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

    it('orders services with running replicas first, then service names case-insensitively', () => {
        const input: ContainerItem[] = [
            { ...container, service: 'Charlie', state: 'exited' },
            { ...container, service: 'Zulu' },
            { ...container, service: 'bravo', state: 'paused' },
            { ...container, service: 'alpha', state: 'exited' },
            { ...container, service: 'alpha', id: 'second' },
        ];
        const item = new ProcessingDomainTreeItem(
            PRIMARY_PROCESSING_DOMAIN,
            input,
        );

        expect(item.description).toBe('4 services');
        expect(item.getChildren().map((child) => child.label)).toEqual([
            'alpha',
            'Zulu',
            'bravo',
            'Charlie',
        ]);
    });

    it('groups by service even when replica images differ and other services share an image', () => {
        const replica = { ...container, id: 'replica', image: 'another-image' };
        const worker = { ...container, id: 'worker', service: 'worker' };
        const item = new ProcessingDomainTreeItem(PRIMARY_PROCESSING_DOMAIN, [
            container,
            worker,
            replica,
        ]);

        expect(item.getChildren().map((child) => child.serviceItem)).toEqual([
            { name: 'app', containers: [container, replica] },
            { name: 'worker', containers: [worker] },
        ]);
    });

    it('omits service UI when containers are not provided', () => {
        const item = new ProcessingDomainTreeItem(PRIMARY_PROCESSING_DOMAIN);

        expect(item.description).toBeUndefined();
        expect(item.getChildren()).toEqual([]);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });
});
