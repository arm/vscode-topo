# Topo CLI update strategy

## ~~Step 1 - cleanup~~

### ~~VS Code changes:~~

- ~~Removal of unused features including~~
    - ~~service addition~~
    - ~~service deletion~~
    - ~~makefile generation~~

## Step 2 - disable and update

### VS Code changes:

- Topo CLI updated to latest version (to be determined).
- Deploy functionality to be disabled

## Step 3 - deploy operation

### VS Code changes:

- Deploy re-enabled with support for target argument
    - How? Possible strategy would be to start just by adding a context menu command on compose files. What compose file? All?
- Selected target made more prominent to the user (EG: status bar indicator)
- Deploy operation should be cancelable

### Topo CLI changes:

- examples need to be listed in json format
- example could include a user friendly name. Only an id is shown now.

## Step 4 - example cloning

### VS Code changes:

- Clone operation added
    - The user must be able to provide clone parameters. Two options: redirect topo CLI stdin or let VS Code know what parameters will be needed before cloning.

### Topo CLI changes:

- `topo clone` implemented as discussed into topo CLI
- A new operation to show example arguments can be added

## Step 5 - example listing

### VS Code changes:

- Example listing added


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
