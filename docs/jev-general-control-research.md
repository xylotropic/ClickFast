# JEV general-control architecture and failed-trial diagnosis

Research checked November 11, 2026. This review read current official TypeSafe documentation, AXe pinned at `d8ddf406d391882943e27211562ae57012ad2f7d`, Sprint's current `src/jev.mjs`, and the recorded 23:49 trial results. It made no model requests, phone inputs or implementation changes.

## Finding

The current adapter is a **tap selector for a whole goal**, not yet a general operation executor. Its arithmetic failure is mostly conservative handoff: six of ten trials stopped at decision gates, while all three single-navigation trials and one arithmetic trial completed. Lowering the gates would conceal uncertainty rather than establish reliable control.

The smallest promising change is to supply one explicit bounded intent, preserve exact observed state and action outcomes, and ask operation plus conditional target/text questions in one request. Keep the existing native validation and independent completion predicate. This is a proposal to test, not a measured improvement.

## What the recorded trial establishes

Evidence: [23:49 results](../benchmarks/runs/2026-11-11T23-49-23-694Z/results.json). One trial per task and mode, recording active in both modes, reset/setup excluded, source dirty but individual source hashes recorded. The JEV module hash is `e376c283aaa5c2710c959dcaf62b305b110315be653da4ce330acb45ce55ffac`, matching the source reviewed here; the alias resolved to `jev-1.14.0`. Task scoping offered only the unique keys required for each arithmetic task, without their order. This is a favorable restricted candidate set, not evidence of all-app generalization.

| Task | Result / confirmed prefix | Confidence / selected probability / availability at stop |
| --- | --- | --- |
| `7 + 8` | Stopped after `7` | `1.00 / 1.00 / 0.80` |
| `48 − 19` | Stopped after `4, 8` | `1.00 / 1.00 / 0.88` |
| `6 × 7` | Verified after four actions | Completed |
| `81 ÷ 9` | Stopped after `8` | `0.88 / 0.90 / 0.80` |
| `1.5 + 2.25` | Stopped after `1` | `0.92 / 0.93 / 0.79` |
| `50 × 10%` | Stopped before input | `0.89 / 0.90 / 0.97` |
| `(12 + 8) × 3` | Stopped after `1, 2, Add` | `0.87 / 0.88 / 0.98` |
| Clock → Stopwatch | Verified | Completed |
| Clock → World Clock | Verified | Completed |
| Settings → General | Verified | Completed |

All six failures use the generic gate/handoff reason; no HTTP error, malformed response or native input failure is recorded for these runs. Three fail solely at the companion availability gate; the others also fail confidence and/or selected probability. No recorded stop selects DONE/BLOCKED. The gates prevented further input; these are not completed-task speed results.

The 21 recorded chooser calls have median 87.1 ms, range 61.2–200.3 ms. Fifteen delivered-action records have median 365.0 ms. These are narrow timings from this instrumented run, not a service latency guarantee or a clean estimate of unrecorded app performance. Improving selection alone cannot remove the larger driver/action cost. Scripted batches are an execution floor with known actions, not a competing general planner.

The records log `aN`, probabilities and candidate count but not the request-time candidate map. Final AX row order differs from the original candidate order; a rejected `aN` cannot safely be translated using the final snapshot. Therefore these logs establish gate failures, but do not prove whether each blocked target choice was semantically right. Save complete request/response pairs privately in future experiments.

## Diagnosis of the adapter

Source: [current adapter](../src/jev.mjs). Conclusions below are source inspection or explicitly identified hypotheses.

1. **The decision is too broad.** Each request asks which single tap advances the full remaining task, while the Noul independently asks essentially the same planning question. For arithmetic that requires tracking a partial operand, expression and repeated controls, both heads must solve sequencing from scratch. The low Noul scores are observed; that this duplicated reasoning causes them is a hypothesis to isolate in replay.
2. **The input representation loses useful state.** `controls` contains kind/label/identifier only. It omits current values, selected/focused state, supported operations, geometry and nearby labels. Only the first 60 StaticText labels are supplied separately. That is adequate for obvious tabs, but weak for fields, selection state, similar controls and forms.
3. **History describes dispatch, not effect.** It records tap label/identifier but not delivery status, before/after observation, observed value changes or remaining intent. The model must infer progress from old actions and the current display. A submitted action is not automatically an observed semantic achievement.
4. **The repeat instruction is overbroad.** “Do not repeat completed actions” can conflict with a second `2` in `2.25`, another Equals, or reuse of the same search control. Prohibit replay of an uncertain mutation, while allowing a newly required action on the same control after confirmed progress.
5. **Tap-only is a capability limit.** The executor cannot choose typing into an editable field, clearing, Return, scrolling to an absent target, waiting for a transition, or opening another scoped app. Fixed allowed selectors also require the caller to anticipate controls before seeing later screens. Those limits cannot be solved by a better tap prompt.
6. **The gate reason is too coarse for diagnosis.** Preserve separate failures for branch, target, applicability, distribution validation, freshness, native admission and postcondition. Record the unexecuted proposal alongside which gate rejected it.
7. **The progress fingerprint is an imperfect oracle.** It includes ordered rows, values and all rectangles. Reordered AX rows or unrelated ticking text can appear as progress. Conversely, a valid operation that produces the same display needs explicit evidence, not another tap. Use intent-relevant before/after facts plus a canonical structural signature.

