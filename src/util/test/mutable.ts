import { Mutable } from '../types';

export const mutable = <T>(obj: T): Mutable<T> => {
    return obj;
};
