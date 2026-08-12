import * as vscode from 'vscode';
import { loaded, unloaded } from '../../util/loadable';
import { SkillGroupTreeItem } from './skillGroupTreeItem';

describe('SkillGroupTreeItem', () => {
    it('shows an info icon when no agent skill is installed', () => {
        const item = new SkillGroupTreeItem(
            loaded({ codex: 'missing', 'claude-code': 'outdated' }),
        );

        expect(item.iconPath).toEqual(new vscode.ThemeIcon('info'));
    });

    it('shows a green tick when at least one agent skill is installed', () => {
        const item = new SkillGroupTreeItem(
            loaded({ codex: 'installed', 'claude-code': 'missing' }),
        );

        expect(item.iconPath).toEqual(
            new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        );
    });

    it('shows a spinner while statuses are loading', () => {
        const item = new SkillGroupTreeItem(unloaded(true));

        expect(item.iconPath).toEqual(new vscode.ThemeIcon('loading~spin'));
    });
});
