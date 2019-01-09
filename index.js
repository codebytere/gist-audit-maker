const Gists = require('gists')
require('dotenv-safe').config();
const { getBranchDiff } = require('./branch-diff-ish')

const gists = new Gists({
  username: process.env.USERNAME,
  password: process.env.PASSWORD
})

let auditBranch

if (require.main === module) {
  let argv = require('minimist')(process.argv.slice(2))
  auditBranch = argv._[0]
}

// get audit data to update the 
function getNewAuditData() {
  const options = {
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

function gitAuditMaker (auditBranch) {
  const auditFileName = `audit-${auditBranch}.md`

  // get the audit log gist to edit
  const auditGist = gists.list(username).data
    .filter(gist => {
      const files = Object.keys(gist.data.files)
      return files.some(file => file === auditFileName)
    })[0]
  
  // get the gist id for editing
  const auditGistID = auditGist.id

  // get updated audit log data
  const newAuditData = getNewAuditData()

  const options = {}
  options.files[fileName].content = newAuditData
  
  gists.edit(auditGistID, options)
}

module.exports = gitAuditMaker