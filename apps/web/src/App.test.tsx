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

function chooseLockOption(slotLabel: string, option: string) {
  fireEvent.click(
    within(screen.getByRole('group', {name: `${slotLabel}选项`}))
      .getByRole('button', {name: option}),
  );
}

describe('PC Web core flow', () => {
  it('keeps Learning first and exposes the canonical route order', async () => {
    await authenticate();

    const navigation = screen.getByRole('navigation', {name: '主要导航'});
    expect(
      within(navigation)
        .getAllByRole('button')
        .map(button => button.textContent),
    ).toEqual(['学习', '空间', '统计', '我的']);
    expect(screen.getByRole('heading', {name: '当前学习卡'})).toBeInTheDocument();
    expect(screen.getByText('跨端同步 · 当前设备可继续')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('开发状态');
  });

  it('requires reveal and exactly two authorized flip self-assess choices', async () => {
    await authenticate();

    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    const assessment = screen.getByRole('group', {name: '自我评估'});
    expect(within(assessment).getAllByRole('button')).toHaveLength(2);
    expect(within(assessment).getByRole('button', {name: '有把握'})).toBeInTheDocument();
    expect(within(assessment).getByRole('button', {name: '再回看'})).toBeInTheDocument();

    fireEvent.click(within(assessment).getByRole('button', {name: '有把握'}));
    expect(screen.getByText('已记为有把握')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '确认自评'})).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', {name: '继续下一张'}));
    expect(within(screen.getByRole('group', {name: '四选一选项'})).getAllByRole('button')).toHaveLength(4);
  });

  it('keeps Peek available and remembers a collapsed hint for learning statistics', async () => {
    await authenticate();

    fireEvent.click(screen.getByRole('button', {name: '查看线索'}));
    expect(
      screen.getByText('先抓题干里的关键信号，再完成当前判断。'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '收起线索'}));
    fireEvent.click(screen.getByRole('button', {name: '查看提示'}));
    expect(screen.getByText(/先问自己/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '收起提示'}));
    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    fireEvent.click(screen.getByRole('button', {name: '统计'}));

    const hintRow = screen.getByText('使用提示').closest('div');
    expect(hintRow).toHaveTextContent('1');
  });

  it('keeps favorite and sleep as card states inside the owning box', async () => {
    await authenticate();
    fireEvent.click(screen.getByRole('button', {name: '空间'}));

    expect(screen.getByRole('heading', {name: '转折关系'})).toBeInTheDocument();
    const address = screen.getByLabelText('当前空间地址');
    expect(within(address).getByText('听力')).toBeInTheDocument();
    expect(within(address).getByText('逻辑关系')).toBeInTheDocument();
    expect(screen.getByRole('region', {name: '当前卡盒 转折关系'})).toBeInTheDocument();
    expect(screen.getByLabelText('盒内卡片')).toBeInTheDocument();
    expect(screen.getByRole('region', {name: '盒内休眠区'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '回到当前学习卡'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '转折关系 2 张'})).toHaveAttribute('aria-current', 'location');
    expect(screen.queryByText('把句子主干锁出来，三个槽位都对才开锁。')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '标记喜欢'}));
    fireEvent.click(screen.getByRole('button', {name: '移入盒内休眠区'}));

    expect(screen.getByText(/1 张卡暂时离开学习流/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '取消喜欢'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '唤醒到学习流'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '回到学习'}));
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

  it('keeps the current-box Space structure accessible', async () => {
    await authenticate();
    fireEvent.click(screen.getByRole('button', {name: '空间'}));

    const report = await axe.run(document, {
      rules: {'color-contrast': {enabled: false}},
    });
    expect(report.violations).toEqual([]);
  });

  it('supports non-touch shortcuts without exposing internal metadata', async () => {
    await authenticate();

    fireEvent.keyDown(document.body, {key: 'Enter'});
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    fireEvent.click(screen.getByRole('button', {name: '继续下一张'}));
    fireEvent.keyDown(document.body, {key: '2'});

    expect(screen.getByRole('button', {name: /B.*unclear/})).toHaveAttribute('aria-pressed', 'true');
    for (const routeName of ['空间', '统计', '我的', '学习']) {
      fireEvent.click(screen.getByRole('button', {name: new RegExp(`^${routeName}$`)}));
      expect(document.body.textContent).not.toMatch(/card_id|knowledge_ref|box_ref|sourceId|contentVersion|apiKey/i);
    }
  });

  it('starts the full trial on the first authenticated entry and makes unavailable account actions honest', async () => {
    await authenticate();
    fireEvent.click(screen.getByRole('button', {name: '我的'}));

    expect(screen.getByText('5 天体验中')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /开启 5 天体验/})).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: '封闭内测权益由邀请开通'}),
    ).toBeDisabled();
    expect(
      screen.getByText('获得资格后会随当前账号自动同步，不需要在产品内购买。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '暂时无法删除账户'})).toBeDisabled();

    fireEvent.click(screen.getByRole('button', {name: '隐私与账户规则'}));
    expect(screen.getByRole('region', {name: '隐私与账户规则说明'})).toBeInTheDocument();
  });

  it('ends the system-ordered session instead of silently looping to the first card', async () => {
    await authenticate();

    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '有把握'}));
    fireEvent.click(screen.getByRole('button', {name: '继续下一张'}));

    fireEvent.click(screen.getByRole('button', {name: /B.*unclear/}));
    fireEvent.click(screen.getByRole('button', {name: '提交判断'}));
    fireEvent.click(screen.getByRole('button', {name: '继续下一张'}));

    const lockRows = screen.getByRole('group', {name: '开锁槽位'});
    expect(within(lockRows).getByRole('group', {name: '主语锁位'})).toHaveTextContent('当前锁位');
    expect(screen.queryByRole('group', {name: '谓语选项'})).not.toBeInTheDocument();
    chooseLockOption('主语', 'reduces');
    expect(within(lockRows).getByRole('group', {name: '主语锁位'})).toHaveTextContent('再试一次');
    expect(screen.queryByRole('group', {name: '谓语选项'})).not.toBeInTheDocument();
    chooseLockOption('主语', 'The policy');
    expect(
      within(screen.getByRole('group', {name: '谓语选项'}))
        .getByRole('button', {name: 'reduces'}),
    ).toBeEnabled();
    chooseLockOption('谓语', 'reduces');
    chooseLockOption('宾语', 'reduces');
    expect(screen.getByRole('button', {name: '提交判断'})).toBeDisabled();
    chooseLockOption('宾语', 'test anxiety');
    expect(within(lockRows).getAllByText('已开锁')).toHaveLength(3);
    expect(screen.getByRole('button', {name: '提交判断'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button', {name: '提交判断'}));
    fireEvent.click(screen.getByRole('button', {name: '继续下一张'}));

    const elimination = screen.getByRole('group', {name: '选择要删除的干扰成分'});
    fireEvent.click(within(elimination).getByRole('button', {name: 'who review in short bursts'}));
    fireEvent.click(within(elimination).getByRole('button', {name: 'usually'}));
    fireEvent.click(within(elimination).getByRole('button', {name: 'before the test'}));
    fireEvent.click(screen.getByRole('button', {name: '提交判断'}));
    fireEvent.click(screen.getByRole('button', {name: '继续下一张'}));

    const swipe = screen.getByRole('group', {name: '左右滑动判断'});
    const swipeCard = within(swipe).getByRole('group', {name: '当前滑动卡，可拖动或使用左右选项'});
    expect(swipeCard).toBeInTheDocument();
    expect(within(swipe).getAllByRole('button')).toHaveLength(2);
    fireEvent.pointerDown(swipeCard, {clientX: 120, pointerId: 1});
    fireEvent.pointerUp(swipeCard, {clientX: 80, pointerId: 1});
    expect(within(swipe).getByRole('button', {name: /可直接套用/})).toHaveAttribute('aria-pressed', 'false');
    fireEvent.pointerDown(swipeCard, {clientX: 120, pointerId: 2});
    fireEvent.pointerMove(swipeCard, {clientX: 20, pointerId: 2});
    fireEvent.pointerUp(swipeCard, {clientX: 20, pointerId: 2});
    expect(within(swipe).getByRole('button', {name: /可直接套用/})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', {name: '提交判断'})).not.toBeInTheDocument();
    expect(screen.getByText('判断正确')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '完成本轮'}));

    expect(screen.getByRole('heading', {name: '这一轮到这里'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: '当前学习卡'})).not.toBeInTheDocument();
    expect(screen.getByLabelText('本轮摘要')).toHaveTextContent('完成 5');
  });

  it('ends a review deck without offering the same review loop again', async () => {
    await authenticate();

    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '再回看'}));
    fireEvent.click(screen.getByRole('button', {name: '继续下一张'}));

    fireEvent.click(screen.getByRole('button', {name: /B.*unclear/}));
    fireEvent.click(screen.getByRole('button', {name: '提交判断'}));
    fireEvent.click(screen.getByRole('button', {name: '继续下一张'}));

    chooseLockOption('主语', 'The policy');
    chooseLockOption('谓语', 'reduces');
    chooseLockOption('宾语', 'test anxiety');
    fireEvent.click(screen.getByRole('button', {name: '提交判断'}));
    fireEvent.click(screen.getByRole('button', {name: '继续下一张'}));

    const elimination = screen.getByRole('group', {name: '选择要删除的干扰成分'});
    fireEvent.click(within(elimination).getByRole('button', {name: 'who review in short bursts'}));
    fireEvent.click(within(elimination).getByRole('button', {name: 'usually'}));
    fireEvent.click(within(elimination).getByRole('button', {name: 'before the test'}));
    fireEvent.click(screen.getByRole('button', {name: '提交判断'}));
    fireEvent.click(screen.getByRole('button', {name: '继续下一张'}));

    fireEvent.keyDown(document.body, {key: 'ArrowLeft'});
    expect(screen.getByText('判断正确')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '提交判断'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '完成本轮'}));
    fireEvent.click(screen.getByRole('button', {name: '开始回看 1 张'}));

    fireEvent.click(screen.getByRole('button', {name: '翻面看答案'}));
    fireEvent.click(screen.getByRole('button', {name: '再回看'}));
    fireEvent.click(screen.getByRole('button', {name: '完成本轮'}));

    expect(screen.getByText('回看完成')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /开始回看/})).not.toBeInTheDocument();
  });

  it('clears account-scoped state on sign out', async () => {
    await authenticate();
    fireEvent.click(screen.getByRole('button', {name: '标记喜欢'}));
    fireEvent.click(screen.getByRole('button', {name: '退出'}));

    expect(screen.getByLabelText('手机号')).toHaveValue('');
    expect(screen.queryByRole('navigation', {name: '主要导航'})).not.toBeInTheDocument();
  });
});
