import { BoardState } from './types';

export function hasContainerEngine(boardState: BoardState): boolean {
    if (!boardState.health) {
        return false;
    }

    return boardState.health.dependencies.some(
        (v) => v.name === 'Container Engine' && v.healthy,
    );
}

export function isBoardReachable(boardState: BoardState): boolean {
    return boardState.health?.connectivity.healthy ?? false;
}

export function isTargetReady(boardState: BoardState): boolean {
    return isBoardReachable(boardState) && hasContainerEngine(boardState);
}
