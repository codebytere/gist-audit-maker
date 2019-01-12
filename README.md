## Gist Audit Maker

In keeping track of commits that need auditing for backport in Node.js, the current best approach is to maintain and update a gist with the commits.

This package allows for automatic updating of this gist.

### To Use

Set the following environment variables, as these are needed to authenticate `@octokit/rest` for gist fetching and updating

```sh
USERNAME=<your github username>
PASSWORD=<your github password>
```

This tool will look for a file named according to the following format: `audit-v[VERSION].md`, where version is a Node version such as `audit-v10.md` or `audit-v11.md`. If a gist with this name pattern doesn't exist, this tool will create it for you and then update it on future runs.

Install `gist-audit-maker` globally:

```sh
$ npm i -g gist-audit-maker
```

This tool must be run from your local clone of the core `nodejs/node` repository. It takes one argument: the the target branch for auditing.

Example:

```sh
$ cd /path/to/node
$ gist-audit-maker -- v10.x
```