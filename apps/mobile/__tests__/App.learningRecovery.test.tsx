import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';
import {AppState} from 'react-native';
import App from '../App';
import {LearningSurface} from '../src/learning/LearningSurface';
import {LearningEventOutbox} from '../src/sync/learningEventOutbox';
import {createReactNativeLearningEventOutboxStorage} from '../src/sync/learningEventOutboxStorage.native';
import type {LearningAudioSelection, RefreshLearningAudioDownload} from '../src/audio/learningAudioController';
import {createLocalLearningSession} from '../src/learning/session';
import {createSoftbookRemoteRuntimeConfig} from '../src/runtime/appRuntimeConfig';
import {getChinaDayKey} from '../src/shared/chinaDay';
import type {LearningCard, LearningSession} from '../src/learning/model';

const TEST_CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;
const mockLoadSession = jest.fn();
const mockRefreshAudioDownload = jest.fn();
jest.mock('../src/learning/learningRepository', () => ({
  createLearningSessionRepository: () => ({loadSession: mockLoadSession, refreshAudioDownload: mockRefreshAudioDownload, continueRound: jest.fn()}),
}));
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react'); const {View} = require('react-native');
  return {SafeAreaProvider: ({children}: {children: React.ReactNode}) => mockReact.createElement(View, null, children),
    SafeAreaView: ({children}: {children: React.ReactNode}) => mockReact.createElement(View, null, children)};
});
type MockLearningEvent = {answer_grade:'passed'|'review_needed'; card_id:string; client_occurred_at:string;
  interaction_id:LearningCard['interaction_id'];outcome:'correct'|'incorrect'|'confident'|'review';phase:'learning'|'review'; used_hint:boolean;used_peek:boolean};
type SpaceWireState = {card_id:string;is_favorited:boolean;is_sleeping:boolean;last_modified_at:string};
const originalFetch = global.fetch;
const originalAppState=AppState.currentState;
const trees: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  for (const tree of trees.splice(0)) act(() => tree.unmount());
  global.fetch = originalFetch;
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = undefined;
  jest.restoreAllMocks();
  Object.defineProperty(AppState,'currentState',{value:originalAppState,writable:true,configurable:true});
});
beforeEach(() => {mockLoadSession.mockReset();mockRefreshAudioDownload.mockReset();Object.defineProperty(AppState,'currentState',{value:'active',writable:true,configurable:true});});

