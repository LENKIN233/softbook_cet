import {IconLabel} from './StudioIcon';
export type LearningSceneProgress = {
  roundIndex: number | null;
  completedCount: number;
  total: number;
};

export type LearningSceneOverall = {
  learned: number | null;
  total: number | null;
  scope?: 'accessible' | 'library';
  loading?: boolean;
};

export function LearningSceneNavigation({progress, overall, onExit, onOpenSpace, spaceDisabled = false}: {
  progress: LearningSceneProgress;
  overall: LearningSceneOverall;
  onExit: () => void;
  onOpenSpace: () => void;
  spaceDisabled?: boolean;
}) {
  const total = Math.max(1, progress.total);
  const completed = Math.min(total, Math.max(0, progress.completedCount));
  const overallLabel = overall.scope === 'accessible' ? '可学卡片' : '本库';
  return <nav className="learning-scene-navigation" aria-label="学习操作">
    <button className="scene-exit" onClick={onExit}><IconLabel name="chevronLeft">返回</IconLabel></button>
    <div className="scene-progress" aria-live="polite">
      <div className="scene-round" role="status" aria-label={`${progress.roundIndex === null ? '本轮' : `第 ${progress.roundIndex} 轮`} · 已完成 ${completed}/${total}`}><span>{progress.roundIndex === null ? '本轮' : `第 ${progress.roundIndex} 轮`}</span><strong>{completed}/{total}</strong></div>
      <ol className="scene-trail" aria-label={`本轮已确认 ${completed}/${total}`}>
        {Array.from({length: total}, (_, index) => <li key={index} className={index < completed ? 'confirmed' : ''} aria-label={`第 ${index + 1} 张${index < completed ? '已确认' : '未确认'}`} />)}
      </ol>
    </div>
    <button className="scene-space" disabled={spaceDisabled} onClick={onOpenSpace}><IconLabel name="map">空间</IconLabel></button>
    <small className="scene-overall">{overall.loading ? `${overallLabel}进度更新中` : overall.learned === null || overall.total === null ? `${overallLabel}进度暂不可读` : `${overall.scope === 'accessible' ? '可学卡片已练' : '本库已练过'} ${overall.learned}/${overall.total} 张`}</small>
  </nav>;
}
