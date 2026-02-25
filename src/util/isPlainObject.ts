import lodashIsPlainObject from 'lodash.isplainobject';

export const isPlainObject = (
    value: unknown,
): value is Record<string, unknown> => lodashIsPlainObject(value);
