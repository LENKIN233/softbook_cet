import {fireEvent, render, screen, cleanup} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {App} from './App';
import {resolveWebRuntime} from './runtime';

afterEach(() => {cleanup(); window.history.replaceState(null, '', '/');});

it.each([['cet4', 1180, /electric buses/], ['cet6', 1234, /任务：先听音频/]] as const)(
  'opens the real %s library through the ordinary local login', async (track, count, firstPrompt) => {
    window.history.replaceState(null, '', `/?track=${track}`);
    expect(resolveWebRuntime()).toMatchObject({mode: 'development', track});
    render(<App />);
    fireEvent.change(screen.getByLabelText('手机号'), {target: {value: '13800138000'}});
    fireEvent.click(screen.getByRole('button', {name: '获取验证码'}));
    fireEvent.change(screen.getByLabelText('短信验证码'), {target: {value: '123456'}});
    fireEvent.click(screen.getByRole('button', {name: '验证并继续'}));
    expect(await screen.findByRole('heading', {name: firstPrompt})).toBeInTheDocument();
    expect(screen.getByText(`1 / ${count}`)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '播放音频'})).toBeEnabled();
    expect(screen.queryByText(/短对话里听到 however/)).toBeNull();
  },
);
