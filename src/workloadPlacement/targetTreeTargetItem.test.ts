import * as vscode from 'vscode';
import { TargetTreeTargetItem } from './targetTreeTargetItem';
import { TargetItem } from '../util/types';

describe('TargetTreeTargetItem', () => {
    const baseTarget: TargetItem = {
        ssh: 'root@host.local',
        host: 'host.local',
    };

    it('sets basic fields (id, label, description)', () => {
        const item = new TargetTreeTargetItem(baseTarget, false, 'connected');

        expect(item.id).toBe(baseTarget.ssh);
        expect(item.label).toBe(baseTarget.ssh);
        expect(item.displayName).toBe(baseTarget.ssh);
        expect(item.contextValue).toContain('Target');
    });

    it('shows loading icon and Selected context when selected and connecting', () => {
        const item = new TargetTreeTargetItem(baseTarget, true, 'connecting');

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).not.toContain('Connected');
        expect(item.iconPath).toBeDefined();
        expect(item.iconPath).toBeInstanceOf(vscode.ThemeIcon);
        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon).toBeDefined();
        expect(icon!.id).toBe('loading~spin');
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('shows error icon when selected and disconnected', () => {
        const item = new TargetTreeTargetItem(baseTarget, true, 'disconnected');

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).not.toContain('Connected');
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

    it('has no selected context or icon when not selected but connected', () => {
        const item = new TargetTreeTargetItem(baseTarget, false, 'connected');

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).not.toContain('Selected');
        expect(item.contextValue).toContain('Connected');
        expect(item.iconPath).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('is expanded when selected and connected', () => {
        const item = new TargetTreeTargetItem(baseTarget, true, 'connected');

        expect(item.contextValue).toContain('Target');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).toContain('Connected');
        expect(item.iconPath).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });
});
