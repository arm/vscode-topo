import * as vscode from 'vscode';
import {
    getDependencyGroupIcon,
    getDependencyItemIcon,
} from './dependencyIcons';

describe('getDependencyItemIcon', () => {
    it('maps ok to a passed check icon', () => {
        const icon = getDependencyItemIcon('ok');

        expect(icon).toStrictEqual(
            new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        );
    });

    it('maps warning to a queued warning icon', () => {
        const icon = getDependencyItemIcon('warning');

        expect(icon).toStrictEqual(
            new vscode.ThemeIcon(
                'warning',
                new vscode.ThemeColor('testing.iconQueued'),
            ),
        );
    });

    it('maps error to a failed close icon', () => {
        const icon = getDependencyItemIcon('error');

        expect(icon).toStrictEqual(
            new vscode.ThemeIcon(
                'close',
                new vscode.ThemeColor('testing.iconFailed'),
            ),
        );
    });
});

describe('getDependencyGroupIcon', () => {
    it('maps ok to a neutral library icon', () => {
        const icon = getDependencyGroupIcon('ok');

        expect(icon).toStrictEqual(new vscode.ThemeIcon('library'));
    });

    it('maps warning to a warning item icon', () => {
        expect(getDependencyGroupIcon('warning')).toEqual(
            getDependencyItemIcon('warning'),
        );
    });

    it('maps error to an error item icon', () => {
        expect(getDependencyGroupIcon('error')).toEqual(
            getDependencyItemIcon('error'),
        );
    });
});
