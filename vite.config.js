import { defineConfig } from 'vite';

function getPagesBase() {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    return '/';
  }

  const repository = process.env.GITHUB_REPOSITORY || '';
  const repoName = repository.split('/')[1];

  if (!repoName) {
    return '/';
  }

  return `/${repoName}/`;
}

export default defineConfig({
  base: getPagesBase(),
});