async function settle() {
  for(let i=0;i<8;i++) await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
}
async function press(root:ReactTestRenderer.ReactTestInstance,id:string) {
  await act(async()=>{root.findByProps({testID:id}).props.onPress();await Promise.resolve();});
}
async function login() {
  let tree!:ReactTestRenderer.ReactTestRenderer;
  await act(async()=>{tree=ReactTestRenderer.create(<App/>)}); trees.push(tree);
  const root=tree.root;
  await act(()=>root.findByProps({testID:'auth-phone-input'}).props.onChangeText('13800138000'));
  await press(root,'auth-request-code-button'); await settle();
  await act(()=>root.findByProps({testID:'auth-code-input'}).props.onChangeText('2468'));
  await press(root,'auth-submit-button'); await settle();
  return {tree,root};
}
async function inspectSpace(root:ReactTestRenderer.ReactTestInstance) {
  await press(root,'route-tab-space'); await settle();
  await press(root,'space-open-card-list');
}
function createRuntime() {
  const base={...createLocalLearningSession('cet4'),contentVersion:TEST_CONTENT_VERSION,membershipStage:'premium' as const};
  let selectedId:string|null=base.catalogCards[0].card_id;
  let selectionId='sel_recovery_first_selection';
  let nextDueAt:string|null=null;
  let phase:'learning'|'review'='learning';
  let spaceRevision=0;
  let sessionRevision=0;
  let online=true;
  let spaceStates:SpaceWireState[]=[];
  let nextServerCardId=base.catalogCards.at(-1)!.card_id;
  let loadsFail=false;
  let bootstrapReads=0;
  let eventFailure:string|null=null;
  const completedEvents:MockLearningEvent[]=[];
  mockLoadSession.mockImplementation(async()=>{
    if(loadsFail) throw new Error('Session unavailable');
    const selected=base.catalogCards.find(card=>card.card_id===selectedId);
    return {...base,cards:selected?[selected]:[],schedulingMode:'server',nextDueAt,serverSelection:selected?{
      cardId:selected.card_id,dueAt:null,phase,reason:phase==='review'?'due_review':'catalog_new',selectionId,
    }:null};
  });
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__=createSoftbookRemoteRuntimeConfig({baseUrl:'https://api.softbook.example',featureModes:{contentManifest:'local'}});
  const requests=jest.fn(async(input:string,init?:{body?:string})=>{
    if(input.endsWith('/v2/auth/request-code')) return createRemoteAuthChallengeResponse();
    if(input.endsWith('/v2/auth/verify-code')) return createRemoteAuthSessionResponse();
    if(input.includes('/v2/bootstrap?')) {
      bootstrapReads++;
      const p=createAccountBootstrapPayload(base,'premium',completedEvents);
      p.data.component_revisions.space.state_revision=spaceRevision;
      p.data.component_revisions.learning.space_revision=spaceRevision;
      p.data.component_revisions.learning.session_revision=sessionRevision;
      p.data.component_revisions.progress.space_revision=spaceRevision;
      p.data.space.states=spaceStates as never[];
      p.data.progress.favorite_count=spaceStates.filter(state=>state.is_favorited).length;
      p.data.progress.sleeping_count=spaceStates.filter(state=>state.is_sleeping).length;
      return createJsonResponse(p);
    }
    if(input.endsWith('/v2/space/actions')) {
      if(!online) return createJsonResponse({},503);
      const request=JSON.parse(init!.body!);
      for(const action of request.actions) {
        const state=spaceStates.find(item=>item.card_id===action.card_id)??{card_id:action.card_id,is_favorited:false,is_sleeping:false,last_modified_at:action.client_occurred_at};
        if(action.dimension==='favorite') state.is_favorited=action.value; else state.is_sleeping=action.value;
        state.last_modified_at=action.client_occurred_at;
        spaceStates=[...spaceStates.filter(item=>item.card_id!==state.card_id),state].sort((a,b)=>a.card_id.localeCompare(b.card_id));
        if(action.dimension==='sleep' && (selectedId===action.card_id || selectedId===null)) {
          selectedId=action.value?nextServerCardId:action.card_id;
          selectionId=`sel_recovery_sleep_${spaceRevision+1}`;
        }
        spaceRevision++;
      }
      return createJsonResponse({data:{schema_version:'space-actions-ack.v2',acknowledged_at:new Date().toISOString(),track:'cet4',content_version:TEST_CONTENT_VERSION,
        results:request.actions.map((action:{action_id:string})=>({action_id:action.action_id,status:'applied'})),
        space_state:{schema_version:'space-state.v2',acknowledged_at:new Date().toISOString(),track:'cet4',content_version:TEST_CONTENT_VERSION,states:spaceStates}}});
    }
    if(input.endsWith('/v2/learning/events')) {
      if(eventFailure) return createJsonResponse({error:{code:eventFailure,message:'Explicit server rejection'}},409);
      throw new Error('This recovery must not synthesize a completion');
    }
    throw new Error(`Unexpected request: ${input}`);
  });
  global.fetch=requests as unknown as typeof fetch;
  return {base,requests, getBootstrapReads:()=>bootstrapReads,
    bumpSessionRevision:()=>{sessionRevision++},
    addAudio:()=>{
      const card={...base.catalogCards[0],audio:{asset_id:'audio_recovery_0001',sha256:`sha256:${'c'.repeat(64)}`,duration_ms:1000}};
      base.catalogCards[0]=card;base.cards[0]=card;
    },
    rejectEvents:(code:string)=>{eventFailure=code},
    setContentVersion:(version:string)=>{base.contentVersion=version},
    setPhase:(value:'learning'|'review')=>{phase=value},
    setOnline:(value:boolean)=>{online=value}, setLoadsFail:(value:boolean)=>{loadsFail=value},
    setNextServerCard:(id:string)=>{nextServerCardId=id},
    setSelection:(id:string|null)=>{selectedId=id;selectionId=`sel_recovery_revision_${++sessionRevision}`},
    setEmpty:(dueAt:string|null)=>{selectedId=null;nextDueAt=dueAt},
    setSleeping:(id:string)=>{spaceStates=[{card_id:id,is_favorited:false,is_sleeping:true,last_modified_at:new Date().toISOString()}];spaceRevision++},
  };
}


