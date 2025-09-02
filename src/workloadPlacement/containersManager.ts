import * as vscode from 'vscode';
import { logger } from '../util/logger';
import { BoardConnectionChecker } from '../util/boardConnectionChecker';
import { Deferred } from '../util/deferred';
import { ContainerCommands, DockerPsItem } from './containerCommands';

/**
 * Represents a Docker container item from the output of the "docker ps" command.
 *
 * @property {string} id - The unique identifier for the container.
 * @property {string} name - The name assigned to the container.
 * @property {string} image - The Docker image used to create the container.
 * @property {string} state - The current state of the container (e.g., "running", "stopped").
 * @property {string} status - A descriptive status string of the container.
 * @property {string} labels - A string of key-value labels associated with the container.
 * @property {string} runningFor - A description indicating how long the container has been running.
 * @property {string} createdAt - The timestamp indicating when the container was created.
 * @property {string} runtime - The runtime of the container.
 * @property {string[]} ports - The ports exposed by the container.
 * @property {string} cpuUsage - The CPU usage of the container.
 * @property {string} memUsage - The memory usage of the container.
 */
export interface ContainerItem {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  labels: string;
  runningFor: string;
  createdAt: string;
  runtime: string;
  ports: string[];
  cpuUsage: string;
  memUsage: string;
}

export interface BoardState {
    isReachable: boolean;
    hasContainerRuntime: boolean;
}

export class ContainersManager {
    private containersDataDeferred: Deferred<void> | undefined = undefined;
    private boardStateDeferred: Deferred<void> | undefined = undefined;
    private containersDataInitialised = false;
    private boardStateInitialised = false;
    private readonly _onDataUpdate = new vscode.EventEmitter<void>();
    public readonly onDataUpdate = this._onDataUpdate.event;
    private refreshTimer: NodeJS.Timeout | undefined;
    private shouldAutoRefresh = false;
    private containersData: ContainerItem[] = [];
    private boardState: BoardState = {
        isReachable: false,
        hasContainerRuntime: false,
    };

    constructor(
        private readonly boardConnectionChecker: BoardConnectionChecker,
        private readonly containerCommands: ContainerCommands,
    ) {}

    private get isBoardAvailable(): boolean {
        return this.boardState.isReachable && this.boardState.hasContainerRuntime;
    }

    public async activate(): Promise<void> {
        await this.containerCommands.ensureContext();
        await this.startAutoRefresh();
    }

    private async getBoardStateInfo(): Promise<BoardState> {
        const isBoardReachable = await this.boardConnectionChecker.isBoardSshPortOpen();
        const isBoardContainerRuntimeOn = isBoardReachable ? await this.containerCommands.isContainerRuntimeOn() : false;
        return {
            isReachable: isBoardReachable,
            hasContainerRuntime: isBoardContainerRuntimeOn
        };
    }

    public async getContainersData(): Promise<ContainerItem[]> {
        if (!this.containersDataInitialised) {
            await this.loadContainersData();
        }
        return this.containersData;
    }

    private async loadContainersData(): Promise<void> {
        if (this.containersDataDeferred) {
            return this.containersDataDeferred.promise;
        }
        this.containersDataDeferred = new Deferred<void>();
        (async () => {
            try {
                this.containersData = await this.getContainersInfo();
                this.containersDataInitialised = true;
                this.containersDataDeferred?.resolve();
            } catch (err) {
                this.containersDataDeferred?.reject(err);
            } finally {
                this.containersDataDeferred = undefined;
            }
        })();
        return this.containersDataDeferred.promise;
    }

    public async getBoardState(): Promise<BoardState> {
        if (!this.boardStateInitialised) {
            await this.loadBoardState();
        }
        return this.boardState;
    }

    private loadBoardState(): Promise<void> {
        if (this.boardStateDeferred) {
            return this.boardStateDeferred.promise;
        }
        this.boardStateDeferred = new Deferred<void>();
        (async () => {
            try {
                this.boardState = await this.getBoardStateInfo();
                this.boardStateInitialised = true;
                this.boardStateDeferred?.resolve();
            } catch (err) {
                this.boardStateDeferred?.reject(err);
            } finally {
                this.boardStateDeferred = undefined;
            }
        })();
        return this.boardStateDeferred.promise;
    }

