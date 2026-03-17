import * as vscode from 'vscode';
import { TargetTreeDependencyItem } from './targetTreeDependencyItem';
import { mock } from 'jest-mock-extended';
import { HealthCheckDependency } from '../topoCliSchema';

describe('TargetTreeDependencyItem', () => {
    it('sets label and description', () => {
        const item = new TargetTreeDependencyItem(
            mock<HealthCheckDependency>({
                name: 'Container Engine',
                value: 'docker',
            }),
        );

        expect(item.label).toBe('Container Engine');
        expect(item.description).toBe('docker');
    });

    it('sets icon and context value for healthy dependency', () => {
        const item = new TargetTreeDependencyItem(
            mock<HealthCheckDependency>({
                status: 'ok',
            }),
        );

        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('check');
        expect(item.contextValue).toBe('Dependency Healthy');
    });

    it('sets icon and context value for unhealthy dependency', () => {
        const item = new TargetTreeDependencyItem(
            mock<HealthCheckDependency>({
                status: 'error',
            }),
        );

        const icon = item.iconPath as vscode.ThemeIcon;
        expect(icon.id).toBe('warning');
        expect(item.contextValue).toBe('Dependency Unhealthy');
    });
});
