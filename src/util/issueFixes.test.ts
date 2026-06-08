import { IssueCheck, TargetHealthCheck } from '../topoCliSchema';
import {
    hasFixableIssueFix,
    getTargetIssueFixCommandGroups,
} from './issueFixes';

describe('getTargetIssueFixCommandGroups', () => {
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
});

describe('hasFixableIssueFix', () => {
    it.each<{
        name: string;
        issue: IssueCheck;
        expected: boolean;
    }>([
        {
            name: 'executable fix',
            issue: {
                name: 'Container Engine',
                status: 'error',
                value: 'missing',
                fix: {
                    description: 'Install Docker',
                    command: 'topo install docker',
                },
            },
            expected: true,
        },
        {
            name: 'healthy dependency',
            issue: {
                name: 'Debugger',
                status: 'ok',
                value: 'installed',
            },
            expected: false,
        },
        {
            name: 'informational dependency',
            issue: {
                name: 'Runtime',
                status: 'info',
                value: 'available',
            },
            expected: false,
        },
        {
            name: 'manual fix without command',
            issue: {
                name: 'Runtime',
                status: 'warning',
                value: 'missing',
                fix: {
                    description: 'Manual setup required',
                },
            },
            expected: false,
        },
    ])('returns $expected for $name', ({ issue, expected }) => {
        expect(hasFixableIssueFix(issue)).toBe(expected);
    });
});
