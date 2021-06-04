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
    where you can request the  
    installation of GitHub Apps. You can see your organizations and create a new
    one on [GitHub](https://github.com/settings/organizations). A free
    organization is sufficient for this setup.

2.  [Create a smee.io Channel](https://smee.io) to receive webhook events on
    your local machine. You only need the channel url, such as
    `https://smee.io/OCsqJyCJE0HNuby`.

3.  [Create a GitHub App](https://github.com/settings/apps/new) in your personal
    GitHub account.

    - App Name: `JupiterOne <your-github-username>` (it can be anything, but it
      must be unique across GitHub)
    - Homepage URL: `https://smee.io/{thing-you-copied}`
    - User authorization callback URL: `https://smee.io/{thing-you-copied}`
    - Webhook URL: `https://smee.io/{thingy-you-copied}`
    - Webhook secret: `development`
    - At the bottom, under `Where can this GitHub App be installed?`, select
      `Any account`.
    - Set repo permissions. Beside the Metadata Permissions always granted, the
      App only needs Read Only for Repository Metadata and Organization Members
      at this time.

4.  Note the App ID, and press the **Generate a private key** button. Move the
    `private-key.pem` file somewhere safe and note the complete path.

5.  Create `<project>/.env` with the following fields (change example data to
    your data):

    ```env
    GITHUB_APP_ID=19645
    GITHUB_APP_LOCAL_PRIVATE_KEY_PATH=/Users/aiwilliams/jupiterone-aiwilliams.2018-10-24.private-key.pem
    GITHUB_APP_LOCAL_CALLBACK_URL=https://smee.io/OCsqJyCJE0HNuby
    ```

6.  To install the App, visit the
    [app settings page](https://github.com/settings/apps), choose your App, and
    click Install App in the sidebar. Next to your Organization name, click
    Install.

7.  A webhook payload should be delivered to your smee.io channel. Check it out!
    Note the `installation.id` value and update `<project>/.env` to include the
    following:

    ```env
    GITHUB_APP_LOCAL_INSTALLATION_ID=413407
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

Note also that you can review and update permissions here:
https://github.com/settings/apps/{YOURAPPNAME}/permissions
