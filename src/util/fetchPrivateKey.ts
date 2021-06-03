import { IntegrationValidationError } from '@jupiterone/integration-sdk-core';

const fs = require('fs');
//import * as ssm from '../aws/util/ssm';

interface CreateJsonWebTokenOptions {
  privateKeyEnvLocalPathParam: string;
  privateKeyEnvSsmParam: string;
}

function getLocalPrivateKey(envLocalPathParam: string): string | undefined {
  const localPath = process.env[envLocalPathParam];
  if (localPath) {
    let content;
    try {
      content = fs.readFileSync(localPath);
    } catch (err) {
      // basically not there
    }
    if (content) {
      return content.toString();
    } else {
      throw new Error(`${envLocalPathParam} ${localPath}: cannot read content`);
    }
  }
}

async function getSsmPrivateKey(envSssParam: string) {
  const secretName = process.env[envSssParam];
  if (!secretName) {
    throw new IntegrationValidationError(`${envSssParam} must be defined!`);
  }
  return 'fakeString'; //ssm.getSecret(secretName);
}

export default async function fetchPrivateKey(
  options: CreateJsonWebTokenOptions,
): Promise<string> {
  let privateKey = getLocalPrivateKey(options.privateKeyEnvLocalPathParam);

  if (!privateKey) {
    privateKey = await getSsmPrivateKey(options.privateKeyEnvSsmParam);
  }

  if (!privateKey) {
    throw new Error('Could not load the GitHub App private key!');
  }

  return privateKey;
}
