import test from "node:test";
import assert from "node:assert/strict";
import { chapters, scenes } from "../src/content/index.ts";
import {
  initialSave,
  validateSave,
  choose,
  advance,
  rewind,
  flagsFor,
  commitmentsFor,
  endingFor,
  evaluateEvidence,
  allocationTotal,
  activityReady,
} from "../src/engine.ts";
import type { Save, Scene } from "../src/model.ts";

function activity(scene: Scene): Record<string, string> {
  if (scene.kind === "evidence") return { witnesses: "b" };
  if (scene.kind === "allocation") return { expenses: "care,offering" };
  if (scene.kind === "weapon")
    return {
      ordinary: "如约归还",
      threat: "暂缓并找人协助",
      uncertain: "询问并短时暂存",
      abuse: "要求说明与复核期限",
    };
  return {};
}

function playTo(
  index: number,
  optionAt: (scene: Scene, index: number) => string = (scene) => scene.options[0].id,
): Save {
  let save = initialSave();
  while (save.index < index) {
    const scene = scenes[save.index];
    save = advance(
      choose(save, scene.id, optionAt(scene, save.index), "我的理由尚有待检验。", activity(scene)),
    );
  }
  return save;
}

test("new players cannot advance before choosing, or submit a later scene", () => {
  const save = initialSave();
  assert.equal(advance(save).index, 0);
  assert.equal(save.answers.length, 0);
  assert.throws(() => choose(save, scenes[1].id, scenes[1].options[0].id));
  assert.throws(() => choose(save, scenes[0].id, "not-an-option"));
});

test("a submitted current choice and an advanced save both survive JSON export/import", () => {
  const initial = initialSave();
  const selected = choose(
    initial,
    scenes[0].id,
    scenes[0].options[0].id,
    "原句：先听对方的理由。",
    activity(scenes[0]),
  );
  assert.equal(selected.index, 0);
  assert.equal(initial.answers.length, 0, "choosing must not mutate a prior export");
  for (const save of [initial, selected, advance(selected), playTo(scenes.length)]) {
    assert.deepEqual(validateSave(JSON.parse(JSON.stringify(save))), save);
  }
});

test("import rejects skipped chapters, reordered choices, unknown choices and invalid cursors", () => {
  const complete = playTo(scenes.length);
  const invalid = [
    { ...initialSave(), index: 2 },
    { ...complete, index: -1 },
    { ...complete, index: 0.5 },
    { ...complete, index: scenes.length + 1 },
    { ...complete, version: 2 },
    { ...complete, updatedAt: "not a date" },
    { ...complete, answers: complete.answers.slice(1) },
    { ...complete, answers: [...complete.answers].reverse() },
    {
      ...complete,
      answers: complete.answers.map((answer, index) =>
        index === 0 ? { ...answer, optionId: "forged" } : answer,
      ),
    },
  ];
  for (const input of invalid) assert.equal(validateSave(input), null);
});

test("import rejects malformed or oversized player material and discards untrusted extra fields", () => {
  const selected = choose(
    initialSave(),
    scenes[0].id,
    scenes[0].options[0].id,
    "",
    activity(scenes[0]),
  );
  const answer = selected.answers[0];
  for (const input of [
    null,
    undefined,
    2,
    "save",
    [],
    {},
    { ...selected, answers: null },
    { ...selected, answers: [{ ...answer, note: "字".repeat(1201) }] },
    { ...selected, answers: [{ ...answer, activity: [] }] },
    { ...selected, answers: [{ ...answer, activity: { invalid: 42 } }] },
    { ...selected, answers: [{ ...answer, activity: { invalid: "x".repeat(1001) } }] },
  ])
    assert.equal(validateSave(input), null);
  const clean = validateSave({ ...selected, flags: { legacy: "care" }, role: "admin" });
  assert.deepEqual(clean, selected);
  assert.notEqual(clean!.answers, selected.answers);
  clean!.answers[0].activity.test = "mutated";
  assert.equal(selected.answers[0].activity.test, undefined);
});

