import {
  DisabledStepReason,
  IntegrationExecutionContext,
  StepStartStates,
} from '@jupiterone/integration-sdk-core';

import { IntegrationConfig, validateInvocation } from './config';

export default async function getStepStartStates(
  context: IntegrationExecutionContext<IntegrationConfig>,
): Promise<StepStartStates> {
  const scopes = await validateInvocation(context);

  return {
    ['fetch-account']: { disabled: false },
    ['fetch-users']: { disabled: false },
    ['fetch-repos']: { disabled: false },
    ['fetch-teams']: { disabled: false },
    ['fetch-team-members']: { disabled: false },
    ['fetch-team-repos']: { disabled: false },
    ['fetch-collaborators']: { disabled: false },
    ['fetch-prs']: { disabled: false },
    ['fetch-issues']: {
      disabled: !scopes.repoIssues,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    ['fetch-apps']: {
      disabled: !scopes.orgAdmin,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    ['fetch-code-scanning-alerts']: {
      disabled: !scopes.codeScanningAlerts,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    ['fetch-environments']: {
      disabled: !scopes.repoEnvironments,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    ['fetch-org-secrets']: {
      disabled: !scopes.orgSecrets,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    ['fetch-repo-secrets']: {
      disabled: !scopes.repoSecrets,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    ['fetch-env-secrets']: {
      disabled: !scopes.repoSecrets || !scopes.repoEnvironments,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    ['fetch-vulnerability-alerts']: {
      disabled:
        !scopes.dependabotAlerts ||
        !context.instance.config.enableDependabotAlerts,
      disabledReason: !context.instance.config.enableDependabotAlerts
        ? DisabledStepReason.CONFIG
        : DisabledStepReason.PERMISSION,
    },
    ['fetch-branch-protection-rules']: {
      disabled: !scopes.repoAdmin && !scopes.repoDiscussions,
      disabledReason: DisabledStepReason.PERMISSION,
    },
  };
}
