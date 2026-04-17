import { TextEncoder, TextDecoder } from 'node:util';

global.fetch = jest.fn();
Object.assign(global, { TextDecoder, TextEncoder });
