# Team setup

This guide is for the person preparing GitHub, Hugging Face, and the Jetson for the team. Engineers operating the collector should follow the main `README.md` and `docs/OPERATIONS.md`.

## Recommended ownership

Use two private repositories with different jobs:

1. **Private GitHub repository** — application and collection code only.
2. **Private Hugging Face organization dataset** — recorded sessions only.

An organization-owned Hugging Face dataset is important for collaboration. A private dataset under a personal account is writable only by that owner; an organization can give collectors write access and analysts read access.

Suggested dataset ID:

```text
YOUR_HF_ORG/prompt-to-platter-robot-data
```

## One-time administrator checklist

- [ ] Create or choose a private GitHub repository.
- [ ] Add every engineer who needs the code.
- [ ] Create or choose a Hugging Face organization.
- [ ] Add collectors with `write` access and analysts with `read` access.
- [ ] Put the organization dataset ID in `.env` on the Thor.
- [ ] Create a fine-grained Hugging Face token scoped to the dataset.
- [ ] Run `./collector doctor` on the Thor.
- [ ] Run `./collector init-hf` once.
- [ ] Record, finalize, and upload one throwaway smoke-test session.
- [ ] Confirm another team member can view the private dataset.

## GitHub workflow

Engineers clone the code normally:

```bash
git clone YOUR_PRIVATE_GITHUB_URL
cd YOUR_REPOSITORY/jetson-thor-data-collection
./collector setup
cp .env.example .env
```

Do not commit `.env`, `.venv`, or anything under `data/sessions/`. The included `.gitignore` already excludes them.

For updates on the Thor:

```bash
git pull --ff-only
./collector setup
./collector doctor
```

## Authentication on a shared Thor

The simplest hackathon setup is one fine-grained machine token limited to the team dataset. Authenticate once on the Thor with `.venv/bin/hf auth login`, and restrict access to the Thor's Unix account.

Do not paste the token into GitHub, Slack, documentation, or shell scripts. If it leaks, revoke it in Hugging Face settings and create a replacement.

For stronger attribution, give each engineer a separate Unix account and have each account authenticate with that engineer's own Hugging Face token.

## What goes where

| Artifact | Location |
|---|---|
| React configurator and collector scripts | GitHub |
| `.env` and authentication cache | Thor only |
| Active and finalized local sessions | Thor collection disk |
| Uploaded sessions | Hugging Face dataset |
| Tokens or credentials | Never in either repository |