test("rewinding erases later answers, commitments and flags without changing the saved past", () => {
  const complete = playTo(scenes.length);
  const index = Math.floor(scenes.length / 2);
  const before = JSON.stringify(complete);
  const back = rewind(complete, index);
  assert.equal(back.index, index);
  assert.deepEqual(back.answers, complete.answers.slice(0, index));
  assert.deepEqual(flagsFor(back.answers), flagsFor(complete.answers.slice(0, index)));
  assert.ok(
    commitmentsFor(back.answers).every((commitment) =>
      scenes.slice(0, index).some((scene) => scene.id === commitment.sceneId),
    ),
  );
  assert.equal(JSON.stringify(complete), before);
  assert.deepEqual(validateSave(back), back);
  for (const invalidIndex of [-1, 0.5, scenes.length + 1])
    assert.deepEqual(rewind(back, invalidIndex), back);
});

test("replacing a current decision cannot retain flags or commitments from its discarded alternative", () => {
  const index = scenes.findIndex(
    (scene) =>
      scene.options.length > 1 && scene.options.some((option) => option.flags || option.commitment),
  );
  assert.ok(index >= 0);
  const scene = scenes[index];
  const prior = playTo(index);
  const first = choose(prior, scene.id, scene.options[0].id, "", activity(scene));
  const changed = choose(first, scene.id, scene.options[1].id, "", activity(scene));
  assert.equal(changed.answers.length, index + 1);
  assert.equal(changed.answers[index].optionId, scene.options[1].id);
  assert.deepEqual(flagsFor(changed.answers), flagsFor([...prior.answers, changed.answers[index]]));
  assert.equal(first.answers[index].optionId, scene.options[0].id);
});

test("four different commitments accumulate, and rewinding removes only the discarded future", () => {
  const path: Record<string, string> = {
    "court-threshold": "challenge",
    "court-counterexample": "conditions",
    "court-ledger": "need",
    "court-definition": "plural",
  };
  const save = playTo(4, (scene) => path[scene.id]);
  assert.deepEqual(flagsFor(save.answers), {
    courtApproach: "challenge",
    evidenceScope: "conditions",
    wealthPriority: "need",
    justiceScope: "plural",
  });
  assert.deepEqual(
    commitmentsFor(save.answers).map((commitment) => commitment.sceneId),
    ["court-threshold", "court-counterexample", "court-ledger", "court-definition"],
  );
  const back = rewind(save, 2);
  assert.deepEqual(flagsFor(back.answers), {
    courtApproach: "challenge",
    evidenceScope: "conditions",
  });
  const alternative = choose(back, "court-ledger", "promise", "", { expenses: "debt" });
  assert.deepEqual(flagsFor(alternative.answers), {
    courtApproach: "challenge",
    evidenceScope: "conditions",
    wealthPriority: "promise",
  });
});

test("every published option can be chosen and completed from its own valid prefix", () => {
  let prefix = initialSave();
  for (const scene of scenes) {
    for (const option of scene.options) {
      const selected = choose(prefix, scene.id, option.id, "", activity(scene));
      const next = advance(selected);
      assert.equal(next.index, prefix.index + 1, `${scene.id}/${option.id}`);
      assert.deepEqual(validateSave(next), next, `${scene.id}/${option.id} must remain importable`);
    }
    prefix = advance(choose(prefix, scene.id, scene.options[0].id, "", activity(scene)));
  }
  assert.equal(prefix.index, scenes.length);
});

test("inquiry, care and institutional commitments all reach distinct completed endings", () => {
  const legacyScene = scenes.find((scene) =>
    scene.options.some((option) => option.flags?.legacy === "care"),
  );
  assert.ok(legacyScene, "the ending must offer explicit alternative commitments");
  const titles = new Set<string>();
  const endings = legacyScene.options.filter((option) => option.flags?.legacy);
  assert.ok(endings.length >= 3);
  for (const legacyOption of endings) {
    const save = playTo(scenes.length, (scene) =>
      scene.id === legacyScene.id ? legacyOption.id : scene.options.at(-1)!.id,
    );
    assert.equal(save.index, scenes.length);
    assert.equal(flagsFor(save.answers).legacy, legacyOption.flags!.legacy);
    assert.deepEqual(validateSave(save), save);
    const ending = endingFor(save);
    assert.ok(ending.text.length > 0 && ending.question.length > 0);
    titles.add(ending.title);
  }
  assert.equal(
    titles.size,
    endings.length,
    "different legacies should have genuinely different closing responses",
  );
});

