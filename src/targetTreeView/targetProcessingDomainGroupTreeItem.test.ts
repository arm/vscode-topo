import * as vscode from 'vscode';
import { TargetProcessingDomainGroupTreeItem } from './targetProcessingDomainGroupTreeItem';
import { ContainerItem } from '../util/types';

describe('TargetProcessingDomainGroupTreeItem', () => {
    it('sets label, contextValue, icon, remote processor names, and containers', () => {
        const remoteProcessorNames = ['imx-rproc'];
        const containers: ContainerItem[] = [];
        const item = new TargetProcessingDomainGroupTreeItem(
            'root@host.local',
            remoteProcessorNames,
            containers,
        );

        expect(item.label).toBe('Processing Domains');
        expect(item.contextValue).toBe('ProcessingDomains');
        expect(item.remoteProcessorNames).toBe(remoteProcessorNames);
        expect(item.containers).toBe(containers);
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });
});
