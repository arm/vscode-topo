import * as vscode from 'vscode';
import { TargetTreeSubsystemGroupItem } from './targetTreeSubsystemGroupItem';

describe('TargetTreeSubsystemGroupItem', () => {
    it('sets label, contextValue, and icon', () => {
        const item = new TargetTreeSubsystemGroupItem('root@host.local');

        expect(item.label).toBe('Subsystems');
        expect(item.contextValue).toBe('Subsystems');
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });
});
