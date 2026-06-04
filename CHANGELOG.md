# Change Log

All notable changes to the "vscode-topo" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## 0.1.0

## What's Changed
* feat!: remove serial monitor integration and related configurations by @federicobozzini in https://github.com/arm/vscode-topo/pull/7
* chore(deps): bump actions/setup-node from 4.4.0 to 6.3.0 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/6
* chore: update CODEOWNERS and repository URL by @federicobozzini in https://github.com/arm/vscode-topo/pull/8
* chore: Bump  topo CLI to version 4.0.0 by @federicobozzini in https://github.com/arm/vscode-topo/pull/9
* chore: remove outdated Topo CLI update documentation by @federicobozzini in https://github.com/arm/vscode-topo/pull/10
* chore(deps): bump softprops/action-gh-release from 2.4.1 to 3.0.0 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/14
* chore(deps): bump actions/upload-artifact from 5.0.0 to 7.0.1 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/15
* chore: removed unnecessary files from .vsix file by @federicobozzini in https://github.com/arm/vscode-topo/pull/11
* chore: fix punycode deprecation warning by @federicobozzini in https://github.com/arm/vscode-topo/pull/12
* chore: fix npm version for dependabot by @federicobozzini in https://github.com/arm/vscode-topo/pull/13
* chore: update LICENSE to Apache 2.0 by @federicobozzini in https://github.com/arm/vscode-topo/pull/17
* chore(deps-dev): bump webpack from 5.99.7 to 5.106.1 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/19
* chore(deps-dev): bump yargs from 17.7.2 to 18.0.0 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/20
* chore(deps-dev): bump minimatch from 3.1.2 to 3.1.5 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/24
* chore(deps-dev): bump ts-loader from 9.5.2 to 9.5.7 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/21
* chore: update README and add development guide by @federicobozzini in https://github.com/arm/vscode-topo/pull/16
* chore: tsconfig refactor by @federicobozzini in https://github.com/arm/vscode-topo/pull/26
* chore: tests speedup by @federicobozzini in https://github.com/arm/vscode-topo/pull/28
* chore: update topo-cli to v4.1.0 by @federicobozzini in https://github.com/arm/vscode-topo/pull/31
* CI: enable npm caching in CI by @federicobozzini in https://github.com/arm/vscode-topo/pull/27
* feat: list candidate targets from sshconfig when adding target by @awphi in https://github.com/arm/vscode-topo/pull/25
* chore: bump typescript to version 6 by @federicobozzini in https://github.com/arm/vscode-topo/pull/29
* chore: removed unrestricted imports for builtin modules by @federicobozzini in https://github.com/arm/vscode-topo/pull/30
* chore(deps-dev): bump @swc/core from 1.15.24 to 1.15.26 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/32
* feat: direct users to edit ssh config  entries via topo_config by @federicobozzini in https://github.com/arm/vscode-topo/pull/37
* refactor: de-singletonize TargetStore by @awphi in https://github.com/arm/vscode-topo/pull/39
* feat: remove configure ssh targets quickpick entry by @awphi in https://github.com/arm/vscode-topo/pull/41
* refactor: delete unused files by @awphi in https://github.com/arm/vscode-topo/pull/43
* refactor: delete unused on-target console opener by @awphi in https://github.com/arm/vscode-topo/pull/38
* refactor: remove as unknown casts by @awphi in https://github.com/arm/vscode-topo/pull/42
* refactor: TopoError replaced by WrappedError by @federicobozzini in https://github.com/arm/vscode-topo/pull/44
* refactor: dockerCommands refactor by @awphi in https://github.com/arm/vscode-topo/pull/46
* refactor: use a unified interface to describe wrapped error logs by @federicobozzini in https://github.com/arm/vscode-topo/pull/45
* feat: enhance TopoError handling and logging with structured log entries by @federicobozzini in https://github.com/arm/vscode-topo/pull/36
* chore(deps): bump actions/setup-node from 6.3.0 to 6.4.0 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/51
* chore(deps-dev): bump @vscode/vsce from 3.6.2 to 3.9.1 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/52
* chore(deps-dev): bump typescript from 6.0.2 to 6.0.3 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/53
* ci: add validate PR title workflow by @awphi in https://github.com/arm/vscode-topo/pull/49
* refactor: delete Target class by @awphi in https://github.com/arm/vscode-topo/pull/40
* chore: npm audit fix by @federicobozzini in https://github.com/arm/vscode-topo/pull/57
* chore(deps): bump postcss from 8.5.3 to 8.5.12 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/61
* chore: Bumped topo CLI to version 5.0.0 by @federicobozzini in https://github.com/arm/vscode-topo/pull/60
* refactor: replace TargetItem struct with simple strings by @awphi in https://github.com/arm/vscode-topo/pull/58
* feat: remove compose editor by @federicobozzini in https://github.com/arm/vscode-topo/pull/63
* chore: fixed preLaunch task for debugging by @federicobozzini in https://github.com/arm/vscode-topo/pull/59
* refactor: pass explicit target parameters to ContainersManager by @awphi in https://github.com/arm/vscode-topo/pull/56
* feat: remove target dashboard by @federicobozzini in https://github.com/arm/vscode-topo/pull/64
* refactor: removed unused isPlainObject by @federicobozzini in https://github.com/arm/vscode-topo/pull/65
* chore: removed unused dependencies by @federicobozzini in https://github.com/arm/vscode-topo/pull/66
* refactor: further slim down `ContainersManager` by @awphi in https://github.com/arm/vscode-topo/pull/62
* chore: vite bumped to version 8.0.10 by @federicobozzini in https://github.com/arm/vscode-topo/pull/68
* feat: install missing/unhealthy dependencies by @awphi in https://github.com/arm/vscode-topo/pull/67
* chore: bump topo CLI to version 5.1.1 by @federicobozzini in https://github.com/arm/vscode-topo/pull/74
* chore: delete docker stats by @awphi in https://github.com/arm/vscode-topo/pull/70
* fix: get target containers data immediately after target switch by @federicobozzini in https://github.com/arm/vscode-topo/pull/72
* chore(deps-dev): bump tar and @types/tar by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/77
* chore(deps-dev): bump @eslint/eslintrc from 3.3.3 to 3.3.5 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/78
* chore(deps-dev): bump @typescript-eslint/parser from 8.58.2 to 8.59.1 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/80
* feat: remove requirement on container engine to interact with treeview by @awphi in https://github.com/arm/vscode-topo/pull/69
* refactor: unify task execution by @awphi in https://github.com/arm/vscode-topo/pull/71
* fix: improved logger disposal by @federicobozzini in https://github.com/arm/vscode-topo/pull/83
* refactor: removed duplicated projectClone tests by @federicobozzini in https://github.com/arm/vscode-topo/pull/82
* fix: handle `topo describe` output renames by @federicobozzini in https://github.com/arm/vscode-topo/pull/85
* fix: improved targetStore disposal by @federicobozzini in https://github.com/arm/vscode-topo/pull/84
* feat: added new host-manager view by @federicobozzini in https://github.com/arm/vscode-topo/pull/81
* refactor: remove unnecessary casting by @federicobozzini in https://github.com/arm/vscode-topo/pull/86
* chore: eslint bumped to version 10 by @federicobozzini in https://github.com/arm/vscode-topo/pull/76
* chore(deps-dev): bump eslint from 10.2.1 to 10.3.0 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/55
* chore: removed unused tar types by @federicobozzini in https://github.com/arm/vscode-topo/pull/89
* chore: improved gitignore to ignore all of test-workspace content by @federicobozzini in https://github.com/arm/vscode-topo/pull/88
* chore(deps-dev): bump vite from 8.0.10 to 8.0.11 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/97
* chore(deps-dev): bump @typescript-eslint/eslint-plugin from 8.58.2 to 8.59.2 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/99
* chore(deps-dev): bump prettier from 3.7.4 to 3.8.3 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/100
* chore(deps-dev): bump tar from 7.5.13 to 7.5.15 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/101
* chore(ci): speedup test step by @federicobozzini in https://github.com/arm/vscode-topo/pull/94
* chore: remove unused topo CLI deploy wrapper by @awphi in https://github.com/arm/vscode-topo/pull/96
* refactor: files and folders renamed to better mirror codebase structure by @federicobozzini in https://github.com/arm/vscode-topo/pull/91
* chore: improved eslint rules by @federicobozzini in https://github.com/arm/vscode-topo/pull/90
* chore(ci): remove unnecessary app token step by @federicobozzini in https://github.com/arm/vscode-topo/pull/95
* feat: add support for topo stop operation by @federicobozzini in https://github.com/arm/vscode-topo/pull/87
* chore(deps-dev): bump fast-uri from 3.0.6 to 3.1.2 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/103
* chore(deps-dev): bump @swc/core from 1.15.26 to 1.15.33 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/106
* chore(deps-dev): bump @typescript-eslint/eslint-plugin from 8.59.2 to 8.59.3 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/107
* chore(deps-dev): bump vite from 8.0.11 to 8.0.13 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/108
* chore: make getSelectedTarget sync by @awphi in https://github.com/arm/vscode-topo/pull/102
* chore(deps-dev): bump jest-mock-extended from 4.0.0 to 4.0.1 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/109
* refactor: introduced topo host health operation by @federicobozzini in https://github.com/arm/vscode-topo/pull/92
* refactor: move target health inspection out of tree data provider by @awphi in https://github.com/arm/vscode-topo/pull/112
* refactor: separate target management commands + delete unused refresh command by @awphi in https://github.com/arm/vscode-topo/pull/113
* refactor: standalone showoutput command by @awphi in https://github.com/arm/vscode-topo/pull/117
* refactor: move projectInit into actions dir by @awphi in https://github.com/arm/vscode-topo/pull/116
* chore: remove unused TargetStore.updateTarget method by @awphi in https://github.com/arm/vscode-topo/pull/114
* feat: update health check dependency fix to run actual command exposed by topo by @federicobozzini in https://github.com/arm/vscode-topo/pull/120
* chore: sync-ify extension activation by @awphi in https://github.com/arm/vscode-topo/pull/121
* refactor: extract executeCommand utility for test commands by @federicobozzini in https://github.com/arm/vscode-topo/pull/122
* refactor: use executeCommand test utility in all places by @federicobozzini in https://github.com/arm/vscode-topo/pull/123
* chore(deps-dev): bump @typescript-eslint/eslint-plugin from 8.59.3 to 8.59.4 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/125
* chore(deps-dev): bump eslint from 10.3.0 to 10.4.0 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/124
* refactor: MVC-ify the host health tree by @awphi in https://github.com/arm/vscode-topo/pull/119
* chore(deps-dev): bump @types/node from 22.19.15 to 22.19.19 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/126
* chore: require vscode 1.101.* by @awphi in https://github.com/arm/vscode-topo/pull/131
* refactor: centralize dependency visibility and fix helpers by @federicobozzini in https://github.com/arm/vscode-topo/pull/136
* chore(deps-dev): bump jest from 30.3.0 to 30.4.2 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/127
* chore(deps-dev): bump @typescript-eslint/parser from 8.59.4 to 8.60.0 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/128
* docs: add ARCHITECTURE doc for MVC by @awphi in https://github.com/arm/vscode-topo/pull/132
* refactor: move showOutput command into new register flow by @awphi in https://github.com/arm/vscode-topo/pull/133
* chore(deps): bump uuid and @azure/msal-node by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/129
* chore(deps-dev): bump qs from 6.14.2 to 6.15.2 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/130
* chore(deps-dev): bump tmp from 0.2.4 to 0.2.6 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/139
* refactor: rename install dependency action to fix dependency by @federicobozzini in https://github.com/arm/vscode-topo/pull/137
* refactor: introduce TargetController by @awphi in https://github.com/arm/vscode-topo/pull/134
* refactor: migrate tests from Jest to Vitest by @federicobozzini in https://github.com/arm/vscode-topo/pull/138
* fix: issues detections on activation by @federicobozzini in https://github.com/arm/vscode-topo/pull/141
* refactor: separate status bar and target manager tree views by @awphi in https://github.com/arm/vscode-topo/pull/135
* refactor: separate vscode doc provider + utilise for host health by @awphi in https://github.com/arm/vscode-topo/pull/140
* test: improve TransientDocumentProvider interface by @federicobozzini in https://github.com/arm/vscode-topo/pull/142
* refactor: wrap malformed target store data errors by @federicobozzini in https://github.com/arm/vscode-topo/pull/144
* feat: mark targets with fixable dependencies by @federicobozzini in https://github.com/arm/vscode-topo/pull/143
* refactor: separate command handlers from actions by @federicobozzini in https://github.com/arm/vscode-topo/pull/145
* refactor: add DisposableCollector for lifecycle cleanup by @federicobozzini in https://github.com/arm/vscode-topo/pull/146
* refactor: introduce target model for target readers by @awphi in https://github.com/arm/vscode-topo/pull/147
* test: skip flaky host health integration on Windows CI by @federicobozzini in https://github.com/arm/vscode-topo/pull/152
* chore(deps-dev): bump @typescript-eslint/parser from 8.59.4 to 8.60.0 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/154
* chore(deps-dev): bump @typescript-eslint/eslint-plugin from 8.59.4 to 8.60.0 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/158
* chore(deps-dev): bump globals from 17.5.0 to 17.6.0 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/157
* chore(deps-dev): bump vitest-mock-extended from 3.1.1 to 4.0.0 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/156
* chore(deps-dev): bump vite from 8.0.13 to 8.0.14 by @dependabot[bot] in https://github.com/arm/vscode-topo/pull/155
* feat: remove automatic dependency fix prompt by @federicobozzini in https://github.com/arm/vscode-topo/pull/149
* feat: show dependency health in target status bar by @federicobozzini in https://github.com/arm/vscode-topo/pull/151
* chore: add tests for TargetModel by @awphi in https://github.com/arm/vscode-topo/pull/153
* refactor: introduced more specific type for a target health check result by @federicobozzini in https://github.com/arm/vscode-topo/pull/162
* fix: restrict deploy and stop actions to compose.yaml file by @federicobozzini in https://github.com/arm/vscode-topo/pull/161
* feat: introduced new topo icon by @federicobozzini in https://github.com/arm/vscode-topo/pull/164
* docs: small README improvements by @federicobozzini in https://github.com/arm/vscode-topo/pull/160
* fix: Use bundled topo CLI for tasks by @yejseo01 in https://github.com/arm/vscode-topo/pull/163
* refactor: separate host health action by @awphi in https://github.com/arm/vscode-topo/pull/171
* fix: run extension tasks without a shell by @yejseo01 in https://github.com/arm/vscode-topo/pull/172
* refactor: slim down API surface of TargetStore by @awphi in https://github.com/arm/vscode-topo/pull/165
* chore: align controller methods with command handler naming by @awphi in https://github.com/arm/vscode-topo/pull/166
* docs: add actions to architecture doc + full dataflow diagram by @awphi in https://github.com/arm/vscode-topo/pull/167
* refactor: register all commands in centralized command router by @awphi in https://github.com/arm/vscode-topo/pull/168
* refactor: use transient doc provider in target health action by @awphi in https://github.com/arm/vscode-topo/pull/170
* fix: run docker commands without shell by @yejseo01 in https://github.com/arm/vscode-topo/pull/173
* refactor: simplify target tree view rendering by @awphi in https://github.com/arm/vscode-topo/pull/176

## New Contributors
* @federicobozzini made their first contribution in https://github.com/arm/vscode-topo/pull/7
* @dependabot[bot] made their first contribution in https://github.com/arm/vscode-topo/pull/6
* @awphi made their first contribution in https://github.com/arm/vscode-topo/pull/25
* @yejseo01 made their first contribution in https://github.com/arm/vscode-topo/pull/163

**Full Changelog**: https://github.com/arm/vscode-topo/commits/v0.1.0


## [Unreleased]

- Initial release
