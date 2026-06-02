import * as vscode from 'vscode';
import { TargetSubsystemGroupTreeItem } from './targetSubsystemGroupTreeItem';
import { TargetDescription } from '../util/types';

const targetDescription: TargetDescription = {
    hostProcessors: [],
    remoteProcessors: [{ name: 'imx-rproc' }],
};

describe('TargetSubsystemGroupTreeItem', () => {
    it('sets label, contextValue, icon, and target description reference', () => {
        const item = new TargetSubsystemGroupTreeItem(
            'root@host.local',
            targetDescription,
        );

        expect(item.label).toBe('Subsystems');
        expect(item.contextValue).toBe('Subsystems');
        expect(item.targetDescription).toBe(targetDescription);
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });
});
