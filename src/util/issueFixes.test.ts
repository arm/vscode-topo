import { HealthCheck } from '../services/topoCliSchema';
import { hasFixCommand, getIssueFixCommandGroups } from './issueFixes';

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