test("one reliable non-suffering elderly witness disproves a universal without a matched pair", () => {
  assert.equal(evaluateEvidence(["b"]).counterexample, true);
  assert.equal(evaluateEvidence(["b"]).matched, false);
  assert.equal(evaluateEvidence(["b", "d"]).counterexample, true);
  assert.equal(evaluateEvidence(["b", "d"]).matched, false);
  assert.equal(evaluateEvidence(["a", "b"]).matched, true);
  assert.equal(evaluateEvidence(["a", "c", "d"]).counterexample, false);
  assert.equal(evaluateEvidence(["unknown"]).counterexample, false);
});

test("resource constraints allow care and debt priorities, without making sacrifice mandatory", () => {
  const scene = scenes.find((scene) => scene.kind === "allocation");
  assert.ok(scene);
  assert.equal(allocationTotal(["debt", "care"]), 6);
  assert.equal(allocationTotal(["debt", "debt"]), 3);
  assert.equal(activityReady(scene.id, { expenses: "debt,care" }), false);
  assert.equal(activityReady(scene.id, { expenses: "" }), false);
  assert.equal(activityReady(scene.id, { expenses: "care" }), true);
  assert.equal(activityReady(scene.id, { expenses: "debt" }), true);
  assert.equal(activityReady(scene.id, { expenses: "care,offering" }), true);
});

test("weapon activity requires all four judgments, but does not force a single moral rule", () => {
  const scene = scenes.find((scene) => scene.kind === "weapon");
  assert.ok(scene);
  assert.equal(activityReady(scene.id, {}), false);
  assert.equal(activityReady(scene.id, { ...activity(scene), uncertain: "forged" }), false);
  assert.equal(activityReady(scene.id, activity(scene)), true);
  assert.equal(
    activityReady(scene.id, {
      ordinary: "暂时保管",
      threat: "坚持归还",
      uncertain: "归还并陪同前往",
      abuse: "优先恢复物主权利",
    }),
    true,
  );
  const prefix = playTo(scenes.indexOf(scene));
  assert.throws(() => choose(prefix, scene.id, scene.options[0].id, "", {}));
});

test("the complete scene graph has unique addresses and explicit source boundaries", () => {
  assert.equal(new Set(chapters.map((chapter) => chapter.id)).size, chapters.length);
  assert.equal(new Set(scenes.map((scene) => scene.id)).size, scenes.length);
  assert.deepEqual(
    chapters.flatMap((chapter) => chapter.scenes),
    scenes,
  );
  const addresses = new Set<string>();
  for (const scene of scenes) {
    assert.ok(
      scene.source.trim(),
      `${scene.id} needs a primary-text reference or an explicit original-game designation`,
    );
    assert.ok(
      scene.frame.trim(),
      `${scene.id} needs a separate explanation of adaptation/invention`,
    );
    assert.ok(
      scene.lines.length && scene.lines.every((line) => line.speaker.trim() && line.text.trim()),
      scene.id,
    );
    assert.ok(scene.question.trim() && scene.prompt.trim(), scene.id);
    assert.ok(scene.options.length >= 2, scene.id);
    for (const option of scene.options) {
      const address = `${scene.id}/${option.id}`;
      assert.ok(!addresses.has(address), `duplicate option address ${address}`);
      addresses.add(address);
      assert.ok(option.text.trim() && option.responsibility.trim(), address);
      assert.ok(
        option.reply.length &&
          option.reply.every((line) => line.speaker.trim() && line.text.trim()),
        address,
      );
      if (option.commitment)
        assert.ok(
          Object.values(option.commitment).every((value) => value.trim()),
          address,
        );
    }
  }
});

test("every conditional character echo can actually be reached from an earlier choice", () => {
  for (let index = 0; index < scenes.length; index++) {
    const earlierOptions = scenes.slice(0, index).flatMap((scene) => scene.options);
    for (const echo of scenes[index].echoes ?? []) {
      assert.ok(
        earlierOptions.some((option) => option.flags?.[echo.key] === echo.value),
        `${scenes[index].id}: unreachable echo ${echo.key}=${echo.value}`,
      );
      assert.ok(echo.speaker.trim() && echo.text.trim());
    }
  }
});
