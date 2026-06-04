import * as vscode from 'vscode';
import { TargetSubsystemGroupTreeItem } from './targetSubsystemGroupTreeItem';
import { ContainerItem } from '../util/types';

describe('TargetSubsystemGroupTreeItem', () => {
    it('sets label, contextValue, icon, remote processor names, and containers', () => {
        const remoteProcessorNames = ['imx-rproc'];
        const containers: ContainerItem[] = [];
        const item = new TargetSubsystemGroupTreeItem(
            'root@host.local',
            remoteProcessorNames,
            containers,
        );

        expect(item.label).toBe('Subsystems');
        expect(item.contextValue).toBe('Subsystems');
        expect(item.remoteProcessorNames).toBe(remoteProcessorNames);
        expect(item.containers).toBe(containers);
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });
});