    private async getContainersInfo(): Promise<ContainerItem[]> {
        try {
            const items = await this.containerCommands.getContainers();
            const ids = items.map(item => item.ID);
            const inspectStdout = await this.containerCommands.inspectContainers(ids);
            const inspectLines = inspectStdout.trim().split(/\r?\n/);
            const parsedInspectLines = inspectLines.map(line => line.split(';'));
            const statsOutput = await this.containerCommands.containerStats(ids);
            const statsLines = statsOutput.trim().split(/\r?\n/);
            const parsedStatsLines = statsLines.map(line => line.split(';'));
            const containersData = items.reduce<ContainerItem[]>((acc, item) => {
                const containerInspectLine = parsedInspectLines.find(inspectLine => inspectLine[0].slice(0, 12) === item.ID);
                const containerStatsLine = parsedStatsLines.find(stat => stat[0].slice(0, 12) === item.ID);
                const ports = containerInspectLine ? this.parsePorts(containerInspectLine[1]) : [];
                const runtime = containerInspectLine ? containerInspectLine[2] : '';
                const cpuUsage = containerStatsLine ? containerStatsLine[1] : '';
                const memUsage = containerStatsLine ? containerStatsLine[2] : '';
                acc.push(this.createContainerItem(item, runtime, ports, cpuUsage, memUsage));
                return acc;
            }, []);
            return containersData;
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : "Unknown error";
            logger.error(`Failed to get containers info: ${errorMsg}`);
            return this.containersData;
        }
    }

    private parsePorts(portsJson: string): string[] {
        try {
            const portObj = JSON.parse(portsJson);
            const ports = Object.entries(portObj)
                .filter(([_, arr]) => Array.isArray(arr) && arr.length > 0)
                .map(([containerPort, arr]) => {
                    if (!Array.isArray(arr)) {
                        return [];
                    }
                    // For each mapping, return host:container
                    return (arr as Array<{ HostPort?: string; }>)
                        .map((m) => {
                            const hostPort = m && m.HostPort ? m.HostPort : undefined;
                            const containerPortNum = containerPort.split('/')[0];
                            return hostPort ? `${hostPort}:${containerPortNum}` : undefined;
                        })
                        .filter((p): p is string => !!p);
                })
                .flat();
            return Array.from(new Set(ports));
        } catch {
            // If JSON parsing fails, fallback to empty ports
            return [];
        }
    }

    public async startAutoRefresh(): Promise<void> {
        if (this.refreshTimer) {
            return;
        }
        this.shouldAutoRefresh = true;
        const refresh = async () => {
            if (this.shouldAutoRefresh) {
                await this.loadBoardState();
                if (this.isBoardAvailable) {
                    await this.loadContainersData();
                }
                this._onDataUpdate.fire();
                this.refreshTimer = setTimeout(refresh, 3000);
            }
        };
        await refresh();
    }

    public async stopAutoRefresh(): Promise<void> {
        this.shouldAutoRefresh = false;
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }
    }

    public async stopContainer(containerId: string): Promise<void> {
        return this.containerCommands.stopContainer(containerId);
    }

    public async startContainer(containerId: string): Promise<void> {
        return this.containerCommands.startContainer(containerId);
    }

    public async deleteContainer(containerId: string): Promise<void> {
        return this.containerCommands.deleteContainer(containerId);
    }

    private createContainerItem(item: DockerPsItem, runtime: string, ports: string[], cpuUsage: string, memUsage: string): ContainerItem {
        return {
            id: item.ID,
            name: item.Names,
            image: item.Image,
            state: item.State,
            status: item.Status,
            labels: item.Labels,
            runningFor: item.RunningFor,
            createdAt: item.CreatedAt,
            runtime,
            ports,
            cpuUsage,
            memUsage,
        };
    }
}
