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
const Disposable = vi.fn(function () {
    return { dispose: vi.fn() };
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
const RelativePattern = vi.fn(function () {});
const ShellExecution = vi.fn(function (executablePath, executionArgs, options) {
    return {
        executablePath,
        executionArgs,
        options,
    };
});
const Task = vi.fn(function (definition, scope, name, type, execution) {
    return {
        definition,
        scope,
        name,
        type,
        execution,
    };
});
const ColorThemeKind = {
    Dark: 1,
};

const Position = vi.fn(function () {});

const QuickPickItemKind = {
    Separator: -1,
};

const Range = vi.fn(function () {});

const DiagnosticSeverity = {
    Error: 0,
};

const CodeActionKind = {
    QuickFix: vi.fn(),
};
const CodeAction = vi.fn(function () {});

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
    executeCommand: vi.fn(),
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
};
const debug = {
    startDebugging: vi.fn(),
};
const env = {
    openExternal: vi.fn(),
};
const languages = {
    createDiagnosticCollection: vi.fn(),
};
const tasks = {
    executeTask: vi.fn(),
    fetchTasks: vi.fn(() => []),
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
    createStatusBarItem: vi.fn(() => ({
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn(),
    })),
    showTextDocument: vi.fn(),
    showInformationMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showErrorMessage: vi.fn(),
    showOpenDialog: vi.fn(),
    showWorkspaceFolderPick: vi.fn(),
    showQuickPick: vi.fn(),
    createQuickPick: vi.fn(),
    showInputBox: vi.fn(),
    withProgress: vi.fn(),
    registerTreeDataProvider: vi.fn(),
    registerCustomEditorProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registerUriHandler: vi.fn(() => ({ dispose: vi.fn() })),
    terminals: [],
    createTerminal: vi.fn(() => ({
        sendText: vi.fn(),
        show: vi.fn(),
    })),
    createTreeView: vi.fn(() => ({
        onDidExpandElement: new EventEmitter().event,
        onDidCollapseElement: new EventEmitter().event,
        dispose: vi.fn(),
    })),
    state: { focused: true },
    createOutputChannel: vi.fn(() => ({
        appendLine: vi.fn(),
        name: '',
        append: vi.fn(),
        replace: vi.fn(),
        clear: vi.fn(),
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn(),
        logLevel: LogLevel.Warning,
        onDidChangeLogLevel: new EventEmitter().event,
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })),
};
const fs = {
    readFile: vi.fn(),
    writeFile: vi.fn(),
};
const workspace = {
    fs,
    findFiles: vi.fn(async () => []),
    getConfiguration: vi.fn(() => ({
        get: vi.fn(),
        has: vi.fn(),
        inspect: vi.fn(),
        update: vi.fn(),
    })),
    onDidChangeConfiguration: new EventEmitter().event,
    onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeWorkspaceFolders: vi.fn(() => ({ dispose: vi.fn() })),
    onDidSaveTextDocument: new EventEmitter().event,
    openTextDocument: vi.fn(),
    registerTextDocumentContentProvider: vi.fn(() => ({
        dispose: vi.fn(),
    })),
    workspaceFolders: undefined,
    getWorkspaceFolder: vi.fn(),
    updateWorkspaceFolders: vi.fn(),
    createFileSystemWatcher: vi.fn(() => ({
        onDidCreate: new EventEmitter().event,
        onDidChange: new EventEmitter().event,
        onDidDelete: new EventEmitter().event,
        dispose: vi.fn(),
    })),
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
