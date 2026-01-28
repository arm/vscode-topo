export const subsystems = ['Host', 'Ambient'] as const;
export type Subsystem = (typeof subsystems)[number];

export interface TemplateDescription {
    id: string;
    url: string;
    subsystem: Subsystem;
    ports: string[];
}

export interface SubsystemInfo {
    id: Subsystem;
    runtime: string;
    annotations: Record<string, string>;
}

export interface BoardInfo {
    id: string;
    subsystems: SubsystemInfo[];
}

export interface ConfigMetadata {
    boards: BoardInfo[];
}

export interface ServiceDescription {
    build: {
        context: string;
    };
    containerName: string;
    runtime?: string;
    annotations?: Record<string, string>;
}

export interface ProjectDescription {
    name: string;
    services: Record<string, ServiceDescription>;
}

export interface ServiceCreationDescription extends ServiceDescription {
    name: string;
    errors: string[];
}

export type MessagePoster = {
    postMessage(message: unknown): void | Thenable<boolean>;
};
