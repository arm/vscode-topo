import { BOARD_HOSTNAME } from '../src/manifest';
import { MessageHandler } from '../src/util/types';
import type { BoardState, ContainerItem } from '../src/workloadPlacement/containersManager';

export interface BoardDashboardProps {
  containersData: ContainerItem[];
  boardState: BoardState;
  messageHandler: MessageHandler;
}

function splitContainersByRuntime(containers: ContainerItem[]) {
    const host: ContainerItem[] = [];
    const ambient: ContainerItem[] = [];
    containers.forEach(c => {
        if (!c.runtime || c.runtime === 'runc') {
            host.push(c);
        } else {
            ambient.push(c);
        }
    });
    return { host, ambient };
}

function StateIcon({ state }: { state: string }) {
    return (
        <span
            className="state-icon"
            title={state}
        >
            <span
                className="codicon codicon-debug-breakpoint-log"
            ></span>
        </span>
    );
}

function ContainerTable({ containers, messageHandler, subsystem }: { containers: ContainerItem[], messageHandler: MessageHandler, subsystem: string }) {
    if (containers.length === 0) {
        return <div className="no-containers-message">
            <span className="codicon codicon-error" />
            <span>No containers</span>
        </div>;
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
                    <th className="container-ports">Ports</th>
                    <th className="container-actions">Actions</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td colSpan={6}><hr /></td>
                </tr>
                {containers.map(c => {
                    const isRunning = c.state === 'running';
                    return (
                        <tr key={c.id} className={isRunning ? 'running' : 'not-running'}>
                            <td>
                                <StateIcon state={c.state} />
                            </td>
                            <td>{c.name}</td>
                            <td>{c.image}</td>
                            <td>{c.runningFor}</td>
                            <td>
                                {c.ports.length > 0
                                    ? c.ports.map((port, idx) => (
                                        <div key={idx} className="container-port-item">
                                            {port}
                                            <button
                                                title="Open in browser"
                                                className="action-btn link-btn container-port-link-btn"
                                                onClick={() => {
                                                    messageHandler.postMessage({
                                                        type: 'open-container-in-browser',
                                                        containerId: c.id,
                                                    });
                                                }}
                                            >
                                                <span
                                                    className="codicon codicon-link-external container-port-link-icon"
                                                />
                                            </button>
                                        </div>
                                    ))
                                    : null}
                            </td>
                            <td>
                                {isRunning ? (
                                    <>
                                        <button
                                            title="Stop container"
                                            className="action-btn stop-btn"
                                            onClick={() => {
                                                messageHandler.postMessage({ type: 'stop-container', containerId: c.id });
                                            }}
                                        >
                                            <span className="codicon codicon-debug-stop" />
                                        </button>
                                        { subsystem === 'Host' ? (
                                            <>
                                                <button
                                                    title="Delete container"
                                                    className="action-btn delete-btn"
                                                    onClick={() => {
                                                        messageHandler.postMessage({ type: 'delete-container', containerId: c.id });
                                                    }}
                                                >
                                                    <span className="codicon codicon-trash vscode-codicon-trash" />
                                                </button>
                                                <button
                                                    title="Attach VS Code"
                                                    className="action-btn vscode-attach-btn"
                                                    onClick={() => {
                                                        messageHandler.postMessage({ type: 'attach-vscode', containerId: c.id });
                                                    }}
                                                    style={{ marginLeft: 4 }}
                                                >
                                                    <span className="codicon codicon-vscode vscode-attach-icon" />
                                                </button>
                                                <button
                                                    title="Attach Shell"
                                                    className="action-btn shell-attach-btn"
                                                    onClick={() => {
                                                        messageHandler.postMessage({ type: 'attach-shell', containerId: c.id });
                                                    }}
                                                    style={{ marginLeft: 4 }}
                                                >
                                                    <span className="codicon codicon-terminal shell-attach-icon" />
                                                </button>
                                            </>
                                        ) : null }
                                    </>
                                ) : (
                                    <>
                                        <button
                                            title="Start container"
                                            className="action-btn play-btn"
                                            onClick={() => {
                                                messageHandler.postMessage({ type: 'start-container', containerId: c.id });
                                            } }
                                        >
                                            <span className="codicon codicon-debug-start" />
                                        </button>
                                        <button
                                            title="Delete container"
                                            className="action-btn trash-btn"
                                            onClick={() => {
                                                messageHandler.postMessage({ type: 'delete-container', containerId: c.id });
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

export function BoardDashboard({ containersData, boardState, messageHandler }: BoardDashboardProps) {

    let errorMessage: string | undefined = undefined;
    if (!boardState.isReachable) {
        errorMessage = 'No board found. Please ensure the board is running and accessible.';
    }
    if (!boardState.hasContainerRuntime) {
        errorMessage = 'No container runtime found. Please ensure the container runtime of the board is installed and running.';
    }
    if (errorMessage) {
        return (
            <div className="board-dashboard">
                <div className="no-access-message">
                    <span className="codicon codicon-error" />
                    <span>{errorMessage}</span>
                </div>
            </div>
        );
    }
    const { host, ambient } = splitContainersByRuntime(containersData);

    return (
        <div className="board-dashboard">
            <h1>Board Dashboard: {BOARD_HOSTNAME}</h1>
            <div className="section-group">
                <h3>
          Host
                    <button
                        title="Attach via SSH"
                        className="action-btn ssh-attach-btn"
                        onClick={() => {
                            messageHandler.postMessage({ type: 'attach-ssh' });
                        }}
                        style={{ marginLeft: 4 }}
                    >
                        <span className="codicon codicon-terminal ssh-attach-icon" />
                    </button>
                </h3>
                <ContainerTable
                    containers={host}
                    messageHandler={messageHandler}
                    subsystem='Host'
                />
            </div>
            <div className="section-group">
                <h3>Ambient</h3>
                <ContainerTable
                    containers={ambient}
                    messageHandler={messageHandler}
                    subsystem='Ambient'
                />
            </div>
        </div>
    );
}
