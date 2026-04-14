# ECR Retag via API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `docker pull` + `docker tag` + `docker push` in `tag-service` with a direct ECR API call so that the `:dev`/`:prod`/`:$CIRCLE_TAG` tags share the same image digest as the `:$CIRCLE_SHA1_SHORT` tag, eliminating redundant manifest storage and unnecessary data transfer.

**Architecture:** Delete the `docker-retag-and-push` command and replace it with a new `ecr-retag` command that fetches the manifest from ECR using `aws ecr batch-get-image` and writes a new tag pointer using `aws ecr put-image` — no Docker daemon involved. Update the `tag-service` job to remove `ecr-login` (Docker login no longer needed) and `checkout` (not needed; `CIRCLE_SHA1` is a CircleCI env var).

**Tech Stack:** CircleCI 2.1 YAML, AWS CLI v2 (`aws ecr batch-get-image`, `aws ecr put-image`), `jq` (available on ubuntu-2204 machine executor)

---

### Task 1: Replace `docker-retag-and-push` command with `ecr-retag`

**Files:**
- Modify: `.circleci/config.yml:88-110` (the `docker-retag-and-push` command block)

- [ ] **Step 1: Delete the `docker-retag-and-push` command and write `ecr-retag` in its place**

Replace lines 88–110 in `.circleci/config.yml`:

```yaml
  ecr-retag:
    # Retags an existing ECR image by copying its manifest verbatim via the ECR API.
    # This guarantees the new tag shares the exact same digest as the source tag —
    # no docker pull/push, no manifest re-serialization, zero data transfer.
    parameters:
      service:
        type: string
    steps:
      - set-short-sha
      - run:
          name: Retag << parameters.service >> via ECR API
          command: |
            REPO="maintenance-tracker/<< parameters.service >>"
            IMAGE_INFO=$(aws ecr batch-get-image \
              --repository-name "$REPO" \
              --image-ids imageTag="$CIRCLE_SHA1_SHORT" \
              --output json)
            MANIFEST=$(echo "$IMAGE_INFO" | jq -r '.images[0].imageManifest')
            MEDIA_TYPE=$(echo "$IMAGE_INFO" | jq -r '.images[0].imageManifestMediaType')
            if [ -n "$CIRCLE_TAG" ]; then
              aws ecr put-image \
                --repository-name "$REPO" \
                --image-tag "$CIRCLE_TAG" \
                --image-manifest "$MANIFEST" \
                --image-manifest-media-type "$MEDIA_TYPE"
              aws ecr put-image \
                --repository-name "$REPO" \
                --image-tag prod \
                --image-manifest "$MANIFEST" \
                --image-manifest-media-type "$MEDIA_TYPE"
            else
              aws ecr put-image \
                --repository-name "$REPO" \
                --image-tag dev \
                --image-manifest "$MANIFEST" \
                --image-manifest-media-type "$MEDIA_TYPE"
            fi
```

- [ ] **Step 2: Validate config syntax**

```bash
circleci config validate .circleci/config.yml
```

Expected output: `Config file at .circleci/config.yml is valid.`

If `circleci` CLI is not installed locally: `brew install circleci`

---

### Task 2: Update `tag-service` job

**Files:**
- Modify: `.circleci/config.yml:234-244` (the `tag-service` job block)

The current job does `checkout` + `ecr-login` + `docker-retag-and-push`. After Task 1:
- `checkout` is unnecessary — `CIRCLE_SHA1` is injected by CircleCI as an environment variable, not read from git.
- `ecr-login` is unnecessary — that step authenticates Docker with ECR. The ECR API calls use IAM credentials from the CircleCI context directly, not Docker.

- [ ] **Step 1: Replace the `tag-service` job steps**

Replace the `tag-service` job block in `.circleci/config.yml`:

```yaml
  tag-service:
    executor: machine-executor
    resource_class: arm.medium
    parameters:
      service:
        type: string
    steps:
      - ecr-retag:
          service: << parameters.service >>
```

- [ ] **Step 2: Validate config syntax**

```bash
circleci config validate .circleci/config.yml
```

Expected output: `Config file at .circleci/config.yml is valid.`

- [ ] **Step 3: Commit**

```bash
git add .circleci/config.yml
git commit -m "replace docker retag with ECR API to preserve image digest"
```

---

### Task 3: Verify in CI

This is a config-only change — there are no unit-testable code paths. Verification is done by observing the live pipeline.

- [ ] **Step 1: Push the branch and trigger the pipeline**

```bash
git push
```

- [ ] **Step 2: Approve the build in CircleCI and wait for `tag-service` jobs to complete**

Observe the `tag-dev-backend` (and sibling) jobs. Expected:
- Job completes successfully with no Docker-related steps.
- The run log shows `aws ecr batch-get-image` and `aws ecr put-image` calls.
- No `docker pull` or `docker push` in the logs.

- [ ] **Step 3: Confirm digest parity in ECR**

In the AWS console (or CLI), check that the `:dev` tag and the `:$CIRCLE_SHA1_SHORT` tag on one of the repositories share the same digest:

```bash
aws ecr describe-images \
  --repository-name maintenance-tracker/backend \
  --query 'sort_by(imageDetails, &imagePushedAt)[-1]' \
  --output json
```

The `imageTags` array on the returned object should include both the short SHA and `dev`. A single object with two tags means one digest — confirmed.
