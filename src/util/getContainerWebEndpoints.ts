export interface ContainerWebEndpoint {
    port: number;
    url: string;
}

interface PublishedAddress {
    host: string;
    port: number;
}

function parsePublishedAddress(value: string): PublishedAddress | undefined {
    const address = value.split('->', 1)[0].trim();
    const portSeparator = address.lastIndexOf(':');
    if (portSeparator < 1) {
        return undefined;
    }

    const host = address.slice(0, portSeparator);
    const port = Number(address.slice(portSeparator + 1));
    if (
        !host ||
        /[\s/@?#\\]/.test(host) ||
        !Number.isInteger(port) ||
        port < 1 ||
        port > 65_535
    ) {
        return undefined;
    }

    return { host, port };
}

function formatUrlHost(host: string): string {
    if (host.includes(':') && !(host.startsWith('[') && host.endsWith(']'))) {
        return `[${host}]`;
    }
    return host;
}

function getScheme(port: number): 'http' | 'https' {
    return port === 443 || port === 8443 ? 'https' : 'http';
}

/** Returns one endpoint per published port in the order reported by topo ps. */
export function getContainerWebEndpoints(
    address: string,
): ContainerWebEndpoint[] {
    const ports = new Set<number>();
    return address
        .split(',')
        .map(parsePublishedAddress)
        .filter((item): item is PublishedAddress => {
            if (!item || ports.has(item.port)) {
                return false;
            }
            ports.add(item.port);
            return true;
        })
        .map(({ host, port }) => ({
            port,
            url: `${getScheme(port)}://${formatUrlHost(host)}:${port}`,
        }));
}
