# Task 10 — Categories screen

Implemented visible and hidden category management in `src/screens/CategoriesScreen.tsx`.

- Replaced the inline creation card with the shared `AddCategorySheet` and connected its close/create/activation callbacks.
- Visible rows retain edit and delete controls and add a hide action. Hiding warns when an active recurring commitment uses the category and explains the last-visible-category refusal.
- Hidden categories are preserved in a conditional, separate section with a textual Hidden state, history reassurance, and Show again action.
- The edit panel now saves rename (including blank restore), hue, and icon overrides. Display uses the shared presentation resolver so saved icon/hue overrides are immediately reflected.
- Added `__tests__/categoriesScreenPartition.test.ts` to pin that hidden category identities remain out of the visible management list.

## Verification

Executed successfully on 2026-09-06:

```text
npm run typecheck
# exit 0

npm test -- --runInBand __tests__/categoriesScreenPartition.test.ts __tests__/categoryVisibility.test.ts __tests__/categoryPresentation.test.ts
# 3 suites passed, 21 tests passed
```

`git diff --check` also completed without whitespace errors.

## Manual limitation

No Expo simulator or physical-device session is attached to this workspace, so I could not perform the requested device walkthrough (manual-entry filtering, historical badge/Breakdown retention, show-again restoration, and last-visible alert). The repository guard and focused category tests cover the related persisted behaviour; the device flow still needs that final visual interaction check.
