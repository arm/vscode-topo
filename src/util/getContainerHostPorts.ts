import { ContainerItem } from '../util/types';

const minPort = 1;
const maxPort = 65535;

const parseValidPort = (value: string): number | undefined => {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        return undefined;
    }
    const port = Number(trimmed);

    if (port < minPort || port > maxPort) {
        return undefined;
    }
    return port;
};

export const getContainerHostPorts = (c: ContainerItem): number[] => {
    const hostPorts: Set<number> = new Set();
    for (const mappings of Object.values(c.ports)) {
        if (mappings) {
            mappings.forEach((mapping) => {
                const port = parseValidPort(mapping.HostPort);
                if (port !== undefined) {
                    hostPorts.add(port);
                }
            });
        }
    }
    return [...hostPorts];
};
