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
    ['fetch-users']: { disabled: true },
    ['fetch-repos']: { disabled: false },
    ['fetch-teams']: { disabled: true },
    ['fetch-team-members']: { disabled: true },
    ['fetch-team-repos']: { disabled: true },
    ['fetch-collaborators']: { disabled: true },
    ['fetch-prs']: { disabled: true },
    ['fetch-issues']: {
      disabled: !scopes.repoIssues,
      disabledReason: DisabledStepReason.PERMISSION,
    },
    ['fetch-apps']: {
      disabled: !scopes.orgAdmin,
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
      disabled: !scopes.orgAdmin,
      disabledReason: DisabledStepReason.PERMISSION,
    },
  };
}
