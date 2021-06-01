import {
  IntegrationExecutionContext
} from '@jupiterone/integration-sdk-core';

export default function getInstallationId(
  context: IntegrationExecutionContext
): number {
  const installationId: any = context.instance.config.installationId;

  if (!installationId) {
    throw new Error(
      'No installationId found in integration instance configuration'
    );
  }

  return Number(installationId);
}
