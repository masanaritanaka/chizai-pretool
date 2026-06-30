export const DISCLAIMER_TEXT =
  '本ツールは登録可能性・権利侵害の有無を判定・保証するものではありません。初期調査と論点整理の補助を目的としています。最終判断は弁理士・知財部にご相談ください。';

export function DisclaimerBanner() {
  return (
    <div className="disclaimer-banner" role="note">
      {DISCLAIMER_TEXT}
    </div>
  );
}
