import {useEffect, useMemo, useState} from 'react';

import type {
  LearningCard,
  LearningCardResult,
  LearningCardState,
  LearningSession,
} from '../../mobile/src/learning/model';
import {INTERACTION_LABELS} from '../../mobile/src/learning/model';
import {
  canSubmitLearningCard,
  createLearningCardState,
  evaluateLearningCard,
  summarizeLearningResults,
} from '../../mobile/src/learning/sessionCore';
import {
  createInitialMembershipState,
  resolveMembershipAccess,
  startMembershipTrial,
  type MembershipState,
} from '../../mobile/src/membership/localMembership';
import {resolveWebRuntime} from './runtime';

type RouteKey = 'learning' | 'space' | 'statistics' | 'mine';
type AuthStage = 'phone' | 'code' | 'authenticated';

const ROUTES: {id: RouteKey; label: string; mark: string}[] = [
  {id: 'learning', label: '学习', mark: '学'},
  {id: 'space', label: '空间', mark: '域'},
  {id: 'statistics', label: '统计', mark: '记'},
  {id: 'mine', label: '我的', mark: '我'},
];

const PHONE_PATTERN = /^1\d{10}$/;

export function App() {
  const runtime = useMemo(() => resolveWebRuntime(), []);
  const [session, setSession] = useState<LearningSession | null>(null);
  const [authStage, setAuthStage] = useState<AuthStage>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [authError, setAuthError] = useState('');
  const [route, setRoute] = useState<RouteKey>('learning');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [learningPhase, setLearningPhase] = useState<'learning' | 'review'>('learning');
  const [reviewCards, setReviewCards] = useState<LearningCard[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [cardState, setCardState] = useState<LearningCardState | null>(() =>
    null,
  );
  const [results, setResults] = useState<LearningCardResult[]>([]);
  const [resolved, setResolved] = useState<LearningCardResult | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [sleeping, setSleeping] = useState<string[]>([]);
  const [membership, setMembership] = useState<MembershipState>(
    createInitialMembershipState,
  );

  const activeCards = learningPhase === 'review' ? reviewCards : session?.cards ?? [];
  const currentCard = activeCards[currentIndex] ?? null;

  useEffect(() => {
    let active = true;
    if (!import.meta.env.DEV || runtime.mode !== 'development') return;

    import('../../mobile/src/learning/session').then(({createLocalLearningSession}) => {
      if (!active) return;
      const nextSession = createLocalLearningSession(runtime.track);
      setSession(nextSession);
      setCardState(
        nextSession.cards[0] ? createLearningCardState(nextSession.cards[0]) : null,
      );
    });

    return () => {
      active = false;
    };
  }, [runtime]);

  useEffect(() => {
    window.scrollTo({behavior: 'auto', top: 0});
  }, [currentIndex, route]);

  function requestCode() {
    if (runtime.mode === 'unavailable') {
      setAuthError(runtime.reason);
      return;
    }
    if (runtime.mode === 'remote') {
      setAuthError('远端短信登录接线尚未完成，当前构建不会降级为本地账户。');
      return;
    }
    if (!PHONE_PATTERN.test(phone)) {
      setAuthError('请输入 11 位中国大陆手机号。');
      return;
    }
    setAuthError('');
    setAuthStage('code');
  }

  function verifyCode() {
    if (!/^\d{6}$/.test(code)) {
      setAuthError('请输入 6 位验证码。');
      return;
    }
    setAuthError('');
    setAuthStage('authenticated');
    setMembership(previous => startMembershipTrial(previous));
  }

  function toggleFavorite(cardId: string) {
    const nextActive = !favorites.includes(cardId);
    setFavorites(
      nextActive
        ? unique([...favorites, cardId])
        : favorites.filter(id => id !== cardId),
    );
    if (currentCard?.card_id === cardId) {
      setCardState(state => state ? {...state, isFavorited: nextActive} : state);
    }
  }

  function signOut() {
    setAuthStage('phone');
    setPhone('');
    setCode('');
    setAuthError('');
    setRoute('learning');
    setCurrentIndex(0);
    setLearningPhase('learning');
    setReviewCards([]);
    setSessionComplete(false);
    setResults([]);
    setResolved(null);
    setFavorites([]);
    setSleeping([]);
    setMembership(createInitialMembershipState());
    setCardState(
      session?.cards[0] ? createLearningCardState(session.cards[0]) : null,
    );
  }

  if (authStage !== 'authenticated') {
    return (
      <main className="auth-shell">
        <section className="auth-object" aria-labelledby="auth-title">
          <span className="wordmark">SOFTBOOK · CET</span>
          <p className="eyebrow">同一账户 · 连续学习</p>
          <h1 id="auth-title">验证后开始今天的学习</h1>
          <p className="lede">手机号用于建立同一学习账户；已有进度会在验证后读取，新用户会从第一张卡开始。</p>
          <div className="field-stack">
            <label htmlFor="phone">手机号</label>
            <input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={event => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))}
              disabled={authStage === 'code'}
              placeholder="11 位手机号"
            />
            {authStage === 'code' ? (
              <>
                <label htmlFor="code">短信验证码</label>
                <input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 位验证码"
                  autoFocus
                />
              </>
            ) : null}
          </div>
          {authError ? <p className="notice error" role="alert">{authError}</p> : null}
          <button className="primary wide" onClick={authStage === 'phone' ? requestCode : verifyCode}>
            {authStage === 'phone' ? '获取验证码' : '验证并继续'}
          </button>
          {authStage === 'code' ? (
            <button className="text-button" onClick={() => {setAuthStage('phone'); setCode('');}}>
              更换手机号
            </button>
          ) : null}
          <p className="privacy-copy">当前开发构建只验证登录流程，不会把验证码写入页面或错误信息。正式上线前将在此提供服务条款与隐私政策链接。</p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="mobile-header">
        <span className="wordmark">SOFTBOOK · CET</span>
        <button className="text-button" onClick={signOut}>退出</button>
      </header>
      <nav className="route-rail" aria-label="主要导航">
        <span className="wordmark">SOFTBOOK</span>
        <div className="route-list">
          {ROUTES.map(item => (
            <button
              key={item.id}
              className={route === item.id ? 'route active' : 'route'}
              aria-current={route === item.id ? 'page' : undefined}
              onClick={() => setRoute(item.id)}
            >
              <span aria-hidden="true">{item.mark}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div className="rail-account">
          <span className="avatar" aria-hidden="true">{phone.slice(-2) || '我'}</span>
          <span>{maskPhone(phone)}</span>
        </div>
      </nav>

      {route === 'learning' ? (
        sessionComplete ? (
          <SessionCompleteSurface
            phase={learningPhase}
            results={results.filter(result => activeCards.some(card => card.card_id === result.cardId))}
            total={activeCards.length}
            onOpenSpace={() => setRoute('space')}
            onRestart={() => {
              const first = session?.cards[0] ?? null;
              setLearningPhase('learning');
              setReviewCards([]);
              setSessionComplete(false);
              setCurrentIndex(0);
              setResults([]);
              setResolved(null);
              setCardState(first ? withFavoriteState(first, favorites) : null);
            }}
            onStartReview={() => {
              const candidates = (session?.cards ?? []).filter(card =>
                results.some(result => result.cardId === card.card_id &&
                  (result.outcome === 'incorrect' || result.outcome === 'review')),
              );
              if (!candidates.length) return;
              setLearningPhase('review');
              setReviewCards(candidates);
              setSessionComplete(false);
              setCurrentIndex(0);
              setResolved(null);
              setCardState(withFavoriteState(candidates[0], favorites));
            }}
          />
        ) : <LearningSurface
          card={currentCard}
          cardState={cardState}
          currentIndex={currentIndex}
          phase={learningPhase}
          total={activeCards.length}
          resolved={resolved}
          onState={setCardState}
          onResolve={stateOverride => {
            const stateToResolve = stateOverride ?? cardState;
            if (!currentCard || !stateToResolve) return;
            const next = evaluateLearningCard(currentCard, stateToResolve);
            if (!next) return;
            setCardState(stateToResolve);
            setResolved(next);
            setResults(previous => [...previous.filter(item => item.cardId !== next.cardId), next]);
            setFavorites(previous => stateToResolve.isFavorited
              ? unique([...previous, currentCard.card_id])
              : previous.filter(id => id !== currentCard.card_id));
          }}
          onContinue={() => {
            if (!activeCards.length) return;
            if (currentIndex >= activeCards.length - 1) {
              setResolved(null);
              setSessionComplete(true);
              return;
            }
            const nextIndex = currentIndex + 1;
            const nextState = withFavoriteState(activeCards[nextIndex], favorites);
            setResolved(null);
            setCurrentIndex(nextIndex);
            setCardState(nextState);
          }}
          onOpenSpace={() => setRoute('space')}
          onFavorite={toggleFavorite}
        />
      ) : null}
      {route === 'space' ? (
        <SpaceSurface
          cards={session?.catalogCards ?? []}
          currentCardId={currentCard?.card_id ?? null}
          favorites={favorites}
          sleeping={sleeping}
          membership={membership}
          onFavorite={toggleFavorite}
          onSleep={id => setSleeping(items => toggle(items, id))}
          onReturn={() => setRoute('learning')}
        />
      ) : null}
      {route === 'statistics' ? <StatisticsSurface results={results} total={session?.cards.length ?? 0} /> : null}
      {route === 'mine' ? (
        <MineSurface
          phone={phone}
          membership={membership}
          onLogout={signOut}
        />
      ) : null}
    </div>
  );
}

type LearningSurfaceProps = {
  card: LearningCard | null;
  cardState: LearningCardState | null;
  currentIndex: number;
  phase: 'learning' | 'review';
  total: number;
  resolved: LearningCardResult | null;
  onState: React.Dispatch<React.SetStateAction<LearningCardState | null>>;
  onResolve: (stateOverride?: LearningCardState) => void;
  onContinue: () => void;
  onOpenSpace: () => void;
  onFavorite: (cardId: string) => void;
};

function LearningSurface(props: LearningSurfaceProps) {
  const {card, cardState, resolved} = props;
  const {onContinue, onState} = props;

  useEffect(() => {
    function handleKeyboard(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, input, select, textarea')) return;

      if (resolved && event.key === 'Enter') {
        event.preventDefault();
        onContinue();
        return;
      }
      if (!card || resolved) return;

      if (card.interaction_id === 'flip' && event.key === 'Enter') {
        event.preventDefault();
        onState(previous => previous ? {...previous, isFlipped: true} : previous);
      }
      if (card.interaction_id === 'multiple_choice' && /^[1-4]$/.test(event.key)) {
        const option = card.options[Number(event.key) - 1];
        if (option) {
          event.preventDefault();
          onState(previous => previous ? {...previous, selectedOptionId: option.id} : previous);
        }
      }
      if (card.interaction_id === 'swipe' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        const option = card.swipe_states[event.key === 'ArrowLeft' ? 0 : 1];
        if (option) {
          event.preventDefault();
          onState(previous => previous ? {...previous, swipeSelection: option.id} : previous);
        }
      }
    }

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [card, onContinue, onState, resolved]);

  if (!card || !cardState) {
    return <main className="workbench"><p className="notice">当前没有可用学习卡。</p></main>;
  }

  const patchState = (patch: Partial<LearningCardState>) =>
    props.onState(previous => previous ? {...previous, ...patch} : previous);

  return (
    <>
      <main className="workbench" aria-labelledby="learning-title">
        <div className="workbench-heading">
          <div>
            <p className="eyebrow">{props.phase === 'review' ? '回看顺序' : '系统顺序'} · {INTERACTION_LABELS[card.interaction_id]}</p>
            <h1 id="learning-title">{props.phase === 'review' ? '当前回看卡' : '当前学习卡'}</h1>
          </div>
          <span className="counter">{props.currentIndex + 1} / {props.total}</span>
        </div>
        <article className={`learning-card interaction-${card.interaction_id}`}>
          <p className="eyebrow">{card.front.eyebrow}</p>
          <h2>{card.front.prompt}</h2>
          <p className="support">{card.front.support}</p>
          <p className="context">{card.front.context}</p>
          <Interaction
            card={card}
            state={cardState}
            patch={patchState}
            disabled={Boolean(resolved)}
            onResolveFlip={value => props.onResolve({
              ...cardState,
              isFlipped: true,
              flipConfidence: value,
            })}
          />
          {!resolved && card.interaction_id !== 'flip' ? (
            <button className="primary" disabled={!canSubmitLearningCard(card, cardState)} onClick={() => props.onResolve()}>
              提交判断
            </button>
          ) : null}
          {resolved ? (
            <section className={`result-slip ${resultTone(resolved)}`} aria-live="polite">
              <p className="result-label">{resultLabel(resolved)}</p>
              <h3>{card.analysis.title}</h3>
              <p>{card.analysis.summary}</p>
              <p className="exam-tip">考试提示 · {card.analysis.exam_tip}</p>
              <button className="primary" onClick={props.onContinue}>
                {props.currentIndex === props.total - 1 ? '完成本轮' : '继续下一张'}
              </button>
            </section>
          ) : null}
        </article>
      </main>
      <aside className="context-rail" aria-label="当前卡片工具与位置">
        <section>
          <p className="eyebrow">所在位置</p>
          <h2>{card.space_metadata.box}</h2>
          <p>{card.space_metadata.library} / {card.space_metadata.group} / {card.space_metadata.box}</p>
          <button className="secondary" onClick={props.onOpenSpace}>在空间中查看</button>
        </section>
        <section>
          <p className="eyebrow">附着工具</p>
          <button
            className={cardState.isFavorited ? 'tool active' : 'tool'}
            aria-pressed={cardState.isFavorited}
            onClick={() => {
              patchState({isFavorited: !cardState.isFavorited});
              props.onFavorite(card.card_id);
            }}
          >{cardState.isFavorited ? '已标记喜欢' : '标记喜欢'}</button>
          {card.hint_layer ? (
            <button className="tool" aria-expanded={cardState.isHintVisible} onClick={() => patchState({isHintVisible: !cardState.isHintVisible})}>
              {cardState.isHintVisible ? '收起提示' : '查看提示'}
            </button>
          ) : null}
          {cardState.isHintVisible && card.hint_layer ? <p className="attached-note">{card.hint_layer.content}</p> : null}
          {card.audio ? <button className="tool" disabled>卡片音频 · 尚未接入</button> : <p className="muted">这张卡没有附着音频。</p>}
          <p className="shortcut-note">{shortcutLabel(card)}</p>
        </section>
      </aside>
    </>
  );
}

function Interaction({card, state, patch, disabled, onResolveFlip}: {card: LearningCard; state: LearningCardState; patch: (value: Partial<LearningCardState>) => void; disabled: boolean; onResolveFlip: (value: 'confident' | 'review') => void}) {
  switch (card.interaction_id) {
    case 'flip':
      return (
        <div className="interaction flip-panel">
          {!state.isFlipped ? (
            <button className="reveal" disabled={disabled} onClick={() => patch({isFlipped: true})}>翻面看答案</button>
          ) : (
            <>
              <p className="back-text">{card.back_text}</p>
              <div className="confidence" role="group" aria-label="自我评估">
                <button className={state.flipConfidence === 'confident' ? 'confidence-good selected' : 'confidence-good'} aria-pressed={state.flipConfidence === 'confident'} disabled={disabled} onClick={() => onResolveFlip('confident')}>有把握</button>
                <button className={state.flipConfidence === 'review' ? 'confidence-review selected' : 'confidence-review'} aria-pressed={state.flipConfidence === 'review'} disabled={disabled} onClick={() => onResolveFlip('review')}>再回看</button>
              </div>
            </>
          )}
        </div>
      );
    case 'multiple_choice':
      return <div className="interaction choice-grid" role="group" aria-label="四选一选项">{card.options.map(option => <button key={option.id} className={state.selectedOptionId === option.id ? 'choice selected' : 'choice'} aria-pressed={state.selectedOptionId === option.id} disabled={disabled} onClick={() => patch({selectedOptionId: option.id})}><span>{option.label}</span>{option.text}</button>)}</div>;
    case 'lock':
      return <div className="interaction lock-list">{card.lock_slots.map(slot => <label key={slot.id}><span>{slot.label}</span><select disabled={disabled} value={state.lockSelections[slot.id] ?? ''} onChange={event => patch({lockSelections: {...state.lockSelections, [slot.id]: event.target.value}})}><option value="">选择槽位内容</option>{slot.options.map(option => <option key={option}>{option}</option>)}</select></label>)}</div>;
    case 'elimination':
      return <div className="interaction elimination-list" role="group" aria-label="选择要删除的干扰成分">{card.elimination_items.map(item => {const active = state.eliminatedItemIds.includes(item.id); return <button key={item.id} className={active ? 'elimination selected' : 'elimination'} aria-pressed={active} disabled={disabled} onClick={() => patch({eliminatedItemIds: toggle(state.eliminatedItemIds, item.id)})}>{item.text}</button>;})}</div>;
    case 'swipe':
      return <div className="interaction swipe-choices">{card.swipe_states.map((item, index) => <button key={item.id} className={state.swipeSelection === item.id ? 'swipe-choice selected' : 'swipe-choice'} aria-pressed={state.swipeSelection === item.id} disabled={disabled} onClick={() => patch({swipeSelection: item.id})}><span aria-hidden="true">{index === 0 ? '←' : '→'}</span><strong>{item.label}</strong><small>{item.description}</small></button>)}</div>;
  }
}

type SpaceBox = {
  box: string;
  boxRef: string;
  cards: LearningCard[];
  group: string;
  library: string;
};

function SpaceSurface({cards, currentCardId, favorites, sleeping, membership, onFavorite, onSleep, onReturn}: {cards: LearningCard[]; currentCardId: string | null; favorites: string[]; sleeping: string[]; membership: MembershipState; onFavorite: (id: string) => void; onSleep: (id: string) => void; onReturn: () => void}) {
  const boxes = useMemo(() => buildSpaceBoxes(cards), [cards]);
  const currentBoxRef = cards.find(card => card.card_id === currentCardId)?.space_metadata.box_ref;
  const [selectedBoxRef, setSelectedBoxRef] = useState(currentBoxRef ?? boxes[0]?.boxRef ?? '');
  const selectedBox = boxes.find(box => box.boxRef === selectedBoxRef) ?? boxes[0];
  const [selectedId, setSelectedId] = useState(currentCardId ?? selectedBox?.cards[0]?.card_id ?? '');
  const selected = selectedBox?.cards.find(card => card.card_id === selectedId) ?? selectedBox?.cards[0];
  const access = resolveMembershipAccess(membership);
  const libraries = unique(boxes.map(box => box.library));
  const sleepingInSelectedBox = selectedBox?.cards.filter(card => sleeping.includes(card.card_id)).length ?? 0;

  return (
    <>
      <main className="space-workbench" aria-labelledby="space-title">
        <section className="space-tree" aria-label="知识空间层级">
          <p className="eyebrow">空间路径</p><h2>知识空间</h2>
          <ul className="space-library-list">{libraries.map(library => <li key={library}>
            <strong>{library}</strong>
            <ul>{unique(boxes.filter(box => box.library === library).map(box => box.group)).map(group => <li key={`${library}-${group}`}>
              <span>{group}</span>
              <ul>{boxes.filter(box => box.library === library && box.group === group).map(box => <li key={box.boxRef}>
                <button
                  className={box.boxRef === selectedBox?.boxRef ? 'tree-node selected' : 'tree-node'}
                  aria-current={box.boxRef === selectedBox?.boxRef ? 'location' : undefined}
                  onClick={() => {
                    setSelectedBoxRef(box.boxRef);
                    setSelectedId(box.cards[0]?.card_id ?? '');
                  }}
                >{box.box} <small>{box.cards.length} 张</small></button>
              </li>)}</ul>
            </li>)}</ul>
          </li>)}</ul>
        </section>
        <section className="box-object">
          <div className="workbench-heading"><div><p className="eyebrow">{selectedBox ? `${selectedBox.library} / ${selectedBox.group}` : '当前容器'}</p><h1 id="space-title">{selectedBox?.box ?? '当前没有卡盒'}</h1></div><span className="counter">{selectedBox?.cards.length ?? 0} 张</span></div>
          <div className="contained-cards">{selectedBox?.cards.map(card => <button key={card.card_id} className={`${selected?.card_id === card.card_id ? 'contained-card selected' : 'contained-card'} ${sleeping.includes(card.card_id) ? 'sleeping' : ''}`} onClick={() => setSelectedId(card.card_id)}><span>{INTERACTION_LABELS[card.interaction_id]}</span><strong>{card.front.prompt}</strong><small>{favorites.includes(card.card_id) ? '喜欢 · ' : ''}{sleeping.includes(card.card_id) ? '休眠中' : '学习中'}</small></button>)}</div>
          {sleepingInSelectedBox ? <section className="sleep-region"><p className="eyebrow">盒内休眠区</p><p>{sleepingInSelectedBox} 张卡暂时离开学习流，仍归属于“{selectedBox?.box}”。</p></section> : null}
        </section>
      </main>
      <aside className="context-rail inspector" aria-label="所选对象检查器">
        {selected ? <><section><p className="eyebrow">所选卡片</p><h2>{selected.front.prompt}</h2><p>{selected.space_metadata.library} · {selected.space_metadata.group} · {selected.space_metadata.box}</p></section><section><button className="tool" onClick={() => onFavorite(selected.card_id)}>{favorites.includes(selected.card_id) ? '取消喜欢' : '标记喜欢'}</button><button className="tool" onClick={() => onSleep(selected.card_id)}>{sleeping.includes(selected.card_id) ? '唤醒到学习流' : '移入盒内休眠区'}</button><button className="secondary" onClick={onReturn}>回到学习</button></section></> : <p>当前卡盒为空。</p>}
        {!access.completePhysicalSpace ? <section className="membership-note"><p className="eyebrow">当前可见范围</p><h2>当前卡盒保持可用</h2><p>体验结束后保留基础空间；完整书架、卡片库与算法属于会员能力。</p></section> : null}
      </aside>
    </>
  );
}

function StatisticsSurface({results, total}: {results: LearningCardResult[]; total: number}) {
  const summary = summarizeLearningResults(results, total);
  const rows = [
    ['已完成', `${summary.completed} / ${summary.total}`],
    ['自动判定正确', String(summary.autoCorrectCount)],
    ['需要回看', String(summary.autoIncorrectCount + summary.reviewFlipCount)],
    ['使用提示', String(summary.hintUseCount)],
    ['标记喜欢', String(summary.favoriteCount)],
  ];
  return <main className="ledger-workbench"><section className="ledger" aria-labelledby="statistics-title"><p className="eyebrow">今日记录</p><h1 id="statistics-title">学习账页</h1><p className="lede">只记录已经发生的学习，不用成绩环或连续打卡替代掌握。</p><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section></main>;
}

function MineSurface({phone, membership, onLogout}: {phone: string; membership: MembershipState; onLogout: () => void}) {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const stageLabel = {trial_available: '体验待自动开启', trial: '5 天体验中', free: '基础版', premium: '会员'}[membership.stage];
  return <main className="account-workbench"><section className="account-object" aria-labelledby="mine-title">
    <p className="eyebrow">账户对象</p><h1 id="mine-title">{maskPhone(phone)}</h1>
    <div className="account-row"><span>会员状态</span><strong>{stageLabel}</strong></div>
    <div className="account-row"><span>跨端同步</span><strong>尚未连接</strong></div>
    {membership.stage === 'premium' ? <p className="notice">完整卡片库、算法与空间访问已开启。</p> : null}
    <button className="secondary" disabled>购买会员 · 尚未接入</button>
    <button className="tool" disabled>恢复购买 · 尚未接入</button>
    <button className="tool" aria-expanded={showPrivacy} onClick={() => setShowPrivacy(value => !value)}>隐私与账户规则</button>
    {showPrivacy ? <section className="account-policy" aria-label="隐私与账户规则说明"><h2>当前开发构建的账户边界</h2><p>手机号只用于登录流程和账户归属。正式发布前必须接入可访问的服务条款、隐私政策、账户删除与购买恢复能力；未接入的服务不会伪装成可用入口。</p></section> : null}
    <button className="tool danger" disabled>删除账户 · 尚未接入</button>
    <button className="tool danger" onClick={onLogout}>退出登录</button>
  </section></main>;
}

function SessionCompleteSurface({phase, results, total, onOpenSpace, onRestart, onStartReview}: {phase: 'learning' | 'review'; results: LearningCardResult[]; total: number; onOpenSpace: () => void; onRestart: () => void; onStartReview: () => void}) {
  const summary = summarizeLearningResults(results, total);
  const reviewCount = results.filter(result => result.outcome === 'incorrect' || result.outcome === 'review').length;
  return <main className="completion-workbench"><section className="completion-object" aria-labelledby="session-complete-title">
    <p className="eyebrow">{phase === 'review' ? '回看完成' : '本轮完成'}</p>
    <h1 id="session-complete-title">这一轮到这里</h1>
    <p className="lede">已经完成 {summary.completed} 张。需要再看的内容仍保留在原卡盒，可在本轮结束后集中回看。</p>
    <div className="completion-summary" aria-label="本轮摘要"><span>完成 <strong>{summary.completed}</strong></span><span>待回看 <strong>{reviewCount}</strong></span></div>
    {phase === 'learning' && reviewCount > 0 ? <button className="primary" onClick={onStartReview}>开始回看 {reviewCount} 张</button> : null}
    <button className="secondary" onClick={onOpenSpace}>查看这些卡的位置</button>
    <button className="tool" onClick={onRestart}>重新开始完整一轮</button>
  </section></main>;
}

function maskPhone(phone: string) {
  return phone.length === 11 ? `${phone.slice(0, 3)} **** ${phone.slice(-4)}` : '已验证账户';
}

function toggle(items: string[], id: string) {
  return items.includes(id) ? items.filter(item => item !== id) : [...items, id];
}

function unique(items: string[]) {
  return [...new Set(items)];
}

function withFavoriteState(card: LearningCard, favorites: string[]) {
  const state = createLearningCardState(card);
  state.isFavorited = favorites.includes(card.card_id);
  return state;
}

function buildSpaceBoxes(cards: LearningCard[]): SpaceBox[] {
  const boxes = new Map<string, SpaceBox>();
  cards.forEach(card => {
    const metadata = card.space_metadata;
    const existing = boxes.get(metadata.box_ref);
    if (existing) {
      existing.cards.push(card);
      return;
    }
    boxes.set(metadata.box_ref, {
      box: metadata.box,
      boxRef: metadata.box_ref,
      cards: [card],
      group: metadata.group,
      library: metadata.library,
    });
  });
  return [...boxes.values()];
}

function resultTone(result: LearningCardResult) {
  return result.outcome === 'correct' || result.outcome === 'confident' ? 'good' : 'review';
}

function resultLabel(result: LearningCardResult) {
  const labels: Record<LearningCardResult['outcome'], string> = {correct: '判断正确', incorrect: '这张需要回看', confident: '已记为有把握', review: '已加入回看'};
  return labels[result.outcome];
}

function shortcutLabel(card: LearningCard) {
  switch (card.interaction_id) {
    case 'flip': return '键盘：Enter 翻面';
    case 'multiple_choice': return '键盘：1–4 选择';
    case 'lock': return '键盘：Tab 逐槽选择';
    case 'elimination': return '键盘：Tab + Space 切换删除';
    case 'swipe': return '键盘：← / → 选择方向';
  }
}
