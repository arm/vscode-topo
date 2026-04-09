import React, { useCallback } from 'react';
import { ConfigMetadata, ServiceCreationDescription, Subsystem, TemplateDescription } from '../../src/util/types';
import { QuickPicker } from './composeEditor';

export interface SubsystemSectionProps {
  readonly quickPicker: QuickPicker<string>;
  readonly title: Subsystem;
  readonly subsystemServices: ServiceCreationDescription[];
  readonly templates: TemplateDescription[];
  readonly configMetadata: ConfigMetadata;
  readonly board: string;
  readonly addService: (serviceName: string, templateId: string) => void;
  readonly removeService: (serviceName: string) => void;
}

export const SubsystemSection: React.FC<SubsystemSectionProps> = ({
    title,
    subsystemServices,
    quickPicker,
    templates,
    addService,
    removeService
}) => {

    const removeEntry = useCallback((service: ServiceCreationDescription) => {
        removeService(service.name);
    }, [removeService]);

    const addEntry = useCallback(async () => {
        const templateId = await quickPicker.showQuickPick(
            templates.map(t => t.id),
            { placeHolder: 'Choose a template' }
        );
        if (!templateId) {
            return;
        }
        const serviceName = await quickPicker.createQuickPick(
            [templateId],
            { placeHolder: 'Name of the service' }
        );
        if (!serviceName) {
            return;
        }
        addService(serviceName, templateId);
    }, [quickPicker, templates, addService]);

    return (
        <div className="section-group">
            <h3>{title}</h3>
            {subsystemServices.length > 0 && (
                <table className="services-table">
                    <thead>
                        <tr>
                            <th className="service-name">Service Name</th>
                            <th className="service-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subsystemServices.map((service, i) => (
                            <tr key={i}>
                                <td>
                                    <input
                                        value={service.name}
                                        readOnly
                                    />
                                    {service.errors.length > 0 && (
                                        <span className="warning-icon" title={service.errors[0]}>
                    ⚠️
                                        </span>
                                    )}
                                </td>
                                <td>
                                    <button
                                        type="button"
                                        onClick={() => removeEntry(service)}
                                        className="remove-button"
                                    >
                    Remove
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            <button
                type="button"
                onClick={addEntry}
                className="add-service-button"
            >
          Add Service
            </button>
        </div>
    );
};