test.each([false,true])('keeps the same server attempt and sticky help through another card favorite (resolved=%s)',async resolved=>{
  const runtime=createRuntime(); const {root}=await login();
  await press(root,'learning-peek-button'); await press(root,'learning-peek-button');
  await press(root,'learning-flip-button');
  if(resolved) await press(root,'learning-flip-confident-button');
  await inspectSpace(root); await press(root,'space-card-next');
  await press(root,'space-favorite-2'); await settle();
  await press(root,'space-return-learning');
  expect(root.findAllByProps({testID:'learning-flip-button'})).toHaveLength(0);
  expect(root.findByProps({testID:resolved?'learning-result-summary':'learning-flip-confident-button'})).toBeTruthy();
  expect(mockLoadSession).toHaveBeenCalledTimes(1);
  expect(runtime.getBootstrapReads()).toBeGreaterThan(1);
  if(!resolved) await press(root,'learning-flip-confident-button');
  expect(root.findByType(LearningSurface).props.currentResult.usedPeek).toBe(true);
});

test('replaces a slept current card only with the next server selection',async()=>{
  const runtime=createRuntime(); const expected=runtime.base.catalogCards.at(-1)!;
  const {root,tree}=await login(); await inspectSpace(root);
  await press(root,'space-sleep-1'); await settle();
  await press(root,'space-return-learning');
  expect(mockLoadSession).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(tree.toJSON())).toContain(expected.front.prompt);
  expect(JSON.stringify(tree.toJSON())).not.toContain(runtime.base.cards[0].front.prompt);
  expect(root.findAllByProps({testID:'learning-empty-session'})).toHaveLength(0);
});

test('sleeping another card preserves the server review phase and current answer',async()=>{
  const runtime=createRuntime();runtime.setPhase('review');const {root}=await login();
  await press(root,'learning-flip-button');await press(root,'learning-flip-confident-button');
  await inspectSpace(root);await press(root,'space-card-next');await press(root,'space-sleep-2');await settle();
  await press(root,'space-return-learning');
  const surface=root.findByType(LearningSurface).props;
  expect(surface.phase).toBe('review');
  expect(surface.currentResult?.outcome).toBe('confident');
  expect(surface.currentCardState.isFlipped).toBe(true);
  expect(mockLoadSession).toHaveBeenCalledTimes(1);
});

test('hides a durable offline sleep without inventing a next card, then recovers on reconnect',async()=>{
  const runtime=createRuntime(); runtime.setOnline(false);
  jest.spyOn(console,'warn').mockImplementation(()=>undefined);
  const {root,tree}=await login(); await inspectSpace(root);
  await press(root,'space-sleep-1'); await settle(); await press(root,'space-return-learning');
  expect(root.findByProps({testID:'learning-empty-session'})).toBeTruthy();
  expect(JSON.stringify(tree.toJSON())).toContain('这张卡已放入休眠');
  expect(JSON.stringify(tree.toJSON())).not.toContain(runtime.base.cards[0].front.prompt);
  expect(mockLoadSession).toHaveBeenCalledTimes(1);
  runtime.setOnline(true);
  const {emitNetInfoState}=jest.requireMock('@react-native-community/netinfo');
  await act(()=>{emitNetInfoState({isConnected:false,isInternetReachable:false});emitNetInfoState({isConnected:true,isInternetReachable:true})});
  await settle();
  expect(mockLoadSession).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(tree.toJSON())).toContain(runtime.base.catalogCards.at(-1)!.front.prompt);
});

test('preserves server null and due time, and manually re-reads instead of restarting local cards',async()=>{
  const runtime=createRuntime(); runtime.setEmpty('2099-09-12T08:30:00.000Z');
  const {root,tree}=await login();
  expect(root.findByProps({testID:'learning-next-due-at'})).toBeTruthy();
  expect(JSON.stringify(tree.toJSON())).toContain('9月12日 16:30');
  expect(JSON.stringify(tree.toJSON())).not.toContain('完成 0 张');
  expect(root.findAllByProps({testID:'learning-restart-button'})).toHaveLength(0);
  await press(root,'learning-refresh-session-button'); await settle();
  expect(mockLoadSession).toHaveBeenCalledTimes(2);
  expect(root.findByProps({testID:'learning-empty-session'})).toBeTruthy();
  runtime.setSelection(runtime.base.catalogCards.at(-1)!.card_id);
  await press(root,'learning-refresh-session-button'); await settle();
  expect(mockLoadSession).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(tree.toJSON())).toContain(runtime.base.catalogCards.at(-1)!.front.prompt);
});

