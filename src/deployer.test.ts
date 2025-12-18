import { Deployer } from './deployer';
import { spawn } from 'child_process';
import path from 'path';
import { Target } from './workloadPlacement/target';
import { TargetStore } from './workloadPlacement/targetStore';

/* eslint-disable @typescript-eslint/no-explicit-any */

type EventHandler = (...args: any[]) => void;
const events: { [key: string]: EventHandler[] } = {};
const proc = {
    stdout: {
        on: jest.fn((event: string, cb: EventHandler) => {
            events[event] = events[event] || [];
            events[event].push(cb);
        })
    },
    stderr: {
        on: jest.fn((event: string, cb: EventHandler) => {
            events[event] = events[event] || [];
            events[event].push(cb);
        })
    },
    on: jest.fn((event: string, cb: EventHandler) => {
        events[event] = events[event] || [];
        events[event].push(cb);
    }),
    pid: 1234,
    kill: jest.fn()
};

jest.mock('child_process', () => {
    return {
        spawn: jest.fn(() => {
            return proc;
        }),
    };
});

jest.mock('fs', () => ({
    existsSync: jest.fn(() => true),
}));

describe('Deployer', () => {
    let deployer: Deployer;
    const composeFilePath: string = '/tmp/compose.topo.yaml';
    const target = new Target('test-target', 'user@host');

    const topoCli = {
        deploy: jest.fn(() => {
            return (spawn as jest.Mock)();
        }),
    };
    const targetStore: jest.Mocked<Pick<TargetStore, 'getSelectedTarget'>> = {
        getSelectedTarget: jest.fn(async () => target),
    };

    beforeEach(() => {
        deployer = new Deployer(topoCli, targetStore);

        jest.clearAllMocks();
    });

    it('should start the process and emit events', async () => {

        await deployer.start(composeFilePath);

        expect(topoCli.deploy).toHaveBeenCalledWith(path.dirname(composeFilePath), target.ssh);
    });

    it('should fail if no target is selected', async () => {
        targetStore.getSelectedTarget.mockResolvedValueOnce(undefined);

        const deployOperation = deployer.start(composeFilePath);

        await expect(deployOperation).rejects.toMatchObject({
            message: expect.stringContaining('No target selected'),
        });
    });

    it('should not start if already started', async () => {
        await deployer.start(composeFilePath);

        await deployer.start(composeFilePath);

        expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should stop the process on non-win32', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'linux' });
        // Patch process.kill to a jest mock
        const oldKill = process.kill;
        process.kill = jest.fn();
        await deployer.start(composeFilePath);

        await deployer.stop();

        expect(process.kill).toHaveBeenCalledWith(-1234);
        process.kill = oldKill;
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should stop the process on win32', async () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });
        await deployer.start(composeFilePath);

        await deployer.stop();

        expect(spawn).toHaveBeenCalledWith('taskkill', ['/pid', '1234', '/T', '/F']);
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should emit stdout, stderr, exit, and error events', async () => {

        const stdoutListener = jest.fn();
        const stderrListener = jest.fn();
        const exitListener = jest.fn();
        const errorListener = jest.fn();
        deployer.onStdoutData(stdoutListener);
        deployer.onStderrData(stderrListener);
        deployer.onExit(exitListener);
        deployer.onError(errorListener);

        await deployer.start(composeFilePath);

        // Simulate events
        // Get the mock process object from the spawn mock
        const events = (spawn as jest.Mock).mock.results[0].value;
        // Simulate stdout and stderr
        (events.stdout.on.mock.calls[0][1] as (data: Buffer) => void)(Buffer.from('out'));
        (events.stderr.on.mock.calls[0][1] as (data: Buffer) => void)(Buffer.from('err'));
        // Simulate exit and error
        const exitCall = events.on.mock.calls.find((call: any[]) => call[0] === 'exit');
        if (exitCall) {
            (exitCall[1] as (code: number | null) => void)(0);
        }
        const errorCall = events.on.mock.calls.find((call: any[]) => call[0] === 'error');
        if (errorCall) {
            (errorCall[1] as (err: Error) => void)(new Error('fail'));
        }
        expect(stdoutListener).toHaveBeenCalledWith(Buffer.from('out'));
        expect(stderrListener).toHaveBeenCalledWith(Buffer.from('err'));
        expect(exitListener).toHaveBeenCalledWith(0);
        expect(errorListener).toHaveBeenCalledWith(new Error('fail'));
    });

});
