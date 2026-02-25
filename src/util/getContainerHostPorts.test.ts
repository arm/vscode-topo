import { getContainerHostPorts } from './getContainerHostPorts';
import type { ContainerItem, TargetItem } from './types';

const makeContainer = (ports: ContainerItem['ports']): ContainerItem => {
    const target: TargetItem = {
        id: 'topo',
        ssh: 'user@topo.local',
        user: 'user',
        host: 'topo.local',
        targetDescription: {
            hostProcessor: [],
            remoteprocCPU: [],
        },
    };
    return {
        id: 'abc123',
        name: 'my-container',
        image: 'nginx',
        state: 'running',
        status: 'Up',
        labels: '',
        runningFor: '1h',
        createdAt: 'now',
        runtime: 'runc',
        annotations: {},
        ports,
        cpuUsage: '0%',
        memUsage: '0B / 0B',
        target,
    };
};

describe('getContainerHostPorts', () => {
    it('returns unique valid host ports as numbers', () => {
        const c = makeContainer({
            '80/tcp': [
                { HostIp: '0.0.0.0', HostPort: '8080' },
                { HostIp: '::', HostPort: '8080' },
            ],
            '443/tcp': [{ HostIp: '0.0.0.0', HostPort: '8443' }],
        });

        const ports = getContainerHostPorts(c).sort((a, b) => a - b);

        expect(ports).toEqual([8080, 8443]);
    });

    it('accepts leading/trailing whitespace around HostPort', () => {
        const c = makeContainer({
            '80/tcp': [{ HostIp: '0.0.0.0', HostPort: '  8080  ' }],
        });

        expect(getContainerHostPorts(c)).toEqual([8080]);
    });

    it('filters out invalid HostPort values', () => {
        const c = makeContainer({
            '80/tcp': [
                { HostIp: '0.0.0.0', HostPort: '' },
                { HostIp: '0.0.0.0', HostPort: 'abc' },
                { HostIp: '0.0.0.0', HostPort: '-1' },
                { HostIp: '0.0.0.0', HostPort: '0' },
                { HostIp: '0.0.0.0', HostPort: '65536' },
                { HostIp: '0.0.0.0', HostPort: '22.5' },
                { HostIp: '0.0.0.0', HostPort: '1e2' },
                { HostIp: '0.0.0.0', HostPort: '22' },
            ],
        });

        expect(getContainerHostPorts(c)).toEqual([22]);
    });
});
