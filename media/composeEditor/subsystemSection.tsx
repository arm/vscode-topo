import React from 'react';
import { ServiceCreationDescription } from '../../src/util/types';

export interface SubsystemSectionProps {
    readonly title: string;
    readonly subsystemServices: ServiceCreationDescription[];
}

export const SubsystemSection: React.FC<SubsystemSectionProps> = ({
    title,
    subsystemServices,
}) => {
    return (
        <div className="section-group">
            <h3>{title}</h3>
            {subsystemServices.length > 0 && (
                <table className="services-table">
                    <thead>
                        <tr>
                            <th className="service-name">Service Name</th>
                        </tr>
                    </thead>
                    <tbody>
                        {subsystemServices.map((service, i) => (
                            <tr key={i}>
                                <td>
                                    <input value={service.name} readOnly />
                                    {service.errors.length > 0 && (
                                        <span
                                            className="warning-icon"
                                            title={service.errors[0]}
                                        >
                                            ⚠️
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};
