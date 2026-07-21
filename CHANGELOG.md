# Change Log

All notable changes to the "vscode-topo" extension will be documented in this file.




## 0.10.0

<!-- Release notes generated using configuration in .github/release.yml at 0eda69759f36ab480ff82a5b52521ebd04dae692 -->

## What's Changed
### Features and Enhancements
* feat: disable Topo self-upgrades in extension (#341)
### Fixes
* fix: allow project deploy and stop while refreshing healthy targets (#342)
* fix: refresh projects when ancestor folders are deleted (#343)
* fix: make topo.openSettings command name more accurate (#356)


**Full Changelog**: https://github.com/arm/vscode-topo/compare/v0.8.0...v0.10.0


## 0.8.0

<!-- Release notes generated using configuration in .github/release.yml at 3e886b7b541a937a6d7a85ab9a1d2769d0fba7b1 -->

## What's Changed
### Breaking Changes
* feat!: merge template and remote clone commands into single command (#329)
### Features and Enhancements
* feat: use clearer stopped container icon (#309)
* feat: when health check passes, a green tick shows (#308)
* feat: surface consistent error messages from the Topo CLI  (#311)
* feat: use native log levels for logging (#318)
* feat: render full error in tree view item tooltip and prevent on-click behaviour (#324)
* feat: cancel deployment when target is not ready (#317)
* feat: enable cli flags (#312)
* feat: add UI button to open containers in browser (#326)
* feat: add UI button connect to selected target via SSH (#327)
* feat: cancel stop operation when target is not ready (#328)
* feat: rename templates to projects (#336)
### Fixes
* fix: ensure all resources are disposed on extension deactivation (#314)
* fix: skip topo version check in terminal (#338)


**Full Changelog**: https://github.com/arm/vscode-topo/compare/v0.6.0...v0.8.0


## 0.6.0

<!-- Release notes generated using configuration in .github/release.yml at ca09aa3a22290edbd544ab0aa16bedf300d13425 -->

## What's Changed
### Breaking Changes
* feat!: `Unselect Target` renamed to `Clear Selection` (#296)
* feat!: rename `Dependencies` tree item to `Health` (#297)
### Features and Enhancements
* feat: display containers in project view exclusively (#291)
* feat: prevent render of welcome views before extension is ready (#293)

**Full Changelog**: https://github.com/arm/vscode-topo/compare/v0.4.0...v0.6.0


## 0.4.0

## What's Changed
* feat: support manual refresh of Target View by @awphi in https://github.com/arm/vscode-topo/pull/245
* refactor: put target description in target model/controller by @awphi in https://github.com/arm/vscode-topo/pull/239
* ci: revert removal of publish step by @awphi in https://github.com/arm/vscode-topo/pull/253
* chore: remove debounce in target tree view renders by @awphi in https://github.com/arm/vscode-topo/pull/254
* chore: avoid floating promises by @federicobozzini in https://github.com/arm/vscode-topo/pull/259
* test: misc assertion tidy up by @awphi in https://github.com/arm/vscode-topo/pull/260
* refactor: introduced task executor to execute tasks by @federicobozzini in https://github.com/arm/vscode-topo/pull/219
* feat: introduced a Projects view by @federicobozzini in https://github.com/arm/vscode-topo/pull/248
* fix: added support for git SHAs for the clone operation by @federicobozzini in https://github.com/arm/vscode-topo/pull/262
* refactor: introduce unloaded state for stationary, unrequested data by @awphi in https://github.com/arm/vscode-topo/pull/261
* fix: allow execution of tasks without workspaces by @awphi in https://github.com/arm/vscode-topo/pull/263
* chore: removed unnecessary code from TargetController class by @federicobozzini in https://github.com/arm/vscode-topo/pull/265
* feat: make target management case-sensitive by @awphi in https://github.com/arm/vscode-topo/pull/266
* feat: add single clone command and corresponding project view button by @awphi in https://github.com/arm/vscode-topo/pull/274
* chore: update topo CLI to version 7.1.0 by @federicobozzini in https://github.com/arm/vscode-topo/pull/277
* feat: make Target view more compact by removing target node element by @federicobozzini in https://github.com/arm/vscode-topo/pull/267
* fix: allow cloning template projects when selected target is unhealthy by @awphi in https://github.com/arm/vscode-topo/pull/275
* chore: drop support for v-prefix CLI version strings by @awphi in https://github.com/arm/vscode-topo/pull/279
* feat: support vscode.dev URL redirect by @federicobozzini in https://github.com/arm/vscode-topo/pull/264
* chore: upgrade to topo 7.2.0 by @awphi in https://github.com/arm/vscode-topo/pull/280
* chore: group changes in changelog by @tgonzalezorlandoarm in https://github.com/arm/vscode-topo/pull/246
* feat: add refresh button to the Projects view by @federicobozzini in https://github.com/arm/vscode-topo/pull/283
* fix: make sure Target view placeholder is only shown when necessary by @federicobozzini in https://github.com/arm/vscode-topo/pull/282
* feat: show container count in processing domain by @awphi in https://github.com/arm/vscode-topo/pull/281
* feat: add project clone call to action, adjust clone button icon, re-order clone options by @awphi in https://github.com/arm/vscode-topo/pull/278
* ci: make release note label creation idempotent by @tgonzalezorlandoarm in https://github.com/arm/vscode-topo/pull/284
* ci: fix permissions read -> write so that labels can update by @tgonzalezorlandoarm in https://github.com/arm/vscode-topo/pull/286

**Full Changelog**: https://github.com/arm/vscode-topo/compare/v0.2.0...v0.4.0


## 0.2.0

## What's Changed
* feat: remove unnecessary activation event by @federicobozzini in https://github.com/arm/vscode-topo/pull/250
* fix: add corrupted target data reset flow by @federicobozzini in https://github.com/arm/vscode-topo/pull/205
* feat: automatically refresh Target View after fixing an issue by @awphi in https://github.com/arm/vscode-topo/pull/242
* chore: update test files names to match implementations by @awphi in https://github.com/arm/vscode-topo/pull/251
* ci: download correct binary for release packaging by @awphi in https://github.com/arm/vscode-topo/pull/252


**Full Changelog**: https://github.com/arm/vscode-topo/compare/v0.0.1...v0.2.0


## 0.0.1

Initial release.
