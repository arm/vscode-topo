import {
    TARGET_HOST_RUNTIME,
    TARGET_REMOTEPROC_RUNTIME,
} from '../src/manifest';
import { hasContainerEngine, isTargetReachable } from '../src/util/targetState';
import { getContainerHostPorts } from '../src/util/getContainerHostPorts';
import { TargetState, ContainerItem, MessagePoster } from '../src/util/types';

export interface TargetDashboardProps {
    target: string;
    containersData: ContainerItem[];
    targetState: TargetState;
    messagePoster: MessagePoster;
    subsystems: string[];
}

function splitContainersBySubsystem(
    containers: ContainerItem[],
    subsystems: string[],
) {
    const groups: Record<string, ContainerItem[]> = { Host: [] };

    for (const c of containers) {
        if (c.runtime === undefined || c.runtime === TARGET_HOST_RUNTIME) {
            groups['Host'].push(c);
        } else if (c.runtime === TARGET_REMOTEPROC_RUNTIME) {
            const subsystem = c.annotations?.['remoteproc.name'];
            if (subsystem && subsystems.includes(subsystem)) {
                groups[subsystem] ??= [];
                groups[subsystem].push(c);
            }
        }
    }

    return groups;
}

function StateIcon({ state }: { state: string }) {
    return (
        <span className="state-icon" title={state}>
            <span className="codicon codicon-debug-breakpoint-log"></span>
        </span>
    );
}

