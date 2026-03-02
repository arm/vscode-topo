import * as vscode from 'vscode';
import { TargetTreeSubsystemGroupItem } from './targetTreeSubsystemGroupItem';
import { TargetItem } from '../util/types';
import { mock } from 'jest-mock-extended';

describe('TargetTreeSubsystemGroupItem', () => {
    it('sets label, contextValue, and icon', () => {
        const item = new TargetTreeSubsystemGroupItem(mock<TargetItem>());

        expect(item.label).toBe('Subsystems');
        expect(item.contextValue).toBe('Subsystems');
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });
});
