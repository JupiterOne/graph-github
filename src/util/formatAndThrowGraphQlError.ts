import { IntegrationError } from '@jupiterone/integration-sdk-core';

export function formatAndThrowGraphQlError(err: any, name): never {
  const errors = err.errors ? err.errors : [err];
  throw new IntegrationError({
    message: name + ': ' + errors.map((e) => e.message).join(' | '),
    code: errors[0].Code ?? errors[0].code,
    cause: errors[0].stack ? errors : JSON.stringify(errors),
  });
}