test('due timer rechecks an empty session once and does not loop on an unchanged overdue answer',async()=>{
  const runtime=createRuntime(); runtime.setEmpty(new Date(Date.now()-1000).toISOString());
  const {root}=await login(); await settle();
  expect(mockLoadSession).toHaveBeenCalledTimes(2);
  expect(root.findByProps({testID:'learning-empty-session'})).toBeTruthy();
  await settle(); expect(mockLoadSession).toHaveBeenCalledTimes(2);
});

test('an empty session resumes on foreground and still obeys the returned null',async()=>{
  const listeners:Array<(state:string)=>void>=[];
  jest.spyOn(AppState,'addEventListener').mockImplementation((_name,listener)=>{
    listeners.push(listener as (state:string)=>void);return {remove:jest.fn()};
  });
  const runtime=createRuntime();runtime.setEmpty(null);
  const {root}=await login();
  await act(()=>{listeners.forEach(listener=>listener('background'));listeners.forEach(listener=>listener('active'))});
  await settle();
  expect(mockLoadSession).toHaveBeenCalledTimes(2);
  expect(root.findByProps({testID:'learning-empty-session'})).toBeTruthy();
});

test('waking a card from an empty session re-reads the server and makes that selection usable',async()=>{
  const runtime=createRuntime();runtime.setEmpty(null);runtime.setSleeping(runtime.base.cards[0].card_id);
  const {root,tree}=await login();
  await press(root,'learning-empty-open-space-button');await settle();await press(root,'space-open-card-list');
  await press(root,'space-sleep-1');await settle();await press(root,'space-return-learning');
  expect(mockLoadSession).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(tree.toJSON())).toContain(runtime.base.cards[0].front.prompt);
});

test('empty-session refresh failures expose retry without a fake completed round',async()=>{
  const runtime=createRuntime();runtime.setEmpty(null);const {root,tree}=await login();
  runtime.setLoadsFail(true);await press(root,'learning-refresh-session-button');await settle();
  expect(root.findByProps({testID:'learning-bootstrap-retry-button'})).toBeTruthy();
  expect(JSON.stringify(tree.toJSON())).not.toContain('完成 0 张');
  runtime.setLoadsFail(false);runtime.setSelection(runtime.base.cards[0].card_id);
  await press(root,'learning-bootstrap-retry-button');await settle();
  expect(root.findByProps({testID:'learning-flip-button'})).toBeTruthy();
});

async function failAttemptRefresh(runtime: ReturnType<typeof createRuntime>, root: ReactTestRenderer.ReactTestInstance) {
  runtime.bumpSessionRevision();
  runtime.setLoadsFail(true);
  await inspectSpace(root);
  await press(root,'space-card-next');
  const favoriteButton=root.findAll(node=>
    typeof node.props.testID==='string' && /^space-favorite-\d+$/.test(node.props.testID),
  )[0];
  await press(root,favoriteButton.props.testID);
  await settle();
  await press(root,'space-return-learning');
  expect(root.findByProps({testID:'learning-bootstrap-retry-button'})).toBeTruthy();
}

test.each([false,true])('preserves the same assisted attempt through failed refresh and retry (resolved=%s)',async resolved=>{
  const runtime=createRuntime();const {root}=await login();
  await press(root,'learning-peek-button');await press(root,'learning-peek-button');
  await press(root,'learning-hint-button');await press(root,'learning-hint-button');
  await press(root,'learning-flip-button');
  if(resolved) await press(root,'learning-flip-confident-button');
  await failAttemptRefresh(runtime,root);
  await press(root,'learning-bootstrap-retry-button');await settle();
  expect(root.findByProps({testID:'learning-bootstrap-retry-button'})).toBeTruthy();
  runtime.setLoadsFail(false);
  await press(root,'learning-bootstrap-retry-button');await settle();
  const surface=root.findByType(LearningSurface).props;
  expect(surface.currentCardState).toMatchObject({hasUsedHint:true,hasUsedPeek:true,isHintVisible:false,isPeeked:false,isFlipped:true});
  if(!resolved) await press(root,'learning-flip-confident-button');
  expect(root.findByType(LearningSurface).props.currentResult).toMatchObject({usedHint:true,usedPeek:true});
});

