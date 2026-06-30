# Task 2 — CircleCI Renovate Wiring

Worktree: `.worktrees/task-2-circleci-wiring`
Branch: `claude/task-2-circleci-wiring`
File modified: `.circleci/config.yml`

## Edits made (4)

1. **Top-level `parameters`** — inserted after `version: 2.1`, before the Executors banner:
   ```yaml
   parameters:
     workflow_type:
       type: string
       default: ''
   ```

2. **`renovate` job** — added to the `jobs:` map immediately after `deploy-production`:
   ```yaml
   renovate:
     docker:
       - image: renovate/renovate:41
     resource_class: medium
     environment:
       RENOVATE_REPOSITORIES: jianhong1998/maintenance-tracker
       RENOVATE_PLATFORM: github
       LOG_LEVEL: info
     steps:
       - run:
           name: Run Renovate
           command: renovate
   ```

3. **Gated `branch-workflow`** — `when` changed to an `and` requiring empty tag AND
   `workflow_type != 'dependency-update'`. Jobs list unchanged.

4. **`renovate-workflow`** — added between `branch-workflow` and `tag-workflow`:
   ```yaml
   renovate-workflow:
     when:
       equal: ['dependency-update', << pipeline.parameters.workflow_type >>]
     jobs:
       - renovate:
           context: renovate-context
   ```

## Validation

Command:
```
circleci config validate .circleci/config.yml
```
Output:
```
Config file at .circleci/config.yml is valid.
```
Exit code: 0

Sanity check — `tag-workflow` `when` block intact (lines 479-483):
```
  tag-workflow:
    when:
      not:
        equal: ['', << pipeline.git.tag >>]
```
