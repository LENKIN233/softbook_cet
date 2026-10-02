import {LearningSceneNavigation} from './LearningSceneNavigation';
import {LearningHome} from './LearningHome';
import {StudioMark} from './StudioMark';
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  LearningSession,
  LearningTrack,
} from "../../mobile/src/learning/model";
import {
  hasStudyActivity,
  activeStudyCard,
  nextStudyDue,
  pendingStudyIds,
  studyDay,
  studyStatistics,
} from "../../mobile/src/local/studyModel";
import {
  useChinaDay,
  useStudyProfile,
  type localStudyLock,
} from "../../mobile/src/local/useStudyProfile";
import type { StudyStorage } from "../../mobile/src/local/studyStore";
import { createInitialMembershipState } from "../../mobile/src/membership/localMembership";
import type { LocalWebSurfaces } from "./App";
import { createBundledAudioController } from "./bundledAudio";
import {FirstLearningDialog} from './FirstRunGuidance';
import type {FirstRunGuidanceRecord} from './firstRunGuidanceStore';

const storage: StudyStorage = {
  removeItem: (key) => localStorage.removeItem(key),
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  getAllKeys: () => Object.keys(localStorage),
};
const withLock: typeof localStudyLock = (key, work) =>
  navigator.locks
    ? navigator.locks.request(key, work)
    : Promise.reject(new Error("Storage locking unavailable"));
