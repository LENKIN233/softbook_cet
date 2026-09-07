# Readability calibration

These are real development-app screenshots from `454b4d5f79ae36fe675c454a4b57716dddf4df6d`, captured on iPhone 17 Pro / iOS 26.4 on 2026-09-05. They are deliberately broken examples, not accepted designs or formal content evidence.

- `material.png`: elimination card `013001` renders its choices without the required sentence in `front.support`.
- `answer.png`: the correction screen contains a `learning-detail-correct-answer` accessibility node, but the explanation covers its pixels.

`scripts/run_experience_acceptance.mjs` must reject both and accept freshly captured repaired journeys. A clean run's screenshots are positive examples, not frozen pixel snapshots. OCR does not assess aesthetics, all occlusion patterns, or comprehension. Update calibration together with the sample if the consumed development payload changes.
