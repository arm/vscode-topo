import * as vscode from 'vscode';
import { TargetTreeSubsystemItem } from './targetTreeSubsystemItem';

describe('TargetTreeSubsystemItem', () => {
    it('should set label and contextValue', () => {
        const item = new TargetTreeSubsystemItem('Host');
        expect(item.label).toBe('Host');
        expect(item.contextValue).toBe('Subsystem Host');
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect(item.collapsibleState).toBe(vscode.TreeItemCollapsibleState.Collapsed);
    });
});
