/* eslint-env jest */

/*
 * Copyright (C) 2024 Arm Limited
 * Mocks for the vscode API, used in unit tests.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { URI, Utils: UriUtils } = require('vscode-uri');

class Uri extends URI {
    static joinPath = UriUtils.joinPath;
}

// Classes
const Disposable = jest.fn(() => {
    return { dispose: jest.fn() };
});
Disposable.from = disposable => disposable;
class EventEmitter {
    constructor() {
        this._callbacks = [];
    }
    dispose() {}
    get event() {
        return (callback, thisArg) => {
            this._callbacks.push(thisArg ? callback.bind(thisArg) : callback);
            return { dispose: () => {} };
        };
    }
    fire(event) {
        this._callbacks.forEach(cb => cb(event));
    }
}
const RelativePattern = jest.fn();
const ShellExecution = jest.fn((executablePath, executionArgs, options) => (
    { executablePath, executionArgs, options }
));
const Task = jest.fn((definition, scope, name, type, execution) => (
    { definition, scope, name, type, execution }
));
const ColorThemeKind = {
    Dark: 1,
};

const Position = jest.fn();

const QuickPickItemKind = {
    Separator: -1
};

const Range = jest.fn();

const DiagnosticSeverity = {
    Error: 0,
};

const CodeActionKind = {
    QuickFix: jest.fn(),
};
const CodeAction = jest.fn();

// Enums
const ShellQuoting = { Escape: 'Escape' };
const StatusBarAlignment = { Left: 'Left' };
const TaskScope = { Workspace: 'Workspace' };
const ViewColumn = {
    Active: -1,
    Beside: -2
};
const ProgressLocation = { Notification: 1 };

// Namespaces
const commands = {
    executeCommand: jest.fn(),
    registerCommand: jest.fn(),
};
const debug = {
    startDebugging: jest.fn()
};
const env = {
    openExternal: jest.fn(),
};
const languages = {
    createDiagnosticCollection: jest.fn()
};
const tasks = {
    executeTask: jest.fn(),
    fetchTasks: jest.fn(() => []),
    onDidStartTaskProcess: new EventEmitter().event,
    onDidEndTaskProcess: new EventEmitter().event
};
const window = {
    activeColorTheme: { kind: 1 },
    createStatusBarItem: jest.fn(() => ({ show: jest.fn(), hide: jest.fn() })),
    createWebviewPanel: jest.fn(),
    registerWebviewPanelSerializer: jest.fn(),
    registerWebviewViewProvider: jest.fn(),
    showTextDocument: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showOpenDialog: jest.fn(),
    showQuickPick: jest.fn(),
    createQuickPick: jest.fn(),
    showInputBox: jest.fn(),
    withProgress: jest.fn(),
    registerTreeDataProvider: jest.fn(),
    registerCustomEditorProvider: jest.fn(),
    createTerminal: jest.fn(),
    createTreeView: jest.fn(() => ({
        onDidExpandElement: new EventEmitter().event,
        onDidCollapseElement: new EventEmitter().event,
    })),
    state: { focused: true },
    createOutputChannel: jest.fn(() => ({
        appendLine: jest.fn(),
        show: jest.fn(),
    })),
};
const fs = {
    readFile: jest.fn(),
    writeFile: jest.fn(),
};
const workspace = {
    fs,
    findFiles: jest.fn(async () => []),
    getConfiguration: jest.fn(() => ({ get: jest.fn() })),
    onDidChangeConfiguration: new EventEmitter().event,
    onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    onDidChangeWorkspaceFolders: jest.fn(() => ({ dispose: jest.fn() })),
    onDidSaveTextDocument: new EventEmitter().event,
    openTextDocument: jest.fn(),
    workspaceFolders: undefined,
    getWorkspaceFolder: jest.fn(),
    updateWorkspaceFolders: jest.fn(),
    createFileSystemWatcher: jest.fn(() => ({
        onDidCreate: new EventEmitter().event,
        onDidChange: new EventEmitter().event,
        onDidDelete: new EventEmitter().event,
        dispose: jest.fn(),
    })),
};

const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2
};

const TaskRevealKind = {
    Always: 1,
    Silent: 2,
    Never: 3
};

const TreeItem = class {
    /**
     * @param {string|vscode.TreeItemLabel} [label]
     * @param {number} [collapsibleState]
     */
    constructor(label, collapsibleState) {
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.id = undefined;
        this.iconPath = undefined;
        this.resourceUri = undefined;
        this.command = undefined;
        this.contextValue = undefined;
        this.tooltip = undefined;
        this.description = undefined;
        this.accessibilityInformation = undefined;
        this.checkboxState = undefined;
        this.resourceUri = undefined;
        this.iconPath = undefined;
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.id = undefined;
        this.contextValue = undefined;
        this.tooltip = undefined;
        this.description = undefined;
        this.resourceUri = undefined;
        this.iconPath = undefined;
        this.command = undefined;
        this.accessibilityInformation = undefined;
        this.checkboxState = undefined;
    }
};

class ThemeColor {
    constructor(id) {
        this.id = id;
    }
}

class ThemeIcon {
    constructor(id, color) {
        this.id = id;
        this.color = color;
    }
}

const UIKind = {
	Desktop: 1,
	Web: 2
};

env.uiKind = UIKind.Desktop;

module.exports = {
    CodeAction,
    ColorThemeKind,
    CodeActionKind,
    DiagnosticSeverity,
    Disposable,
    EventEmitter,
    Position,
    QuickPickItemKind,
    Range,
    RelativePattern,
    ShellExecution,
    Task,
    Uri,
    ShellQuoting,
    StatusBarAlignment,
    TaskScope,
    ViewColumn,
    ProgressLocation,
    commands,
    debug,
    env,
    languages,
    tasks,
    window,
    workspace,
    TaskRevealKind,
    TreeItem,
    TreeItemCollapsibleState,
    ThemeColor,
    ThemeIcon,
    UIKind,
};
