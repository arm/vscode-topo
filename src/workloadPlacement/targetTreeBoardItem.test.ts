import * as vscode from 'vscode';
import { TargetTreeBoardItem } from './targetTreeBoardItem';
import { TargetItem } from '../util/types';

describe('TargetTreeBoardItem', () => {
    const baseTarget: TargetItem = {
        id: 't-1',
        ssh: 'root@host.local',
        user: 'root',
        host: 'host.local',
        targetDescription: {
            hostProcessor: [],
            remoteprocCPU: [],
        },
    };

    it('sets basic fields (id, label, description)', () => {
        const item = new TargetTreeBoardItem(baseTarget, false, false, true);

        expect(item.id).toBe(baseTarget.id);
        expect(item.label).toBe(baseTarget.id);
        expect(item.description).toBe(baseTarget.ssh);
        expect(item.displayName).toBe(baseTarget.id);
        expect(item.contextValue).toContain('Board');
    });

    it('shows loading icon and Selected context when selected but not connectionReady', () => {
        const item = new TargetTreeBoardItem(baseTarget, true, false, true);

        expect(item.contextValue).toContain('Board');
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
        const item = new TargetTreeBoardItem(baseTarget, true, true, false);

        expect(item.contextValue).toContain('Board');
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
        const item = new TargetTreeBoardItem(baseTarget, false, false, true);

        expect(item.contextValue).toContain('Board');
        expect(item.contextValue).not.toContain('Selected');
        expect(item.contextValue).not.toContain('ConnectionReady');
        expect(item.contextValue).toContain('TargetReady');
        expect(item.iconPath).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.None,
        );
    });

    it('is expanded when selected, connectionReady and targetReady', () => {
        const item = new TargetTreeBoardItem(baseTarget, true, true, true);

        expect(item.contextValue).toContain('Board');
        expect(item.contextValue).toContain('Selected');
        expect(item.contextValue).toContain('ConnectionReady');
        expect(item.contextValue).toContain('TargetReady');
        expect(item.iconPath).toBeUndefined();
        expect(item.collapsibleState).toBe(
            vscode.TreeItemCollapsibleState.Expanded,
        );
    });
});
