## Gist Audit Maker

In keeping track of commits that need auditing for backport in Node.js, the current best approach is to maintain and update a gist with the commits.

This package allows for automatic updating of this gist.

### To Use

Set the following environment variables, as these are needed to authenticate `@octokit/rest` for gist fetching and updating

```sh
USERNAME=<your github username>
PASSWORD=<your github password>
```

You will also need to have an existing gist with the name of the target branch for auditing. This gist will need to be named according to the following format: `audit-v[VERSION].md`, where version is a Node version such as `audit-v10.md` or `audit-v11.md`.

Note: Future versions will create this gist if it doesn't already exist.

Install `gist-audit-maker` globally:

```sh
$ npm i -g gist-audit-maker
```

This tool takes one argument: the the target branch for auditing.

Examples:

```sh
$ gist-audit-maker -- v10.x 
$ gist-audit-maker -- v11.x 
```