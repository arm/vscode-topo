import React from 'react';
import { SubsystemSection } from './subsystemSection';
import {
    ServiceCreationDescription,
    MessagePoster,
} from '../../src/util/types';
import {
    BOARD_REMOTEPROC_RUNTIME,
    BOARD_HOST_RUNTIME,
} from '../../src/manifest';
import { ProjectDescription } from '../../src/topoCliSchema';

interface ComposeEditorProps {
    messagePoster: MessagePoster;
    project: ProjectDescription;
    subsystems: string[];
}

const getSubsystemServices = (
    project: ProjectDescription,
    subsystem: string,
): ServiceCreationDescription[] => {
    if (subsystem === 'Host') {
        return Object.entries(project.services)
            .filter(
                ([, service]) =>
                    service.runtime === undefined ||
                    service.runtime === BOARD_HOST_RUNTIME,
            )
            .map(([serviceName, service]) => ({
                ...service,
                name: serviceName,
            }));
    }

    return Object.entries(project.services)
        .filter(
            ([, service]) =>
                service.runtime === BOARD_REMOTEPROC_RUNTIME &&
                service.annotations?.['remoteproc.name'] === subsystem,
        )
        .map(([serviceName, service]) => ({
            ...service,
            name: serviceName,
        }));
};

export const ComposeEditor: React.FC<ComposeEditorProps> = ({
    messagePoster,
    project,
    subsystems,
}) => {
    const [isDeploying, setIsDeploying] = React.useState(false);

    const handler = (event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'deploy-complete') {
            setIsDeploying(false);
        }
    };

    React.useEffect(() => {
        window.addEventListener('message', handler);
        return () => {
            window.removeEventListener('message', handler);
        };
    }, []);

    return (
        <form className="compose-editor">
            <h3>Project: {project.name}</h3>
            {subsystems.map((subsystem) => {
                const subsystemServices = getSubsystemServices(
                    project,
                    subsystem,
                );
                return (
                    <SubsystemSection
                        key={subsystem}
                        title={subsystem}
                        subsystemServices={subsystemServices}
                    />
                );
            })}
            <div className="form-controls">
                <button
                    type="button"
                    className="deploy-button"
                    onClick={() => {
                        setIsDeploying(true);
                        messagePoster.postMessage({ type: 'deploy' });
                    }}
                    disabled={isDeploying}
                >
                    {isDeploying ? 'Deploying...' : 'Deploy'}
                </button>
            </div>
        </form>
    );
};
