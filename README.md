# jQuery Foundation License Verification

This module audits jQuery Foundation repositories to ensure that all commits have appropriate licensing either via the [CLA](http://contribute.jquery.org/CLA/) or the CAA. This can be run either as a full audit against a given branch of a repository or as a webhook to verify all commits within a pull request.



## Config

The Auditing scripts require some configuration. Create a `config.json` in the root of this module with the following properties:

* `owner` (default: `"jquery"`): Which GitHub user/organization to audit.
  * This only exists for development purposes so that the value can be set to a personal account for testing.
* `repoDir` (default: `"repos"`): Which directory to clone repositories into.

### Webhook config

The following properties only apply when running the webhook:

* `githubToken`: A [GitHub access token](https://help.github.com/articles/creating-an-access-token-for-command-line-use/) used for setting the commit status.
* `port` (default: 8000): Which port to listen on.
* `signatureRefresh` (default: 60,000): How often to fetch new CLA signatures.



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



### Exceptions

While we strive to have proper licensing for all commits, many projects contain contributions that were made prior to the existence of the CLA. When we can't track down the contributors and get them to sign the CLA, we can exclude those commits from the audits by listing them as exceptions.

**Exceptions should only be used for trivial changes or code that has since been removed from the repository.**

To mark a commit as an exception, add an entry to the appropriate file in the `exceptions` directory. The file name must match the repository name and every SHA listed as an exception must be accompanied by a comment explaining why the commit is viable for exclusion from audits.
