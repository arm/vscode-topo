import { load } from 'js-yaml';
import { TargetDescription } from './types';
import { getErrorMessage } from './getErrorMessage';
import { isPlainObject } from './isPlainObject';

const parseHostProcessor = (
    value: unknown,
): TargetDescription['hostProcessor'] => {
    if (!Array.isArray(value)) {
        throw new Error('Invalid target description: "host" must be an array');
    }

    return value.map((entry, index) => {
        if (!isPlainObject(entry)) {
            throw new Error(
                `Invalid target description: host[${index}] must be an object`,
            );
        }

        const { model, cores, features } = entry;

        if (typeof model !== 'string' || model.trim() === '') {
            throw new Error(
                `Invalid target description: host[${index}].model must be a non-empty string`,
            );
        }
        if (
            typeof cores !== 'number' ||
            !Number.isFinite(cores) ||
            cores <= 0
        ) {
            throw new Error(
                `Invalid target description: host[${index}].cores must be a positive finite number`,
            );
        }
        if (!Array.isArray(features)) {
            throw new Error(
                `Invalid target description: host[${index}].features must be an array`,
            );
        }

        const normalizedFeatures = features.map((feature, featureIndex) => {
            if (typeof feature !== 'string') {
                throw new Error(
                    `Invalid target description: host[${index}].features[${featureIndex}] must be a string`,
                );
            }
            return feature.trim();
        });

        return {
            model: model.trim(),
            cores,
            features: normalizedFeatures,
        };
    });
};

const parseRemoteprocCPU = (
    value: unknown,
): TargetDescription['remoteprocCPU'] => {
    if (!Array.isArray(value)) {
        throw new Error(
            'Invalid target description: "remoteprocs" must be an array',
        );
    }

    return value.map((entry, index) => {
        if (!isPlainObject(entry)) {
            throw new Error(
                `Invalid target description: remoteprocs[${index}] must be an object`,
            );
        }

        const name = entry.name;
        if (typeof name !== 'string' || name.trim() === '') {
            throw new Error(
                `Invalid target description: remoteprocs[${index}].name must be a non-empty string`,
            );
        }

        return { name: name.trim() };
    });
};

export function parseTargetDescription(yamlFile: string): TargetDescription {
    if (yamlFile.trim() === '') {
        throw new Error(
            'Invalid target description: expected non-empty yaml content',
        );
    }

    let parsed: unknown;
    try {
        parsed = load(yamlFile);
    } catch (error) {
        throw new Error(
            `Failed to parse target description yaml: ${getErrorMessage(error)}`,
        );
    }

    if (!isPlainObject(parsed)) {
        throw new Error(
            'Invalid target description: expected yaml document to be an object',
        );
    }

    return {
        hostProcessor: parseHostProcessor(parsed.host),
        remoteprocCPU: parseRemoteprocCPU(parsed.remoteprocs),
    };
}
