import { HealthCheckDependency } from '../topoCliSchema';
import { getDependencyFixCommandGroups } from './getDependencyFixes';

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
});
