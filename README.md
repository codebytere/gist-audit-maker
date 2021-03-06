## Gist Audit Maker

In keeping track of commits that need auditing for backport in Node.js, the current best approach is to maintain and update a gist with the commits.

This package allows for automatic updating of this gist.

### To Use

Set the following environment variables, as these are needed to authenticate `@octokit/rest` for gist fetching and updating

```sh
export USERNAME=<your github username>
export PASSWORD=<your github password>
```

This tool will look for a file named according to the following format: `audit-v[VERSION]-[SEMVER].md`, where version is a Node version such as `audit-v10-patch.md` or `audit-v11-minor.md`. If a gist with this name pattern doesn't exist, this tool will create it for you and then update it on future runs.

Install `gist-audit-maker` globally:

```sh
$ npm i -g gist-audit-maker
```

This tool must be run from your local clone of the core `nodejs/node` repository. It takes three arguments:

1. `branch` - the target branch for auditing
2. `semver` - whether you would like to see either `semver-minor` or `semver-patch` commits (possible values are `minor` or `patch`)
3. `fork` - whether or not the repo in which this is being run is a fork (defaults to `false`)

Examples:

```sh
$ cd /path/to/node
$ gist-audit-maker --branch=v10.x --semver=patch --fork=true
```

```sh
$ cd /path/to/node
$ gist-audit-maker --branch=v11.x --semver=minor
```

You could also run it with `npx`, like so:

```sh
$ cd /path/to/node
$ npx gist-audit-maker --branch=v10.x --semver=minor --fork=false
```