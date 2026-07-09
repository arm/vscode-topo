import { getContainerWebEndpoints } from './getContainerWebEndpoints';

describe('getContainerWebEndpoints', () => {
    it('returns every published port in the reported order', () => {
        const address = 'target.local:8080, target.local:5432, target.local:80';

        const endpoints = getContainerWebEndpoints(address);

        expect(endpoints).toEqual([
            { port: 8080, url: 'http://target.local:8080' },
            { port: 5432, url: 'http://target.local:5432' },
            { port: 80, url: 'http://target.local:80' },
        ]);
    });

    it('uses HTTPS for conventional HTTPS ports', () => {
        const endpoints = getContainerWebEndpoints(
            'target.local:443, target.local:8443',
        );

        expect(endpoints).toEqual([
            { port: 443, url: 'https://target.local:443' },
            { port: 8443, url: 'https://target.local:8443' },
        ]);
    });

    it('supports unstripped topo port mappings', () => {
        const endpoints = getContainerWebEndpoints('0.0.0.0:8080->80/tcp');

        expect(endpoints).toEqual([{ port: 8080, url: 'http://0.0.0.0:8080' }]);
    });

    it('returns only one endpoint when a port is reported more than once', () => {
        const endpoints = getContainerWebEndpoints(
            'target.local:8080, [::]:8080',
        );

        expect(endpoints).toEqual([
            { port: 8080, url: 'http://target.local:8080' },
        ]);
    });

    it('formats IPv6 addresses for use in a URL', () => {
        const endpoints = getContainerWebEndpoints(':::8080');

        expect(endpoints).toEqual([{ port: 8080, url: 'http://[::]:8080' }]);
    });

    it('ignores entries without a valid published host and port', () => {
        const endpoints = getContainerWebEndpoints(
            'target.local, 80/tcp, target.local:0, target.local:65536',
        );

        expect(endpoints).toEqual([]);
    });
});
