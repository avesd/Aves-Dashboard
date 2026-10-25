# GridUI migration verification

Status: completed against published GridUI 1.0.0 on 2026-10-24.
All six catalog entries and the installed dependency lockfile are aligned.
The scoped minimumReleaseAgeExclude entry remains in place.

## Ownership and migration

The UI facades consume GridUI controls, geometry, data displays, sidebar,
composer, collections, notices, disclosure, code display and follow-scroll.
Generic behavior stays upstream. Avesd retains domain state, request admission,
IPC, persistence, Markdown policy, branding and canvas decoration.

The previously prepared upstream API changes are included in GridUI 1.0.0.
No additional GridUI source change or publication was needed during this pass.
No Git operations were performed.

## Repairs during verification

- Replaced the remaining legacy Button leading prop in ApiKeySettings with
  the supported icon child composition.
- Fixed controller navigation text overlapping adjacent buttons at 320px.
  The navigation scopes the public --gridui-type-ui font token to its existing
  intended 12px size (11px below 350px), keeping weight 500 and the Avesd font
  family. Button spacing uses supported className overrides. No compatibility
  component or copied GridUI behavior was added.

## Validation results

- GridUI make validate passed: build, compile, lint, tooling and package tests.
- GridUI workflow browser suite passed 160 cases across four widths, two
  themes and both motion preferences.
- GridUI follow-scroll browser scenario passed all 16 matrix cases, covering
  growth, pausing while reading and explicit resume.
- Avesd pnpm validate completed lint/boundary/header/workflow checks, then found
  the obsolete Button prop during compile. After its repair, the changed file's
  ESLint check, root pnpm compile and root pnpm build passed, completing all
  validation stages without rerunning unrelated successful checks.
- Avesd affected complete suites passed: Controls 14, Grid 4, Layout 5,
  Renderer Agent 3 (26 total).
- Native Electron passed 9 scenarios: runtime popup nested selection and Escape,
  independent submissions and busy supplements, voice/text draft retention,
  cancellation, native collapse/expand, settings reopening, sidebar resizing
  and secure API-key lifecycle with synthetic credentials.
- The subsequent navigation-only styling fix passed scoped ESLint and the
  desktop build. Its affected normal/narrow views and both collection views
  were recaptured and inspected; unrelated suites were not repeated.

## Visual review

Inspected real Electron windows using disposable profiles, production assets,
preload/IPC, and clearly synthetic conversation/provider/canvas content.
Controller viewports: 380x240 collapsed, 440x720 expanded, 320x680 narrow.
Settings viewports: 840x768 light and 560x728 dark/compact (native minimum width).
Reviewed nested model options, tool output disclosure, draft input, sessions,
long canvas titles, voice states, sidebar compact mode and keyboard focus.

No remaining clipping, overlapping navigation or document-level horizontal
scrolling was observed in these states. The baseline button font remains
500 14px/19.6px Inter/system. Light foreground remains rgb(36, 42, 51) and the
settings background remains rgb(252, 252, 250). Scoped navigation is intentionally
smaller as above. Dark theme remains readable and uses the existing identity.

Review gallery: /tmp/avesd-gridui-final/review.md.
Metrics: /tmp/avesd-gridui-final/metrics.json and recheck-metrics.json.
Logs: /tmp/avesd-gridui-{validate,compile,build,tests,native}.log and
/tmp/gridui-final-{validate,browser,scroll}.log.

## Coverage limits

The original migration pass used electron-vite 5.0.0 with Vite 8.3.4. The later
dependency update uses electron-vite 6.0.0 and Vite 8.3.5; the compatibility
verification below supersedes that earlier peer-range observation.
Synthetic providers do not verify external ACP/model connectivity, live audio,
provider billing or OS permission dialogs. No user content or real credentials
were used for screenshots.


## Dependency Compatibility Recheck - 2026-10-25

After the dependency update and audit remediation, the user authorized a full
validation pass and the required compatibility repairs:

- Sandbox preload entries disable dependency externalization and use isolated
  bundles, restoring native startup under electron-vite 6.
- Provider readiness uses a controller-authorized availability channel; Settings
  retains its own command authorization.
- Electron 45 credential encryption is asynchronous, with stale-write, revoked
  sender, cancellation, and pending-decryption regression coverage.
- Test media-query mocks retain their compatibility methods without deprecated
  contextual declarations; deterministic JSX and test type issues were repaired.

`pnpm validate` passed. The complete affected package suites passed 34 tests,
the desktop suite passed 84 tests, and all 12 native Electron scenarios passed.
The native light/dark and normal/narrow views were recaptured and inspected with
production styles and isolated synthetic data. No layout repair was needed.

Current visual gallery: `/tmp/avesd-validation-20261025/review.html`.
Metrics: `/tmp/avesd-validation-20261025/metrics.json`. Native checks ran on macOS;
Linux format admission has unit coverage, not a native secret-service run.