test('keeps a lock mistake through failed refresh so later correction still needs review',async()=>{
  const runtime=createRuntime();
  const card=runtime.base.catalogCards.find(candidate=>candidate.interaction_id==='lock')!;
  if(card.interaction_id!=='lock') throw new Error('Lock fixture required');
  runtime.setSelection(card.card_id);
  const {root}=await login();
  const wrongIndex=card.lock_slots[0].options.findIndex(option=>option!==card.answer_key.lock_pattern[0]);
  await press(root,`learning-lock-1-${wrongIndex+1}`);
  await failAttemptRefresh(runtime,root);
  runtime.setLoadsFail(false);await press(root,'learning-bootstrap-retry-button');await settle();
  expect(root.findByType(LearningSurface).props.currentCardState.hasMadeLockMistake).toBe(true);
  for(const [index,slot] of card.lock_slots.entries()) {
    await press(root,`learning-lock-${index+1}-${slot.options.indexOf(card.answer_key.lock_pattern[index])+1}`);
  }
  expect(root.findByType(LearningSurface).props.currentResult.outcome).toBe('incorrect');
});

test.each(['selection','content','phase'] as const)('discards a failed attempt when recovered %s authority changes',async change=>{
  const runtime=createRuntime();const {root}=await login();
  await press(root,'learning-peek-button');await press(root,'learning-flip-button');
  await press(root,'learning-flip-confident-button');
  await failAttemptRefresh(runtime,root);
  if(change==='selection') runtime.setSelection(runtime.base.cards[0].card_id);
  else if(change==='content') runtime.setContentVersion(`sha256:${'b'.repeat(64)}`);
  else runtime.setPhase('review');
  runtime.setLoadsFail(false);await press(root,'learning-bootstrap-retry-button');await settle();
  const surface=root.findByType(LearningSurface).props;
  expect(surface.currentCardState).toMatchObject({hasUsedHint:false,hasUsedPeek:false,isFlipped:false});
  expect(surface.currentResult).toBeNull();
});

test('a changed server selection discards the old attempt instead of transplanting its answer',async()=>{
  const runtime=createRuntime();const {root,tree}=await login();
  await press(root,'learning-flip-button');
  runtime.setSelection(runtime.base.catalogCards.at(-1)!.card_id);
  await inspectSpace(root);await press(root,'space-card-next');await press(root,'space-favorite-2');await settle();
  await press(root,'space-return-learning');
  expect(mockLoadSession).toHaveBeenCalledTimes(2);
  expect(root.findByType(LearningSurface).props.currentResult).toBeNull();
  expect(root.findByType(LearningSurface).props.currentCardState.isFlipped).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain(runtime.base.catalogCards.at(-1)!.front.prompt);
});

test('an explicit rejection of an old-content selection refreshes without counting it, and survives remount',async()=>{
  const runtime=createRuntime();const {root,tree}=await login();
  await press(root,'learning-flip-button');await press(root,'learning-flip-confident-button');
  runtime.setSelection(runtime.base.catalogCards.at(-1)!.card_id);
  runtime.setContentVersion(`sha256:${'b'.repeat(64)}`);
  runtime.rejectEvents('learning_event_selection_conflict');
  await press(root,'learning-next-button');await settle();
  const submitted=runtime.requests.mock.calls.filter(([input])=>input.endsWith('/v2/learning/events'));
  expect(submitted).toHaveLength(1);
  expect(JSON.parse(submitted[0][1]!.body!).events[0].content_version).toBe(TEST_CONTENT_VERSION);
  const outbox=new LearningEventOutbox({storage:createReactNativeLearningEventOutboxStorage()});
  expect(await outbox.getPendingCount('13800138000')).toBe(0);
  expect(await outbox.getRejectedEntries('13800138000')).toHaveLength(1);
  expect(root.findByProps({testID:'learning-rejected-result-notice'}).props.children).toBe('这次结果未计入，已更新学习安排。');
  expect(root.findByType(LearningSurface).props.completedResults).toHaveLength(0);
  expect(root.findByType(LearningSurface).props.currentCard.card_id).toBe(runtime.base.catalogCards.at(-1)!.card_id);
  expect(mockLoadSession).toHaveBeenCalledTimes(2);
  act(()=>tree.unmount());trees.splice(trees.indexOf(tree),1);
  let restored!:ReactTestRenderer.ReactTestRenderer;
  await act(async()=>{restored=ReactTestRenderer.create(<App/>)});trees.push(restored);await settle();
  expect(restored.root.findByProps({testID:'learning-rejected-result-notice'}).props.children).toBe('这次结果未计入，已更新学习安排。');
  const settledLoads=mockLoadSession.mock.calls.length;
  await settle();expect(mockLoadSession).toHaveBeenCalledTimes(settledLoads);
  expect(runtime.requests.mock.calls.filter(([input])=>input.endsWith('/v2/learning/events'))).toHaveLength(1);
});

