import * as vscode from 'vscode';
import { TargetTreeDependencyItem } from './targetTreeDependencyItem';

describe('TargetTreeDependencyItem', () => {
    it('sets label and description', () => {
        const item = new TargetTreeDependencyItem({
            name: 'Container Engine',
            value: 'docker',
            status: 'ok',
        });

        expect(item.label).toBe('Container Engine');
        expect(item.description).toBe('docker');
    });

    it('sets icon and context value for an ok dependency', () => {
        const item = new TargetTreeDependencyItem({
            name: 'Container Engine',
            value: 'docker',
            status: 'ok',
        });

        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('check');
        expect(item.contextValue).toBe('Dependency Ok');
    });

    it('sets icon and context value for a dependency with a warning', () => {
        const item = new TargetTreeDependencyItem({
            name: 'Container Engine',
            value: 'docker',
            status: 'warning',
        });

        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('warning');
        expect(item.contextValue).toBe('Dependency Warning');
    });

    it('sets icon and context value for a dependency with an error', () => {
        const item = new TargetTreeDependencyItem({
            name: 'Container Engine',
            value: 'missing',
            status: 'error',
        });

        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('close');
        expect(item.contextValue).toBe('Dependency Error');
    });

    it.each([['Remoteproc Runtime'], ['Remoteproc Shim']])(
        'marks unhealthy %s dependencies as installable',
        (dependencyName) => {
            const item = new TargetTreeDependencyItem({
                name: dependencyName,
                value: 'missing',
                status: 'warning',
            });

            expect(item.contextValue).toBe('Dependency Warning Installable');
        },
    );

    it('does not mark healthy remoteproc dependencies as installable', () => {
        const item = new TargetTreeDependencyItem({
            name: 'Remoteproc Runtime',
            value: 'installed',
            status: 'ok',
        });

        expect(item.contextValue).toBe('Dependency Ok');
    });
});
