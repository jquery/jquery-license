# jQuery Foundation License Verification

This module audits jQuery Foundation repositories to ensure that all commits have appropriate licensing either via the [CLA](http://contribute.jquery.org/CLA/) or the CAA. This can be run either as a full audit against a given branch of a repository or to verify all commits within a pull request. The latter can be done automatically with a webhook.

To manually check a PR, set up a `config.json` with your `githubToken` (next section), then run the audir-pr script (see PR Auditing below).



## Config

The Auditing scripts require some configuration. Create a `config.json` in the root of this module with the following properties:

* `owner` (default: `"jquery"`): Which GitHub user/organization to audit.
  When running jquery-license as a webhook server, this property can be specified as an array
  of strings instead of a single string, to check pull requests against multiple owners/orgs.
* `repoDir` (default: `"repos"`): Which directory to clone repositories into.
* `outputDir` (default: `"output"`): Which directory to store PR results into.
  * Results for all PR checks are stored, whether run through the web hook or through the `jquery-audit-pr` binary.
* `githubToken`: A [GitHub access token](https://help.github.com/articles/creating-an-access-token-for-command-line-use/) used for setting the commit status. Used for the manual PR audit and webhook.

### Webhook config

The following properties only apply when running the webhook:

* `port` (default: 8000): Which port to listen on.
* `signatureRefresh` (default: 60,000): How often to fetch new CLA signatures.



## Adding a new org/repository

1. Add the organization name to the `owner` array in `config.json`
2. Set up the Webhook in the Settings page of the GitHub org or repo:
   * Payload URL is the URL to the Webhook server run by `bin/server.js`
   * Content-type should be `application/x-www-form-urlencoded`
   * Secret is empty
   * Event types is “Pull request”
3. Grant jquerybot write access to all the repositories that you want to apply CLA checks to



## Debugging

The [debug](https://www.npmjs.org/package/debug) module is used for debug messages. To enable all debugging, run any script with `DEBUG=*`. You may want to exclude the GitHub requests since they're large and noisy; to do so use `DEBUG=*,-github:*`.

The following debug names are used:

* `config`: Prints out the config values that are being used.
* `signatures`: Prints out messages from the signatures module.
* `repo:{repo-name}`: Prints out messages from the repo module.
* `github:{request-id}`: Prints out all requests through the GitHub API. The request ID allows you to correlate requests and responses.
* `audit:{repo}-{pr}`: Prints out messages from the PR audit module.
* `server`: Prints out messages from the web hook server.



## Branch Auditing

The main export of this module is a function which audits a single branch from a single repository. The signature is as follows:

`function( options )`
* `options` (Object): Settings for the audit.
  * `repo` (String): The name of the repository to audit.
  * `branch` (String; default: `"master"`): The name of the branch to audit.
* Returns `Promise`
  * `data`: Object containing audit information.
    * `commits` (Array): An array of all commits that were audited. Each commit object contains `hash`, `name`, and `email` properties.
    * `neglectedCommits` (Array): An array of all commits that aren't licensed.
    * `neglectedAuthors` (Array): An array of all authors that haven't signed a license agreement. Each author object contains `email` and `commits` properties, with the `commits` property containing an array of SHAs.

This module also exposes a binary named `jquery-audit-branch` which just passes its arguments on to the main export for auditing a branch. The usage is as follows:

```sh
jquery-audit-branch <repo> <branch>

# or
./bin/audit-branch.js <repo> <branch>
```



## PR Auditing

The webhook server can be run via `npm start` and will listen to pull request hooks for all repositories. The webhook will set the commit status based on the results of the audit. On every PR synchronization, all commits in the PR are checked.

This module also exposes a binary named `jquery-audit-pr` which performs a manual audit of a PR. The usage is as follows:

```sh
jquery-audit-pr <repo> <pr>

# or
./bin/audit-pr.js <repo> <pr>
```

Make sure to create a `config.json` with the `githubToken` property (see above).



### Exceptions

While we strive to have proper licensing for all commits, many projects contain contributions that were made prior to the existence of the CLA. When we can't track down the contributors and get them to sign the CLA, we can exclude those commits from the audits by listing them as exceptions.

**Exceptions should only be used for trivial changes or code that has since been removed from the repository.**

To mark a commit as an exception, add an entry to the appropriate file in the `exceptions` directory. The file name must match the repository name and every SHA listed as an exception must be accompanied by a comment explaining why the commit is viable for exclusion from audits.
