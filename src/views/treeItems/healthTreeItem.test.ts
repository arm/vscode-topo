import * as vscode from 'vscode';
import { HealthCheck } from '../../services/topoCliSchema';
import { loaded } from '../../util/loadable';
import { HealthTreeItem } from './healthTreeItem';

const connectivity: HealthCheck = {
    name: 'Connectivity',
    location: 'target',
    status: 'ok',
    value: 'ok',
};

describe('HealthTreeItem', () => {
    it('preserves capability order and checks shared between capabilities', () => {
        const deploymentChecks: HealthCheck[] = [
            {
                name: 'Container Engine',
                location: 'target',
                status: 'ok',
                value: 'present',
            },
            connectivity,
        ];
        const item = new HealthTreeItem(
            loaded({
                capabilities: [
                    { name: 'Project management', checks: [connectivity] },
                    { name: 'Deployment', checks: deploymentChecks },
                ],
            }),
        );

        const capabilities = item.getChildren();
        expect(capabilities).toMatchObject([
            { label: 'Project management' },
            { label: 'Deployment' },
        ]);
        expect(capabilities[0].getChildren()).toMatchObject([
            { label: 'Connectivity' },
        ]);
        expect(capabilities[1].getChildren()).toMatchObject([
            { label: 'Container Engine' },
            { label: 'Connectivity' },
        ]);
    });

    it('shows loading on health, capabilities, and checks while refreshing', () => {
        const item = new HealthTreeItem(
            loaded(
                {
                    capabilities: [
                        { name: 'Deployment', checks: [connectivity] },
                    ],
                },
                true,
            ),
        );

        const loadingIcon = new vscode.ThemeIcon('loading~spin');
        const capabilities = item.getChildren();

        expect(item.iconPath).toEqual(loadingIcon);
        expect(capabilities).toMatchObject([{ iconPath: loadingIcon }]);
        expect(capabilities[0].getChildren()).toMatchObject([
            { iconPath: loadingIcon },
        ]);
    });

    it('offers fixes when a capability contains a fixable check', () => {
        const item = new HealthTreeItem(
            loaded({
                capabilities: [
                    {
                        name: 'Deployment',
                        checks: [
                            {
                                name: 'ProcessingDomainDriver',
                                location: 'target',
                                status: 'error',
                                value: 'missing',
                                fix: {
                                    description:
                                        'Install processing domain driver',
                                    command:
                                        'topo install processing-domain-driver',
                                },
                            },
                        ],
                    },
                ],
            }),
        );

        expect(item.contextValue).toBe('Health HasFixableIssues');
    });
});
