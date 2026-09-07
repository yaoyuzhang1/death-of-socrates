import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  ArrowRight,
  BookOpen,
  Download,
  Upload,
  RotateCcw,
  Volume2,
  VolumeX,
  Pause,
  Play,
  X,
  Compass,
  ChevronLeft,
  Feather,
  Check,
  ExternalLink,
} from "lucide-react";
import { chapters, scenes } from "./content/index.ts";
import {
  initialSave,
  validateSave,
  choose,
  advance,
  rewind,
  flagsFor,
  commitmentsFor,
  endingFor,
  activityReady,
  activitySummary,
} from "./engine.ts";
import { Activity } from "./activities.tsx";
import { asset, useVoice } from "./voice.ts";
import type { Save, Line } from "./model.ts";
import "./style.css";

const SAVE_KEY = "socrates-full-game-v1";
function readSave() {
  try {
    const text = localStorage.getItem(SAVE_KEY);
    return text ? validateSave(JSON.parse(text)) : null;
  } catch {
    return null;
  }
}
function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    const d = ref.current;
    return () => {
      d?.close();
      queueMicrotask(() => {
        if (trigger?.isConnected && document.activeElement === document.body) trigger.focus();
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="关闭" onClick={onClose}>
          <X />
        </button>
      </div>
      <div className="modal-content">{children}</div>
    </dialog>
  );
}
export default function App() {
  const [save, setSave] = useState<Save>(() => readSave() ?? initialSave());
  const [landing, setLanding] = useState(true);
  const [panel, setPanel] = useState<"journal" | "chapters" | "about" | null>(null);
  const [phase, setPhase] = useState<"reading" | "decision" | "reply">(
    save.answers[save.index] ? "reply" : "reading",
  );
  const [beat, setBeat] = useState(0);
  const [allText, setAllText] = useState(false);
  const [note, setNote] = useState("");
  const [activity, setActivity] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scene = scenes[save.index];
  const chapter =
    chapters.find((c) => c.scenes.some((s) => s.id === scene?.id)) ?? chapters[chapters.length - 1];
  const chapterIndex = chapters.indexOf(chapter);
  const currentAnswer = save.answers[save.index];
  const selected = scene?.options.find((o) => o.id === currentAnswer?.optionId);
  const flags = useMemo(
    () => flagsFor(save.answers.slice(0, save.index)),
    [save.answers, save.index],
  );
  const opening = useMemo<Line[]>(
    () =>
      scene
        ? [
            ...(scene.echoes ?? [])
              .filter((e) => flags[e.key] === e.value)
              .map((e) => ({ speaker: e.speaker, text: e.text })),
            ...scene.lines,
          ]
        : [],
    [scene, flags],
  );
  const displayed = useMemo(
    () =>
      landing || !scene
        ? []
        : phase === "reply"
          ? (selected?.reply ?? [])
          : phase === "reading"
            ? allText
              ? opening
              : opening.slice(beat * 2, beat * 2 + 2)
            : [],
    [landing, scene, phase, selected, allText, opening, beat],
  );
  const scope = landing
    ? "landing"
    : `${save.index}:${phase}:${beat}:${allText}:${currentAnswer?.optionId ?? ""}`;
  const voice = useVoice(displayed, scope, panel !== null);
  const completed = save.index === scenes.length;
  const hasProgress = save.answers.length > 0 || save.index > 0;
  useEffect(() => {
    if (!hasProgress) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch {
      setNotice("浏览器无法自动保存。请使用“导出进度”保留本次旅程。");
    }
  }, [save, hasProgress]);
  useEffect(() => {
    setBeat(0);
    setAllText(false);
    setNote(save.answers[save.index]?.note ?? "");
    setActivity(save.answers[save.index]?.activity ?? {});
    setPhase(save.answers[save.index] ? "reply" : "reading");
    if (!landing) {
      window.scrollTo({ top: 0, behavior: "instant" });
      titleRef.current?.focus();
    }
  }, [save.index, landing]);
  function enter() {
    setLanding(false);
    setPanel(null);
  }
  function startOver() {
    if (hasProgress && !window.confirm("重新开始会替换当前进度。你可以先在札记中导出。继续吗？"))
      return;
    voice.stop();
    setSave(initialSave());
    setBeat(0);
    setPhase("reading");
    setNote("");
    setActivity({});
    setLanding(false);
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {}
  }
  function goBack(index: number) {
    if (
      index < save.answers.length &&
      !window.confirm("从这里重新提问，会移除这一场及之后的选择。继续吗？")
    )
      return;
    voice.stop();
    setSave((s) => rewind(s, index));
    setPhase("reading");
    setBeat(0);
    setNote("");
    setActivity({});
    setPanel(null);
    setLanding(false);
  }
  function submit(id: string) {
    setSave((s) => choose(s, scene.id, id, note, activity));
    setPhase("reply");
    setAllText(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
    titleRef.current?.focus();
  }
  async function importSave(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error();
      const parsed = validateSave(JSON.parse(await file.text()));
      if (!parsed) throw new Error();
      if (hasProgress && !window.confirm("导入这份存档将替换当前进度。继续吗？")) return;
      voice.stop();
      setSave(parsed);
      setPanel(null);
      setLanding(false);
      setPhase(parsed.answers[parsed.index] ? "reply" : "reading");
      setBeat(0);
      setNotice("已恢复导入的进度。");
    } catch {
      setNotice("这份文件不是有效的本游戏存档；当前进度没有改变。");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  function exportJournal() {
    let text = "# 我的苏格拉底札记\n\n";
    for (const a of save.answers) {
      const s = scenes.find((x) => x.id === a.sceneId)!;
      const o = s.options.find((x) => x.id === a.optionId)!;
      text += `## ${s.title}\n\n我的回应：${o.text}\n\n仍需说明：${o.responsibility}\n\n我的笔记：${a.note || "未填写"}\n\n`;
      text += activitySummary(a.sceneId, a.activity)
        .map((line) => line + "\n\n")
        .join("");
      if (o.commitment)
        text += `主张：${o.commitment.position}\n\n理由：${o.commitment.reason}\n\n边界：${o.commitment.limit}\n\n`;
    }
    download("我的苏格拉底札记.md", text, "text/markdown");
  }
  const journal = commitmentsFor(save.answers);
  return (
    <>
      <a className="skip-link" href="#main">
        跳到正文
      </a>
      <header className="topbar">
        <button
          className="wordmark"
          onClick={() => {
            voice.stop();
            setLanding(true);
          }}
          aria-label="返回游戏首页"
        >
          <span className="mark">Σ</span>
          <span>
            苏格拉底之死<small>一场尚未结束的对话</small>
          </span>
        </button>
        <nav aria-label="游戏工具">
          <button onClick={() => setPanel("chapters")}>
            <Compass size={18} />
            <span>旅程</span>
          </button>
          <button onClick={() => setPanel("journal")}>
            <BookOpen size={18} />
            <span>札记</span>
            {save.answers.length > 0 && <b className="count">{save.answers.length}</b>}
          </button>
          <button onClick={() => setPanel("about")} className="about-button">
            作品与来源
          </button>
        </nav>
      </header>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => void importSave(e.target.files?.[0])}
      />
      {notice && (
        <div className="notice" role="status">
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {landing ? (
        <main id="main" className="landing">
          <section className="hero">
            <img
              src={asset("death-of-socrates.jpg")}
              alt="大卫画作：苏格拉底在朋友环绕的牢房中举手谈论"
              className="hero-art"
            />
            <div className="hero-shade" />
            <div className="hero-copy">
              <p className="eyebrow">雅典 · 公元前 399 年的回声</p>
              <h1>
                有些问题，
                <br />
                值得用一生
                <br />
                <em>继续问。</em>
              </h1>
              <p className="hero-intro">
                一个人已经死去。
                <br />
                他留下的追问，正在向你走来。
              </p>
              <div className="hero-actions">
                <button className="primary" onClick={enter}>
                  {hasProgress ? "继续我的旅程" : "打开第一页"}
                  <ArrowRight size={20} />
                </button>
                {hasProgress && (
                  <button className="text-button" onClick={startOver}>
                    重新开始
                  </button>
                )}
              </div>
              <p className="hero-meta">五章完整故事 · 中文剧情 · 无需注册</p>
            </div>
            <span className="art-caption">雅克－路易·大卫《苏格拉底之死》，1787 · 后世绘画</span>
          </section>
          <section className="invitation">
            <div>
              <p className="eyebrow">你是后来读到这些对话的人</p>
              <h2>
                走入文字，
                <br />
                留下自己的理由。
              </h2>
            </div>
            <div>
              <p>
                从克法洛斯的庭院到雅典的法庭，从朋友送来的逃生机会到最后一天的交谈。你会在文本的空白处试问，也会发现：刚刚留下的主张，已经成了下一场谈话的问题。
              </p>
              <p>
                苏格拉底的命运属于历史。你可以赞同他、反驳他，也可以暂缓判断。旅程会记下你的理由与仍未回答的事。
              </p>
              <button className="text-button" onClick={() => setPanel("about")}>
                了解玩法与文本边界 <ArrowRight size={16} />
              </button>
            </div>
          </section>
          <div className="landing-chapters">
            {chapters.map((c) => (
              <div key={c.id}>
                <span>{c.numeral}</span>
                <h3>{c.title}</h3>
                <p>{c.subtitle}</p>
              </div>
            ))}
          </div>
        </main>
      ) : completed ? (
        <main id="main" className="ending">
          <p className="eyebrow">卷终 · 对话留在你这里</p>
          <h1 ref={titleRef} tabIndex={-1}>
            {endingFor(save).title}
          </h1>
          <p className="ending-lead">苏格拉底没有离开那间牢房。柏拉图的文字走出了它。</p>
          <p>{endingFor(save).text}</p>
          <blockquote>{endingFor(save).question}</blockquote>
          <p>
            这段回望依据你最后选择的方向写成。它不替你的全部判断打分；那些没有消失的张力，仍留在札记里。
          </p>
          <div className="ending-commitments">
            {[...new Map(journal.map((c) => [c.topic, c])).values()].slice(-5).map((c) => (
              <article key={c.topic}>
                <p className="eyebrow">{c.topic}</p>
                <h3>{c.position}</h3>
                <p>{c.limit}</p>
              </article>
            ))}
          </div>
          <div className="end-actions">
            <button className="primary" onClick={exportJournal}>
              <Download size={18} />
              带走我的札记
            </button>
            <button className="secondary" onClick={() => setPanel("chapters")}>
              回到一处岔路
            </button>
          </div>
          <div className="closing-question">
            <h2>离开游戏之后</h2>
            <p>
              想起一件你最近作过判断的事。你知道什么？只是推测什么？哪一种反例，会使你愿意改变说法？
            </p>
          </div>
        </main>
      ) : (
        <main id="main" className={"game chapter-" + chapter.id}>
          <aside className="chapter-rail" aria-label="章节进度">
            <span className="rail-label">你的旅程</span>
            {chapters.map((c, i) => (
              <button
                key={c.id}
                className={i === chapterIndex ? "active" : ""}
                disabled={scenes.indexOf(c.scenes[0]) > save.index}
                onClick={() => goBack(scenes.indexOf(c.scenes[0]))}
              >
                <span>{c.numeral}</span>
                <span>{c.title}</span>
              </button>
            ))}
            <div className="rail-progress">
              <span>
                {save.index + 1} / {scenes.length}
              </span>
              <progress value={save.index + 1} max={scenes.length} />
              <small>当前场景</small>
            </div>
          </aside>
          <div className="game-column">
            <section
              className="scene-banner"
              style={{
                backgroundImage: `linear-gradient(90deg,rgba(13,24,31,.93),rgba(13,24,31,.30)),url("${asset(chapterIndex < 2 ? "courtyard.png" : "death-of-socrates.jpg")}")`,
              }}
            >
              <p className="eyebrow">
                第 {chapter.numeral} 章 · {chapter.title}
              </p>
              <h1 ref={titleRef} tabIndex={-1}>
                {scene.title}
              </h1>
              <p>
                {scene.location}
                <span>·</span>
                {scene.time}
              </p>
            </section>
            <div className="scene-body">
              <div className="scene-utilities">
                <span className="scene-position">
                  {phase === "reply"
                    ? "你的话，落在了这里"
                    : phase === "decision"
                      ? "现在，留下你的回答"
                      : "听他们说"}
                </span>
                <div className="voice-controls">
                  <button
                    className="icon-button"
                    onClick={voice.toggleEnabled}
                    aria-label={voice.enabled ? "关闭自动配音" : "开启自动配音"}
                    aria-pressed={voice.enabled}
                  >
                    {voice.enabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
                  </button>
                  <button
                    onClick={voice.toggle}
                    aria-label={voice.status === "playing" ? "暂停配音" : "播放本段"}
                  >
                    {voice.status === "playing" ? <Pause size={16} /> : <Play size={16} />}
                    <span>
                      {voice.status === "playing"
                        ? "暂停"
                        : voice.status === "paused"
                          ? "继续"
                          : voice.status === "blocked"
                            ? "开启配音"
                            : "播放"}
                    </span>
                  </button>
                  <button className="icon-button" onClick={voice.replay} aria-label="重听本段">
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>
              {voice.status === "unavailable" && (
                <p className="audio-note" role="status">
                  这段录音暂不可用，字幕可继续阅读。
                </p>
              )}
              {phase === "reading" && (
                <>
                  <div className="dialogue" aria-live="polite">
                    {displayed.map((line, i) => (
                      <div
                        className={
                          "line " +
                          (line.speaker === "旁白" ? "narrator " : "") +
                          (voice.active === i ? "speaking" : "")
                        }
                        key={`${scope}-${i}`}
                      >
                        <span className="speaker">{line.speaker}</span>
                        <p>{line.text}</p>
                      </div>
                    ))}
                  </div>
                  <div className="reading-actions">
                    <button className="text-button" onClick={() => setAllText((v) => !v)}>
                      {allText ? "逐段阅读" : "查看本场全文"}
                    </button>
                    <span className="beat-indicator">
                      {allText
                        ? "全文"
                        : `${Math.min(beat + 1, Math.ceil(opening.length / 2))} / ${Math.ceil(opening.length / 2)}`}
                    </span>
                    {!allText && (beat + 1) * 2 < opening.length ? (
                      <button
                        className="primary"
                        onClick={() => {
                          setBeat((v) => v + 1);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        继续听 <ArrowRight size={18} />
                      </button>
                    ) : (
                      <button className="primary" onClick={() => setPhase("decision")}>
                        留下我的回答 <Feather size={18} />
                      </button>
                    )}
                  </div>
                </>
              )}
              {phase === "decision" && (
                <div className="decision">
                  <p className="eyebrow">你的页边</p>
                  <h2>{scene.prompt}</h2>
                  <Activity key={scene.id} scene={scene} data={activity} onChange={setActivity} />
                  <label className="reflection-label" htmlFor="reason">
                    {scene.question}
                    <span>可选 · 这段文字只保存在你的浏览器，不参与自动评分</span>
                  </label>
                  <textarea
                    id="reason"
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 1200))}
                    placeholder="写下你的理由，或暂时不能回答的事……"
                    rows={3}
                    maxLength={1200}
                  />
                  <div className="choices">
                    {scene.options.map((o, i) => (
                      <button
                        key={o.id}
                        disabled={!activityReady(scene.id, activity)}
                        onClick={() => submit(o.id)}
                      >
                        <span className="choice-index">{String(i + 1).padStart(2, "0")}</span>
                        <span>{o.text}</span>
                        <ArrowRight size={18} />
                      </button>
                    ))}
                  </div>
                  {!activityReady(scene.id, activity) && (
                    <p className="activity-hint">先完成上面的具体检验，再留下你的立场。</p>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      setAllText(true);
                      setPhase("reading");
                    }}
                  >
                    ← 回看他们的话
                  </button>
                </div>
              )}
              {phase === "reply" && selected && (
                <>
                  <div className="your-words">
                    <span className="eyebrow">你留下的话</span>
                    <p>{selected.text}</p>
                    {currentAnswer &&
                      activitySummary(scene.id, currentAnswer.activity).map((text, i) => (
                        <p className="personal-note" key={i}>
                          {text}
                        </p>
                      ))}
                    {currentAnswer?.note && <p className="personal-note">{currentAnswer.note}</p>}
                  </div>
                  <div className="dialogue" aria-live="polite">
                    {displayed.map((line, i) => (
                      <div
                        className={"line " + (voice.active === i ? "speaking" : "")}
                        key={`${scope}-${i}`}
                      >
                        <span className="speaker">{line.speaker}</span>
                        <p>{line.text}</p>
                      </div>
                    ))}
                  </div>
                  <details className="responsibility">
                    <summary>把这次追问收入札记</summary>
                    <p>{selected.responsibility}</p>
                    {selected.commitment && (
                      <dl>
                        <dt>我的主张</dt>
                        <dd>{selected.commitment.position}</dd>
                        <dt>依据</dt>
                        <dd>{selected.commitment.reason}</dd>
                        <dt>仍未解决</dt>
                        <dd>{selected.commitment.limit}</dd>
                      </dl>
                    )}
                  </details>
                  <div className="reading-actions">
                    <button className="text-button" onClick={() => goBack(save.index)}>
                      <ChevronLeft size={16} />
                      换一种问法
                    </button>
                    <button
                      className="primary"
                      onClick={() => {
                        voice.stop();
                        setSave((s) => advance(s));
                      }}
                    >
                      {save.index === scenes.length - 1
                        ? "留下这场对话"
                        : chapter.scenes.at(-1)?.id === scene.id
                          ? "走进下一章"
                          : "继续前行"}
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </>
              )}
              <details className="source-note">
                <summary>文本与演绎边界</summary>
                <p>{scene.source}</p>
                <p>{scene.frame}</p>
                <p>
                  玩家选项、回应、跨场景回响和互动结果均为游戏演绎。原作重述使用本游戏独立撰写的中文，均非逐字引文。
                </p>
              </details>
            </div>
          </div>
        </main>
      )}
      <footer>
        <span>苏格拉底之死</span>
        <span>让一个理由，遇见另一个人。</span>
        <a href="https://github.com/yaoyuzhang1/death-of-socrates" target="_blank" rel="noreferrer">
          源代码 <ExternalLink size={13} />
        </a>
      </footer>
      {panel === "journal" && (
        <Modal title="我的思想札记" onClose={() => setPanel(null)}>
          <p>这里记录你实际说过的话。你可以保留矛盾，回头修订，也可以继续追问。</p>
          <div className="journal-actions">
            <button className="secondary" onClick={exportJournal}>
              <Download size={16} />
              导出札记
            </button>
            <button
              className="secondary"
              onClick={() => download("苏格拉底之死-进度.json", JSON.stringify(save, null, 2))}
            >
              导出进度
            </button>
            <button className="secondary" onClick={() => fileRef.current?.click()}>
              <Upload size={16} />
              导入进度
            </button>
          </div>
          {save.answers.length === 0 ? (
            <p className="empty-note">第一页还没有留下回答。旅程开始后，你的理由会出现在这里。</p>
          ) : (
            save.answers.map((a, i) => {
              const s = scenes[i];
              const o = s.options.find((x) => x.id === a.optionId)!;
              return (
                <article className="journal-entry" key={a.sceneId}>
                  <p className="eyebrow">
                    {String(i + 1).padStart(2, "0")} · {s.title}
                  </p>
                  <h3>{o.text}</h3>
                  {o.commitment && (
                    <>
                      <p>
                        <strong>根据：</strong>
                        {o.commitment.reason}
                      </p>
                      <p>
                        <strong>边界：</strong>
                        {o.commitment.limit}
                      </p>
                    </>
                  )}
                  <p>{o.responsibility}</p>
                  {activitySummary(a.sceneId, a.activity).map((text, i) => (
                    <p key={i}>{text}</p>
                  ))}
                  {a.note && <blockquote>{a.note}</blockquote>}
                  <button className="text-button" onClick={() => goBack(i)}>
                    回到这里，修订说法 →
                  </button>
                </article>
              );
            })
          )}
        </Modal>
      )}
      {panel === "chapters" && (
        <Modal title="从庭院到黎明" onClose={() => setPanel(null)}>
          <p>章节随旅程开启。回到先前的场景重新回答，会替换那之后的路线；你可以先导出进度。</p>
          {chapters.map((c) => (
            <section className="chapter-map" key={c.id}>
              <div>
                <span>{c.numeral}</span>
                <h3>{c.title}</h3>
              </div>
              <p>{c.introduction}</p>
              {c.scenes.map((s) => {
                const i = scenes.indexOf(s);
                return (
                  <button
                    key={s.id}
                    disabled={i > save.index}
                    onClick={() => {
                      if (i === save.index) {
                        setLanding(false);
                        setPanel(null);
                      } else goBack(i);
                    }}
                  >
                    <span>{s.title}</span>
                    {i < save.answers.length ? (
                      <Check size={16} />
                    ) : i === save.index ? (
                      <ArrowRight size={16} />
                    ) : (
                      <span className="locked">尚未抵达</span>
                    )}
                  </button>
                );
              })}
            </section>
          ))}
        </Modal>
      )}
      {panel === "about" && (
        <Modal title="作品、玩法与来源" onClose={() => setPanel(null)}>
          <h3>这是一场怎样的游戏？</h3>
          <p>
            五章连续故事，二十处关键场景。你是一位虚构的后世读者，在柏拉图文本的空白处试问。选项会改变人物回应、后续追问与札记；没有隐藏的道德分数，也不以复现原作问法判定胜负。
          </p>
          <h3>先听，再判断</h3>
          <p>
            逐段阅读对话，完成证言、钱袋与寄存物的检验，再留下自己的立场。所有人物回应都已经写成，不调用聊天模型。配音只读当前可见对白，不提前读出未选分支；播放结束不会自动替你翻页。可以暂停、重听或关闭配音。
          </p>
          <h3>历史与创作</h3>
          <p>
            本作依据柏拉图对话写成。庭院中的《理想国》与审判、狱中和临终的对话被组织为回望之旅，并非一次连续发生的史实。柏拉图的对话也不等于现代法庭逐字记录。你改变的是理解和演绎分支；苏格拉底被处死的历史结局保持不变。
          </p>
          <ul className="source-links">
            <li>
              <a
                href="https://classics.mit.edu/Plato/republic.2.i.html"
                target="_blank"
                rel="noreferrer"
              >
                《理想国》第一卷
              </a>
              ：老年、财富、正义与伤害。
            </li>
            <li>
              <a
                href="https://classics.mit.edu/Plato/apology.html"
                target="_blank"
                rel="noreferrer"
              >
                《申辩篇》
              </a>
              ：指控、自我省察与审判。
            </li>
            <li>
              <a href="https://classics.mit.edu/Plato/crito.html" target="_blank" rel="noreferrer">
                《克力同篇》
              </a>
              ：出逃、义务与法律之声。
            </li>
            <li>
              <a href="https://classics.mit.edu/Plato/phaedo.html" target="_blank" rel="noreferrer">
                《斐多篇》
              </a>
              ：最后一天、灵魂论证与朋友的悲伤。
            </li>
          </ul>
          <p>
            中文均为本作重述与创作，不是以上英文译本的逐字翻译。各场景可展开“文本与演绎边界”。画作来自大都会艺术博物馆公有领域馆藏；庭院插画为
            AI 生成，均为视觉诠释。
          </p>
          <h3>保存与无障碍</h3>
          <p>
            无需注册。选择与笔记只保存在本机浏览器；可以导出进度，在另一台设备导入。清除浏览器数据会移除本地进度。游戏不主动收集你的笔记或设置；网页托管服务仍会处理正常访问请求。
          </p>
          <p>
            使用 Tab 移动焦点、Enter 或空格激活按钮、Esc
            关闭面板。主要交互也支持触摸；所有剧情都有文字，配音可关闭。游戏遵循系统减少动态效果的偏好。
          </p>
          <a
            className="text-button"
            href="https://github.com/yaoyuzhang1/death-of-socrates"
            target="_blank"
            rel="noreferrer"
          >
            公开代码、完整来源与制作说明 <ExternalLink size={16} />
          </a>
        </Modal>
      )}
    </>
  );
}