function ContainerTable({
    containers,
    messagePoster,
    subsystem,
}: {
    containers: ContainerItem[];
    messagePoster: MessagePoster;
    subsystem: string;
}) {
    if (containers.length === 0) {
        return (
            <div className="no-containers-message">
                <span className="codicon codicon-error" />
                <span>No containers</span>
            </div>
        );
    }
    containers.sort((a, b) => {
        if (a.state === 'running' && b.state !== 'running') {
            return -1;
        }
        if (a.state !== 'running' && b.state === 'running') {
            return 1;
        }
        return a.name.localeCompare(b.name);
    });
    return (
        <table className="containers-table">
            <thead>
                <tr>
                    <th className="container-state"></th>
                    <th className="container-name">Name</th>
                    <th className="container-image">Image</th>
                    <th className="container-last-started">Last started</th>
                    <th className="container-cpu-usage">CPU (%)</th>
                    <th className="container-mem-usage">Memory Usage</th>
                    <th className="container-ports">Ports</th>
                    <th className="container-actions">Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colSpan={8}>
                        <hr />
                    </td>
                </tr>
                {containers.map((c) => {
                    const isRunning = c.state === 'running';
                    return (
                        <tr
                            key={c.id}
                            className={isRunning ? 'running' : 'not-running'}
                        >
                            <td>
                                <StateIcon state={c.state} />
                            </td>
                            <td>{c.name}</td>
                            <td>{c.image}</td>
                            <td>{c.runningFor}</td>
                            <td>{c.cpuUsage}</td>
                            <td>{c.memUsage}</td>
                            <td>
                                {getContainerHostPorts(c).map((port, idx) => (
                                    <div
                                        key={idx}
                                        className="container-port-item"
                                    >
                                        {port}
                                        <button
                                            title="Open in browser"
                                            className="action-btn link-btn container-port-link-btn"
                                            onClick={() => {
                                                messagePoster.postMessage({
                                                    type: 'open-container-in-browser',
                                                    containerId: c.id,
                                                    targetSsh: c.target,
                                                });
                                            }}
                                        >
                                            <span className="codicon codicon-link-external container-port-link-icon" />
                                        </button>
                                    </div>
                                ))}
                            </td>
                            <td>
                                {isRunning ? (
                                    <>
                                        <button
                                            title="Stop container"
                                            className="action-btn stop-btn"
                                            onClick={() => {
                                                messagePoster.postMessage({
                                                    type: 'stop-container',
                                                    containerId: c.id,
                                                });
                                            }}
                                        >
                                            <span className="codicon codicon-debug-stop" />
                                        </button>
                                        <button
                                            title="Delete container"
                                            className="action-btn delete-btn"
                                            onClick={() => {
                                                messagePoster.postMessage({
                                                    type: 'delete-container',
                                                    containerId: c.id,
                                                });
                                            }}
                                        >
                                            <span className="codicon codicon-trash vscode-codicon-trash" />
                                        </button>
                                        {subsystem === 'Host' ? (
                                            <>
                                                <button
                                                    title="Attach VS Code"
                                                    className="action-btn vscode-attach-btn"
                                                    onClick={() => {
                                                        messagePoster.postMessage(
                                                            {
                                                                type: 'attach-vscode',
                                                                containerId:
                                                                    c.id,
                                                                targetSsh:
                                                                    c.target,
                                                            },
                                                        );
                                                    }}
                                                    style={{ marginLeft: 4 }}
                                                >
                                                    <span className="codicon codicon-vscode vscode-attach-icon" />
                                                </button>
                                                <button
                                                    title="Attach Shell"
                                                    className="action-btn shell-attach-btn"
                                                    onClick={() => {
                                                        messagePoster.postMessage(
                                                            {
                                                                type: 'attach-shell',
                                                                containerId:
                                                                    c.id,
                                                                targetSsh:
                                                                    c.target,
                                                            },
                                                        );
                                                    }}
                                                    style={{ marginLeft: 4 }}
                                                >
                                                    <span className="codicon codicon-terminal shell-attach-icon" />
                                                </button>
                                            </>
                                        ) : null}
                                    </>
                                ) : (
                                    <>
                                        <button
                                            title="Start container"
                                            className="action-btn play-btn"
                                            onClick={() => {
                                                messagePoster.postMessage({
                                                    type: 'start-container',
                                                    containerId: c.id,
                                                });
                                            }}
                                        >
                                            <span className="codicon codicon-debug-start" />
                                        </button>
                                        <button
                                            title="Delete container"
                                            className="action-btn trash-btn"
                                            onClick={() => {
                                                messagePoster.postMessage({
                                                    type: 'delete-container',
                                                    containerId: c.id,
                                                });
                                            }}
                                        >
                                            <span className="codicon codicon-trash vscode-codicon-trash" />
                                        </button>
                                    </>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

export function TargetDashboard({
    target,
    containersData,
    targetState,
    messagePoster,
    subsystems,
}: TargetDashboardProps) {
    let errorMessage: string | undefined = undefined;
    if (!isTargetReachable(targetState)) {
        errorMessage =
            'No target found. Please ensure the target is running and accessible.';
    } else {
        if (!hasContainerEngine(targetState)) {
            errorMessage =
                'No container engine found. Please ensure the container engine of the target is installed and running.';
        }
    }
    if (errorMessage) {
        return (
            <div className="target-dashboard">
                <div className="no-access-message">
                    <span className="codicon codicon-error" />
                    <span>{errorMessage}</span>
                </div>
            </div>
        );
    }
    const containerGroups = splitContainersBySubsystem(
        containersData,
        subsystems,
    );

    return (
        <div className="target-dashboard">
            <h1>Target Dashboard: {target}</h1>
            {subsystems.map((subsystem) => (
                <div key={subsystem} className="section-group">
                    <h3>
                        {subsystem}
                        {subsystem === 'Host' && (
                            <button
                                title="Attach via SSH"
                                className="action-btn ssh-attach-btn"
                                onClick={() => {
                                    messagePoster.postMessage({
                                        type: 'attach-ssh',
                                    });
                                }}
                                style={{ marginLeft: 4 }}
                            >
                                <span className="codicon codicon-terminal ssh-attach-icon" />
                            </button>
                        )}
                    </h3>
                    <ContainerTable
                        containers={containerGroups[subsystem] || []}
                        messagePoster={messagePoster}
                        subsystem={subsystem}
                    />
                </div>
            ))}
        </div>
    );
}
