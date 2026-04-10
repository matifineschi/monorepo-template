---
name: committing-atomically
description: Plans and authors atomic git commits while enforcing semantic commit format. Use when creating commits, splitting or amending commits, staging files, or deciding whether changes should be grouped or split.
---

# Committing Atomically

Use this skill for any task involving `git commit`, staging, commit message authoring, commit splitting, or history cleanup.

## Trigger Policy

Trigger when the user asks to:

- Create a commit
- Write or improve a commit message
- Stage and commit changes
- Amend, split, or clean up commits
- Decide whether changes belong in one commit or multiple commits

## Core Standard

A commit must be one independently useful unit of work.

Use this decision test before committing:

- Can this commit be reverted alone without undoing unrelated behavior?
- Can this commit be explained by one sentence describing one change?
- Does this commit stand on its own as part of the feature, without bundling unrelated cleanup?

If any answer is no, split the changes.

## Strict Atomic Gate

Do not commit while staged changes include multiple independent concerns.

- Do not default to `git add -A` or `git commit -a`
- Stage explicit paths or hunks only
- Verify staged files with `git diff --cached --name-only`
- Verify staged scope with `git diff --cached`

Coupled changes are allowed in one commit only when separation would create a broken intermediate state (for example, compile failure or failing contract mismatch). When this happens, the commit body must explicitly explain why the changes must ship together.

## Semantic Commit Format (Required)

Use semantic commit titles:

```text
type(scope): subject
```

- `type`: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `build`, `ci`, `perf`, `style`, `revert`
- `scope`: short area name when known
- `subject`: imperative, specific, no trailing period, usually <= 72 chars

Never use `WIP` as a commit title.

## Commit Body Rules

Add a body for non-trivial commits.

- Keep it concise: usually 1-3 short sentences
- Explain what changed and why
- For coupled changes, include the coupling rationale in plain language

## Deterministic Workflow

1. Inspect working tree: `git status --short`.
2. Partition changes into atomic units using the decision test in this skill.
3. Stage one unit only (explicit paths or hunks).
4. Verify staged file list and staged diff.
5. Pick semantic `type(scope)` and write the commit title/body.
6. Commit.
7. Repeat for the next unit until complete.
