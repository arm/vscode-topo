import { HealthCheck, TargetHealthReport } from '../topoCliSchema';
import {
    hasFix,
    hasFixCommand,
    getIssueFixCommandGroups,
    getTargetIssueFixCommandGroups,
    type IssueFixCommandGroup,
} from './issueFixes';

describe('getTargetIssueFixCommandGroups', () => {
    const targetHealth: TargetHealthReport = {
        destination: 'ssh://topo.local',
        isLocalhost: false,
        connectivity: {
            name: 'Connected',
            status: 'ok',
            value: '',
        },
        dependencies: [],
        processingDomainDriver: {
            name: 'Processing Domain Driver',
            status: 'ok',
            value: 'installed',
        },
    };

    it('ignores target health checks without executable fixes', () => {
        const health: TargetHealthReport = {
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

    it('groups target issue fixes by command', () => {
        const health: TargetHealthReport = {
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
            processingDomainDriver: {
                name: 'Processing Domain Driver',
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
                    'Processing Domain Driver',
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
        const healthChecks: HealthCheck[] = [
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

        const result = getIssueFixCommandGroups(healthChecks);

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
        healthCheck: HealthCheck;
        expected: boolean;
    }>([
        {
            name: 'executable fix',
            healthCheck: {
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
            name: 'healthy health check',
            healthCheck: {
                name: 'Debugger',
                status: 'ok',
                value: 'installed',
            },
            expected: false,
        },
        {
            name: 'informational health check',
            healthCheck: {
                name: 'Runtime',
                status: 'info',
                value: 'available',
            },
            expected: false,
        },
        {
            name: 'manual fix without command',
            healthCheck: {
                name: 'Runtime',
                status: 'warning',
                value: 'missing',
                fix: {
                    description: 'Manual setup required',
                },
            },
            expected: false,
        },
    ])('returns $expected for $name', ({ healthCheck, expected }) => {
        const result = hasFixCommand(healthCheck);

        expect(result).toBe(expected);
    });
});

describe('hasFix', () => {
    it('treats a health check with fix details as a health issue', () => {
        const healthCheck: HealthCheck = {
            name: 'Runtime',
            status: 'warning',
            value: 'missing',
            fix: {
                description: 'Manual setup required',
            },
        };

        expect(hasFix(healthCheck)).toBe(true);
    });

    it('does not treat a health check without fix details as a health issue', () => {
        const healthCheck: HealthCheck = {
            name: 'Runtime',
            status: 'ok',
            value: 'installed',
        };

        expect(hasFix(healthCheck)).toBe(false);
    });
});
