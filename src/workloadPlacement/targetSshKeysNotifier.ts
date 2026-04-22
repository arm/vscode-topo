import * as vscode from 'vscode';
import type { TopoCli } from '../topoCli';
import type { HealthCheckResult } from '../topoCliSchema';
import type { TargetItem } from '../util/types';
import { logger } from '../util/logger';
import { showAndLogError } from '../util/showAndLogError';
import { SetupSshKeys } from '../actions/setupSshKeys';
import { TargetStore } from './targetStore';

const refreshInterval = 3000;
const setUpSshKeysAction: vscode.MessageItem = {
    title: 'Set Up SSH Keys',
};
const notNowAction: vscode.MessageItem = {
    title: 'Not Now',
};

function hasSshKeysIssue(health: HealthCheckResult['target']): boolean {
    return (
        health.connectivity.status === 'error' &&
        (health.connectivity.fix?.includes('setup-keys') ?? false)
    );
}

export class TargetSshKeysNotifier implements vscode.Disposable {
    private refreshTimer: NodeJS.Timeout | undefined;
    private refreshSession: symbol | undefined;
    private target: TargetItem | undefined;
    private lastSshKeysWarningKey: string | undefined;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private readonly topoCli: TopoCli,
        private readonly targetStore: TargetStore,
    ) {
        const onChangedDisposable = this.targetStore.onChanged(() => {
            void this.updateTarget().catch((err) => {
                logger.error(
                    'Failed to update target for SSH keys notification',
                    err,
                );
            });
        });
        this.disposables.push(onChangedDisposable);
    }

    public async activate(): Promise<void> {
        await this.updateTarget();
    }

    private async updateTarget(): Promise<void> {
        const previousTargetSsh = this.target?.ssh;
        this.stopAutoRefresh();
        this.target = await this.targetStore.getSelectedTarget();
        if (this.target?.ssh !== previousTargetSsh) {
            this.lastSshKeysWarningKey = undefined;
        }

        if (this.target) {
            await this.startAutoRefresh();
        }
    }

    private async startAutoRefresh(): Promise<void> {
        if (this.refreshSession) {
            return;
        }

        const refreshSession = Symbol('targetSshKeysRefreshSession');
        this.refreshSession = refreshSession;
        const refresh = async () => {
            if (this.refreshSession !== refreshSession) {
                return;
            }

            await this.checkTargetHealth();
            if (this.refreshSession !== refreshSession) {
                return;
            }

            this.refreshTimer = setTimeout(refresh, refreshInterval);
        };

        await refresh();
    }

    private stopAutoRefresh(): void {
        this.refreshSession = undefined;
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }

    private async checkTargetHealth(): Promise<void> {
        const target = this.target;
        if (!target) {
            return;
        }

        try {
            const health = await this.topoCli.health(target.ssh);
            await this.notifySshKeysIssue(target, health.target);
        } catch (err) {
            logger.error(
                `Failed to check target health for SSH keys notification on ${target.ssh}`,
                err,
            );
        }
    }

    private async notifySshKeysIssue(
        target: TargetItem,
        health: HealthCheckResult['target'],
    ): Promise<void> {
        if (!hasSshKeysIssue(health)) {
            this.lastSshKeysWarningKey = undefined;
            return;
        }

        const warningKey = `${target.ssh}:${health.connectivity.value}`;
        if (this.lastSshKeysWarningKey === warningKey) {
            return;
        }

        this.lastSshKeysWarningKey = warningKey;
        const choice = await vscode.window.showWarningMessage(
            `SSH keys are not set up for target ${target.ssh}. Set up SSH keys to enable passwordless authentication for this target.`,
            setUpSshKeysAction,
            notNowAction,
        );
        if (choice?.title !== setUpSshKeysAction.title) {
            return;
        }

        try {
            await vscode.commands.executeCommand(
                SetupSshKeys.setupSshKeysCommand,
            );
        } catch (err) {
            showAndLogError(
                `Failed to start SSH key setup for target ${target.ssh}`,
                err,
            );
        }
    }

    public dispose(): void {
        this.stopAutoRefresh();
        [...this.disposables].reverse().forEach((d) => {
            try {
                d.dispose();
            } catch (error) {
                logger.error(
                    'Error disposing TargetSshKeysNotifier resource',
                    error,
                );
            }
        });
        this.disposables = [];
    }
}
