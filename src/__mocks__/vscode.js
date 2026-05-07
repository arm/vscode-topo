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
Disposable.from = (disposable) => disposable;
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
        this._callbacks.forEach((cb) => cb(event));
    }
}
const RelativePattern = jest.fn();
const ShellExecution = jest.fn((executablePath, executionArgs, options) => ({
    executablePath,
    executionArgs,
    options,
}));
const Task = jest.fn((definition, scope, name, type, execution) => ({
    definition,
    scope,
    name,
    type,
    execution,
}));
const ColorThemeKind = {
    Dark: 1,
};

const Position = jest.fn();

const QuickPickItemKind = {
    Separator: -1,
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
const StatusBarAlignment = { Left: 1, Right: 2 };
const TaskScope = { Global: 1, Workspace: 2 };
const ViewColumn = {
    Active: -1,
    Beside: -2,
};
const ProgressLocation = { Notification: 1 };

// Namespaces
const commands = {
    executeCommand: jest.fn(),
    registerCommand: jest.fn(() => ({ dispose: jest.fn() })),
};
const debug = {
    startDebugging: jest.fn(),
};
const env = {
    openExternal: jest.fn(),
};
const languages = {
    createDiagnosticCollection: jest.fn(),
};
const tasks = {
    executeTask: jest.fn(),
    fetchTasks: jest.fn(() => []),
    onDidStartTaskProcess: new EventEmitter().event,
    onDidEndTaskProcess: new EventEmitter().event,
};
const LogLevel = {
    Off: 0,
    Trace: 1,
    Debug: 2,
    Info: 3,
    Warning: 4,
    Error: 5,
};
const window = {
    activeColorTheme: { kind: 1 },
    createStatusBarItem: jest.fn(() => ({
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
    })),
    showTextDocument: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showOpenDialog: jest.fn(),
    showWorkspaceFolderPick: jest.fn(),
    showQuickPick: jest.fn(),
    createQuickPick: jest.fn(),
    showInputBox: jest.fn(),
    withProgress: jest.fn(),
    registerTreeDataProvider: jest.fn(),
    registerCustomEditorProvider: jest.fn(() => ({ dispose: jest.fn() })),
    registerUriHandler: jest.fn(() => ({ dispose: jest.fn() })),
    terminals: [],
    createTerminal: jest.fn(() => ({
        sendText: jest.fn(),
        show: jest.fn(),
    })),
    createTreeView: jest.fn(() => ({
        onDidExpandElement: new EventEmitter().event,
        onDidCollapseElement: new EventEmitter().event,
        dispose: jest.fn(),
    })),
    state: { focused: true },
    createOutputChannel: jest.fn(() => ({
        appendLine: jest.fn(),
        name: '',
        append: jest.fn(),
        replace: jest.fn(),
        clear: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
        logLevel: LogLevel.Warning,
        onDidChangeLogLevel: new EventEmitter().event,
        trace: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
    })),
};
const fs = {
    readFile: jest.fn(),
    writeFile: jest.fn(),
};
const workspace = {
    fs,
    findFiles: jest.fn(async () => []),
    getConfiguration: jest.fn(() => ({
        get: jest.fn(),
        has: jest.fn(),
        inspect: jest.fn(),
        update: jest.fn(),
    })),
    onDidChangeConfiguration: new EventEmitter().event,
    onDidChangeTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
    onDidChangeWorkspaceFolders: jest.fn(() => ({ dispose: jest.fn() })),
    onDidSaveTextDocument: new EventEmitter().event,
    openTextDocument: jest.fn(),
    registerTextDocumentContentProvider: jest.fn(() => ({
        dispose: jest.fn(),
    })),
    workspaceFolders: undefined,
    getWorkspaceFolder: jest.fn(),
    updateWorkspaceFolders: jest.fn(),
};

const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
};

const TaskRevealKind = {
    Always: 1,
    Silent: 2,
    Never: 3,
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
    Web: 2,
};

const EndOfLine = {
    LF: 1,
    CRLF: 2,
};

env.uiKind = UIKind.Desktop;

module.exports = {
    CodeAction,
    ColorThemeKind,
    CodeActionKind,
    DiagnosticSeverity,
    Disposable,
    EndOfLine,
    EventEmitter,
    LogLevel,
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
