import * as vscode from 'vscode';
import { mock } from 'jest-mock-extended';
import type { HealthCheckResult } from '../topoCliSchema';
import type { TopoCli } from '../topoCli';
import type { TargetItem } from '../util/types';
import { SetupSshKeys } from '../actions/setupSshKeys';
import { TargetStore } from './targetStore';
import { TargetSshKeysNotifier } from './targetSshKeysNotifier';

jest.mock('../util/logger');
jest.mock('../util/showAndLogError');

const setupKeysTarget: TargetItem = {
    ssh: 'testtarget',
};
const createSetupKeysHealth = (): HealthCheckResult => ({
    host: { dependencies: [] },
    target: {
        isLocalhost: false,
        connectivity: {
            name: 'Connectivity',
            status: 'error',
            value: 'key-based SSH authentication is not setup',
            fix: 'run `topo setup-keys --target ssh://testtarget` to configure SSH keys',
        },
        dependencies: [],
        subsystemDriver: {
            name: 'Subsystem Driver (remoteproc)',
            status: 'info',
            value: 'no remoteproc devices found',
        },
    },
});

describe('TargetSshKeysNotifier', () => {
    let notifier: TargetSshKeysNotifier | undefined;
    const topoCli = mock<TopoCli>();

    beforeEach(() => {
        jest.useFakeTimers();
        jest.resetAllMocks();
        topoCli.health.mockResolvedValue(createSetupKeysHealth());
        notifier = undefined;
    });

    afterEach(() => {
        notifier?.dispose();
        jest.useRealTimers();
        jest.clearAllTimers();
    });

    const createNotifier = (
        targetStore: TargetStore,
    ): TargetSshKeysNotifier => {
        const targetSshKeysNotifier = new TargetSshKeysNotifier(
            topoCli,
            targetStore,
        );
        notifier = targetSshKeysNotifier;
        return targetSshKeysNotifier;
    };

    it('shows an SSH keys warning when SSH keys are missing', async () => {
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(setupKeysTarget);
        const targetSshKeysNotifier = createNotifier(targetStore);

        await targetSshKeysNotifier.activate();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'SSH keys are not set up for target testtarget. Set up SSH keys to enable passwordless authentication for this target.',
            { title: 'Set Up SSH Keys' },
            { title: 'Not Now' },
        );
    });

    it('runs the setup SSH keys command when the warning action is selected', async () => {
        jest.mocked(vscode.window.showWarningMessage).mockResolvedValueOnce({
            title: 'Set Up SSH Keys',
        });
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(setupKeysTarget);
        const targetSshKeysNotifier = createNotifier(targetStore);

        await targetSshKeysNotifier.activate();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
            SetupSshKeys.setupSshKeysCommand,
        );
    });

    it('does not repeat the same SSH keys warning on each refresh', async () => {
        const targetStore = mock<TargetStore>();
        targetStore.getSelectedTarget.mockResolvedValue(setupKeysTarget);
        const targetSshKeysNotifier = createNotifier(targetStore);

        await targetSshKeysNotifier.activate();
        await jest.advanceTimersByTimeAsync(9000);

        expect(vscode.window.showWarningMessage).toHaveBeenCalledTimes(1);
    });
});
