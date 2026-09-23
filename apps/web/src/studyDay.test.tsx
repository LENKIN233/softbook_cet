import {act,renderHook} from '@testing-library/react';
import {useChinaDay} from '../../mobile/src/local/useStudyProfile';
import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>vi.useRealTimers());
it('updates the China product day at midnight without another user action',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-19T15:59:59.000Z'));
 const hook=renderHook(()=>useChinaDay());expect(hook.result.current.day).toBe('2026-09-19');
 act(()=>vi.advanceTimersByTime(1100));expect(hook.result.current.day).toBe('2026-09-20');hook.unmount();
});
it('refreshes immediately after a clock jump when the page becomes active',()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-19T01:00:00.000Z'));
 const hook=renderHook(()=>useChinaDay());vi.setSystemTime(new Date('2026-09-21T01:00:00.000Z'));
 act(()=>hook.result.current.refresh());expect(hook.result.current.day).toBe('2026-09-21');hook.unmount();
});
