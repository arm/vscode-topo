# Topo CLI update strategy

## ~~Step 1 - cleanup~~

### ~~VS Code changes:~~

- ~~Removal of unused features including~~
    - ~~service addition~~
    - ~~service deletion~~
    - ~~makefile generation~~

## ~~Step 2 - disable and update~~

### ~~VS Code changes:~~

- ~~Topo CLI updated to latest version (to be determined)~~
- ~~Deploy functionality to be disabled~~

## ~~Step 3 - deploy operation~~

### ~~VS Code changes:~~

- ~~Deploy re-enabled with support for target argument~~
- ~~Selected target made more prominent to the user (EG: status bar indicator)~~
- ~~Deploy operation should be cancelable~~

## Step 4 - remote and local cloning

### VS Code changes:

- ~~Clone operation added for remote repos~~
    - ~~The user must be able to provide clone parameters. Initially done by letting clone run in a VS Code terminal~~

- Clone operation added for local repos

## Step 5 - example listing

### VS Code changes:

- Example listing added

### Topo CLI changes:

- examples need to be listed in json format
- example could include a user friendly name. Only an id is shown now.

## Step 6 - topo health

### VS Code changes:

- Target subsystems and health information are loaded using topo CLI

### Topo CLI changes:

- `topo health` command must be json
- `topo health` command must add information about the state of the docker runtime (EG: is it running)
- `topo health` can be split into two different commands, one to check the connection and docker state(called frequently), and one to return HW information
- `topo health` asks to accept ssh fingerprint, this is not very practical in VS Code since the health operation would be run without any user interaction

## Step 7 - topo extend

### VS Code changes:

- Add support for `topo extend` operation. Details TBD.

### Topo CLI changes:

- `topo extend` command added to CLI
