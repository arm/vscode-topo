import * as vscode from 'vscode';
import { TargetSubsystemGroupTreeItem } from './targetSubsystemGroupTreeItem';

describe('TargetSubsystemGroupTreeItem', () => {
    it('sets label, contextValue, icon, and remote processor names', () => {
        const remoteProcessorNames = ['imx-rproc'];
        const item = new TargetSubsystemGroupTreeItem(
            'root@host.local',
            remoteProcessorNames,
        );

        expect(item.label).toBe('Subsystems');
        expect(item.contextValue).toBe('Subsystems');
        expect(item.remoteProcessorNames).toBe(remoteProcessorNames);
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });
});
