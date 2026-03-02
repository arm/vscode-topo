import { BoardState } from './types';

export function hasContainerEngine(boardState: BoardState): boolean {
    if (!boardState.health) {
        return false;
    }

    return boardState.health.Dependencies.some(
        (v) => v.Name === 'Container Engine' && v.Healthy,
    );
}

export function isBoardReachable(boardState: BoardState): boolean {
    return boardState.health?.Connectivity.Healthy ?? false;
}

export function isTargetReady(boardState: BoardState): boolean {
    return isBoardReachable(boardState) && hasContainerEngine(boardState);
}
