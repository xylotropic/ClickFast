# Operator versus Apple Mirroring

Ten real phone tasks, verified on both control paths. Total warm time: **7.458 s Operator / 30.525 s Mirroring (4.09×)**. One confirmed pair per task.

| Task | Operator | Mirroring | Ratio | Recording |
|---|---:|---:|---:|---|
| add | 0.654s | 2.684s | 4.11× | [Video](videos/add.mp4) |
| subtract | 0.756s | 3.792s | 5.02× | [Video](videos/subtract.mp4) |
| multiply | 0.658s | 2.684s | 4.08× | [Video](videos/multiply.mp4) |
| divide | 0.690s | 3.400s | 4.93× | [Video](videos/divide.mp4) |
| decimal | 1.230s | 5.730s | 4.66× | [Video](videos/decimal.mp4) |
| percent | 0.839s | 4.532s | 5.40× | [Video](videos/percent.mp4) |
| chain | 0.886s | 5.145s | 5.81× | [Video](videos/chain.mp4) |
| clock-stopwatch | 0.510s | 0.904s | 1.77× | [Video](videos/clock-stopwatch.mp4) |
| clock-world-clock | 0.494s | 0.811s | 1.64× | [Video](videos/clock-world-clock.mp4) |
| settings-general | 0.741s | 0.843s | 1.14× | [Video](videos/settings-general.mp4) |

Same physical iPhone 16 Pro Max/iOS26.5. Operator USB runner and ordinary Apple Mirroring through CUA measured separately, never concurrently. Known action plans on both paths. Warm task time includes actions and independent result verification; setup/app launch excluded. Native fresh AX verification; Mirroring Apple Vision plus Tesseract OCR. Calculator zero also checked against a visually verified real capture. Clock starting tab explicitly verified before timing. All ten confirmed pairs are shown; earlier failures retained separately. Native capture up to3fps; Mirroring capture after each action; video resamples these real frames at10fps with a final0.75s hold. No audio. Only the inspected Settings owner-name and Wi-Fi-name regions are blurred in public video. Clock screens are shown without masks. Original captures remain local.

One confirmed pair per task, ordered native suite then Mirroring suite. Different observation/capture costs are part of the control-path comparison; this is not raw touch latency, a human benchmark, a randomized controlled planner trial or evidence of all-app reliability. Warm timing omits development/recovery and app launch. Confirmed samples do not erase earlier failed attempts.

The controlled native burst on/off run passed20/20 and reduced total time for the seven calculations from16.307s to5.713s (2.85×). The stricter live JEV run passed4/10; it handed back on the other six. JEV is not the controller used for the Operator column here. See [development record](../../../docs/operator-performance.md).
