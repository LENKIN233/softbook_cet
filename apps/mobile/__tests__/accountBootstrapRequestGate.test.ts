import {createAccountBootstrapRequestGate} from '../src/bootstrap/accountBootstrapRequestGate';

test('coalesces only the exact same bootstrap request scope', () => {
  const gate = createAccountBootstrapRequestGate();
  const first = gate.begin('session-a|cet4|2026-08-10|normal');
  const same = gate.begin('session-a|cet4|2026-08-10|normal');

  expect(same.reused).toBe(true);
  expect(same.lease).toBe(first.lease);
  expect(first.lease.abortController.signal.aborted).toBe(false);

  const nextTrack = gate.begin('session-a|cet6|2026-08-10|normal');
  expect(nextTrack.reused).toBe(false);
  expect(first.lease.abortController.signal.aborted).toBe(true);
  expect(gate.isCurrent(first.lease)).toBe(false);
  expect(gate.isCurrent(nextTrack.lease)).toBe(true);
});

test('cross-day and force-fresh requests supersede an older in-flight read', () => {
  const gate = createAccountBootstrapRequestGate();
  const dayOne = gate.begin('session-a|cet4|2026-08-10|normal').lease;
  const dayTwo = gate.begin('session-a|cet4|2026-08-11|normal').lease;

  expect(dayOne.abortController.signal.aborted).toBe(true);
  expect(gate.isCurrent(dayTwo)).toBe(true);

  const causalRefresh = gate.begin(dayTwo.key, {forceFresh: true}).lease;
  expect(dayTwo.abortController.signal.aborted).toBe(true);
  expect(causalRefresh).not.toBe(dayTwo);
  expect(gate.isCurrent(causalRefresh)).toBe(true);

  gate.finish(dayTwo);
  expect(gate.isCurrent(causalRefresh)).toBe(true);
  gate.invalidate();
  expect(causalRefresh.abortController.signal.aborted).toBe(true);
  expect(gate.isCurrent(causalRefresh)).toBe(false);
});
