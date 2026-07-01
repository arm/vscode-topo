import * as vscode from 'vscode';
import { getHealthCheckIcon } from './healthIcons';

describe('getHealthCheckIcon', () => {
    it('maps ok to a passed check icon', () => {
        const icon = getHealthCheckIcon('ok');

        expect(icon).toStrictEqual(
            new vscode.ThemeIcon(
                'check',
                new vscode.ThemeColor('testing.iconPassed'),
            ),
        );
    });

    it('maps warning to a queued warning icon', () => {
        const icon = getHealthCheckIcon('warning');

        expect(icon).toStrictEqual(
            new vscode.ThemeIcon(
                'warning',
                new vscode.ThemeColor('testing.iconQueued'),
            ),
        );
    });

    it('maps error to a failed close icon', () => {
        const icon = getHealthCheckIcon('error');

        expect(icon).toStrictEqual(
            new vscode.ThemeIcon(
                'close',
                new vscode.ThemeColor('testing.iconFailed'),
            ),
        );
    });
});
