import { parseTargetDescription } from './parseTargetDescription';

describe('parseTargetDescription', () => {
    it('parses valid target-description yaml', () => {
        const yaml = `host:
    - model: Cortex-A55
      cores: 2
      features:
        - fp
        - asimd
remoteprocs:
    - name: imx-rproc`;

        const parsed = parseTargetDescription(yaml);

        expect(parsed).toEqual({
            hostProcessor: [
                {
                    model: 'Cortex-A55',
                    cores: 2,
                    features: ['fp', 'asimd'],
                },
            ],
            remoteprocCPU: [{ name: 'imx-rproc' }],
        });
    });

    it('throws when yaml is invalid', () => {
        expect(() => parseTargetDescription('host: [')).toThrow(
            /Failed to parse target description yaml/,
        );
    });

    it('throws when host section is missing', () => {
        const yaml = ['remoteprocs:', '  - name: imx-rproc'].join('\n');

        expect(() => parseTargetDescription(yaml)).toThrow(
            /"host" must be an array/,
        );
    });

    it('throws when remoteprocs section is missing', () => {
        const yaml = [
            'host:',
            '  - model: Cortex-A55',
            '    cores: 2',
            '    features: []',
        ].join('\n');

        expect(() => parseTargetDescription(yaml)).toThrow(
            /"remoteprocs" must be an array/,
        );
    });

    it('throws when a host feature is not a string', () => {
        const yaml = [
            'host:',
            '  - model: Cortex-A55',
            '    cores: 2',
            '    features:',
            '      - fp',
            '      - 10',
            'remoteprocs:',
            '  - name: imx-rproc',
        ].join('\n');

        expect(() => parseTargetDescription(yaml)).toThrow(
            /features\[1\] must be a string/,
        );
    });
});
