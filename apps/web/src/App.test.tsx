import {fireEvent, render, screen, within} from '@testing-library/react';
import axe from 'axe-core';

import {App} from './App';

async function authenticate() {
  render(<App />);
  fireEvent.change(screen.getByLabelText('手机号'), {
    target: {value: '13800138000'},
  });
  fireEvent.click(screen.getByRole('button', {name: '获取验证码'}));
  fireEvent.change(screen.getByLabelText('短信验证码'), {
    target: {value: '123456'},
  });
  fireEvent.click(screen.getByRole('button', {name: '验证并继续'}));
  await screen.findByRole('heading', {name: '当前学习卡'});
}

describe('PC Web core flow', () => {
  it('keeps Learning first and exposes the canonical route order', async () => {
    await authenticate();

    const navigation = screen.getByRole('navigation', {name: '主要导航'});
    expect(
      within(navigation)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual(['学Learning', '域Space', '记Statistics', '我Mine']);
    expect(screen.getByRole('heading', {name: '当前学习卡'})).toBeInTheDocument();
  });

  it('requires reveal and exactly two authorized flip self-assess choices', async () => {
    await authenticate();

    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    const assessment = screen.getByRole('group', {name: '自我评估'});
    expect(within(assessment).getAllByRole('button')).toHaveLength(2);
    expect(within(assessment).getByRole('button', {name: '有把握'})).toBeInTheDocument();
    expect(within(assessment).getByRole('button', {name: '再回看'})).toBeInTheDocument();

    fireEvent.click(within(assessment).getByRole('button', {name: '有把握'}));
    fireEvent.click(screen.getByRole('button', {name: '确认自评'}));
    expect(screen.getByText('已记为有把握')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: '继续下一张'}));
    expect(within(screen.getByRole('group', {name: '四选一选项'})).getAllByRole('button')).toHaveLength(4);
  });

  it('keeps favorite and sleep as card states inside the owning box', async () => {
    await authenticate();
    fireEvent.click(screen.getByRole('button', {name: 'Space'}));

    expect(screen.getByRole('heading', {name: '当前卡盒'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '标记喜欢'}));
    fireEvent.click(screen.getByRole('button', {name: '移入盒内休眠区'}));

    expect(screen.getByText(/1 张卡暂时离开学习流/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '取消喜欢'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '唤醒到学习流'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '回到 Learning'}));
    expect(screen.getByRole('button', {name: '已标记喜欢'})).toBeInTheDocument();
  });

  it('fails closed for an invalid phone number', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('手机号'), {target: {value: '123'}});
    fireEvent.click(screen.getByRole('button', {name: '获取验证码'}));
    expect(screen.getByRole('alert')).toHaveTextContent('请输入 11 位中国大陆手机号。');
    expect(screen.queryByLabelText('短信验证码')).not.toBeInTheDocument();
  });

  it('has no automatically detectable accessibility violations in the Learning shell', async () => {
    await authenticate();

    const report = await axe.run(document, {
      rules: {'color-contrast': {enabled: false}},
    });
    expect(report.violations).toEqual([]);
  });

  it('supports non-touch shortcuts without exposing internal metadata', async () => {
    await authenticate();

    fireEvent.keyDown(document.body, {key: 'Enter'});
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    fireEvent.click(screen.getByRole('button', {name: '确认自评'}));
    fireEvent.click(screen.getByRole('button', {name: '继续下一张'}));
    fireEvent.keyDown(document.body, {key: '2'});

    expect(screen.getByRole('button', {name: /B.*unclear/})).toHaveAttribute('aria-pressed', 'true');
    for (const routeName of ['Space', 'Statistics', 'Mine', 'Learning']) {
      fireEvent.click(screen.getByRole('button', {name: new RegExp(`^${routeName}$`)}));
      expect(document.body.textContent).not.toMatch(/card_id|knowledge_ref|box_ref|sourceId|contentVersion|apiKey/i);
    }
  });

  it('clears account-scoped state on sign out', async () => {
    await authenticate();
    fireEvent.click(screen.getByRole('button', {name: '标记喜欢'}));
    fireEvent.click(screen.getByRole('button', {name: '退出'}));

    expect(screen.getByLabelText('手机号')).toHaveValue('');
    expect(screen.queryByRole('navigation', {name: '主要导航'})).not.toBeInTheDocument();
  });
});
