# Real wireless iPhone trials

10 real iPhone tasks, each completed twice over Apple iPhone Mirroring. These are Spotlight calculations and conversions. This is not proof of working arbitrary-app taps or native XCTest over Wi-Fi. Median warm result verification: 0.921s; median reset plus warm: 3.596s. Earlier failed attempts remain in results.json.

| Query | Expected | First run | Confirmation | Reset + confirmation | Recording |
|---|---:|---:|---:|---:|---|
| 7+8 | 15 | 1.087s | 1.030s | 3.834s | [video](recordings/01-add-comparison.mp4) |
| 48-19 | 29 | 0.732s | 0.757s | 3.444s | [video](recordings/02-subtract-comparison.mp4) |
| 6*7 | 42 | 0.738s | 0.690s | 3.356s | [video](recordings/03-multiply-comparison.mp4) |
| 81/9 | 9 | 1.053s | 0.748s | 3.410s | [video](recordings/04-divide-comparison.mp4) |
| 1.5+2.25 | 3.75 | 0.827s | 0.815s | 3.434s | [video](recordings/05-decimal-comparison.mp4) |
| 50*10% | 5 | 1.171s | 1.093s | 3.748s | [video](recordings/06-percent-comparison.mp4) |
| (12+8)*3 | 60 | 1.188s | 1.099s | 3.791s | [video](recordings/07-parentheses-comparison.mp4) |
| 2^8 | 256 | 1.074s | 0.710s | 3.384s | [video](recordings/08-power-comparison.mp4) |
| 8 km in miles | 4.97097 | 1.191s | 1.176s | 3.891s | [video](recordings/09-length-comparison.mp4) |
| 20 celsius in fahrenheit | 68 | 1.326s | 1.028s | 3.779s | [video](recordings/10-temperature-comparison.mp4) |

[Video comparison page](comparison.html), [CSV](comparison.csv), [logs and earlier failures](results.json). One confirmation sample per task; no statistical latency or wired/wireless ratio is claimed. The final confirmation used one pinned harness across all ten. The first round used two revisions with the same timed input/verification path; setup guards were corrected between them.
