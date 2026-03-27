import * as vscode from 'vscode';
import { TargetTreeTargetItem } from './targetTreeTargetItem';
import { TargetItem } from '../util/types';

describe('TargetTreeTargetItem', () => {
    const baseTarget: TargetItem = {
        ssh: 'root@host.local',
        host: 'host.local',
    };

    it('sets basic fields (id, label, description)', () => {
        const item = new TargetTreeTargetItem(baseTarget, false, false, true);

        expect(item.id).toBe(baseTarget.ssh);
        expect(item.label).toBe(baseTarget.ssh);
        expect(item.displayName).toBe(baseTarget.ssh);
        expect(item.contextValue).toContain('Target');
    });

    it('shows loading icon and Selected context when selected but not connectionReady', () => {
        const item = new TargetTreeTargetItem(baseTarget, true, false, true);

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).not.toContain('ConnectionReady');
        expect(item.contextValue).toContain('TargetReady');
        expect(item.iconPath).toBeDefined();
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon).toBeDefined();
        expect(icon!.id).toBe('loading~spin');
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('shows error icon and ConnectionReady context when connectionReady true but targetReady false', () => {
        const item = new TargetTreeTargetItem(baseTarget, true, true, false);

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).toContain('ConnectionReady');
        expect(item.contextValue).not.toContain('TargetReady');
        expect(item.iconPath).toBeDefined();
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('error');
        const color = icon.color;
        expect(color).toBeDefined();
        expect(color!.id).toBe('terminal.ansiRed');

        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('has no special contexts or icon when not selected and targetReady true', () => {
        const item = new TargetTreeTargetItem(baseTarget, false, false, true);

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).not.toContain('Selected');
        expect(item.contextValue).not.toContain('ConnectionReady');
        expect(item.contextValue).toContain('TargetReady');
        expect(item.iconPath).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('is expanded when selected, connectionReady and targetReady', () => {
        const item = new TargetTreeTargetItem(baseTarget, true, true, true);

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).toContain('ConnectionReady');
        expect(item.contextValue).toContain('TargetReady');
        expect(item.iconPath).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });
});
