#!/usr/bin/env node

const octokit = require('@octokit/rest')()
require('dotenv-safe').config();
const { getBranchDiff } = require('./branch-diff-ish')

octokit.authenticate({
  type: 'basic',
  username: process.env.USERNAME,
  password: process.env.PASSWORD
})

// get audit data to update the gist
function getNewAuditData(auditBranch) {
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
  const branchTwo = `upstream/v11.x`

  return getBranchDiff(branchOne, branchTwo, options)
}

async function gitAuditMaker (auditBranch) {
  const auditFileName = `audit-${auditBranch.split('.')[0]}.md`

  // get the audit log gist to edit
  const auditGist = Object.values((await octokit.gists.list()).data)
    .filter(gist => {
      const files = Object.keys(gist.files)
      return files.some(file => file === auditFileName)
    })
  
  // get the gist id for editing
  const gist_id = auditGist.id

  // get updated audit log data
  const newAuditData = getNewAuditData(auditBranch)
  console.log(newAuditData)

  // const options = {}
  // options.files[fileName].content = newAuditData
  
  // octokit.gists.update({gist_id, files: {
  //   content: newAuditData
  // }})
}

if (require.main === module) {
  let argv = require('minimist')(process.argv.slice(2))
  const auditBranch = argv._[0]

  gitAuditMaker(auditBranch)
}

module.exports = gitAuditMaker