test('an unknown conflict stays pending and is never labelled as rejected or silently skipped',async()=>{
  const runtime=createRuntime();runtime.rejectEvents('unknown_conflict');jest.spyOn(console,'warn').mockImplementation(()=>undefined);
  const {root}=await login();await press(root,'learning-flip-button');await press(root,'learning-flip-confident-button');
  await press(root,'learning-next-button');await settle();
  const outbox=new LearningEventOutbox({storage:createReactNativeLearningEventOutboxStorage()});
  expect(await outbox.getPendingCount('13800138000')).toBe(1);
  expect(await outbox.getRejectedEntries('13800138000')).toHaveLength(0);
  expect(root.findAllByProps({testID:'learning-rejected-result-notice'})).toHaveLength(0);
  expect(mockLoadSession).toHaveBeenCalledTimes(1);
});

function audioSelection(root:ReactTestRenderer.ReactTestInstance): LearningAudioSelection {
  const surface=root.findByType(LearningSurface).props;
  const card=surface.currentCard as LearningCard;
  return {authorityToken:surface.audioAttemptId,cardToken:`${card.card_id}:${card.audio!.sha256}`,
    asset:{...card.audio!,media_type:'audio/mpeg',size_bytes:64},
    download:{asset_id:card.audio!.asset_id,expires_at:'2026-09-12T00:00:00.000Z',url:'https://assets.example/expired'}};
}

test('renews audio only for the exact current attempt and passes a live scope guard',async()=>{
  const runtime=createRuntime();runtime.addAudio();const {root}=await login();
  const selection=audioSelection(root);
  const download={...selection.download,expires_at:'2099-09-12T00:00:00.000Z',url:'https://assets.example/renewed'};
  mockRefreshAudioDownload.mockResolvedValue(download);
  const refresh=root.findByType(LearningSurface).props.refreshAudioDownload as RefreshLearningAudioDownload;
  await expect(refresh(selection)).resolves.toEqual(download);
  expect(mockRefreshAudioDownload).toHaveBeenCalledTimes(1);
  expect(mockRefreshAudioDownload.mock.calls[0][3].isCurrent()).toBe(true);
  await expect(refresh({...selection,authorityToken:'sel_wrong_attempt_identity'})).rejects.toMatchObject({reason:'caller_cancelled'});
  expect(mockRefreshAudioDownload).toHaveBeenCalledTimes(1);
});

test('drops a pending audio renewal after leaving the learning attempt',async()=>{
  const runtime=createRuntime();runtime.addAudio();const {root}=await login();
  const selection=audioSelection(root);
  let resolveDownload!:(download:LearningAudioSelection['download'])=>void;
  mockRefreshAudioDownload.mockImplementation(()=>new Promise(resolve=>{resolveDownload=resolve}));
  const refresh=root.findByType(LearningSurface).props.refreshAudioDownload as RefreshLearningAudioDownload;
  const pending=refresh(selection);
  const rejection=pending.catch(error=>error);
  await press(root,'route-tab-space');
  expect(mockRefreshAudioDownload.mock.calls[0][3].isCurrent()).toBe(false);
  resolveDownload({...selection.download,expires_at:'2099-09-12T00:00:00.000Z'});
  expect(await rejection).toMatchObject({reason:'caller_cancelled'});
  await expect(refresh(selection)).rejects.toMatchObject({reason:'caller_cancelled'});
  expect(mockRefreshAudioDownload).toHaveBeenCalledTimes(1);
});

function createJsonResponse(payload: unknown, status = 200) {
  return {
    json: async () => payload,
    ok: status >= 200 && status < 300,
    status,
  };
}

function createRemoteAuthChallengeResponse() {
  return createJsonResponse({
    data: {
      challenge_id: 'challenge-123',
      expires_at: '2099-07-20T00:05:00.000Z',
      retry_after_seconds: 60,
    },
  });
}

