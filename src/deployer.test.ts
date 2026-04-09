import { TopoCli } from './topoCli';
import { Deployer } from './deployer';
import { spawn } from 'child_process';
import path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock('child_process', () => {
  type EventHandler = (...args: any[]) => void;
  const events: { [key: string]: EventHandler[] } = {};
  return {
      spawn: jest.fn(() => {
          return {
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
      }),
  };
});

jest.mock('fs', () => ({
    existsSync: jest.fn(() => true),
}));

describe('Deployer', () => {
    let deployer: Deployer;
    let composeFilePath: string;
    let topoCli: Pick<TopoCli, 'generateMakefile'>;

    beforeEach(() => {
        topoCli = {
            generateMakefile: jest.fn(),
        };
        deployer = new Deployer(topoCli);
        composeFilePath = '/tmp/compose.topo.yaml';
        jest.clearAllMocks();
    });

    it('should start the process and emit events', () => {

        deployer.start(composeFilePath);
  
        expect(spawn).toHaveBeenCalledWith('make', [], expect.objectContaining({
            cwd: path.dirname(composeFilePath),
            shell: true,
            detached: true
        }));
    });

    it('should not start if already started', () => {
        deployer.start(composeFilePath);

        deployer.start(composeFilePath);

        expect(spawn).toHaveBeenCalledTimes(1);
    });

    it('should stop the process on non-win32', () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'linux' });
        // Patch process.kill to a jest mock
        const oldKill = process.kill;
        process.kill = jest.fn();
        deployer.start(composeFilePath);

        deployer.stop();

        expect(process.kill).toHaveBeenCalledWith(-1234);
        process.kill = oldKill;
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should stop the process on win32', () => {
        const originalPlatform = process.platform;
        Object.defineProperty(process, 'platform', { value: 'win32' });
        deployer.start(composeFilePath);

        deployer.stop();

        expect(spawn).toHaveBeenCalledWith('taskkill', ['/pid', '1234', '/T', '/F']);
        Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should emit stdout, stderr, exit, and error events', () => {

        deployer.start(composeFilePath);

        const stdoutListener = jest.fn();
        const stderrListener = jest.fn();
        const exitListener = jest.fn();
        const errorListener = jest.fn();
        deployer.onStdoutData(stdoutListener);
        deployer.onStderrData(stderrListener);
        deployer.onExit(exitListener);
        deployer.onError(errorListener);
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

    it('should create makefile and start deployment when makefile does not exist and user accepts', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        const showInfoSpy = (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Yes');

        await deployer.start(composeFilePath);

        expect(showInfoSpy).toHaveBeenCalledWith(
            'Makefile not found in the folder. Would you like to create one?',
            'Yes',
            'No'
        );
        expect(topoCli.generateMakefile).toHaveBeenCalled();
        expect(spawn).toHaveBeenCalledWith('make', [], expect.objectContaining({
            cwd: path.dirname(composeFilePath),
            shell: true,
            detached: true
        }));
    });

    it('should cancel deployment when user declines to create the makefile', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        const showInfoSpy = (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('No');    
        const errorListener = jest.fn();
        deployer.onError(errorListener);
    
        await deployer.start(composeFilePath);
    
        expect(showInfoSpy).toHaveBeenCalledWith(
            'Makefile not found in the folder. Would you like to create one?',
            'Yes',
            'No'
        );
        expect(topoCli.generateMakefile).not.toHaveBeenCalled();
        expect(errorListener).toHaveBeenCalled();
        // Verify the error message from the fired error event.
        expect(errorListener.mock.calls[0][0].message).toBe('Deploy operation cancelled');
    });
});
