interface WebEndpoint {
    port: number;
    scheme: 'http' | 'https';
}

const WEB_ENDPOINTS: WebEndpoint[] = [
    { port: 80, scheme: 'http' },
    { port: 443, scheme: 'https' },
    { port: 8080, scheme: 'http' },
    { port: 8443, scheme: 'https' },
    { port: 8000, scheme: 'http' },
    { port: 8888, scheme: 'http' },
    { port: 3000, scheme: 'http' },
    { port: 3001, scheme: 'http' },
    { port: 4200, scheme: 'http' },
    { port: 5000, scheme: 'http' },
    { port: 5173, scheme: 'http' },
    { port: 5174, scheme: 'http' },
];

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

/** Selects the most likely web endpoint from the addresses reported by topo ps. */
export function getContainerWebUrl(address: string): string | undefined {
    const publishedAddresses = address
        .split(',')
        .map(parsePublishedAddress)
        .filter((item): item is PublishedAddress => item !== undefined);

    for (const endpoint of WEB_ENDPOINTS) {
        const publishedAddress = publishedAddresses.find(
            (item) => item.port === endpoint.port,
        );
        if (publishedAddress) {
            const host = formatUrlHost(publishedAddress.host);
            return `${endpoint.scheme}://${host}:${endpoint.port}`;
        }
    }

    return undefined;
}
