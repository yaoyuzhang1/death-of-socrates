import type { Answer, Save, Commitment } from "./model.ts";
import { scenes } from "./content/index.ts";

export const initialSave = (): Save => ({
  version: 1,
  index: 0,
  answers: [],
  updatedAt: new Date().toISOString(),
});
export const witnesses = [
  {
    id: "a",
    name: "阿里斯顿",
    age: 72,
    wealth: "家境宽裕",
    experience: "夜里常为失去的欢乐难过",
    suffering: true,
  },
  {
    id: "b",
    name: "克法洛斯",
    age: 72,
    wealth: "家境宽裕",
    experience: "欲望渐息，反而感到安宁",
    suffering: false,
  },
  {
    id: "c",
    name: "多里翁",
    age: 25,
    wealth: "家境宽裕",
    experience: "为未来忧虑，难以安睡",
    suffering: true,
  },
  {
    id: "d",
    name: "梅农",
    age: 72,
    wealth: "生活拮据",
    experience: "劳作艰难，也常感到痛苦",
    suffering: true,
  },
];
export function evaluateEvidence(ids: string[]) {
  const selected = witnesses.filter((w) => ids.includes(w.id));
  const counterexample = selected.some((w) => w.age >= 65 && !w.suffering);
  const matched = selected.some((a) =>
    selected.some(
      (b) =>
        a.id !== b.id && a.age === b.age && a.wealth === b.wealth && a.suffering !== b.suffering,
    ),
  );
  return {
    counterexample,
    matched,
    text: counterexample
      ? "这位老人报告自己并不痛苦。如果证言可靠，“所有老人都痛苦”就已经被反驳。不需要另一位同龄、同家境的人才能完成这一步。"
      : "这些证言还没有否定“所有老人都痛苦”。一个年轻人的痛苦，也不能替我们判断老人的处境。",
  };
}
export const expenses = [
  { id: "debt", name: "偿还借款", cost: 3, detail: "借你钱的人也等着这笔钱支付工钱。" },
  {
    id: "offering",
    name: "兑现祭献之约",
    cost: 2,
    detail: "你曾郑重许诺。老人视此为义务，旁人未必承认相同理由。",
  },
  { id: "care", name: "照看患病家人", cost: 3, detail: "临时出现的需要。等一等并非没有代价。" },
];
export const allocationTotal = (ids: string[]) =>
  expenses.filter((e) => ids.includes(e.id)).reduce((sum, e) => sum + e.cost, 0);
