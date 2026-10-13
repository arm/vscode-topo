import * as vscode from 'vscode';
import * as manifest from '../manifest';
import { TargetSelectionState, TargetTreeView } from './targetTreeView';
import { TargetDescription } from '../services/topoCliSchema';
import type { TargetHealth } from '../util/healthReport';
import { TargetModel } from '../models/targetModel';
import { TargetDataIssueTreeItem } from './treeItems/targetDataIssueTreeItem';
import { errored, loaded, loading, unloaded } from '../util/loadable';

describe('TargetTreeView', () => {
    let view: TargetTreeView;
    let targetModel: TargetModel;
    let treeView: vscode.TreeView<vscode.TreeItem>;
    const target = 'user@topo.local';
    const targetDescription: TargetDescription = {
        hostProcessors: [],
        remoteProcessors: [{ name: 'imx-rproc' }],
        totalMemoryKb: 1024,
    };
    const connectedTargetHealth: TargetHealth = {
        capabilities: [
            {
                name: 'Deployment',
                checks: [
                    {
                        name: 'Connectivity',
                        location: 'target',
                        status: 'ok',
                        value: 'ok',
                    },
                ],
            },
        ],
    };

    const disconnectedTargetHealth: TargetHealth = {
        capabilities: [
            {
                name: 'Deployment',
                checks: [
                    {
                        name: 'Connectivity',
                        location: 'target',
                        status: 'error',
                        value: '"ssh" not found on remote target\'s $PATH',
                    },
                ],
            },
        ],
    };

    beforeEach(() => {
        targetModel = new TargetModel();
        targetModel.setTargets(loaded([target]));
        targetModel.setSelected(target);
        targetModel.setSelectedTargetHealth(loaded(connectedTargetHealth));
        targetModel.setSelectedTargetDescription(loaded(targetDescription));
        view = new TargetTreeView(targetModel);
        treeView = vi.mocked(vscode.window.createTreeView).mock.results[0]
            .value;
        vi.clearAllTimers();
        vi.clearAllMocks();
    });

    describe('context', () => {
        it('syncs contexts when the view is created', () => {
            const model = new TargetModel();
            model.setTargets(errored('Failed to load targets'));
            model.setSelected('my-target');

            const contextView = new TargetTreeView(model);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                manifest.CONTEXT_TARGET_DATA_ISSUE,
                true,
            );
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                manifest.CONTEXT_SELECTED_TARGET_STATE,
                TargetSelectionState.Selected,
            );
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                manifest.CONTEXT_SELECTED_TARGET_CONNECTED,
                false,
            );
            contextView.dispose();
        });

        it('syncs target data issue context when target state changes', async () => {
            targetModel.setTargets(errored('Failed to load targets'));

            expect(
                vscode.commands.executeCommand,
            ).toHaveBeenCalledExactlyOnceWith(
                'setContext',
                manifest.CONTEXT_TARGET_DATA_ISSUE,
                true,
            );

            vi.mocked(vscode.commands.executeCommand).mockClear();
            targetModel.setTargets(loaded([target]));

            expect(
                vscode.commands.executeCommand,
            ).toHaveBeenCalledExactlyOnceWith(
                'setContext',
                manifest.CONTEXT_TARGET_DATA_ISSUE,
                false,
            );
        });

        it('syncs selected target context when selected target changes', async () => {
            targetModel.setSelected(undefined);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                manifest.CONTEXT_SELECTED_TARGET_STATE,
                TargetSelectionState.Unselected,
            );
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                manifest.CONTEXT_SELECTED_TARGET_CONNECTED,
                false,
            );
            expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(2);

            vi.mocked(vscode.commands.executeCommand).mockClear();
            targetModel.setSelected(target);

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                manifest.CONTEXT_SELECTED_TARGET_STATE,
                TargetSelectionState.Selected,
            );
            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'setContext',
                manifest.CONTEXT_SELECTED_TARGET_CONNECTED,
                false,
            );
            expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(2);
        });

        it('syncs connected target context when target health changes', () => {
            targetModel.setSelectedTargetHealth(
                loaded(disconnectedTargetHealth),
            );

            expect(
                vscode.commands.executeCommand,
            ).toHaveBeenCalledExactlyOnceWith(
                'setContext',
                manifest.CONTEXT_SELECTED_TARGET_CONNECTED,
                false,
            );

            vi.mocked(vscode.commands.executeCommand).mockClear();
            targetModel.setSelectedTargetHealth(loaded(connectedTargetHealth));

            expect(
                vscode.commands.executeCommand,
            ).toHaveBeenCalledExactlyOnceWith(
                'setContext',
                manifest.CONTEXT_SELECTED_TARGET_CONNECTED,
                true,
            );
        });

        it('keeps a target connected when dependencies have issues', () => {
            targetModel.setSelectedTargetHealth(
                loaded({
                    capabilities: [
                        {
                            name: 'Deployment',
                            checks: [
                                ...connectedTargetHealth.capabilities[0].checks,
                                {
                                    name: 'Container Engine',
                                    location: 'target',
                                    status: 'warning',
                                    value: 'missing',
                                },
                            ],
                        },
                    ],
                }),
            );

            expect(
                vscode.commands.executeCommand,
            ).toHaveBeenCalledExactlyOnceWith(
                'setContext',
                manifest.CONTEXT_SELECTED_TARGET_CONNECTED,
                true,
            );
        });

        it('keeps a target connected while its health is refreshing', () => {
            targetModel.setSelectedTargetHealth(
                loading(loaded(connectedTargetHealth)),
            );

            expect(
                vscode.commands.executeCommand,
            ).toHaveBeenCalledExactlyOnceWith(
                'setContext',
                manifest.CONTEXT_SELECTED_TARGET_CONNECTED,
                true,
            );
        });

        it('marks target connected without a connectivity check', () => {
            targetModel.setSelectedTargetHealth(loaded({ capabilities: [] }));

            expect(
                vscode.commands.executeCommand,
            ).toHaveBeenCalledExactlyOnceWith(
                'setContext',
                manifest.CONTEXT_SELECTED_TARGET_CONNECTED,
                true,
            );
        });
    });

    describe('getChildren', () => {
        it('shows the selected target health checks and processing domains', () => {
            const rootChildren = view.getChildren();

            expect(treeView.description).toBe(target);
            expect(rootChildren).toMatchObject([
                { label: 'Health' },
                { label: 'Processing Domains' },
            ]);
            const capabilities = view.getChildren(rootChildren[0]);
            expect(capabilities).toMatchObject([{ label: 'Deployment' }]);
            expect(view.getChildren(capabilities[0])).toMatchObject([
                { label: 'Connectivity' },
            ]);
            expect(view.getChildren(rootChildren[1])).toMatchObject([
                { label: manifest.PRIMARY_PROCESSING_DOMAIN },
                { label: 'imx-rproc' },
            ]);
        });

        it('shows loading while keeping existing health checks during refresh', () => {
            const health = loading(loaded(connectedTargetHealth));
            targetModel.setSelectedTargetHealth(health);

            const healthItem = view.getChildren()[0];
            expect(healthItem.iconPath).toEqual(
                new vscode.ThemeIcon('loading~spin'),
            );
            const capabilities = view.getChildren(healthItem);
            expect(view.getChildren(capabilities[0])).toMatchObject([
                { label: 'Connectivity' },
            ]);
        });

        it('returns a health check item while selected target health is pending', () => {
            targetModel.setSelectedTargetHealth(unloaded(true));

            const rootChildren = view.getChildren();

            expect(rootChildren).toHaveLength(1);
            expect(rootChildren[0]).toMatchObject({
                label: 'Checking target health',
                iconPath: { id: 'loading~spin' },
            });
        });

        it('returns no children when selected target health is unloaded', () => {
            targetModel.setSelectedTargetHealth(unloaded());

            expect(view.getChildren()).toEqual([]);
        });

        it('returns a connectivity item when selected target has a connectivity error', () => {
            targetModel.setSelectedTargetHealth(
                loaded(disconnectedTargetHealth),
            );

            const rootChildren = view.getChildren();

            expect(rootChildren[0]).toMatchObject({
                label: 'Connectivity',
                description: '"ssh" not found on remote target\'s $PATH',
                contextValue: 'HealthCheck Error',
            });
        });

        it('updates the view description when the selected target changes', () => {
            const otherTarget = 'user@other.local';
            targetModel.setTargets(loaded([target, otherTarget]));
            targetModel.setSelected(otherTarget);
            targetModel.setSelectedTargetHealth(
                errored('ssh connection failed'),
            );

            const rootChildren = view.getChildren();

            expect(treeView.description).toBe(otherTarget);
            expect(rootChildren[0]).toMatchObject({
                label: 'Failed to check target health',
                description: 'ssh connection failed',
                contextValue: 'OpenableError',
            });
        });

        it('shows loading while failed selected target health is refreshing', () => {
            targetModel.setSelectedTargetHealth(
                loading(errored('topo health failed')),
            );

            const rootChildren = view.getChildren();

            expect(rootChildren[0]).toMatchObject({
                label: 'Failed to check target health',
                description: 'topo health failed',
                iconPath: { id: 'loading~spin' },
            });
        });

        it('shows description failures under processing domains', () => {
            const description = errored('Failed to load target description');
            targetModel.setSelectedTargetDescription(description);

            const processingDomains = view.getChildren()[1];
            expect(view.getChildren(processingDomains)).toMatchObject([
                { description: 'Failed to load target description' },
            ]);
        });

        it('returns empty array when no target is selected', async () => {
            targetModel.setTargets(loaded([]));
            targetModel.setSelected(undefined);

            const rootChildren = view.getChildren();

            expect(rootChildren.length).toEqual(0);
            expect(treeView.description).toBeUndefined();
        });

        it('shows target data issues at the root', () => {
            const targets = errored('Failed to load targets');
            targetModel.setTargets(targets);

            const rootChildren = view.getChildren();

            expect(rootChildren).toStrictEqual([
                new TargetDataIssueTreeItem(targets),
            ]);
        });
    });
});
