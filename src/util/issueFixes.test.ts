import { IssueCheck, TargetHealthCheck } from '../topoCliSchema';
import {
    hasFixCommand,
    getIssueFixCommandGroups,
    getTargetIssueFixCommandGroups,
    type IssueFixCommandGroup,
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
        const health: TargetHealthCheck = {
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
        };
        const expectedCommandGroups: IssueFixCommandGroup[] = [];

        const result = getTargetIssueFixCommandGroups(health);

        expect(result).toEqual(expectedCommandGroups);
    });

    it('groups target health issue fixes by command', () => {
        const health: TargetHealthCheck = {
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
        };
        const expectedCommandGroups = [
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
        ];

        const result = getTargetIssueFixCommandGroups(health);

        expect(result).toEqual(expectedCommandGroups);
    });
});

describe('getIssueFixCommandGroups', () => {
    it('groups the provided issues by command', () => {
        const issues: IssueCheck[] = [
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
                name: 'Remoteproc Shim',
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
        ];

        const result = getIssueFixCommandGroups(issues);

        expect(result).toEqual([
            {
                issueNames: ['Remoteproc Runtime', 'Remoteproc Shim'],
                command: 'topo install remoteproc',
            },
            {
                issueNames: ['Debugger'],
                command: 'topo install debugger',
            },
        ]);
    });
});

describe('hasFixCommand', () => {
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
        const healthIssue = issue;
        const expectedResult = expected;

        const result = hasFixCommand(healthIssue);

        expect(result).toBe(expectedResult);
    });
});
