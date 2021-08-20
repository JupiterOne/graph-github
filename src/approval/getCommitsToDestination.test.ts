import { PullsListCommitsResponseItem } from '../types';
import getCommitsToDestination from './getCommitsToDestination';

describe('getCommitsToDestination', () => {
  test('should be able to handle pull requests with an empty destination commit', () => {
    const commits: PullsListCommitsResponseItem[] = [
      {
        url: 'url',
        sha: 'sha',
        node_id: 'node_id',
        html_url: 'html_url',
        comments_url: 'comments_url',
        author: {} as PullsListCommitsResponseItem['author'],
        committer: {} as PullsListCommitsResponseItem['committer'],
        parents: [
          {
            sha: 'sha',
            url: 'url',
          },
        ],
        commit: {
          url: 'url',
          author: {},
          committer: {},
          message: '',
          comment_count: 0,
          tree: {
            sha: 'sha',
            url: 'url',
          },
        },
      },
    ];
    const destination = (undefined as unknown) as string;
    expect(getCommitsToDestination(commits, destination)).toHaveLength(0);
  });
});
