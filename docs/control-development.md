# Pending phone validation

The current change lets the controller enter an exact supplied string when the caller already names one observed field. It avoids a second model decision about that field. Other actions still use JEV.

The shortcut requires native field-bound text support, a complete observation, a unique native target, an empty field, and the exact authorized string. The goal must name the destination app, or permit only one app. Existing drafts, ambiguous fields or destination apps, and additional submission conditions do not use the shortcut. Native snapshot, app, identity, and focus checks still apply. `direct_text:false` requires a JEV decision for every action. The default JEV gates remain at 0.9.

Nine archived phone observations reached the intended field through the production controller with zero JEV calls. This was a replay, not a physical trial or a speed measurement. All 60 host checks pass. The new physical comparison has not run because the Mac currently detects no USB phone.

## Next recorded run

```sh
node scripts/benchmark-general.mjs benchmarks/fixtures/general-v3.json 1 paired
```

The manifest contains 12 tasks across Home Screen folders, Clock, YouTube, Contacts, Shortcuts, Calendar, Files, App Store, Reminders, Weather, Books, and Settings. Each task runs once with direct field selection and once with JEV-only selection. The order alternates by task. This compares two decision paths in ClickFast. A separate run through ordinary iPhone Mirroring is still required.

Recording starts before setup and includes cleanup. Warm timing includes fresh observation, decisions, input, and an independent result check. Setup and cleanup have separate times. The recorder stores capture intervals and the warm timer's offset. It stops permanently on a phone lock and discards a frame if the phone locks during capture.

Cleanup clears only a known benchmark string in a unique fresh field. It preserves other text and verifies that the field became empty. A failed cleanup remains in the result. Capture and model traces remain private. No failed mutation is replayed.
