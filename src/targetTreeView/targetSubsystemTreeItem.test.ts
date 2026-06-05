import * as vscode from 'vscode';
import { TargetSubsystemTreeItem } from './targetSubsystemTreeItem';
import { ContainerItem } from '../util/types';

const target = 'user@topo.local';
const containers: ContainerItem[] = [];

describe('TargetSubsystemTreeItem', () => {
    it('should set label, contextValue, and container reference', () => {
        const item = new TargetSubsystemTreeItem('Host', target, containers);
        expect(item.label).toBe('Host');
        expect(item.contextValue).toBe('Subsystem Host');
        expect(item.containers).toBe(containers);
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Collapsed,
        );
    });

    it('should accept dynamic subsystem names', () => {
        const item = new TargetSubsystemTreeItem(
            'imx-rproc',
            target,
            containers,
        );
        expect(item.label).toBe('imx-rproc');
        expect(item.contextValue).toBe('Subsystem imx-rproc');
        expect(item.group).toBe('imx-rproc');
    });
});
