# GridUI migration verification

Status: completed against published GridUI 2.0.0 on 2026-10-25.
All six catalog entries and the installed dependency lockfile are aligned.
The scoped minimumReleaseAgeExclude entry remains in place.

## UI ownership adoption - 2026-10-25

- Controller panels now use Tabs, including keyboard navigation, panel associations
  and a retained conversation panel. Voice remains outside the panel lifecycle.
- Settings and runtime fields use Fieldset, Field, Label and FieldNote. Settings,
  controller and canvas feedback use InlineNotice. Row, Stack and Split replace
  repeated alignment, spacing and structural seam styles. Functional notice
  borders remain inside structural regions so Split does not erase tone markers.
- API key entry uses InlineEditor; deletion confirmation uses AlertDialog. Avesd
  retains immediate draft clearing, synchronous duplicate-request protection,
  revisions, encryption, authorization and asynchronous failure handling.
- GridUI Controls has a pending minor changeset for submitDisabled,
  editButtonProps, native reportValidity checks, omitted empty display regions and
  focus recovery after busy editing ends. The implementation lives in the upstream
  repository. The version-specific Avesd pnpm patch carries its compiled section
  and public declaration until the upstream release; no local links or publication
  are required. A frozen offline install passed.

### Verification

- Avesd `pnpm validate` passed, and the complete affected Controls, Grid, Layout
  and Renderer Controller suites passed 28 tests.
- GridUI `make validate` completed build, compile and lint, then hit sandbox
  process restrictions in tooling tests. The test stage passed outside that
  restriction: 227 public package tests, 28 internal configuration tests and 56
  root tooling tests. The focused InlineEditor browser matrix passed 16 cases.
- Ten native Electron scenarios passed across the initial run and focused retry.
  The initial credential scenario exposed a missing space in the new dialog title;
  the title was corrected and its complete native scenario passed. Checks cover
  encrypted credential save/replace/delete, empty and whitespace submission guards,
  edit/cancel focus recovery, Tabs keyboard navigation, retained drafts, nested
  popovers, independent submissions, voice lifecycle, settings reopening, sidebar
  resize/compact recovery and initial canvas failure/replacement/removal.
- Follow-up appearance and notice-marker fixes passed affected lint, compile and
  desktop builds. The changed views were recaptured and inspected; unrelated
  successful suites were not repeated.

### Visual review and limits

Inspected 20 screenshots of real Electron windows: controller collapsed/expanded,
tabs, collections, narrow dark feedback, empty password entry, deletion confirmation,
light/dark settings, voice lifecycle and synthetic canvas failure recovery.
Controller viewports included 380x240, 440x720, 320x240 and 320x680. Settings
viewports were 840x768 and 560x728. No clipping, overlapping navigation or
document-level horizontal overflow remained in the reviewed states.

The standalone settings screenshot run remained at its asynchronous loading state;
the final settings visual pass used synthetic settings service metadata. The
separate native credential scenario verified real encryption and persistence.
Screenshots contain no credential values. External model/audio connectivity and
OS permission dialogs are outside this UI verification.

Screenshots and gallery: `/tmp/avesd-ui-adoption-visual/`.
Logs: `/tmp/avesd-ui-adoption-{validate,tests,native,credential-retry,frozen}.log`,
`/tmp/gridui-inline-{validate,tests-retry,browser}.log` and the affected scoped
compile/lint/build logs in `/tmp/`. No Git operations or npm publication occurred.

## GridUI 2.0.0 migration

- Installed the six published 2.0.0 packages and updated the dependency lockfile.
- Moved CollectionItem, CollectionItemButton, useFollowScroll and their existing
  public types from the Layout facade to Controls. Updated the controller,
  canvas list and session list consumers.
- Moved InlineNotice and InlineNoticeProps to Data. Updated controller and
  runtime picker consumers. Composer and Sidebar remain in Layout.
- Updated the UI ownership documentation. No application use of the removed
  Grid spacing exports, ContentPanel boundary prop, MenuGrid defaults or removed
  CSS hooks was found. Existing style order and React versions remain compatible.

### Verification

- Root `pnpm validate` passed: file headers, lint, repository/workflow boundaries,
  release planning checks, TypeScript and the production build.
- Complete affected suites passed 28 tests: Controls 14, Grid 4, Layout 5 and
  Renderer Controller 5. The first sandboxed test attempt could not create the
  tsx IPC pipe; the affected suites passed outside that sandbox restriction.
- The nine selected native Electron scenarios all passed across the initial run
  and focused rerun. The initial run passed eight scenarios and failed one
  sidebar pointer-drag assertion (width remained 216 rather than 280). The
  isolated rerun passed, followed by three consecutive passing repeats. A separate
  native visual session also verified pointer resizing and Escape rollback.
  The initial pointer failure was not reproduced; no product repair was justified.
- A temporary native verification script confirmed follow-scroll growth,
  pausing while reading and explicit resume on message submission. It also
  checked collection rendering/selection and the Data-owned error notice through
  the production renderer and preload with synthetic service responses.

### Visual review

Inspected all 15 captured screenshots from real Electron windows with isolated
temporary profiles and synthetic content. Controller viewports included 380x240
collapsed, 440x720 expanded, 320x240 compact and 320x680 narrow. Settings viewports
were 840x768 light and 560x728 dark/compact. Reviewed session and canvas collections,
long-title truncation, error notices, tool disclosure, keyboard focus, text drafts,
voice lifecycle states, sidebar seams and compact navigation. No clipping,
overlapping navigation or document-level horizontal overflow was observed.

Screenshots and metrics: `/tmp/avesd-gridui2-visual/`.
Logs: `/tmp/avesd-gridui2-validate.log`, `/tmp/avesd-gridui2-tests.log`,
`/tmp/avesd-gridui2-tests-retry.log`, `/tmp/avesd-gridui2-native.log`,
`/tmp/avesd-gridui2-sidebar-retry.log`, `/tmp/avesd-gridui2-sidebar-repeat.log`
and `/tmp/avesd-gridui2-visual.log`.

No GridUI upstream source changes or Git operations were performed. Synthetic
providers do not verify external model connectivity, real audio, billing or
operating-system permission dialogs. Unrelated Agent/IPC suites were not rerun.

## Historical GridUI 1.0.0 verification

Completed against published GridUI 1.0.0 on 2026-10-24.

### Ownership and migration

The UI facades consume GridUI controls, geometry, data displays, sidebar,
composer, collections, notices, disclosure, code display and follow-scroll.
Generic behavior stays upstream. Avesd retains domain state, request admission,
IPC, persistence, Markdown policy, branding and canvas decoration.

The previously prepared upstream API changes are included in GridUI 1.0.0.
No additional GridUI source change or publication was needed during this pass.
No Git operations were performed.

### Repairs during verification

- Replaced the remaining legacy Button leading prop in ApiKeySettings with
  the supported icon child composition.
- Fixed controller navigation text overlapping adjacent buttons at 320px.
  The navigation scopes the public --gridui-type-ui font token to its existing
  intended 12px size (11px below 350px), keeping weight 500 and the Avesd font
  family. Button spacing uses supported className overrides. No compatibility
  component or copied GridUI behavior was added.

### Validation results

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

### Visual review

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

### Coverage limits

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
