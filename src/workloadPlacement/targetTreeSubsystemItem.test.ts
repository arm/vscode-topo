import * as vscode from 'vscode';
import { TargetTreeSubsystemItem } from './targetTreeSubsystemItem';
import { TargetItem } from '../util/types';
import { mock } from 'jest-mock-extended';

const target = mock<TargetItem>();

describe('TargetTreeSubsystemItem', () => {
    it('should set label and contextValue', () => {
        const item = new TargetTreeSubsystemItem('Host', target);
        expect(item.label).toBe('Host');
        expect(item.contextValue).toBe('Subsystem Host');
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Collapsed,
        );
    });

    it('should accept dynamic subsystem names', () => {
        const item = new TargetTreeSubsystemItem('imx-rproc', target);
        expect(item.label).toBe('imx-rproc');
        expect(item.contextValue).toBe('Subsystem imx-rproc');
        expect(item.group).toBe('imx-rproc');
    });
});
