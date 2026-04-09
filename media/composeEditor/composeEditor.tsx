import React from 'react';
import { SubsystemSection } from './subsystemSection';
import {
    TemplateDescription,
    Subsystem,
    ProjectDescription,
    ServiceCreationDescription,
    ConfigMetadata,
    MessageHandler,
    subsystems,
} from '../../src/util/types';

export type QuickPicker<T> = {
  showQuickPick(
    items: T[],
    options?: {
      placeHolder?: string;
      canPickMany?: boolean;
      matchOnDetail?: boolean;
      matchOnDescription?: boolean;
    }
  ): Thenable<T | undefined>;
  createQuickPick(
    items: T[],
    options?: {
      placeHolder?: string;
      canPickMany?: boolean;
      matchOnDetail?: boolean;
      matchOnDescription?: boolean;
    }) : Thenable<T | undefined>;
}

interface ComposeEditorProps {
  yamlText: string;
  messageHandler: MessageHandler;
  quickPicker: QuickPicker<string>,
  project: ProjectDescription;
  templates: TemplateDescription[];
  configMetadata: ConfigMetadata;
}

// hardcoded board for demo purposes
const board = "NXP i.MX 93";

const getSubsystemServices = (
    project: ProjectDescription,
    subsystem: Subsystem,
    configMetadata: ConfigMetadata,
    board: string
): ServiceCreationDescription[] => {
    const boardSubsystems = configMetadata.boards.find(b => b.id === board)?.subsystems || [];
    const subsystemInfo = boardSubsystems.find(s => s.id === subsystem);

    if (!subsystemInfo) {
    // Host subsystem does not have a runtime, so we return all services
        if (subsystem === 'Host') {
            return Object.entries(project.services)
                .filter(([, service]) => service.runtime === undefined)
                .map(([serviceName, service]) => ({
                    ...service,
                    name: serviceName,
                    errors: [],
                }));
        } else {
            return [];
        }
    }
  
    return Object.entries(project.services)
    // TODO match annotations
        .filter(([, service]) => service.runtime === subsystemInfo.runtime)
        .map(([serviceName, service]) => ({
            ...service,
            name: serviceName,
            errors: [],
        }));
};

export const ComposeEditor: React.FC<ComposeEditorProps> = ({ messageHandler, quickPicker, project, templates, configMetadata }) => {

    const addService = (serviceName: string, templateId: string): void => {
        messageHandler.postMessage({ type: 'add-service', serviceName, templateId });
    };

    const removeService = (serviceName: string): void => {
        messageHandler.postMessage({ type: 'remove-service', serviceName });
    };

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

    const [isDeploying, setIsDeploying] = React.useState(false);

    return (
        <form className="compose-editor">
            <h3>Project: {project.name}</h3>
            {subsystems.map(subsystem => {
                const subsystemServices = getSubsystemServices(project, subsystem, configMetadata, board);
                const subsystemTemplates = templates.filter(t => t.subsystem === subsystem);
                return (
                    <SubsystemSection
                        key={subsystem}
                        title={subsystem}
                        subsystemServices={subsystemServices}
                        templates={subsystemTemplates}
                        quickPicker={quickPicker}
                        configMetadata={configMetadata}
                        addService={addService}
                        removeService={removeService}
                        board={board}
                    />
                );
            })}
            <div className="form-controls">
                <button
                    type="button"
                    className="deploy-button"
                    onClick={() => {
                        setIsDeploying(true);
                        messageHandler.postMessage({ type: 'deploy' });
                    }}
                    disabled={isDeploying}
                >
                    { isDeploying ? 'Deploying...' : 'Deploy' }
                </button>
            </div>
        </form>
    );
};
