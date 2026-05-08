import * as vscode from 'vscode';
import { TargetSubsystemGroupTreeItem } from './targetSubsystemGroupTreeItem';

describe('TargetSubsystemGroupTreeItem', () => {
    it('sets label, contextValue, and icon', () => {
        const item = new TargetSubsystemGroupTreeItem('root@host.local');

        expect(item.label).toBe('Subsystems');
        expect(item.contextValue).toBe('Subsystems');
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });
});
