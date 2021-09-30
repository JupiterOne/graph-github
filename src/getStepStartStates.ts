import {
  IntegrationExecutionContext,
  StepStartStates,
} from '@jupiterone/integration-sdk-core';

import { validateInvocation, IntegrationConfig } from './config';

export default async function getStepStartStates(
  context: IntegrationExecutionContext<IntegrationConfig>,
): Promise<StepStartStates> {
  const scopes = await validateInvocation(context);

  return {
    ['fetch-account']: { disabled: false },
    ['fetch-users']: { disabled: false },
    ['fetch-repos']: { disabled: false },
    ['fetch-teams']: { disabled: false },
    ['fetch-collaborators']: { disabled: false },
    ['fetch-prs']: { disabled: false },
    ['fetch-apps']: { disabled: !scopes.orgAdmin },
    ['fetch-org-secrets']: { disabled: !scopes.orgSecrets },
    ['fetch-repo-secrets']: { disabled: !scopes.repoSecrets },
    ['fetch-environments']: { disabled: !scopes.repoActions },
    ['fetch-issues']: { disabled: !scopes.repoIssues },
  };
}