export const weaponCases = [
  {
    id: "ordinary",
    title: "一 · 平静的归还",
    text: "朋友来取寄存在你这里的书。他解释要带回家读，也没有其他危险迹象。",
    question: "承诺给了你什么理由？",
    items: ["如约归还", "询问用途后归还", "暂时保管"],
  },
  {
    id: "threat",
    title: "二 · 明确的威胁",
    text: "同一个朋友来取剑，并明确说要用它报复一个人。剑确实属于他。",
    question: "所有权仍然成立，新的理由是否足以改变行动？",
    items: ["坚持归还", "暂缓并找人协助", "直接拒绝归还"],
  },
  {
    id: "uncertain",
    title: "三 · 你还不知道",
    text: "朋友激动地来取剑，说家里出了事。他不肯细说。有人称他准备伤人，但传话者与他有过争执。",
    question: "你愿意根据多弱的证据限制别人的权利？",
    items: ["归还并陪同前往", "询问并短时暂存", "等待可靠见证"],
  },
  {
    id: "abuse",
    title: "四 · 保管人的权力",
    text: "换一位保管人。他也说“我认为有危险”，却不提供理由，甚至从扣留财物中获利。",
    question: "你赋予的裁量权，怎样接受别人的检验？",
    items: ["要求说明与复核期限", "优先恢复物主权利", "交由共同认可者判断"],
  },
];
export function activitySummary(sceneId: string, data: Record<string, string>): string[] {
  const kind = scenes.find((s) => s.id === sceneId)?.kind;
  if (kind === "evidence")
    return [
      "采用的证言：" +
        witnesses
          .filter((w) => (data.witnesses ?? "").split(",").includes(w.id))
          .map((w) => w.name)
          .join("、"),
    ];
  if (kind === "allocation") {
    const ids = (data.expenses ?? "").split(",");
    return [
      "实际先做：" +
        expenses
          .filter((e) => ids.includes(e.id))
          .map((e) => e.name)
          .join("、"),
      "仍未履行：" +
        expenses
          .filter((e) => !ids.includes(e.id))
          .map((e) => e.name)
          .join("、"),
      "尚余 " +
        (5 - allocationTotal(ids)) +
        " 枚。你提出的原则需要解释这份具体安排，特别是未得到资源的人。",
    ];
  }
  if (kind === "weapon")
    return [
      ...weaponCases.map((c) => c.title + "：" + data[c.id]),
      "请检验你的规则能否解释这四次判断。如果前后采用了不同标准，需要说明哪一项新事实使标准改变。",
    ];
  return [];
}
export function activityReady(sceneId: string, data: Record<string, string>) {
  const kind = scenes.find((s) => s.id === sceneId)?.kind;
  if (kind === "evidence")
    return evaluateEvidence((data.witnesses ?? "").split(",")).counterexample;
  if (kind === "allocation") {
    const ids = (data.expenses ?? "").split(",");
    return allocationTotal(ids) > 0 && allocationTotal(ids) <= 5;
  }
  if (kind === "weapon") return weaponCases.every((c) => c.items.includes(data[c.id]));
  return true;
}
function validActivity(input: unknown): input is Record<string, string> {
  return (
    typeof input === "object" &&
    input !== null &&
    !Array.isArray(input) &&
    Object.keys(input).length <= 12 &&
    Object.entries(input).every(
      ([k, v]) => k.length < 40 && typeof v === "string" && v.length <= 1000,
    )
  );
}
export function validateSave(input: unknown): Save | null {
  if (!input || typeof input !== "object") return null;
  const s = input as Save;
  if (
    s.version !== 1 ||
    !Number.isInteger(s.index) ||
    s.index < 0 ||
    s.index > scenes.length ||
    !Array.isArray(s.answers)
  )
    return null;
  if (s.answers.length < s.index || s.answers.length > Math.min(s.index + 1, scenes.length))
    return null;
  if (typeof s.updatedAt !== "string" || !Number.isFinite(Date.parse(s.updatedAt))) return null;
  for (let i = 0; i < s.answers.length; i++) {
    const a = s.answers[i];
    if (
      !a ||
      a.sceneId !== scenes[i].id ||
      !scenes[i].options.some((o) => o.id === a.optionId) ||
      typeof a.note !== "string" ||
      a.note.length > 1200 ||
      !validActivity(a.activity) ||
      !activityReady(a.sceneId, a.activity)
    )
      return null;
  }
  return {
    version: 1,
    index: s.index,
    answers: s.answers.map((a) => ({
      sceneId: a.sceneId,
      optionId: a.optionId,
      note: a.note,
      activity: { ...a.activity },
    })),
    updatedAt: s.updatedAt,
  };
}
export function choose(
  save: Save,
  sceneId: string,
  optionId: string,
  note = "",
  activity: Record<string, string> = {},
): Save {
  const scene = scenes[save.index];
  if (
    !scene ||
    scene.id !== sceneId ||
    !scene.options.some((o) => o.id === optionId) ||
    !activityReady(sceneId, activity) ||
    !validActivity(activity)
  )
    throw new Error("这个选择还不能提交。");
  return {
    ...save,
    answers: [
      ...save.answers.slice(0, save.index),
      { sceneId, optionId, note: note.slice(0, 1200), activity: { ...activity } },
    ],
    updatedAt: new Date().toISOString(),
  };
}
export function advance(save: Save): Save {
  if (!save.answers[save.index] || save.index >= scenes.length) return save;
  return { ...save, index: save.index + 1, updatedAt: new Date().toISOString() };
}
export function rewind(save: Save, index: number): Save {
  if (!Number.isInteger(index) || index < 0 || index >= scenes.length || index > save.index)
    return save;
  return {
    ...save,
    index,
    answers: save.answers.slice(0, index),
    updatedAt: new Date().toISOString(),
  };
}
export function flagsFor(answers: Answer[]) {
  const flags: Record<string, string> = {};
  for (const a of answers)
    Object.assign(
      flags,
      scenes.find((s) => s.id === a.sceneId)?.options.find((o) => o.id === a.optionId)?.flags ?? {},
    );
  return flags;
}
export function commitmentsFor(answers: Answer[]): (Commitment & { sceneId: string })[] {
  return answers.flatMap((a) => {
    const c = scenes
      .find((s) => s.id === a.sceneId)
      ?.options.find((o) => o.id === a.optionId)?.commitment;
    return c ? [{ ...c, sceneId: a.sceneId }] : [];
  });
}
export function endingFor(save: Save) {
  const flags = flagsFor(save.answers);
  const legacy = flags.legacy;
  if (legacy === "institution")
    return {
      title: "给判断留下复核的门",
      text: "你把问题带回了共同生活：谁能作决定，谁能要求说明，谁能纠正已经发生的错误。规则需要人来维护，也需要允许人追问。",
      question: "如果程序完整，结果仍然伤人，你会从哪里开始修订？",
    };
  if (legacy === "care")
    return {
      title: "在身边的人那里继续",
      text: "你留意那些容易被宏大理由遮住的人：等待偿债的人、需要照料的人、坐在床边的朋友。关怀给判断以重量，也让偏爱接受质疑。",
      question: "对亲近者的责任，怎样与陌生人的同等需要相遇？",
    };
  return {
    title: "下一问，轮到你",
    text: "你愿意把理由放到别人面前，也愿意让反例改变自己的说法。追问没有替你消除风险；它让你更清楚，自己正在凭什么行动。",
    question: "当省察影响你的利益与关系时，你会怎样继续？",
  };
}
