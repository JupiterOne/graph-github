import {
  setupRecording,
  Recording,
  SetupRecordingInput,
  mutations,
} from '@jupiterone/integration-sdk-testing';

export { Recording };

function isRecordingEnabled(): boolean {
  return Boolean(process.env.LOAD_ENV);
}

export function setupGithubRecording(
  input: Omit<SetupRecordingInput, 'mutateEntry'>,
): Recording {
  const recordingEnabled = isRecordingEnabled();

  return setupRecording({
    ...input,
    redactedRequestHeaders: ['Authorization'],
    redactedResponseHeaders: ['set-cookie'],
    mutateEntry: (entry) => {
      redact(entry);
    },
    options: {
      mode: recordingEnabled ? 'record' : 'replay',
      recordFailedRequests: true,
      ...input.options,
    },
  });
}

function redact(entry): void {
  if (!entry.response.content.text) {
    return;
  }

  //let's unzip the entry so we can modify it
  mutations.unzipGzippedRecordingEntry(entry);

  entry.request.headers.forEach((header) => {
    if (header.name === 'authorization') {
      header.value = 'Bearer [REDACTED]';
    }
  });

  if (/access_tokens/.exec(entry.request.url)) {
    const responseContent = JSON.parse(entry.response.content.text);
    responseContent.token = '[REDACTED]';
    responseContent.expires_at = '2050-12-31T18:09:20Z'; //so that tests from recordings don't try to refresh tokens
    entry.response.content.text = JSON.stringify(responseContent);
  }
}
