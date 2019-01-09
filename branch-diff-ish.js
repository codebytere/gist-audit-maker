#!/usr/bin/env node

'use strict'

const fs             = require('fs')
const path           = require('path')
const commitStream   = require('commit-stream')
const split2         = require('split2')
const listStream     = require('list-stream')
const pkgtoId        = require('pkg-to-id')
const chalk          = require('chalk')
const map            = require('map-async')
const commitToOutput = require('changelog-maker/commit-to-output')
const collectCommitLabels = require('changelog-maker/collect-commit-labels')
const groupCommits   = require('changelog-maker/group-commits')
const isReleaseCommit = require('changelog-maker/groups').isReleaseCommit
const gitexec        = require('gitexec')

const pkgFile        = path.join(process.cwd(), 'package.json')
const pkgData        = fs.existsSync(pkgFile) ? require(pkgFile) : {}
const pkgId          = pkgtoId(pkgData)
const refcmd         = 'git rev-list --max-count=1 {{ref}}'
const commitdatecmd  = '$(git show -s --format=%cd `{{refcmd}}`)'
const gitcmd         = 'git log {{startCommit}}..{{branch}} --until="{{untilcmd}}"'
const ghId = {
  user: pkgId.user || 'nodejs',
  name: pkgId.name || 'node'
}


function replace (s, m) {
  Object.keys(m).forEach(function (k) {
    s = s.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), m[k])
  })
  return s
}


function branchDiff (branch1, branch2, options, callback) {
  if (!branch1 || !branch2)
    return callback(new Error('Must supply two branch names to compare'))

  let repoPath = options.repoPath || process.cwd()

  findMergeBase(repoPath, branch1, branch2, (err, commit) => {
    if (err)
      return callback(err)
    map(
        [ branch1, branch2 ], (branch, callback) => {
          collect(repoPath, branch, commit, branch == branch2 && options.endRef).pipe(listStream.obj(callback))
        }
      , (err, branchCommits) => err ? callback(err) : diffCollected(options, branchCommits, callback)
    )
  })
}


function findMergeBase (repoPath, branch1, branch2, callback) {
  let gitcmd = `git merge-base ${branch1} ${branch2}`

  gitexec.execCollect(repoPath, gitcmd, (err, data) => {
    if (err)
      return callback(err)

    callback(null, data.substr(0, 10))
  })
}


function diffCollected (options, branchCommits, callback) {
  function isInList (commit) {
    return branchCommits[0].some((c) => {
      if (commit.sha === c.sha)
        return true
      if (commit.summary === c.summary) {
        if (commit.prUrl && c.prUrl) {
            return commit.prUrl === c.prUrl
        } else if (commit.author.name === c.author.name
                && commit.author.email === c.author.email) {
          if (process.stderr.isTTY)
            console.error(`Note: Commit fell back to author checking: "${commit.summary}" -`, commit.author)
          return true
        }
      }
      return false
    })
  }

  let list = branchCommits[1].filter((commit) => !isInList(commit))

  collectCommitLabels(list, (err) => {
    if (err)
      return callback(err)

    if (options.excludeLabels.length > 0) {
      list = list.filter((commit) => {
        return !commit.labels || !commit.labels.some((label) => {
          return options.excludeLabels.indexOf(label) >= 0
        })
      })
    }

    if (options.requireLabels.length > 0) {
      list = list.filter((commit) => {
        return commit.labels && commit.labels.some((label) => {
          return options.requireLabels.indexOf(label) >= 0
        })
      })
    }

    if (options.group)
      list = groupCommits(list)

    callback(null, list)
  })
}


function printCommits (list, format, reverse) {
  if (format === 'sha') {
    list = list.map((commit) => `${commit.sha.substr(0, 10)}`)
  } else {
    list = list.map((commit) => commitToOutput(commit, format === 'simple', ghId))
  }

  if (reverse) list = list.reverse();

  let out = list.join('\n') + '\n'

  if (!process.stdout.isTTY)
    out = chalk.stripColor(out)

  process.stdout.write(out)
}


function collect (repoPath, branch, startCommit, endRef) {
  let endrefcmd = endRef && replace(refcmd, { ref: endRef })
    , untilcmd  = endRef ? replace(commitdatecmd, { refcmd: endrefcmd }) : ''
    , _gitcmd      = replace(gitcmd, { branch, startCommit, untilcmd })

  return gitexec.exec(repoPath, _gitcmd)
    .pipe(split2())
    .pipe(commitStream(ghId.user, ghId.name))
}

function getBranchDiff (branchOne, branchTwo, options = {
  simple: false,
  reverse: false,
  group: false,
  excludeLabels: [],
  requireLabels: [],
  endRef,
  filterRelease: false,
  version: false
}) {
  if (options.version)
    return console.log(`v ${require('./package.json').version}`)

  branchDiff(branchOne, branchTwo, options, (err, list) => {
    if (err) throw err

    if (options.filterRelease)
      list = list.filter((commit) => !isReleaseCommit(commit.summary))

    printCommits(list, options.format, options.reverse)
  })
}

module.exports = { getBranchDiff }