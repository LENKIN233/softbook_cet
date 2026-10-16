import {CardText} from './CardText';
import {createLearningCardState} from '../../mobile/src/learning/sessionCore';
import {StudioAudio} from './StudioAudio';
import {useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent} from 'react';
import {type LearningCard, INTERACTION_LABELS} from '../../mobile/src/learning/model';
import {displayCardText, spaceCardPreview, answerComparison, cardRecallOptions, spaceSearchSummary} from '../../mobile/src/learning/presentation';
import {filterSpaceCards, type SpaceCardFilter} from '../../mobile/src/space/cardFilters';
import {resolveMembershipAccess, type MembershipState} from '../../mobile/src/membership/localMembership';
import {formatSpaceDisplayName} from '../../mobile/src/shared/uiMetadata/displayMetadata';
import {resolveLibraryTone} from '../../mobile/src/visual/tokens';
import {transitionObjectName} from './motion';
import './spaceSurface.css';
import {StudioIcon, IconLabel, DisclosureLabel} from './StudioIcon';

type SpaceBox = {box: string; boxRef: string; cards: LearningCard[]; group: string; library: string};
const summaryStyle: CSSProperties = {display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden'};
const excerptStyle: CSSProperties = {...summaryStyle, WebkitLineClamp: 3};
export type SpaceBrowseState = {selection: {boxRef: string; cardId: string} | null; filter: SpaceCardFilter; query: string; scrollY?: number; openSections?: string[]; answerCardId?: string | null; filterLimit?: number};
export type SpaceSurfaceProps = {
  learnedIds?: string[]; browseState?: SpaceBrowseState; onBrowseStateChange?: (state: SpaceBrowseState) => void;
  audioStatus?: 'idle' | 'loading' | 'paused' | 'playing' | 'ready' | 'error'; onPlayCardAudio?: (id: string) => void; readAudioPosition?: () => number | null | Promise<number | null>; onSeekAudio?: (ms: number) => void; onStopAudio?: () => void;
  busy: boolean; cards: LearningCard[]; canMutate: boolean; currentCardId: string | null;
  pendingReviewIds: string[]; favorites: string[]; sleeping: string[]; membership: MembershipState;
  onFavorite: (id: string) => void; onSleep: (id: string) => void; onReturn: () => void;
  statusMessage: string; syncStatus: string;
};

export function SpaceSurface({busy, cards, canMutate, currentCardId, pendingReviewIds, favorites, sleeping, membership, onFavorite, onSleep, onReturn, statusMessage, syncStatus, learnedIds = [], browseState, onBrowseStateChange, audioStatus = 'idle', onPlayCardAudio, readAudioPosition, onSeekAudio, onStopAudio}: SpaceSurfaceProps) {
  const [filter, setFilter] = useState<SpaceCardFilter>(browseState?.filter ?? 'all');
  const [filterLimit, setFilterLimit] = useState(browseState?.filterLimit ?? 40);
  const [selection, setSelection] = useState<{boxRef: string; cardId: string} | null>(browseState?.selection ?? null);
  const [query, setQuery] = useState(browseState?.query ?? '');
  const [answerCardId, setAnswerCardId] = useState<string | null>(browseState?.answerCardId ?? null);
  const [openSections, setOpenSections] = useState<string[]>(browseState?.openSections ?? []);
  const scrollY = useRef(browseState?.scrollY ?? 0);
  const save = useRef(() => {});
  useLayoutEffect(() => {
    save.current = () => onBrowseStateChange?.({selection, filter, query, openSections, answerCardId, filterLimit, scrollY: scrollY.current});
    save.current();
  }, [selection, filter, query, openSections, answerCardId, filterLimit, onBrowseStateChange]);
  useLayoutEffect(() => {
    const target = scrollY.current;
    window.scrollTo({top: target, behavior: 'instant'});
    const frame = requestAnimationFrame(() => window.scrollTo({top: target, behavior: 'instant'}));
    const rememberScroll = () => {scrollY.current = Math.max(0, window.scrollY); save.current();};
    window.addEventListener('scroll', rememberScroll, {passive: true});
    return () => {cancelAnimationFrame(frame); window.removeEventListener('scroll', rememberScroll);};
  }, []);
  const sectionProps = (key: string) => ({open: openSections.includes(key), onToggle: (event: SyntheticEvent<HTMLDetailsElement>) => {
    const open = event.currentTarget.open;
    setOpenSections(value => value.includes(key) === open ? value : open ? [...value, key] : value.filter(item => item !== key));
  }});
  const boxTray = useRef<HTMLElement>(null);
  const boxes = useMemo(() => buildSpaceBoxes(cards), [cards]);
  const currentBox = boxes.find(box => box.cards.some(card => card.card_id === currentCardId));
  const selectedBox = boxes.find(box => box.boxRef === selection?.boxRef) ?? currentBox ?? boxes[0];
  const selected = selectedBox?.cards.find(card => card.card_id === (selection?.cardId ?? currentCardId)) ?? selectedBox?.cards[0];
  useEffect(() => () => onStopAudio?.(), [selected?.card_id, onStopAudio]);
  const currentBoxIsSelected = selectedBox?.boxRef === currentBox?.boxRef;
  const matches = filterSpaceCards(cards, filter, favorites, pendingReviewIds, sleeping, query);
  const filterEmptyMessage = query.trim() ? '没有找到匹配的卡片，试试其他关键词。' : filter === 'favorites' ? '还没有收藏的卡片。学习时点击 ☆，就能在这里找到它。' : filter === 'sleeping' ? '目前没有暂停的卡片。暂停后仍保留在原卡盒，可随时恢复。' : '目前没有待复习的卡片。';
  const libraries = [...new Set(boxes.map(box => box.library))];
  const groups = [...new Set(boxes.filter(box => box.library === selectedBox?.library).map(box => box.group))];
  const neighbors = boxes.filter(box => box.library === selectedBox?.library && box.group === selectedBox?.group && box !== selectedBox);
  const otherActiveCards = selectedBox?.cards.filter(card => card !== selected && !sleeping.includes(card.card_id)) ?? [];
  const sleepingCards = selectedBox?.cards.filter(card => sleeping.includes(card.card_id)) ?? [];
  const tone = resolveLibraryTone(selectedBox?.library);
  const focusBox = () => requestAnimationFrame(() => {boxTray.current?.scrollIntoView?.({block: 'start'}); boxTray.current?.focus({preventScroll: true});});
  const selectCard = (card: LearningCard) => {setSelection({boxRef: card.space_metadata.box_ref, cardId: card.card_id}); focusBox();};
  const selectBox = (box: SpaceBox) => {const card = box.cards.find(item => item.card_id === currentCardId) ?? box.cards[0]; if (card) selectCard(card);};
  const returnToCurrent = () => {setSelection(null); focusBox();};
  const renderCard = (card: LearningCard) => {
    const isSelected = selected?.card_id === card.card_id;
    const isCurrent = card.card_id === currentCardId;
    const isSleeping = sleeping.includes(card.card_id);
    const preview = spaceCardPreview(card);
    const originalOptions = cardRecallOptions(card);
    return <div className="space-card-object" key={card.card_id}>
      <button className={`${isSelected ? 'contained-card selected' : 'contained-card'}${isSleeping ? ' sleeping' : ''}`} aria-pressed={isSelected} data-learning-current={isCurrent || undefined}
        style={{'--learning-object': transitionObjectName(card.card_id)} as CSSProperties} onClick={() => selectCard(card)}>
        <span className="contained-card-kind">{INTERACTION_LABELS[card.interaction_id]}{isCurrent ? ' · 正在学习' : ''}</span><strong>{<CardText text={isSelected ? displayCardText(card, card.front.prompt) : preview.title} />}</strong>
        {isSelected ? preview.detail.map(text => <span className="card-preview-material" key={text}>{text}</span>) : null}
        <span className="contained-card-tags"><small>{learnedIds.includes(card.card_id) ? '已学过' : '未学习'}</small>{favorites.includes(card.card_id) ? <small className="favorite-tag">已收藏</small> : null}{isSleeping ? <small>休眠中</small> : null}</span>
      </button>
      {isSelected && learnedIds.includes(card.card_id) ? <div className="space-learned-answer"><button className="text-button" aria-expanded={answerCardId === card.card_id} onClick={() => {if (answerCardId === card.card_id) onStopAudio?.(); setAnswerCardId(value => value === card.card_id ? null : card.card_id);}}><IconLabel name="book">{answerCardId === card.card_id ? '收起答案与解析' : '回看答案与解析'}</IconLabel></button>{answerCardId === card.card_id ? <section className="space-answer-content" aria-label="已学卡答案与解析">{card.audio && onPlayCardAudio ? <StudioAudio status={audioStatus} durationMs={card.audio.duration_ms} disabled={busy} onPlay={() => onPlayCardAudio(card.card_id)} readPosition={readAudioPosition} onSeek={onSeekAudio} onRestart={() => {onSeekAudio?.(0); if (audioStatus !== 'playing') onPlayCardAudio(card.card_id);}}/> : null}{originalOptions.length > 0 ? <div role="group" aria-label="原题选项"><h3>原题选项</h3>{originalOptions.map((option, index) => <p key={index}>{option}</p>)}</div> : null}<h3>{card.interaction_id === 'elimination' ? '应删除的部分' : '答案'}</h3><p>{<CardText text={displayCardText(card, answerComparison(card, createLearningCardState(card)).correct)} />}</p><p>{<CardText text={displayCardText(card, card.analysis.summary)} />}</p><p>{<CardText text={displayCardText(card, card.analysis.exam_tip)} />}</p></section> : null}</div> : null}
      {isSelected ? <div className="object-actions" aria-label="所选卡片操作"><button className="text-button" aria-pressed={favorites.includes(card.card_id)} disabled={busy || !canMutate} onClick={() => onFavorite(card.card_id)}><IconLabel name="star">{favorites.includes(card.card_id) ? '取消收藏' : '收藏'}</IconLabel>{favorites.includes(card.card_id) ? <StudioIcon name="check" /> : null}</button><button className="text-button" aria-pressed={isSleeping} disabled={busy || !canMutate} onClick={() => onSleep(card.card_id)}><IconLabel name={isSleeping ? 'sun' : 'moon'}>{isSleeping ? '恢复学习' : '暂不学习这张卡'}</IconLabel></button></div> : null}
    </div>;
  };
  return <main className="space-workbench space-current-first" style={{'--hall': tone.accent, '--hall-action': tone.accentStrong, '--hall-soft': tone.accentSoft, '--hall-deep': tone.accentStrong} as CSSProperties} aria-labelledby="space-title">
    <section ref={boxTray} tabIndex={-1} className="box-tray" aria-label={`当前卡盒 ${selectedBox?.box ?? '暂无'}`}>
      <div className="workbench-heading"><div aria-label="当前卡片位置"><p className="eyebrow"><span>{selected?.track === 'cet6' ? '六级' : '四级'} · {selectedBox?.library}</span> / <span>{selectedBox?.group}</span></p><h1 id="space-title">{selectedBox?.box ?? '当前没有卡盒'}</h1></div><span className="counter">{selectedBox?.cards.length ?? 0} 张</span></div>
      {selected ? <div className="space-focused-card" aria-label="正在查看的卡片">{renderCard(selected)}</div> : <p className="muted">这里还没有卡片，可以先返回学习。</p>}
      <div className="space-current-actions">{currentBox && (!currentBoxIsSelected || selected?.card_id !== currentCardId) ? <button className="text-button" onClick={returnToCurrent}><IconLabel name="folder">回到当前卡盒</IconLabel></button> : null}<button className="primary" onClick={onReturn}><IconLabel name="arrowLeft">返回学习</IconLabel></button></div>
      {statusMessage ? <p className="notice error" role="alert">{statusMessage}</p> : null}
      {!['已保存在本机', '已同步', ''].includes(syncStatus) ? <p className="notice" role="status">空间设置 · {syncStatus}</p> : null}
      {otherActiveCards.length ? <details className="space-box-rest" {...sectionProps(`${selectedBox?.boxRef}:rest`)}><summary><DisclosureLabel name="list">查看盒内其他卡片 · {otherActiveCards.length} 张</DisclosureLabel></summary><div className="contained-cards" aria-label="盒内其他卡片">{otherActiveCards.map(renderCard)}</div></details> : null}
      <details className="space-sleep-details" {...sectionProps(`${selectedBox?.boxRef}:sleep`)}><summary><DisclosureLabel name="moon">休眠区 · {sleepingCards.length ? `${sleepingCards.length} 张` : '暂无休眠'}</DisclosureLabel></summary><section className="sleep-region" aria-label="盒内休眠区"><p className="muted">休眠的卡片暂时离开学习流，仍保留在这个盒中。恢复后可继续学习。</p><div className="contained-cards">{sleepingCards.filter(card => card !== selected).map(renderCard)}</div></section></details>
    </section>
    {neighbors.length ? <section className="space-neighbors" aria-label="本组其他卡盒"><h2>本组其他卡盒</h2><div>{neighbors.map(box => <button className="text-button" key={box.boxRef} onClick={() => selectBox(box)}>{box.box}<small>已学 {box.cards.filter(card => learnedIds.includes(card.card_id)).length} / {box.cards.length}</small></button>)}</div></section> : null}
    <details className="space-browser" {...sectionProps('browser')}><summary><DisclosureLabel name="grid">浏览与查找卡片</DisclosureLabel></summary>
      <p className="space-filter-scope">筛选当前科目全部卡盒，卡片保留原来的位置。</p>
      <div className="space-filters" role="group" aria-label="卡片筛选">{([['all', '全部卡片'], ['favorites', '只看收藏'], ['review', '只看待复习'], ['sleeping', '已暂停']] as const).map(([value, label]) => <button key={value} className="text-button" aria-pressed={filter === value} onClick={() => {setFilter(value); setFilterLimit(40);}}><IconLabel name={value === 'all' ? 'grid' : value === 'favorites' ? 'star' : value === 'sleeping' ? 'moon' : 'refresh'}>{label}</IconLabel>{filter === value ? <StudioIcon name="check" /> : null}</button>)}</div>
      <label className="space-search"><StudioIcon name="search"/>查找卡片<input aria-label="查找卡片" value={query} placeholder="题目关键词或卡盒名称" onChange={event => {setQuery(event.target.value); setFilterLimit(40);}}/></label>
      {filter !== 'all' || query.trim() ? <section className="filtered-cards" aria-label="筛选结果"><div className="space-filter-summary"><strong>{query.trim() ? '查找结果' : filter === 'favorites' ? '只看收藏' : filter === 'sleeping' ? '已暂停' : '只看待复习'}</strong><button className="text-button" onClick={() => {setFilter('all'); setQuery('');}}><IconLabel name="close">清除筛选</IconLabel></button></div>
        {matches.length ? <p className="muted" role="status">{matches.length} 张卡片</p> : null}
        {!matches.length ? <div className="space-empty-actions"><StudioIcon name={filter === 'favorites' ? 'star' : filter === 'sleeping' ? 'moon' : 'book'} size={40}/><p className="muted" role="status">{filterEmptyMessage}</p><button className="primary" onClick={query.trim() ? () => setQuery('') : onReturn}>{query.trim() ? '清除搜索' : '去学习'}</button></div> : null}
        {matches.slice(0, filterLimit).map(card => {
          const summary = spaceSearchSummary(card, query);
          return <button className="filtered-card" key={card.card_id} onClick={() => selectCard(card)}><span className="muted">{[card.space_metadata.library, card.space_metadata.group, card.space_metadata.box].map(name => formatSpaceDisplayName(name, '')).join(' / ')}</span><strong style={summaryStyle}>{summary.title}</strong>{summary.excerpt ? <span className="muted" style={excerptStyle}>{summary.excerpt}</span> : null}<small>{learnedIds.includes(card.card_id) ? '已学过' : '未学习'}</small>{card.card_id === currentCardId ? <small>正在学习</small> : null}</button>;
        })}
        {matches.length > filterLimit ? <button className="text-button" onClick={() => setFilterLimit(value => value + 40)}><IconLabel name="chevronDown">显示更多</IconLabel></button> : null}
      </section> : <section className="shelf-map" aria-label="知识空间层级">
        <div className="library-tabs" aria-label="书架">{libraries.map(library => <button key={library} className={selectedBox?.library === library ? 'library-tab selected' : 'library-tab'} aria-pressed={selectedBox?.library === library} onClick={() => {const first = boxes.find(box => box.library === library); if (first) selectBox(first);}}><span style={{backgroundColor: resolveLibraryTone(library).accent}} />{library}{selectedBox?.library === library ? <StudioIcon name="check" /> : null}</button>)}</div>
        <div className="space-group-tabs" aria-label="书架分区">{groups.map(group => <button key={group} aria-pressed={selectedBox?.group === group} onClick={() => {const first = boxes.find(box => box.library === selectedBox?.library && box.group === group); if (first) selectBox(first);}}><IconLabel name="folder">{group}</IconLabel>{selectedBox?.group === group ? <StudioIcon name="check" /> : null}</button>)}</div>
        <div className="sibling-boxes">{boxes.filter(box => box.library === selectedBox?.library && box.group === selectedBox?.group).map(box => <button key={box.boxRef} className={box === selectedBox ? 'shelf-box selected' : 'shelf-box'} aria-label={`${box.box} ${box.cards.length} 张`} aria-current={box === selectedBox ? 'location' : undefined} onClick={() => selectBox(box)}><span className="shelf-box-title"><StudioIcon name="folder" /><strong>{box.box}</strong></span><small>已学 {box.cards.filter(card => learnedIds.includes(card.card_id)).length} / {box.cards.length}</small>{box === selectedBox ? <span className="shelf-box-selected"><IconLabel name="checkCircle">当前卡盒</IconLabel></span> : null}</button>)}</div>
      </section>}
    </details>
    {!resolveMembershipAccess(membership).completePhysicalSpace ? <p className="membership-note">你可以学习已解锁的卡片，会员可查看全部内容。</p> : null}
  </main>;
}

function buildSpaceBoxes(cards: LearningCard[]): SpaceBox[] {
  const boxes = new Map<string, SpaceBox>();
  for (const card of cards) {
    const metadata = card.space_metadata;
    const existing = boxes.get(metadata.box_ref);
    if (existing) {existing.cards.push(card); continue;}
    boxes.set(metadata.box_ref, {box: formatSpaceDisplayName(metadata.box, '当前卡盒'), boxRef: metadata.box_ref, cards: [card], group: formatSpaceDisplayName(metadata.group, '当前分区'), library: formatSpaceDisplayName(metadata.library, '当前书架')});
  }
  return [...boxes.values()];
}
