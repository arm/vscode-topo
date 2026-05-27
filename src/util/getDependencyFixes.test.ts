import { HealthCheckDependency } from '../topoCliSchema';
import {
    getDependencyFixCommandGroups,
    getFixableDependencyFixes,
    hasFixableDependencies,
} from './getDependencyFixes';

describe('getDependencyFixes', () => {
    it('ignores dependencies without executable fixes', () => {
        const dependencies: HealthCheckDependency[] = [
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
        ];

        expect(getDependencyFixCommandGroups(dependencies)).toEqual([]);
    });

    it('groups dependency fixes by command', () => {
        const dependencies: HealthCheckDependency[] = [
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

        expect(getDependencyFixCommandGroups(dependencies)).toEqual([
            {
                names: ['Remoteproc Runtime', 'Remoteproc Shim'],
                command: 'topo install remoteproc',
            },
            {
                names: ['Debugger'],
                command: 'topo install debugger',
            },
        ]);
    });

    it('returns fixable dependency fixes for unhealthy dependencies only', () => {
        const fixableDependency: HealthCheckDependency = {
            name: 'Container Engine',
            status: 'error',
            value: 'missing',
            fix: {
                description: 'Install Docker',
                command: 'topo install docker',
            },
        };
        const healthyDependency: HealthCheckDependency = {
            name: 'Debugger',
            status: 'ok',
            value: 'installed',
            fix: {
                description: 'Install debugger',
                command: 'topo install debugger',
            },
        };
        const manualDependency: HealthCheckDependency = {
            name: 'Runtime',
            status: 'warning',
            value: 'missing',
            fix: {
                description: 'Manual setup required',
            },
        };

        expect(
            getFixableDependencyFixes([
                fixableDependency,
                healthyDependency,
                manualDependency,
            ]),
        ).toEqual([
            {
                dependency: fixableDependency,
                fix: fixableDependency.fix,
            },
        ]);
    });

    it('checks if dependencies have fixes', () => {
        expect(
            hasFixableDependencies([
                {
                    name: 'Container Engine',
                    status: 'error',
                    value: 'missing',
                    fix: {
                        description: 'Install Docker',
                        command: 'topo install docker',
                    },
                },
            ]),
        ).toBe(true);

        expect(
            hasFixableDependencies([
                {
                    name: 'Container Engine',
                    status: 'error',
                    value: 'missing',
                    fix: {
                        description: 'Manual setup required',
                    },
                },
            ]),
        ).toBe(false);
    });
});
