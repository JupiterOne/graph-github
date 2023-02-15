# Development

JupiterOne requires the JupiterOne GitHub app with read-only permissions be
installed in a Github Organization account.

The setup for a JupiterOne customer using the website is a little different that
setting up a local development environment. For a JupiterOne customer, upon
creating a new GitHub integration configuration in JupiterOne, the user is
re-directed to GitHub to install the JupiterOne GitHub app.

To make a development environment, you will have to create your own GitHub
Organization and GitHub App. You'll have to install the App in your
Organization, set appropriate permissions, and then provide extra information in
the .env file that won't be necessary for a JupiterOne client.

## Provider account setup

To setup a development environment that is NOT using the JupiterOne GitHub App,
you'll need to do the following:

1.  Make sure that your personal GitHub account is a member of an organization
    where you can request the installation of GitHub Apps. You can see your
    organizations and create a new one on
    [GitHub](https://github.com/settings/organizations). A free organization is
    sufficient for this setup.

2.  [Create a smee.io Channel](https://smee.io) to receive webhook events on
    your local machine. You only need the channel url, such as
    `https://smee.io/{some-smee-generated-id}`.

3.  [Create a GitHub App](https://github.com/settings/apps/new) in your personal
    GitHub account.

    - App Name: `JupiterOne <your-github-username>` (it can be anything, but it
      must be unique across GitHub)
    - Homepage URL: `https://smee.io/{some-smee-generated-id}`
    - User authorization callback URL:
      `https://smee.io/{some-smee-generated-id}`
    - Webhook URL: `https://smee.io/{some-smee-generated-id}`
    - Webhook secret: `development`
    - At the bottom, under `Where can this GitHub App be installed?`, select
      `Any account`.
    - Set permissions as follows:

      **Repository Permissions**

      - Actions: Read-only
      - Administration: Read-only
      - Dependabot alerts: Read-only
      - Discussions: Read-only
      - Environments: Read-only
      - Issues: Read-only (enables both Issues and private-repo PRs)
      - Metadata: Read-only
      - Pages: Read-only
      - Pull requests: Read-only
      - Secrets: Read-only (only name and creation date is collected)

      **Organization Permissions**

      - Members: Read-only
      - Administration: Read-only
      - Secrets: Read-only (only name and creation date is collected)
      - Events: Read-only

4.  Note the App ID, and press the **Generate a private key** button. Move the
    `private-key.pem` file somewhere safe and note the complete path.

5.  Create `<project>/.env` with the following fields (change example data to
    your data):

    ```env
    GITHUB_APP_ID=1234
    GITHUB_APP_LOCAL_PRIVATE_KEY_PATH={YOURPATH}/{YOURFILENAME}.private-key.pem
    INSTALLATION_ID=5678
    GITHUB_API_BASE_URL=https://api.github.com
    ```

6.  To install the App, visit the
    [app settings page](https://github.com/settings/apps), choose your App, and
    click Install App in the sidebar. Next to your Organization name, click
    Install.

7.  A webhook payload should be delivered to your smee.io channel. Check it out!
    Note the `installation.id` value and update `<project>/.env` to include the
    following:

    ```env
    INSTALLATION_ID=413407
    ```

With the `.env` in place, you may run the integration with `yarn start` and see
that the GitHub API is invoked with authorization for the installion of your
GitHub App in your account.

JupiterOne customers will only have to enter an installation ID as part of the
integration configuration. The extra stuff above is just for making your own App
and getting the needed ID.

## Authentication

If you have trouble getting this to work (such as by misconfiguring and then
changing settings), you might find it useful to know that suspending and then
unsuspending the App on GitHub will send payloads to the callback URL (the
smee.io link that you configured as the callback URL in the App). Those payloads
will have the App ID and installation ID included, so that's a handy way to get
that info if you're having trouble finding it otherwise.

**NOTE**: You may review and update app permissions here:
https://github.com/settings/apps/{YOURAPPNAME}/permissions

When you update your development app permissions, you must also update the app
installation permissions here:
https://github.com/organizations/{ORG_NAME}/settings/installations/{INSTALLATION_ID}

## Collaborators vs Members

A GitHub organization member is part of the organization. A repo collaborator
can be an organization member or an outside collaborator. In this integration,
the term 'collaborator' is used in this sense, and so 'members' is a subset of
'collaborators'. Both are User entities.

To find all outside collaborators for an organization, filter for `github_user`
with `User.role` === 'outside collaborator'

To find all collaborators for a repo, filter for relationship
'github_repo_allows_user' from that repo. These relationships will point to both
organization members and outside collaborators.

## Issues and Pull Requests

Note that GitHub considers all Pull Requests to be a type of Issue. Therefore,
to get PRs from the API, one often has to ask for Issues and then filter for
ones that are PRs. However, in other syntactical contexts, Pull Requests might
have their own namespace. Beware.

Also note that enabled Pull Request scope for the app grants access to
public-repo Pull Requests, but not private repo ones. The Issues scope grants
access to private-repo Pull Requests, as well as all Issues on public and
private repos.
