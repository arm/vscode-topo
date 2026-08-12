import * as vscode from 'vscode';
import { loaded, unloaded } from '../../util/loadable';
import { SkillGroupTreeItem } from './skillGroupTreeItem';

describe('SkillGroupTreeItem', () => {
    it('shows an info icon when no agent skill is installed', () => {
        const item = new SkillGroupTreeItem({
            codex: loaded('missing'),
            'claude-code': loaded('outdated'),
        });

        expect(item.iconPath).toEqual(new vscode.ThemeIcon('info'));
        expect(item.contextValue).toBe('TopoAgentSkills Installable');
    });

    it('shows a green tick when at least one agent skill is installed', () => {
        const item = new SkillGroupTreeItem({
            codex: loaded('installed'),
            'claude-code': loaded('missing'),
        });

        expect(item.iconPath).toEqual(
            new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        );
        expect(item.contextValue).toBe('TopoAgentSkills Installable');
    });

    it('is not installable when every agent skill is installed', () => {
        const item = new SkillGroupTreeItem({
            codex: loaded('installed'),
            'claude-code': loaded('installed'),
        });

        expect(item.contextValue).toBe('TopoAgentSkills');
    });

    it('shows a spinner while statuses are loading', () => {
        const item = new SkillGroupTreeItem({
            codex: loaded('installed'),
            'claude-code': unloaded(true),
        });

        expect(item.iconPath).toEqual(new vscode.ThemeIcon('loading~spin'));
        expect(item.contextValue).toBe('TopoAgentSkills Installable');
    });
});