The adapter already does several important things correctly: execution stays bounded and app-scoped; malformed/out-of-set answers cause no input; a model DONE does not override the visible predicate; uncertain actions are not replayed; input remains protected by the native runner.

## What TypeSafe's current documentation supports

All questions in a request see the same structured state and are answered independently. A companion Noul cannot read the Choice answer produced beside it. Put goal, current values, candidate definitions and history in shared state rather than assuming one head supplies context to another. [State](https://docs.typesafe.ai/concepts/state)

TypeSafe recommends speculative questions in one call: ask every relevant branch head upfront and consume only the selected branch in code. The vendor says this usually adds little response latency, while extra questions still add tokens; that must be measured for this payload. [Speculative fan-out](https://docs.typesafe.ai/patterns/fan-out), [Choice](https://docs.typesafe.ai/primitives/choice)

Choice always picks a candidate even when none fits. The companion Noul is intended to establish whether the candidate set applies, not to authorize an action or verify a whole task. Its criteria should define a concrete yes/no boundary with current observations. [Companion Noul](https://docs.typesafe.ai/patterns/companion-noul)

Confidence is derived from the top probability and number of options. For fixed cardinality it is not a second independent signal. With `n` choices, `confidence = (p_max − 1/n) / (1 − 1/n)`. Requiring both values ≥0.9 therefore means `p_max ≥ 0.9 + 0.1/n`, before rounding. In this trial, a probability of 0.90 can correctly fail the confidence gate. Keep the existing gates fixed while testing representation changes; any future calibration is a separately declared held-out experiment, not a threshold reduction to rescue these examples. [Confidence](https://docs.typesafe.ai/confidence), [Routing by probability](https://docs.typesafe.ai/patterns/probability-routing)

Structured instructions and option descriptions are supported. Use them where named fields clarify distinctions; large verbose rubrics are not inherently better. TypeSafe's function-calling example separates operation selection and finite argument choices with validation in ordinary code. [Structured questions](https://docs.typesafe.ai/primitives/advanced), [Function calling](https://docs.typesafe.ai/cookbooks/function_calling)

## What AXe actually does

Pinned source: [AgentPolicy.swift](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/Sources/AXeCore/AgentPolicy.swift).

- It constructs operation options from supported current capabilities: OPEN_APP, TAP, TYPE_TEXT, CLEAR_TEXT, SCROLL, PRESS_RETURN, WAIT and handoff states.
- Conditional target heads choose tap targets, editable fields, scroll regions or apps in the same API request. A sole target bypasses an unnecessary target question after the operation is selected.
- State includes compact target/scroll/text rows with values and recent actions. Field-specific text questions see the field's current value and already-entered literals.
- It validates answer type, exact offered probability key set, finite ranges, probability sum and selected argmax. It binds selected IDs to actual objects in code.
- Exact text can come from goal literals; a text helper is optional. That does not require adding a second text-generating model to Sprint.

Important differences: AXe's policy does not use the current Sprint companion gate, defaults its configurable minimum operation probability to zero, and returns target probability without applying Sprint's stronger three-way gate. Do not copy those defaults as a fix. The autonomous AXe runner is simulator-specific, includes fixed waits in parts of its loop, and treats model DONE as completion. Retain Sprint's independent terminal verification. [Policy resolution](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/Sources/AXeCore/AgentPolicy.swift#L258), [simulator loop](https://github.com/cameroncooke/AXe/blob/d8ddf406d391882943e27211562ae57012ad2f7d/Sources/AXe/Agent/SimulatorAgentRunner.swift)

## Minimal proposed contract

The higher-level agent supplies a short **intent**, exact input literals when needed, app/effect scope, budgets and independent completion. This is a newly generated delegation based on the task, not an app-specific recorded routine. The local executor remains adaptive to fresh screens.

```json
{
  "intent": {
    "goal": "Find the requested city and open its weather details",
    "next_outcome": "The search field contains the requested city",
    "exact_values": [{"id":"v0","text":"Lisbon"}],
    "allowed_effects": ["navigate", "edit_search"],
    "completion": "Supplied independent predicate"
  },
  "screen": {
    "observation_id":"fresh-id",
    "app":"observed.bundle",
    "targets":[
      {"ref":"r0","role":"TextField","label":"Search","value":"","focused":true,"enabled":true,"actions":["type_text"]}
    ]
  },
  "actual_history": []
}
```

This example illustrates representation only; it is not an implemented request schema. `next_outcome` should be a semantic result, not a precomputed list of taps. If the intent requires too much interpretation, hand it back to the existing reasoning agent rather than hiding a complex planner in the Noul.

One request then asks:

| Head | Decision | Execution rule |
| --- | --- | --- |
| `operation` Choice | One currently supported operation, or handoff | No unsupported operation is offered |
| `tap_target` Choice | Which observed control, assuming TAP | Consumed only for TAP; preserve native ref/snapshot binding |
| `field_target` Choice | Which editable field, assuming text/clear | Consume only when field is editable/nonsecure and native focus can be confirmed |
| `text_for_field_rN` Choice | Which exact supplied literal belongs in that field | No invented text; compare current value and prior confirmed entry |
| `scroll_target` / `app_target` Choice | Current scroll region or explicitly scoped app | Offer only supported routes, bounded motion and allowed apps |
| Branch applicability Noul | Whether the current candidate set contains a clear supported action for the supplied intent | Shared state must contain the intent and full applicable candidate definitions |

The target question is conditional on a named operation in its own instructions; it does not assume it can read `operation`'s answer. Do not combine unrelated target types in a large undifferentiated Choice. Code consumes one selected branch and ignores speculative answers for others.

Keep the existing decision floor for this experiment. Validate selected branch, target, literal and applicability separately, then revalidate native target identity/coverage/focus immediately before input. A sole candidate removes classification work, not authorization or applicability checks. Never multiply head probabilities as though they were independent correctness estimates.

Keep text entry generic: offer TYPE_TEXT only on a real supported editable target. A Calculator keypad is not automatically an editable text field. Do not add a Calculator-specific answer parser or routine merely to pass the arithmetic tests.

## Prompt and state fixes to test first

Use concise definitions rather than more warnings:

- **Action:** “Choose exactly one supported operation that advances `intent.next_outcome` from the current observation. Interpret history as actual delivered actions and observed effects.”
- **Repeat semantics:** “The same control may be used again when the remaining intent requires it. Never replay an uncertain prior mutation. If its effect is unresolved, hand back.”
- **Target:** “Assuming this question's operation is selected, choose the matching current target using role, label, value, nearby context and supported actions. Only offered refs can execute.”
- **Presence:** “Does this current branch offer an unambiguous supported target for `intent.next_outcome`? A partial input step can qualify. A target absent, disabled, obscured or outside the app/effect scope does not.”
- **Text:** “Choose an exact supplied literal required by this field. Do not synthesize missing text. Already-entered values remain history, but may recur if explicitly required again.”

Include focused/selected/enabled state, values relevant to the task, bounded nearby context and supported actions. Preserve raw exact strings privately; use a normalized planning representation for display-only direction marks if necessary. Do not normalize the actual caption/input bytes. Use deterministic candidate ordering for reproducibility and store the explicit alias→ref map with each request.

For each action record intent ID, operation, target ID, exact supplied literal ID, delivery status, before/after observation IDs, observed effect and whether the local predicate changed. Unknown delivery/effect blocks automatic continuation. Summaries should omit private text from public reports.

## Focused replay experiments

Run these **without phone dispatch first**, under the same resolved model and unchanged gates:

1. Build a labeled corpus from the six stopped states plus successful navigation states. Use goal, confirmed action prefix and final screen as the replay state; do not pretend the original missing candidate map was recovered. Label acceptable next actions independently: Add after `7`; Subtract after `48`; `1` after `8` in the divide task; Decimal after `1`; `5` at the percent start; `8` after `12 +` in the chain task.
2. Compare baseline unchanged versus richer state/effect history; then isolate repeat wording; then compare operation/conditional-target heads. Keep candidate set and gates fixed where the architectures permit. Record every full request and raw response, payload hash, model/version, latency, token usage, proposed action and rejected gate.
3. Repeat each state enough to reveal instability, with variant order alternated. Report correct accepted, wrong accepted, correct rejected and correct handoff separately. A higher acceptance rate alone is not success.
4. Hold out changed numbers/layouts and repeated controls: decimals with repeated digits, repeated Equals, a second search in the same field, keyboard covering a button, disabled/absent targets, ambiguous labels, a completed goal and an uncertain prior input. Do not tune on the held-out examples.
5. Only after the replay is correct run a small reversible physical task suite: typing/search selection, scrolling to a previously absent control, tab navigation and a system modal. Keep native guards, app scope, audio requirements and cancellation. Report wrong input and recovery as well as completed time.

Arithmetic verification also needs strengthening: the existing final-number-plus-last-Equals predicate can be satisfied by typing the expected answer directly. Verify the requested expression or admitted semantic sequence in addition to the result. Keep this oracle outside the chooser prompt. Distinguish planner-quality tests from a driver sequence floor.

Make any gate-calibration study separate, predeclared and based on a held-out wrong-action budget. Do not change gates during the representation experiment. Actual publication must stay within the user's specific account/content/audience instructions; an Instagram draft must remain a draft when sharing is forbidden. No offline decision replay authorizes a phone action.

## Completion criteria for this change

Choose the smallest variant that reduces **time to a verified correct result** while preserving or improving wrong-action rate and recovery behavior. Compare with the existing reasoning agent on the same direct driver; do not claim an independent JEV advantage from a scripted execution floor. Keep failures, conservative handoffs, discarded/billed decisions and instrumentation cost visible. No improved general-control or speed result is established by this research alone.
