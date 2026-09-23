import {act, fireEvent, render, screen, cleanup, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {App} from './App';
import {resolveWebRuntime} from './runtime';

beforeEach(() => window.localStorage.clear());
afterEach(async () => {cleanup(); await act(async () => {await new Promise(resolve => setTimeout(resolve, 0));}); window.localStorage.clear();});

afterEach(() => {cleanup(); window.history.replaceState(null, '', '/');});

it.each([['cet4', 1180, /电动公交、柴油车队/], ['cet6', 1234, /延长图书馆开放/]] as const)(
  'opens the full real %s library in five-card groups without SMS', async (track, count, firstPrompt) => {
    window.history.replaceState(null, '', `/?track=${track}`);
    expect(resolveWebRuntime()).toMatchObject({mode: 'development', track});
    render(<App />);
    expect(screen.queryByLabelText('手机号')).not.toBeInTheDocument();
    const start = await screen.findByRole('button', {name: '开始学习'}, {timeout: 10000});
    await waitFor(() => expect(start).toBeEnabled());
    fireEvent.click(start);
    const {createLocalLearningSession} = await import('../../mobile/src/learning/session');
    expect(createLocalLearningSession(track).catalogCards).toHaveLength(count);
    // Cold CI transforms the full 2414-card module, rather than seven fixtures.
    expect(await screen.findByRole('heading', {name: firstPrompt}, {timeout: 10000})).toBeInTheDocument();
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '播放音频'})).toBeEnabled();
    expect(screen.queryByText(/短对话里听到 however/)).toBeNull();
    if (track === 'cet4') {
      fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
      fireEvent.click(screen.getByRole('button', {name: '空间'}));
      fireEvent.click(screen.getByRole('button', {name: '暂不学习这张卡'}));
      fireEvent.click(screen.getByRole('button', {name: '继续学习'}));
      expect(await screen.findByRole('heading', {name: /咨询预约、考试压力/})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: '翻面看答案'})).toBeEnabled();
      expect(screen.queryByRole('button', {name: '有把握'})).toBeNull();
      expect(screen.getByText('2 / 5')).toBeInTheDocument();
    }
  },
  // Includes the cold transform of the complete card corpus before the UI wait.
  20000,
);
