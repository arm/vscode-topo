import { getContainerWebUrl } from './getContainerWebUrl';

describe('getContainerWebUrl', () => {
    it('prefers port 80 regardless of the address order', () => {
        const address = 'target.local:8080, target.local:443, target.local:80';

        const url = getContainerWebUrl(address);

        expect(url).toBe('http://target.local:80');
    });

    it('uses HTTPS for port 443', () => {
        const url = getContainerWebUrl('target.local:443');

        expect(url).toBe('https://target.local:443');
    });

    it('falls back to common development web ports', () => {
        const url = getContainerWebUrl('target.local:5432, target.local:8080');

        expect(url).toBe('http://target.local:8080');
    });

    it('supports unstripped topo port mappings', () => {
        const url = getContainerWebUrl('0.0.0.0:8080->80/tcp');

        expect(url).toBe('http://0.0.0.0:8080');
    });

    it('formats IPv6 addresses for use in a URL', () => {
        const url = getContainerWebUrl(':::8080');

        expect(url).toBe('http://[::]:8080');
    });

    it('returns undefined when no likely web port is published', () => {
        const url = getContainerWebUrl(
            'target.local:22, target.local:5432, 80/tcp',
        );

        expect(url).toBeUndefined();
    });
});
