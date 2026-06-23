import * as vscode from 'vscode';
import { ProjectProcessingDomainTreeItem } from './projectProcessingDomainTreeItem';
import { ContainerItem } from '../util/types';

const containers: ContainerItem[] = [
    {
        id: 'abc123',
        names: 'app',
        image: 'demo-app',
        status: 'Up 1 minute',
        state: 'running',
        processingDomain: 'Linux Host',
        address: 'localhost:8000',
        target: 'user@topo.local',
    },
];

describe('ProjectProcessingDomainTreeItem', () => {
    it('sets label, description, contextValue, icon, and containers', () => {
        const item = new ProjectProcessingDomainTreeItem(
            'Linux Host',
            containers,
        );

        expect(item.label).toBe('Linux Host');
        expect(item.description).toBe('1 container');
        expect(item.contextValue).toBe('ProjectProcessingDomain Linux Host');
        expect(item.iconPath).toStrictEqual(
            new vscode.ThemeIcon('multiple-windows'),
        );
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
        expect(item.containers).toBe(containers);
    });
});
