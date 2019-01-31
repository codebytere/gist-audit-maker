#!/usr/bin/env node

'use strict'

const octokit = require('@octokit/rest')()
const { getBranchDiff } = require('./branch-diff-ish')

require('colors')
const pass = '\u2713'.green
const fail = '\u2717'.red

let auditBranch
let semverTarget

octokit.authenticate({
  type: 'basic',
  username: process.env.USERNAME,
  password: process.env.PASSWORD
})

// mapping for branch diff version comparison
const compareVersion = {
  'v9.x': 'v10.x',
  'v10.x': 'v11.x',
  'v11.x': 'master'
}

// get audit data to update the gist
function getNewAuditData (callback) {
  const options = {
    filterRelease: true,
    excludeLabels: [
      'semver-major',
      `dont-land-on-${auditBranch}`,
      `backport-requested-${auditBranch}`,
      `backported-to-${auditBranch}`,
      'baking-for-lts'
    ]
  }

  if (semverTarget === 'patch') {
    options.excludeLabels.push('semver-minor')
  } else if (semverTarget === 'minor') {
    options.requireLabels = ['semver-minor']
  } else {
    throw new Error('Invalid semver target type: must be [minor | patch].')
  }

  const branchOne = `${auditBranch}-staging`
  const branchTwo = `upstream/${compareVersion[auditBranch]}`

  return getBranchDiff(branchOne, branchTwo, options, callback)
}

async function gistAuditMaker () {
  const auditFileName = `audit-${auditBranch.split('.')[0]}.md`

  // get the audit log gist to edit
  const auditGist = Object.values((await octokit.gists.list()).data)
    .filter(gist => {
      const files = Object.keys(gist.files)
      return files.some(file => file === auditFileName)
    })[0]

  // get updated audit log data
  getNewAuditData(async auditData => {
    if (auditGist) {
      const options = {
        gist_id: auditGist.id,
        files: {}
      }
      options.files[auditFileName] = { content: auditData }

      // update gist with new data
      octokit.gists.update(options)
        .then(gist => {
          console.log(`${pass} See updated gist at: ${gist.data.html_url}`)
        }).catch(err => {
          console.log(`${fail} Failed to update gist: `, err)
          return 1
        })
    } else {
      const options = { files: {} }
      options.files[auditFileName] = { content: auditData }

      // create a new gist
      octokit.gists.create(options)
        .then(gist => {
          console.log(`${pass} Created new gist at: ${gist.data.html_url}`)
        }).catch(err => {
          console.log(`${fail} Failed to create new gist: `, err)
          return 1
        })
    }
  })
}

// initialize from command line
if (require.main === module) {
  let argv = require('minimist')(process.argv.slice(2))
  auditBranch = argv._[0]
  semverTarget = argv._[1]

  if (!Object.keys(compareVersion).includes(auditBranch)) {
    throw new Error('Invalid branch: must be [v9.x | v10.x | v11.x]')
  }

  gistAuditMaker()
}

module.exports = gistAuditMaker