function createRemoteAuthSessionResponse(
  phoneNumber = '13800138000',
  sessionSuffix: string | null = null,
) {
  return createJsonResponse({
    data: {
      access_token: sessionSuffix
        ? `remote-auth-token-${sessionSuffix}`
        : 'remote-auth-token',
      expires_in: 900,
      phone_number: phoneNumber,
      refresh_expires_at: '2099-08-19T00:00:00.000Z',
      refresh_token: sessionSuffix
        ? `remote-refresh-token-${sessionSuffix}`
        : 'remote-refresh-token',
      session_id: sessionSuffix ? `session-${sessionSuffix}` : 'session-123',
      token_type: 'Bearer',
    },
  });
}

function createAccountBootstrapPayload(
  session: LearningSession = createLocalLearningSession('cet4'),
  stage: 'trial_available' | 'trial' | 'free' | 'premium' = 'free',
  learningEvents: MockLearningEvent[] = [],
  checkedInToday = false,
) {
  const dayKey = getChinaDayKey();
  const learningCompletedCount = learningEvents.filter(
    event => event.phase === 'learning',
  ).length;
  const reviewCompletedCount = learningEvents.filter(
    event => event.phase === 'review',
  ).length;
  const learningServerSequence = learningEvents.length;
  const baseMembershipRevision = {
    trial_available: 0,
    trial: 1,
    free: 2,
    premium: 3,
  }[stage];

  return {
    data: {
      schema_version: 'bootstrap.v2',
      generated_at: new Date().toISOString(),
      day_key: dayKey,
      track: session.track,
      component_revisions: {
        schema_version: 'bootstrap-component-revisions.v1',
        membership: {
          base_membership_revision: baseMembershipRevision,
          beta_entitlement_revision: 0,
          pilot_entitlement_revision: 0,
        },
        learning: {
          event_server_sequence: learningServerSequence,
          session_revision: learningServerSequence,
          space_revision: 0,
        },
        progress: {
          learning_server_sequence: learningServerSequence,
          check_in_revision: Number(checkedInToday),
          space_revision: 0,
        },
        space: { state_revision: 0 },
      },
      content: {
        card_count: session.catalogCards.length,
        release_id: null,
        minimum_client_version: null,
        parent_release_id: null,
        published_at: null,
        source: {
          id: session.sourceId,
          label: session.sourceLabel,
        },
        version: session.contentVersion ?? TEST_CONTENT_VERSION,
      },
      learning: {
        acknowledged_at:
          learningEvents.length > 0 ? new Date().toISOString() : null,
        card_states: learningEvents.map((event, index) => ({
          card_id: event.card_id,
          completed_at: event.client_occurred_at,
          interaction_id: event.interaction_id,
          is_favorited: false,
          outcome: event.outcome,
          phase: event.phase,
          server_sequence: index + 1,
          used_hint: event.used_hint,
          used_peek: event.used_peek,
        })),
        cursor: null,
        source:
          learningEvents.length > 0
            ? {
                id: session.sourceId,
                label: session.sourceLabel,
              }
            : null,
      },
      membership: {
        acknowledged_at: new Date().toISOString(),
        counted_entry_count: 0,
        last_experience_ended_by: null,
        recovery_prompt_visible: false,
        stage,
        trial_duration_days: 5,
        trial_expires_at:
          stage === 'trial' ? '2026-08-17T08:00:00.000Z' : null,
        trial_remaining_seconds: stage === 'trial' ? 432000 : 0,
        trial_started_at:
          stage === 'trial' ? '2026-08-12T08:00:00.000Z' : null,
        trial_started_at_entry_count: stage === 'trial' ? 1 : null,
      },
      progress: {
        acknowledged_at: checkedInToday ? new Date().toISOString() : null,
        checked_in_today: checkedInToday,
        day_key: dayKey,
        favorite_count: 0,
        learning_completed_count: learningCompletedCount,
        learning_authority:
          learningEvents.length > 0 ? 'account_events_v2' : 'empty',
        pending_review_count: learningEvents.filter(
          event => event.answer_grade === 'review_needed',
        ).length,
        review_completed_count: reviewCompletedCount,
        sleeping_count: 0,
        total_completed_count: learningCompletedCount + reviewCompletedCount,
      },
      space: {
        acknowledged_at: null,
        content_version: session.contentVersion ?? TEST_CONTENT_VERSION,
        schema_version: 'space-state.v2',
        states: [],
        track: session.track,
      },
    },
  };
}
