import { useState } from "react";
import { witnesses, evaluateEvidence, expenses, allocationTotal, weaponCases } from "./engine.ts";
import type { Scene } from "./model.ts";
type Props = {
  scene: Scene;
  data: Record<string, string>;
  onChange: (data: Record<string, string>) => void;
};
export function Activity({ scene, data, onChange }: Props) {
  const [caseIndex, setCaseIndex] = useState(0);
  if (scene.kind === "evidence") {
    const selected = (data.witnesses ?? "").split(",").filter(Boolean);
    const result = evaluateEvidence(selected);
    return (
      <section className="activity">
        <p className="eyebrow">证言桌 · 新增检验案例</p>
        <h3>“凡是年老的人，都在痛苦中生活。”</h3>
        <p>哪些证言能检验这句话？可以只选一位。人物证言是游戏构造，克法洛斯的态度依据原作重述。</p>
        <div className="witness-grid">
          {witnesses.map((w) => (
            <button
              key={w.id}
              className={"witness " + (selected.includes(w.id) ? "selected" : "")}
              aria-pressed={selected.includes(w.id)}
              onClick={() =>
                onChange({
                  ...data,
                  witnesses: (selected.includes(w.id)
                    ? selected.filter((id) => id !== w.id)
                    : [...selected, w.id]
                  ).join(","),
                })
              }
            >
              <span>
                {w.age}岁 · {w.wealth}
              </span>
              <strong>{w.name}</strong>
              <q>{w.experience}</q>
            </button>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="activity-feedback" role="status">
            <p>{result.text}</p>
            {result.counterexample && (
              <p>
                {result.matched
                  ? "这组年龄与家境相同的对照，使差异更醒目；其他条件仍可能不同。"
                  : "配对比较可以继续，但你的反例已经成立。"}{" "}
                年龄是否影响体验、差异由什么造成，仍是另外的问题。
              </p>
            )}
          </div>
        )}
      </section>
    );
  }
  if (scene.kind === "allocation") {
    const selected = (data.expenses ?? "").split(",").filter(Boolean);
    const total = allocationTotal(selected);
    return (
      <section className="activity">
        <p className="eyebrow">钱袋 · 新增义务冲突</p>
        <h3>五枚钱币，三件不能轻放的事</h3>
        <p>选择眼下先做的事，再说明如何面对被推迟的人。资金分配不会替你证明谁更正义。</p>
        <div className="coin-budget">
          <span>剩余</span>
          <strong className={total > 5 ? "over-budget" : ""}>{5 - total}</strong>
          <span>/ 5 枚</span>
        </div>
        <div className="expense-list">
          {expenses.map((e) => (
            <button
              key={e.id}
              aria-pressed={selected.includes(e.id)}
              className={selected.includes(e.id) ? "selected" : ""}
              onClick={() =>
                onChange({
                  ...data,
                  expenses: (selected.includes(e.id)
                    ? selected.filter((id) => id !== e.id)
                    : [...selected, e.id]
                  ).join(","),
                })
              }
            >
              <div>
                <strong>{e.name}</strong>
                <p>{e.detail}</p>
              </div>
              <b>{e.cost} 枚</b>
            </button>
          ))}
        </div>
        <p role="status">
          {total > 5
            ? "钱袋不够。请重新安排眼下能做的事。"
            : total === 0
              ? "先作一项具体安排。"
              : `暂未履行：${
                  expenses
                    .filter((e) => !selected.includes(e.id))
                    .map((e) => e.name)
                    .join("、") || "无"
                }。义务并不因缺钱而自动消失；你仍可质疑某项义务的根据。`}
        </p>
      </section>
    );
  }
  if (scene.kind === "weapon") {
    const c = weaponCases[caseIndex];
    const done = weaponCases.every((w) => w.items.includes(data[w.id]));
    return (
      <section className="activity">
        <p className="eyebrow">寄存物 · 四次检验</p>
        <div className="case-track" aria-label="检验进度">
          {weaponCases.map((w, i) => (
            <button
              key={w.id}
              disabled={i > 0 && !data[weaponCases[i - 1].id]}
              onClick={() => setCaseIndex(i)}
              aria-current={i === caseIndex ? "step" : undefined}
            >
              {i + 1}
              {data[w.id] ? " ✓" : ""}
            </button>
          ))}
        </div>
        <h3>{c.title}</h3>
        <p>{c.text}</p>
        <p className="case-question">{c.question}</p>
        <div className="case-options">
          {c.items.map((item) => (
            <button
              key={item}
              aria-pressed={data[c.id] === item}
              className={data[c.id] === item ? "selected" : ""}
              onClick={() => onChange({ ...data, [c.id]: item })}
            >
              {item}
            </button>
          ))}
        </div>
        {data[c.id] && caseIndex < 3 && (
          <button className="text-button" onClick={() => setCaseIndex(caseIndex + 1)}>
            带着这个决定，进入下一例 →
          </button>
        )}
        {done && (
          <div className="activity-feedback">
            <strong>你已经作出四次具体判断。</strong>
            {weaponCases.map((w) => (
              <p key={w.id}>
                {w.title}：{data[w.id]}
              </p>
            ))}
            <p>
              眼下的决定之间可能存在张力。接下来，留下你愿意公开说明的规则；其他人仍可以反驳它。
            </p>
          </div>
        )}
      </section>
    );
  }
  return null;
}
