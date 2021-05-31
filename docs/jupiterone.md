# Integration with JupiterOne

## GitHub + JupiterOne Integration Benefits

- Visualize GitHub organization members, teams, repositories, and pull requests
  in the JupiterOne graph.
- Map GitHub organization members to employees in your JupiterOne account.
- Monitor changes to GitHub organization members using JupiterOne alerts.

## How it Works

- JupiterOne periodically fetches organization members, teams, repositories, and
  pull requests from GitHub to update the graph.
- Write JupiterOne queries to review and monitor updates to the graph, or
  leverage existing queries.
- Configure alerts to take action when JupiterOne graph changes, or leverage
  existing alerts.

## Requirements

- GitHub uses a GitHub App to secure access to their API. Although GitHub Apps
  exist on personal accounts, the API only supports access from an App installed
  on an organization account. Therefore, you will need to be a member of a
  GitHub organization, and have permission to request Apps to be installed for
  the organization.

TODO: more details here on next steps

- JupiterOne requires a REST API key. You need permission to create a user in
  {{provider}} that will be used to obtain the API key.
- You must have permission in JupiterOne to install new integrations.

## Support

If you need help with this integration, please contact
[JupiterOne Support](https://support.jupiterone.io).

## Integration Walkthrough

### In GitHub

1.  [Create a smee.io Channel](https://smee.io) to receive webhook events on
    your local machine. You only need the channel url, such as
    `https://smee.io/OCsqJyCJE0HNuby`.

2.  [Create a GitHub App](https://github.com/settings/apps/new) in your personal
    GitHub account.

    App Name: `JupiterOne <your-github-username>` (they must be unique across
    GitHub) Homepage URL: `https://smee.io/thingy-you-copied` User authorization
    callback URL: `https://smee.io/thingy-you-copied` Webhook URL:
    `https://smee.io/thingy-you-copied` Webhook secret: `development` At the
    bottom, under `Where can this GitHub App be installed?`, select
    `Any account`. Also, set repo permissions.

3.  Note the App ID, and press the **Generate a private key** button. Move the
    `private-key.pem` file somewhere safe and note the complete path.

4.  Create `<project>/.env` with the following contents:

    ```env
    GITHUB_APP_ID=19645
    GITHUB_APP_LOCAL_PRIVATE_KEY_PATH=/Users/aiwilliams/jupiterone-aiwilliams.2018-10-24.private-key.pem
    GITHUB_APP_LOCAL_CALLBACK_URL=https://smee.io/OCsqJyCJE0HNuby
    ```

5.  To install the app, visit the
    [app settings page](https://github.com/settings/apps), choose your app, and
    click Install App in the sidebar. Next to your organization name, click
    Install.

6.  A webhook payload should be delivered to your smee.io channel. Check it out!
    Note the `installation.id` value and update `<project>/.env` to include the
    following:

    ```env
    GITHUB_APP_LOCAL_INSTALLATION_ID=413407
    ```

With the `.env` in place, you may run the integration with `yarn start` and see
that the GitHub API is invoked with authorization for the installion of your
GitHub App in your account.

### In JupiterOne

TODO: List specific actions that must be taken in JupiterOne. Many of the
following steps will be reusable; take care to be sure they remain accurate.

1. From the configuration **Gear Icon**, select **Integrations**.
2. Scroll to the **GitHub** integration tile and click it.
3. Click the **Add Configuration** button and configure the following settings:

- Enter the **Account Name** by which you'd like to identify this {{provider}}
  account in JupiterOne. Ingested entities will have this value stored in
  `tag.AccountName` when **Tag with Account Name** is checked.
- Enter a **Description** that will further assist your team when identifying
  the integration instance.
- Select a **Polling Interval** that you feel is sufficient for your monitoring
  needs. You may leave this as `DISABLED` and manually execute the integration.
- {{additional provider-specific settings}} Enter the **{{provider}} API Key**
  generated for use by JupiterOne.

4. Click **Create Configuration** once all values are provided.

# How to Uninstall

TODO: List specific actions that must be taken to uninstall the integration.
Many of the following steps will be reusable; take care to be sure they remain
accurate.

1. From the configuration **Gear Icon**, select **Integrations**.
2. Scroll to the **GitHub** integration tile and click it.
3. Identify and click the **integration to delete**.
4. Click the **trash can** icon.
5. Click the **Remove** button to delete the integration.

<!-- {J1_DOCUMENTATION_MARKER_START} -->
<!--
********************************************************************************
NOTE: ALL OF THE FOLLOWING DOCUMENTATION IS GENERATED USING THE
"j1-integration document" COMMAND. DO NOT EDIT BY HAND! PLEASE SEE THE DEVELOPER
DOCUMENTATION FOR USAGE INFORMATION:

https://github.com/JupiterOne/sdk/blob/master/docs/integrations/development.md
********************************************************************************
-->

## Data Model

### Entities

The following entities are created:

| Resources   | Entity `_type`   | Entity `_class` |
| ----------- | ---------------- | --------------- |
| Account     | `github_account` | `Account`       |
| Github User | `github_user`    | `User`          |

### Relationships

The following relationships are created/mapped:

| Source Entity `_type` | Relationship `_class` | Target Entity `_type` |
| --------------------- | --------------------- | --------------------- |
| `github_account`      | **HAS**               | `github_user`         |
| `github_user`         | **MANAGES**           | `github_account`      |

<!--
********************************************************************************
END OF GENERATED DOCUMENTATION AFTER BELOW MARKER
********************************************************************************
-->
<!-- {J1_DOCUMENTATION_MARKER_END} -->
