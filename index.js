#!/usr/bin/env node

const octokit = require('@octokit/rest')()
require('dotenv-safe').config();
const { getBranchDiff } = require('./branch-diff-ish')

octokit.authenticate({
  type: 'basic',
  username: process.env.USERNAME,
  password: process.env.PASSWORD
})

// mapping for branch diff version comparison
const compareVersion ={
  'v10.x': 'v11.x',
  'v11.x': 'master'
}

// get audit data to update the gist
function getNewAuditData(auditBranch, callback) {
  const options = {
    filterRelease: true,
    excludeLabels: [ 
      'semver-major',
      'semver-minor',
      `dont-land-on-${auditBranch}`,
      `backport-requested-${auditBranch}`,
      `backported-to-${auditBranch}`,
      'baking-for-lts' 
    ],
  }

  const branchOne = `${auditBranch}-staging`
  const branchTwo = `upstream/${compareVersion[auditBranch]}`

  return getBranchDiff(branchOne, branchTwo, options, callback)
}

async function gitAuditMaker (auditBranch) {
  const auditFileName = `audit-${auditBranch.split('.')[0]}.md`

  // get the audit log gist to edit
  const auditGist = Object.values((await octokit.gists.list()).data)
    .filter(gist => {
      const files = Object.keys(gist.files)
      return files.some(file => file === auditFileName)
    })[0]

  if (!auditGist) {
    console.log(`Failed to find the audit log gist at file: ${auditFileName}`)
    return 1
  }

  // get updated audit log data
  getNewAuditData(auditBranch, async auditData => {
    const options = {
      gist_id: auditGist.id,
      files: {}
    }
    options.files[auditFileName] = { content: auditData }

    // update gist with new data
    await octokit.gists.update(options)
  })
}

// initialize from command line
if (require.main === module) {
  let argv = require('minimist')(process.argv.slice(2))
  const auditBranch = argv._[0]

  gitAuditMaker(auditBranch)
}

module.exports = gitAuditMaker