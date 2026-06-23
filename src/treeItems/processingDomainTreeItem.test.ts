import * as vscode from 'vscode';
import { ProcessingDomainTreeItem } from './processingDomainTreeItem';
import { ContainerItem } from '../util/types';

const target = 'user@topo.local';
const container: ContainerItem = {
    id: 'id1',
    name: 'cont1',
    image: 'img1',
    state: 'running',
    status: 'Up 4 days',
    labels: 'foo=bar',
    runningFor: '1h',
    runtime: '',
    annotations: {},
    createdAt: '',
    ports: {},
    target,
};
const containers: ContainerItem[] = [container];

describe('ProcessingDomainTreeItem', () => {
    it('should set label, description, contextValue, and container reference', () => {
        const item = new ProcessingDomainTreeItem(
            'PrimaryOS',
            target,
            containers,
        );
        expect(item.label).toBe('PrimaryOS');
        expect(item.description).toBe('1 container');
        expect(item.contextValue).toBe('ProcessingDomain PrimaryOS');
        expect(item.containers).toBe(containers);
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon('multiple-windows'),
        );
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Collapsed,
        );
    });

    it('pluralizes the container count', () => {
        const item = new ProcessingDomainTreeItem('PrimaryOS', target, [
            container,
            { ...container, id: 'id2' },
        ]);

        expect(item.description).toBe('2 containers');
    });

    it('should accept dynamic processing domain names', () => {
        const item = new ProcessingDomainTreeItem(
            'imx-rproc',
            target,
            containers,
        );
        expect(item.label).toBe('imx-rproc');
        expect(item.contextValue).toBe('ProcessingDomain imx-rproc');
        expect(item.processingDomainId).toBe('imx-rproc');
    });
});
