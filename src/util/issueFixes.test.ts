import { IssueCheck, TargetHealthCheck } from '../topoCliSchema';
import {
    hasFixableIssueFix,
    getTargetIssueFixCommandGroups,
} from './issueFixes';

describe('getIssueFixes', () => {
    const targetHealth: TargetHealthCheck = {
        isLocalhost: false,
        connectivity: {
            name: 'Connected',
            status: 'ok',
            value: '',
        },
        dependencies: [],
        subsystemDriver: {
            name: 'Subsystem Driver',
            status: 'ok',
            value: 'installed',
        },
    };

    it('ignores target health issues without executable fixes', () => {
        expect(
            getTargetIssueFixCommandGroups({
                ...targetHealth,
                connectivity: {
                    name: 'Connected',
                    status: 'error',
                    value: 'unreachable',
                    fix: {
                        description: 'Manual setup required',
                    },
                },
                dependencies: [
                    {
                        name: 'Container Engine',
                        status: 'error',
                        value: 'missing',
                        fix: {
                            description: 'Manual setup required',
                        },
                    },
                    {
                        name: 'Debugger',
                        status: 'warning',
                        value: 'missing',
                    },
                ],
            }),
        ).toEqual([]);
    });

    it('groups target health issue fixes by command', () => {
        expect(
            getTargetIssueFixCommandGroups({
                ...targetHealth,
                connectivity: {
                    name: 'Connected',
                    status: 'error',
                    value: 'unreachable',
                    fix: {
                        description: 'Install remoteproc components',
                        command: 'topo install remoteproc',
                    },
                },
                subsystemDriver: {
                    name: 'Subsystem Driver',
                    status: 'error',
                    value: 'missing',
                    fix: {
                        description: 'Install remoteproc components',
                        command: 'topo install remoteproc',
                    },
                },
                dependencies: [
                    {
                        name: 'Remoteproc Runtime',
                        status: 'error',
                        value: 'missing',
                        fix: {
                            description: 'Install remoteproc components',
                            command: 'topo install remoteproc',
                        },
                    },
                    {
                        name: 'Debugger',
                        status: 'warning',
                        value: 'missing',
                        fix: {
                            description: 'Install debugger',
                            command: 'topo install debugger',
                        },
                    },
                ],
            }),
        ).toEqual([
            {
                issueNames: [
                    'Connected',
                    'Subsystem Driver',
                    'Remoteproc Runtime',
                ],
                command: 'topo install remoteproc',
            },
            {
                issueNames: ['Debugger'],
                command: 'topo install debugger',
            },
        ]);
    });

    it('identifies dependency issues with executable fixes', () => {
        const fixableDependency: IssueCheck = {
            name: 'Container Engine',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install Docker',
                command: 'topo install docker',
            },
        };
        const healthyDependency: IssueCheck = {
            name: 'Debugger',
            status: 'ok',
            value: 'installed',
        };
        const infoDependency: IssueCheck = {
            name: 'Runtime',
            status: 'info',
            value: 'available',
        };
        const manualDependency: IssueCheck = {
            name: 'Runtime',
            status: 'warning',
            value: 'missing',
            fix: {
                description: 'Manual setup required',
            },
        };

        expect(
            [
                fixableDependency,
                healthyDependency,
                infoDependency,
                manualDependency,
            ].filter(hasFixableIssueFix),
        ).toEqual([fixableDependency]);
    });

    it('identifies connectivity and dependency issues with executable fixes', () => {
        const connectivityIssue: TargetHealthCheck['connectivity'] = {
            name: 'Connected',
            status: 'error',
            value: 'unreachable',
            fix: {
                description: 'Set up SSH keys',
                command: 'topo setup-keys',
            },
        };
        const dependencyIssue: IssueCheck = {
            name: 'Debugger',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install debugger',
                command: 'topo install debugger',
            },
        };

        expect(
            [connectivityIssue, dependencyIssue].filter(hasFixableIssueFix),
        ).toEqual([connectivityIssue, dependencyIssue]);
    });
});
