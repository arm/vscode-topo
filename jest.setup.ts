import { TextEncoder, TextDecoder } from 'util';

global.fetch = jest.fn();
Object.assign(global, { TextDecoder, TextEncoder });
