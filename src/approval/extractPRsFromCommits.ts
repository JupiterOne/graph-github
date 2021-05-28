import { ReposListCommitsResponseItem } from '../types';

const REF_REGEX = /pull request #([\d]+)/;

function detectPRReference(comment: string): number | undefined {
  const match = REF_REGEX.exec(comment);

  if (!match) {
    return undefined;
  }

  return Number.parseInt(match[1], 10);
}

function uniq(collection: any[]) {
  return collection.filter((item, index, self) => self.indexOf(item) === index);
}

export default function extractPRsFromRepoCommits(
  commits: ReposListCommitsResponseItem[]
): number[] {
  const commitMessages = commits.map(commit => commit.commit.message);
  const prIds = uniq(commitMessages.map(message => detectPRReference(message)));
  return prIds;
}
