'use strict'

const LegacyService = require('../legacy-service')
const { makeBadgeData: getBadgeData } = require('../../lib/badge-data')
const serverSecrets = require('../../lib/server-secrets')

// This legacy service should be rewritten to use e.g. BaseJsonService.
//
// Tips for rewriting:
// https://github.com/badges/shields/blob/master/doc/rewriting-services.md
//
// Do not base new services on this code.
module.exports = class JenkinsTests extends LegacyService {
  static get category() {
    return 'build'
  }

  static get route() {
    return {
      base: 'jenkins/t',
      pattern: ':scheme(http|https)?/:host/:job*',
    }
  }

  static get examples() {
    return [
      {
        title: 'Jenkins tests',
        pattern: ':scheme/:host/:job',
        namedParams: {
          scheme: 'https',
          host: 'jenkins.qa.ubuntu.com',
          job:
            'view/Precise/view/All%20Precise/job/precise-desktop-amd64_default',
        },
        staticPreview: {
          label: 'build',
          message: 'passing',
          color: 'brightgreen',
        },
      },
    ]
  }

  static registerLegacyRouteHandler({ camp, cache }) {
    camp.route(
      /^\/jenkins(?:-ci)?\/t\/(http(?:s)?)\/([^/]+)\/(.+)\.(svg|png|gif|jpg|json)$/,
      cache((data, match, sendBadge, request) => {
        const scheme = match[1] // http(s)
        const host = match[2] // example.org:8080
        const job = match[3] // folder/job
        const format = match[4]
        const options = {
          json: true,
          uri: `${scheme}://${host}/job/${job}/lastBuild/api/json?tree=${encodeURIComponent(
            'actions[failCount,skipCount,totalCount]'
          )}`,
        }
        if (job.indexOf('/') > -1) {
          options.uri = `${scheme}://${host}/${job}/lastBuild/api/json?tree=${encodeURIComponent(
            'actions[failCount,skipCount,totalCount]'
          )}`
        }

        if (serverSecrets.jenkins_user) {
          options.auth = {
            user: serverSecrets.jenkins_user,
            pass: serverSecrets.jenkins_pass,
          }
        }

        const badgeData = getBadgeData('tests', data)
        request(options, (err, res, json) => {
          if (err !== null) {
            badgeData.text[1] = 'inaccessible'
            sendBadge(format, badgeData)
            return
          }

          try {
            const testsObject = json.actions.filter(obj =>
              obj.hasOwnProperty('failCount')
            )[0]
            if (testsObject === undefined) {
              badgeData.text[1] = 'inaccessible'
              sendBadge(format, badgeData)
              return
            }
            const successfulTests =
              testsObject.totalCount -
              (testsObject.failCount + testsObject.skipCount)
            const percent = successfulTests / testsObject.totalCount
            badgeData.text[1] = `${successfulTests} / ${testsObject.totalCount}`
            if (percent === 1) {
              badgeData.colorscheme = 'brightgreen'
            } else if (percent === 0) {
              badgeData.colorscheme = 'red'
            } else {
              badgeData.colorscheme = 'yellow'
            }
            sendBadge(format, badgeData)
          } catch (e) {
            badgeData.text[1] = 'invalid'
            sendBadge(format, badgeData)
          }
        })
      })
    )
  }
}
