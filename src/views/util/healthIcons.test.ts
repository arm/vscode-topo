import * as vscode from 'vscode';
import { getHealthGroupIcon, getHealthCheckIcon } from './healthIcons';

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

describe('getHealthGroupIcon', () => {
    it('maps ok to a neutral library icon', () => {
        const icon = getHealthGroupIcon('ok');

        expect(icon).toStrictEqual(new vscode.ThemeIcon('library'));
    });

    it('maps warning to a warning item icon', () => {
        expect(getHealthGroupIcon('warning')).toEqual(
            getHealthCheckIcon('warning'),
        );
    });

    it('maps error to an error item icon', () => {
        expect(getHealthGroupIcon('error')).toEqual(
            getHealthCheckIcon('error'),
        );
    });
});
