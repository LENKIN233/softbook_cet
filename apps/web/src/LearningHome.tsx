import type {LearningTrack} from '../../mobile/src/learning/model';
import type {LearningSceneOverall} from './LearningSceneNavigation';

export function LearningHome({track, today, pendingReview, overall, continuing, reviewIntent = false, busy = false, disabled = false, notice, error, startLabel, onStart}: {
  track: LearningTrack;
  today: number | null;
  pendingReview: number | null;
  overall: LearningSceneOverall;
  continuing: boolean;
  reviewIntent?: boolean;
  busy?: boolean;
  disabled?: boolean;
  notice?: string | null;
  error?: string | null;
  startLabel?: string;
  onStart: () => void;
}) {
  const coverageKnown = overall.learned !== null && overall.total !== null && !overall.loading;
  const coverageLabel = overall.scope === 'accessible' ? '可学卡片已练' : '本库已练过';
  return <main className="learning-home-workbench">
    <section className="learning-home" aria-labelledby="learning-home-title">
      <header className="learning-home-course">
        <p className="learning-home-eyebrow">你的课程 <span>CET {track === 'cet6' ? '6' : '4'}</span></p>
        <h1 id="learning-home-title">{track === 'cet6' ? '英语六级' : '英语四级'}</h1>
        <p className="learning-home-description">听力、阅读、写作与翻译<br />从一张卡开始，按自己的节奏学。</p>
        <div className="learning-home-paper" aria-hidden="true"><span>CET {track === 'cet6' ? '6' : '4'}</span><i /><i /><i /></div>
      </header>
      <div className="learning-home-entry">
        <dl className="learning-home-facts">
          <div><dt>今天练过</dt><dd>{today === null ? <span className="learning-home-unknown">待更新</span> : <>{today}<span> 张</span></>}</dd></div>
          <div><dt>待复习</dt><dd>{pendingReview === null ? <span className="learning-home-unknown">待更新</span> : <>{pendingReview}<span> 张</span></>}</dd></div>
        </dl>
        <div className="learning-home-coverage">
          <p>{overall.loading ? '学习进度更新中' : coverageKnown ? `${coverageLabel} ${overall.learned}/${overall.total} 张` : '学习进度暂不可读'}</p>
          {coverageKnown && overall.total! > 0 ? <progress aria-label={overall.scope === 'accessible' ? '可学卡片学习进度' : '本库学习进度'} value={overall.learned!} max={overall.total!} /> : null}
        </div>
        <div className="learning-home-start">
          <p>{reviewIntent ? '先回顾需要复习的卡片。' : continuing ? '接着学习，随时可以返回这里。' : '一轮五次练习，随时可以停下来。'}</p>
          <button className="primary" disabled={disabled || busy} onClick={onStart}>{busy ? '正在准备…' : startLabel ?? (reviewIntent ? '开始复习' : continuing ? '继续学习' : '开始学习')}</button>
        </div>
        {notice ? <p className="learning-home-notice" role="status">{notice}</p> : null}
        {error ? <p className="notice error" role="alert">{error}</p> : null}
      </div>
    </section>
  </main>;
}
