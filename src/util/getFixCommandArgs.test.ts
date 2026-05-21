import { getFixCommandArgs } from './getFixCommandArgs';

describe('getFixCommandArgs', () => {
    it('returns args for a simple command', () => {
        expect(getFixCommandArgs('topo install debugger')).toEqual([
            'topo',
            'install',
            'debugger',
        ]);
    });

    it('splits args on whitespace', () => {
        expect(
            getFixCommandArgs(
                'topo install remoteproc-runtime --target root@10.2.2.36',
            ),
        ).toEqual([
            'topo',
            'install',
            'remoteproc-runtime',
            '--target',
            'root@10.2.2.36',
        ]);
    });
});
