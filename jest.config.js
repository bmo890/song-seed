module.exports = {
  preset: "jest-expo",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  // Ignore nested git worktrees (e.g. .claude/worktrees/*) so their package.json copies
  // don't trigger Haste module-name collisions.
  modulePathIgnorePatterns: ["<rootDir>/.claude/worktrees/"],
};
