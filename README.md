# evenhub-deploy

Reusable GitHub Action for uploading private Even Realities `.ehpk` builds to Even Hub.

> [!WARNING]
> Unofficial tool. It may break if Even Realities changes their portal, APIs, or authentication flow.

## Quickstart

Copy this into a workflow after your build/package step. This uploads a new private build to Even Hub; the final public publish/release step still needs to be done manually in the Even Hub portal.

```yaml
- uses: fidelio-wilson-2501/evenhub-deploy@v1
  with:
    package-id: com.example.myapp
    ehpk-path: out.ehpk
    changelog: ${{ github.event.head_commit.message }}
    evenhub-username: ${{ secrets.EVENHUB_USERNAME }}
    evenhub-password: ${{ secrets.EVENHUB_PASSWORD }}
```

You need to provide:
- `package-id` - your app's package id from `app.json`
- `ehpk-path` - path to the built `.ehpk` file
- `evenhub-username` - your Even Hub login email
- `evenhub-password` - your Even Hub login password

What this does:
- uploads the packaged build to Even Hub using your account
- creates a new private build/draft there
- does not perform the final manual publish step in the portal

## Inputs and environment variables

You can configure the action either with `with:` inputs or with environment variables. Inputs win if both are set.

### Required

- `package-id` or `PACKAGE_ID`
  - What it is: your Even Realities app package id.
  - Example: `com.example.myapp`
  - Where to find it: in your app's `app.json` manifest.

- `ehpk-path` or `EHPK_PATH`
  - What it is: filesystem path to the packaged `.ehpk` file that your build produced.
  - Example: `out.ehpk`
  - Where to find it: whatever file your packaging step writes. In many repos this is the output of `npm run pack`.

- `evenhub-username` or `EVENHUB_USERNAME`
  - What it is: the email/username you use to sign into the Even Hub developer portal.
  - Example: `you@example.com`
  - Where to find it: your Even Hub account login.
  - Recommended storage: GitHub Actions secret.

- `evenhub-password` or `EVENHUB_PASSWORD`
  - What it is: the plaintext password for that Even Hub account.
  - Where to find it: your Even Hub account login.
  - Recommended storage: GitHub Actions secret.

### Optional

- `changelog` or `CHANGELOG`
  - What it is: release notes text sent with the published draft.
  - Default: `Automated build`
  - Where to find it: usually generated from your git commit message, tag message, or release notes.


## Use with environment variables

```yaml
- uses: fidelio-wilson-2501/evenhub-deploy@v1
  env:
    PACKAGE_ID: com.example.myapp
    EHPK_PATH: out.ehpk
    EVENHUB_USERNAME: ${{ secrets.EVENHUB_USERNAME }}
    EVENHUB_PASSWORD: ${{ secrets.EVENHUB_PASSWORD }}
```

## Example workflow

```yaml
name: build

on:
  push:
    branches: [main]

jobs:
  pack:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm run pack
      - uses: fidelio-wilson-2501/evenhub-deploy@v1
        with:
          package-id: com.example.myapp
          ehpk-path: out.ehpk
          changelog: ${{ github.event.head_commit.message }}
          evenhub-username: ${{ secrets.EVENHUB_USERNAME }}
          evenhub-password: ${{ secrets.EVENHUB_PASSWORD }}
```