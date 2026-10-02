import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {App} from './App';
import {FirstLearningDialog} from './FirstRunGuidance';
import {FIRST_RUN_GUIDANCE_KEY, readFirstRunGuidance, writeFirstRunGuidance} from './firstRunGuidanceStore';
import type {WebRemoteRuntimeController} from './remoteRuntime';
import type {WebRuntime} from './runtime';

function createLoginOnlyController(): WebRemoteRuntimeController {
  return {
    dispose: vi.fn(),
    start: vi.fn(),
    resumeAccountDeletion: async () => ({status: 'none'}),
    subscribeAccountPresentationInvalidation: () => () => undefined,
    subscribeAudioStatus: () => () => undefined,
  } as unknown as WebRemoteRuntimeController;
}

beforeEach(() => {
  window.localStorage.clear();
  window.__SOFTBOOK_WEB_RUNTIME__ = {mode: 'remote', baseUrl: 'https://runtime.example.cn', clientKind: 'web', track: 'cet4', contentManifestPublicKeys: {'release-2026': 'ab'.repeat(32)}};
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
  delete window.__SOFTBOOK_WEB_RUNTIME__;
});

it('blocks login and shortcuts until an explicit subject is selected, then starts with CET6', async () => {
  const factory = vi.fn<(runtime: WebRuntime) => WebRemoteRuntimeController>(() => createLoginOnlyController());
  render(<App remoteRuntimeFactory={factory} />);
  const dialog = screen.getByRole('dialog', {name: '先选一个备考科目'});
  expect(dialog).toHaveFocus();
  expect(screen.getByRole('button', {name: '选择科目后继续'})).toBeDisabled();
  expect(screen.getByTestId('first-subject-cet4')).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByTestId('first-subject-cet6')).toHaveAttribute('aria-pressed', 'false');
  fireEvent.keyDown(window, {key: 'Escape'});
  fireEvent.click(dialog.parentElement!);
  expect(screen.queryByLabelText('手机号')).toBeNull();
  expect(factory).not.toHaveBeenCalled();
  expect(dialog).toHaveTextContent('我的 → 备考科目');
  fireEvent.click(screen.getByTestId('first-subject-cet6'));
  fireEvent.click(screen.getByRole('button', {name: '继续'}));
  await screen.findByRole('heading', {name: '登录软书'});
  expect(factory).toHaveBeenCalledWith(expect.objectContaining({track: 'cet6'}));
  expect(readFirstRunGuidance()).toEqual({version: 1, selectedTrack: 'cet6', learningGuideSeen: false});
});

it('restores the selected subject without showing the subject dialog on the next open', async () => {
  writeFirstRunGuidance({version: 1, selectedTrack: 'cet6', learningGuideSeen: true});
  const factory = vi.fn<(runtime: WebRuntime) => WebRemoteRuntimeController>(() => createLoginOnlyController());
  render(<App remoteRuntimeFactory={factory} />);
  await screen.findByRole('heading', {name: '登录软书'});
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(factory).toHaveBeenCalledWith(expect.objectContaining({track: 'cet6'}));
});

it('keeps selection blocked on storage read failure and allows a real retry', () => {
  const get = Storage.prototype.getItem;
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(this: Storage, key) {
    if (key === FIRST_RUN_GUIDANCE_KEY) throw new Error('storage unavailable');
    return get.call(this, key);
  });
  const factory = vi.fn<(runtime: WebRuntime) => WebRemoteRuntimeController>(() => createLoginOnlyController());
  render(<App remoteRuntimeFactory={factory} />);
  expect(screen.getByRole('alert')).toHaveTextContent('无法读取');
  expect(factory).not.toHaveBeenCalled();
  read.mockRestore();
  fireEvent.click(screen.getByRole('button', {name: '重新读取'}));
  expect(screen.getByRole('button', {name: '选择科目后继续'})).toBeDisabled();
});

it('retains the chosen option after a write failure and opens login only after saving succeeds', async () => {
  const factory = vi.fn<(runtime: WebRuntime) => WebRemoteRuntimeController>(() => createLoginOnlyController());
  render(<App remoteRuntimeFactory={factory} />);
  fireEvent.click(screen.getByTestId('first-subject-cet6'));
  const set = Storage.prototype.setItem;
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, key, value) {
    if (key === FIRST_RUN_GUIDANCE_KEY) throw new Error('quota');
    set.call(this, key, value);
  });
  fireEvent.click(screen.getByRole('button', {name: '继续'}));
  expect(screen.getByRole('alert')).toHaveTextContent('无法记住');
  expect(factory).not.toHaveBeenCalled();
  expect(screen.getByTestId('first-subject-cet6')).toHaveAttribute('aria-pressed', 'true');
  write.mockRestore();
  fireEvent.click(screen.getByRole('button', {name: '继续'}));
  await screen.findByRole('heading', {name: '登录软书'});
});

it('preserves malformed preferences until the user explicitly replaces the subject choice', async () => {
  localStorage.setItem(FIRST_RUN_GUIDANCE_KEY, '{broken');
  const factory = vi.fn<(runtime: WebRuntime) => WebRemoteRuntimeController>(() => createLoginOnlyController());
  render(<App remoteRuntimeFactory={factory} />);
  expect(screen.getByRole('alert')).toHaveTextContent('重新选一次');
  expect(localStorage.getItem(FIRST_RUN_GUIDANCE_KEY)).toBe('{broken');
  expect(factory).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTestId('first-subject-cet6'));
  fireEvent.click(screen.getByRole('button', {name: '继续'}));
  await screen.findByRole('heading', {name: '登录软书'});
  expect(readFirstRunGuidance()?.selectedTrack).toBe('cet6');
});

it('restores prior preferences when the write succeeds but verification fails', () => {
  const previous = {version: 1, selectedTrack: 'cet4', learningGuideSeen: true} as const;
  writeFirstRunGuidance(previous);
  const get = Storage.prototype.getItem;
  let reads = 0;
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(this: Storage, key) {
    if (key === FIRST_RUN_GUIDANCE_KEY && ++reads === 2) throw new Error('verification unavailable');
    return get.call(this, key);
  });
  expect(() => writeFirstRunGuidance({...previous, selectedTrack: 'cet6'})).toThrow();
  expect(readFirstRunGuidance()).toEqual(previous);
});

it('offers a concise learning guide and keeps failed dismissal recoverable', () => {
  const finish = vi.fn().mockImplementationOnce(() => {throw new Error('storage unavailable');});
  render(<FirstLearningDialog onContinue={finish} />);
  expect(screen.getByRole('dialog', {name: '从一张卡开始'})).toHaveTextContent('看判断方法');
  fireEvent.click(screen.getByRole('button', {name: '开始学习'}));
  expect(screen.getByRole('alert')).toHaveTextContent('无法保存');
  fireEvent.click(screen.getByRole('button', {name: '开始学习'}));
  expect(finish).toHaveBeenCalledTimes(2);
});
