#!/usr/bin/env node
'use strict'

/* eslint-disable no-useless-escape */

const fs = require('fs')
const path = require('path')
const commitStream = require('commit-stream')
const split2 = require('split2')
const listStream = require('list-stream')
const pkgtoId = require('pkg-to-id')
const map = require('map-async')
const collectCommitLabels = require('changelog-maker/collect-commit-labels')
const reverts = require('changelog-maker/reverts')
const groupCommits = require('changelog-maker/group-commits')
const groups = require('changelog-maker/groups')
const gitexec = require('gitexec')

const pkgFile = path.join(process.cwd(), 'package.json')
const pkgData = fs.existsSync(pkgFile) ? require(pkgFile) : {}
const pkgId = pkgtoId(pkgData)
const refcmd = 'git rev-list --max-count=1 {{ref}}'
const commitdatecmd = '$(git show -s --format=%cd `{{refcmd}}`)'
const gitcmd = 'git log {{startCommit}}..{{branch}} --until="{{untilcmd}}"'
const ghId = {
  user: pkgId.user || 'nodejs',
  name: pkgId.name || 'node'
}

function replace (s, m) {
  Object.keys(m).forEach(k => {
    s = s.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), m[k])
  })
  return s
}

function branchDiff (branch1, branch2, options, callback) {
  if (!branch1 || !branch2) {
    return callback(new Error('Must supply two branch names to compare'))
  }

  let repoPath = options.repoPath || process.cwd()

  findMergeBase(repoPath, branch1, branch2, (err, commit) => {
    const collectFn = (err, branchCommits) => err ? callback(err) : diffCollected(options, branchCommits, callback)
    if (err) return callback(err)
    map([ branch1, branch2 ], (branch, callback) => {
      collect(repoPath, branch, commit, branch === branch2 && options.endRef).pipe(listStream.obj(callback))
    }, collectFn)
  })
}

function findMergeBase (repoPath, branch1, branch2, callback) {
  let gitcmd = `git merge-base ${branch1} ${branch2}`

  gitexec.execCollect(repoPath, gitcmd, (err, data) => {
    if (err) return callback(err)
    callback(null, data.substr(0, 10))
  })
}

function diffCollected (options, branchCommits, callback) {
  function isInList (commit) {
    return branchCommits[0].some((c) => {
      if (commit.sha === c.sha) return true
      if (commit.summary === c.summary) {
        if (commit.prUrl && c.prUrl) {
          return commit.prUrl === c.prUrl
        } else if (commit.author.name === c.author.name &&
                   commit.author.email === c.author.email) {
          return true
        }
      }
      return false
    })
  }

  let list = branchCommits[1].filter((commit) => !isInList(commit))

  collectCommitLabels(list, (err) => {
    if (err) return callback(err)

    if (options.excludeLabels.length > 0) {
      list = list.filter(commit => {
        return !commit.labels || !commit.labels.some(label => {
          return options.excludeLabels.indexOf(label) >= 0
        })
      })
    }

    if (options.requireLabels.length > 0) {
      list = list.filter(commit => {
        return commit.labels && commit.labels.some(label => {
          return options.requireLabels.indexOf(label) >= 0
        })
      })
    }

    if (options.group) {
      list = groupCommits(list)
    }

    callback(null, list)
  })
}

function collect (repoPath, branch, startCommit, endRef) {
  let endrefcmd = endRef && replace(refcmd, { ref: endRef })
  let untilcmd = endRef ? replace(commitdatecmd, { refcmd: endrefcmd }) : ''
  let _gitcmd = replace(gitcmd, { branch, startCommit, untilcmd })

  return gitexec.exec(repoPath, _gitcmd)
    .pipe(split2())
    .pipe(commitStream(ghId.user, ghId.name))
}

// copied and edited from changelog-maker
function toStringMarkdown (data) {
  let s = ''
  s += '* [[`' + data.sha.substr(0, 10) + '`](' + data.shaUrl + ')] - '
  s += (data.semver || []).length ? '**(' + data.semver.join(', ').toUpperCase() + ')** ' : ''
  s += data.revert ? '***Revert*** "' : ''
  s += data.group ? '**' + data.group + '**: ' : ''
  s += data.summary.replace(/([_~*\\\[\]<>])/g, '\\$1')
  s += data.revert ? '" ' : ' '
  s += data.author ? `(${data.author}) ` : ''
  s += data.pr ? `[${data.pr}](${data.prUrl})` : ''

  return s
}

// copied and edited from changelog-maker
function commitToOutput (commit, ghId) {
  const data = {}
  const prUrlMatch = commit.prUrl && commit.prUrl.match(/^https?:\/\/.+\/([^\/]+\/[^\/]+)\/\w+\/\d+$/i)
  const urlHash = `#${commit.ghIssue}` || commit.prUrl
  const ghUrl = `${ghId.user}/${ghId.name}`

  data.sha = commit.sha
  data.shaUrl = `https://github.com/${ghUrl}/commit/${commit.sha.substr(0, 10)}`
  data.semver = (commit.labels && commit.labels.filter(l => l.indexOf('semver') > -1)) || false
  data.revert = reverts.isRevert(commit.summary)
  data.group = groups.toGroups(commit.summary)
  data.summary = groups.cleanSummary(reverts.cleanSummary(commit.summary))
  data.author = (commit.author && commit.author.name) || ''
  data.pr = prUrlMatch && ((prUrlMatch[1] !== ghUrl ? prUrlMatch[1] : '') + urlHash)
  data.prUrl = prUrlMatch && commit.prUrl

  return toStringMarkdown(data)
}

function getBranchDiff (branchOne, branchTwo, options = {
  reverse: false,
  group: false,
  excludeLabels: [],
  endRef: '',
  filterRelease: false,
  version: false
}, callback) {
  if (options.version) {
    return console.log(`v ${require('./package.json').version}`)
  }

  branchDiff(branchOne, branchTwo, options, (err, list) => {
    if (err) throw err

    if (options.filterRelease) {
      list = list.filter(commit => !groups.isReleaseCommit(commit.summary))
    }

    list = list.map(commit => commitToOutput(commit, ghId))
    if (options.reverse) list = list.reverse()
    callback(null, list.join('\n') + '\n')
  })
}

module.exports = { getBranchDiff }