const PREF = "softbook-cet/local-track";
type Route = "learning" | "space" | "statistics" | "mine";
export function LocalStudyApp({
  initialTrack,
  views,
  firstRunRecord,
  onRememberGuidance,
}: {
  initialTrack: LearningTrack;
  views: LocalWebSurfaces;
  firstRunRecord?: FirstRunGuidanceRecord;
  onRememberGuidance?: (record: FirstRunGuidanceRecord) => void;
}) {
  const [track, setTrack] = useState<LearningTrack>(() => {
    if (firstRunRecord) return firstRunRecord.selectedTrack;
    try {
      const saved = localStorage.getItem(PREF);
      return saved === "cet4" || saved === "cet6" ? saved : initialTrack;
    } catch {
      return initialTrack;
    }
  });
  const [session, setSession] = useState<LearningSession | null>(null);
  const [libraryError, setLibraryError] = useState("");
  const [libraryAttempt, setLibraryAttempt] = useState(0);
  const [entered, setEntered] = useState(false);
  const [reviewIntent, setReviewIntent] = useState(false);
  const [spaceSceneReturn, setSpaceSceneReturn] = useState(false);
  const [route, setRoute] = useState<Route>("learning");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [audioStatus, setAudioStatus] = useState<
    "idle" | "loading" | "paused" | "playing" | "ready" | "error"
  >("idle");
  const [backupInfo, setBackupInfo] = useState<
    | { key: string; date: string; count: number | null; canRestore: boolean }[]
    | null
  >(null);
  const audio = useRef<ReturnType<typeof createBundledAudioController> | null>(
    null
  );
  const { now, day, refresh } = useChinaDay();
  useEffect(() => {
    const update = () => {
      if (!document.hidden) refresh();
      else audio.current?.stop();
    };
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, [refresh]);
  useEffect(() => {
    let active = true;
    setSession(null);
    setLibraryError("");
    import("../../mobile/src/learning/session")
      .then((module) => {
        if (active) setSession(module.createLocalLearningSession(track));
      })
      .catch(() => {
        if (active) setLibraryError("卡库暂时无法读取，请重试。");
      });
    return () => {
      active = false;
    };
  }, [track, libraryAttempt]);
  const input = useMemo(
    () =>
      session?.track === track
        ? {
            track,
            contentVersion: session.contentVersion ?? session.sourceId,
            cards: session.catalogCards,
          }
        : null,
    [track, session]
  );
  const profile = useStudyProfile(input, storage, withLock);
  const state = input ? profile.state : null;
  const card =
    state && session ? activeStudyCard(state, session.catalogCards) : null;
  useEffect(() => {
    audio.current?.stop();
    setAudioStatus("idle");
  }, [
    track,
    card?.card_id,
    route,
    entered,
    state?.frame.phase,
    state?.frame.complete,
  ]);
  useEffect(
    () => () => {
      audio.current?.dispose();
    },
    []
  );
  const perform = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setActionError("");
    try {
      await work();
    } catch {
      setActionError("操作未完成，原记录已保留。请重试。");
    } finally {
      setBusy(false);
    }
  };
  const chooseTrack = (next: LearningTrack) => {
    if (next === track) return;
    void perform(async () => {
      await profile.flush();
      if (firstRunRecord && onRememberGuidance) onRememberGuidance({...firstRunRecord, selectedTrack: next});
      else await storage.setItem(PREF, next);
      setTrack(next);
      setEntered(false);
      setReviewIntent(false);
      setRoute("learning");
      setBackupInfo(null);
    });
  };
  const backup = async () => {
    const contents = await profile.backup();
    const url = URL.createObjectURL(
      new Blob([contents], { type: "application/json" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `softbook-${track}-${day}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const inspectBackups = async () => setBackupInfo(await profile.archives());
  const recovery = (
    <div className="local-record-tools">
      <button
        className="text-button"
        disabled={busy || !session}
        onClick={() => void perform(backup)}
      >
        导出学习备份
      </button>
      <label className="text-button import-backup">
        导入学习备份
        <input
          type="file"
          aria-label="导入学习备份"
          accept="application/json,.json"
          disabled={busy || !session}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file)
              void perform(async () => profile.restore(await file.text()));
          }}
        />
      </label>
      <button
        className="text-button"
        disabled={busy || !session}
        onClick={() => void perform(inspectBackups)}
      >
        查看已有备份
      </button>
      {backupInfo ? (
        <ul aria-label="已有备份">
          {backupInfo.map((item) => (
            <li key={item.key}>
              {item.date} ·{" "}
              {item.count === null ? "原始备份" : `${item.count} 张学习记录`}{" "}
              {item.canRestore ? (
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        "当前记录会先备份，再恢复所选记录。继续吗？"
                      )
                    )
                      void perform(() => profile.restoreArchive(item.key));
                  }}
                >
                  恢复这份记录
                </button>
              ) : (
                <span>原内容已保留，可导出备份</span>
              )}
              <button
                className="text-button"
                onClick={() => {
                  if (
                    window.confirm(
                      "请先导出备份。移除后将无法从本机恢复这份历史记录，当前学习档案不受影响。继续吗？"
                    )
                  )
                    void perform(async () => {
                      await profile.deleteArchive(item.key);
                      await inspectBackups();
                    });
                }}
              >
                移除本机备份
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        className="text-button"
        disabled={busy || !session}
        onClick={() => {
          if (
            window.confirm(
              "原记录会先备份保留，然后开始一份新的学习记录。确定继续吗？"
            )
          )
            void perform(profile.reset);
        }}
      >
        备份后重新开始
      </button>
    </div>
  );
  const trackPicker = (
    <div role="group" aria-label="选择考级" className="space-filters">
      {route === 'mine' ? <span>备考科目</span> : null}
      {(["cet4", "cet6"] as const).map((value) => (
        <button
          className="text-button"
          key={value}
          aria-pressed={track === value}
          disabled={busy}
          onClick={() => chooseTrack(value)}
        >
          {value === "cet4" ? "英语四级" : "英语六级"}
        </button>
      ))}
    </div>
  );
  const error = libraryError || profile.error || actionError;
  const notices = (
    <>
      {profile.notice ? (
        <section className="notice" role="status">
          <p>{profile.notice}</p>
          <button className="text-button" onClick={profile.clearNotice}>
            知道了
          </button>
        </section>
      ) : null}
      {error ? (
        <section className="notice error" role="alert">
          <p>{error}</p>
          {libraryError ? (
            <button onClick={() => setLibraryAttempt((value) => value + 1)}>
              重新加载卡库
            </button>
          ) : (
            <>
              {state ? <button onClick={profile.retry}>重试保存</button> : null}
              <button
                onClick={() => {
                  if (
                    !state ||
                    window.confirm(
                      "读取已保存进度会替换本页未保存的修改。可先导出备份。继续吗？"
                    )
                  )
                    void perform(profile.reload);
                }}
              >
                读取已保存进度
              </button>
              {recovery}
            </>
          )}
        </section>
      ) : null}
    </>
  );
  const Learning = views.Learning,
    Space = views.Space,
    Statistics = views.Statistics;
  const cards = session?.catalogCards ?? [];
  const pending = state ? pendingStudyIds(state, cards, now) : [];
  const counts = state
    ? studyDay(state, now)
    : { learning: 0, review: 0, correct: 0, hints: 0 };
  const sync =
    profile.status === "error"
      ? "尚未保存"
      : profile.status === "saved"
      ? "已保存在本机"
      : "正在保存";
  const savedCheckIn = profile.savedState?.checkIns.includes(day) === true;
  const checkIn = state?.checkIns.includes(day) === true;
  const membership = {
    ...createInitialMembershipState(),
    stage: "premium" as const,
  };
  const activeScene = route === 'learning' && entered;
  const savedStatistics = profile.savedState ? studyStatistics(profile.savedState, track, now) : undefined;
  const savedPending = profile.savedState ? pendingStudyIds(profile.savedState, cards, now).length : null;
  const startLearning = () => {
    if (!state || busy) return;
    setEntered(true);
    if (reviewIntent && (state.frame.phase !== 'review' || state.frame.complete)) profile.dispatch({type:'review'});
    else if (!reviewIntent && state.frame.phase === 'review' && state.frame.complete) profile.dispatch({type:'continue'});
  };
  const showLearningGuide = activeScene && card !== null && firstRunRecord?.learningGuideSeen === false;
  return (
    <>
    <div className={activeScene ? 'app-shell local-study-shell learning-scene' : 'app-shell local-study-shell'} data-local-study="true" inert={showLearningGuide || undefined}>
      {activeScene ? <LearningSceneNavigation
        progress={{roundIndex: null, completedCount: profile.savedState && state && profile.savedState.frame.ids.join(',') === state.frame.ids.join(',') ? profile.savedState.frame.results.length : 0, total: Math.max(1, state?.frame.ids.length ?? 5)}}
        overall={{learned: profile.savedState ? studyStatistics(profile.savedState, track, now)?.cumulativeLearnedCardCount ?? null : null, total: cards.length || null, loading: profile.status === 'saving'}}
        onExit={() => {audio.current?.stop(); setEntered(false); setSpaceSceneReturn(false);}} onOpenSpace={() => {audio.current?.stop(); setSpaceSceneReturn(true); setRoute('space');}}
      /> : <>
      <header className="mobile-header"><div className="brand-lockup"><span className="brand-mark"><StudioMark /></span><span className="wordmark">软书</span></div><button className="course-switch" aria-label="选择备考科目" onClick={() => {setEntered(false);setRoute("mine");}}>CET {track === "cet6" ? "6" : "4"} ⌄</button></header>
      <nav className="route-rail" aria-label="主要导航">
        <div className="rail-brand wordmark">软书四六级</div>
        <div className="route-list">
          {(
            [
              ["learning", "学习"],
              ["space", "空间"],
              ["statistics", "统计"],
              ["mine", "我的"],
            ] as const
          ).map(([value, label]) => (
            <button
              className={route === value ? "route active" : "route"}
              aria-current={route === value ? "page" : undefined}
              key={value}
              onClick={() => {
                audio.current?.stop();
                setEntered(false);
                setReviewIntent(false);
                setSpaceSceneReturn(false);
                setRoute(value);
                window.scrollTo({ top: 0 });
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="rail-account">
          {track === "cet4" ? "英语四级" : "英语六级"} · 本地学习
        </span>
      </nav></>}
      <div className="local-global-notices">{notices}</div>
      {!state ? (
        route === 'learning' ? <LearningHome track={track} today={null} pendingReview={null}
          overall={{learned:null,total:null,loading:!error}} continuing={false} busy={!error} disabled onStart={() => {}} />
        : <main className="workbench"><p>{error ? '学习记录暂不可读，请恢复后继续。' : '正在读取学习记录…'}</p></main>
      ) : (
        <>
          {route === "learning" ? (
            !activeScene ? <LearningHome track={track} today={savedStatistics?.completedCardCount ?? null} pendingReview={savedPending}
              overall={{learned:savedStatistics?.cumulativeLearnedCardCount ?? null,total:cards.length,loading:profile.status==='saving'}}
              continuing={hasStudyActivity(state)} reviewIntent={reviewIntent} busy={busy} disabled={!state}
              onStart={startLearning} /> : state.frame.complete ? (
              <main className="completion-workbench">
                <section className="completion-object">
                  <h1>
                    {state.frame.ids.length ? "本组完成" : "当前安排已完成"}
                  </h1>
                  <p>
                    {state.frame.results.length
                      ? `完成 ${state.frame.results.length} 张卡片。`
                      : "没有可继续学习的新卡片。"}
                  </p>
                  {pending.length ? (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => profile.dispatch({ type: "review" })}
                    >
                      开始复习 {pending.length} 张
                    </button>
                  ) : null}
                  <button
                    className="tool"
                    disabled={busy}
                    onClick={() => profile.dispatch({ type: "continue" })}
                  >
                    {state.resume
                      ? "回到原来的学习"
                      : cards.some(
                          (item) =>
                            !state.results.some(
                              (r) => r.cardId === item.card_id
                            ) && !state.sleeping.includes(item.card_id)
                        )
                      ? "继续下一组"
                      : "检查复习安排"}
                  </button>
                  {!pending.length && nextStudyDue(state) ? (
                    <p className="muted">
                      下次复习：
                      {new Date(nextStudyDue(state)!).toLocaleString("zh-CN", {
                        timeZone: "Asia/Shanghai",
                      })}
                    </p>
                  ) : null}
                  <button
                    className="text-button"
                    onClick={() => {setSpaceSceneReturn(true);setRoute("space");}}
                  >
                    查看卡片
                  </button>
                  {!state.frame.ids.length ? (
                    <button
                      className="text-button"
                      onClick={() => profile.dispatch({ type: "practice" })}
                    >
                      重新练习
                    </button>
                  ) : null}
                </section>
              </main>
            ) : (
              <Learning
                card={card}
                cardState={state.frame.draft}
                currentIndex={state.frame.index}
                total={state.frame.ids.length}
                phase={state.frame.phase}
                motionIdentity={`${track}:${state.frame.ids.join(",")}:${
                  state.frame.index
                }:${state.frame.phase}`}
                resolved={state.frame.resolved}
                onState={profile.updateDraft}
                onResolve={(draft) =>
                  profile.dispatch({ type: "answer", draft })
                }
                onContinue={() => profile.dispatch({ type: "advance" })}
                onOpenSpace={() => {setSpaceSceneReturn(true);setRoute("space");}}
                onFavorite={(id) => profile.dispatch({ type: "favorite", id })}
                onPlayAudio={
                  card?.audio
                    ? () => {
                        if (!audio.current) {
                          audio.current = createBundledAudioController();
                          audio.current.subscribe((value) =>
                            setAudioStatus(value.status)
                          );
                        }
                        void audio.current
                          .play(
                            card,
                            `${track}:${
                              state.frame.phase
                            }:${state.frame.ids.join(",")}:${state.frame.index}`
                          )
                          .catch(() => setAudioStatus("error"));
                      }
                    : null
                }
                audioStatus={audioStatus}
                busy={busy}
                canMutateSpace
                serverSequenced={false}
                onReloadQueued={() => {}}
                onRetryQueued={() => {}}
                queuedResult={null}
                rejectedCompletion={false}
                retryBusy={false}
                statusMessage=""
                syncStatus={sync}
              />
            )
          ) : null}
          {route === "space" ? (
            <Space
              cards={cards}
              busy={busy}
              canMutate
              currentCardId={card?.card_id ?? null}
              pendingReviewIds={pending}
              favorites={state.favorites}
              sleeping={state.sleeping}
              membership={membership}
              onFavorite={(id) => profile.dispatch({ type: "favorite", id })}
              onSleep={(id) => profile.dispatch({ type: "sleep", id })}
              onReturn={() => {setEntered(spaceSceneReturn);setRoute("learning");}}
              statusMessage=""
              syncStatus={sync}
            />
          ) : null}
          {route === "statistics" ? (
            <Statistics
              track={track}
                statistics={studyStatistics(state, track, now) ?? null}
              localOnly
              busy={busy}
              disabled={busy}
              results={state.results.filter(
                (result) => getChinaDay(result.completedAt) === day
              )}
              onReview={() => {
                setReviewIntent(true);
                setEntered(false);
                setRoute("learning");
              }}
              dailyCounts={counts}
              cumulativeLearnedCount={state.results.length}
              pendingReviewCount={pending.length}
              syncStatus={sync}
              checkInSync={{
                checkedInToday: savedCheckIn,
                pending: checkIn && !savedCheckIn,
                status: savedCheckIn
                  ? "confirmed"
                  : checkIn
                  ? "queued"
                  : counts.learning + counts.review > 0
                  ? "ready"
                  : "unavailable",
              }}
              onCheckIn={() => {
                profile.dispatch({ type: "checkin" });
                profile.retry();
              }}
              onContinueLearning={() => {setReviewIntent(false);setEntered(false);setRoute("learning");}}
            />
          ) : null}
          {route === "mine" ? (
            <main className="account-workbench">
              <section className="account-object">
                <h1>本地学习</h1>
                {trackPicker}
                <p>
                  学习记录保存在这台设备的当前浏览器中。清除浏览器数据前，请先导出备份。
                </p>
                <p role="status">{sync}</p>
                {recovery}

                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await profile.flush();
                      setEntered(false);
                      setRoute("learning");
                    })
                  }
                >
                  返回首页
                </button>
              </section>
            </main>
          ) : null}
        </>
      )}
    </div>
    {showLearningGuide && firstRunRecord && onRememberGuidance ? <FirstLearningDialog onContinue={() => onRememberGuidance({...firstRunRecord, learningGuideSeen: true})} /> : null}
    </>
  );
}
function getChinaDay(value: string) {
  return new Date(Date.parse(value) + 8 * 3600000).toISOString().slice(0, 10);
}
