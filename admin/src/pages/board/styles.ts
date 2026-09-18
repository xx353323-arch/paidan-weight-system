import { createStyles, keyframes, responsive } from 'antd-style';

const floatA = keyframes`
  0%   { transform: translate3d(0, 0, 0) scale(1); }
  33%  { transform: translate3d(6vw, -4vh, 0) scale(1.08); }
  66%  { transform: translate3d(-4vw, 5vh, 0) scale(0.95); }
  100% { transform: translate3d(0, 0, 0) scale(1); }
`;

const floatB = keyframes`
  0%   { transform: translate3d(0, 0, 0) scale(1); }
  40%  { transform: translate3d(-7vw, 6vh, 0) scale(1.12); }
  75%  { transform: translate3d(5vw, -3vh, 0) scale(0.92); }
  100% { transform: translate3d(0, 0, 0) scale(1); }
`;

const riseIn = keyframes`
  from { opacity: 0; transform: translate3d(0, 24px, 0); }
  to   { opacity: 1; transform: translate3d(0, 0, 0); }
`;

const podiumGrow = keyframes`
  from { opacity: 0; transform: translate3d(0, 40px, 0) scaleY(0.82); }
  to   { opacity: 1; transform: translate3d(0, 0, 0) scaleY(1); }
`;

const shimmer = keyframes`
  0%   { opacity: 0.35; }
  50%  { opacity: 0.7; }
  100% { opacity: 0.35; }
`;

export const useBoardStyles = createStyles(({ token, css }) => {
  const glass = css`
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.65);
    box-shadow:
      0 8px 32px rgba(31, 38, 135, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    border-radius: 24px;
  `;

  return {
    glass,

    page: css`
      position: relative;
      min-height: 100vh;
      padding: 32px 24px 72px;
      overflow: hidden;
      background: linear-gradient(170deg, #eef4ff 0%, #f7f3ff 45%, #fdf2f8 100%);
      ${responsive.mobile} {
        padding: 20px 14px 48px;
      }
    `,

    embedded: css`
      min-height: auto;
      margin: -24px;
      padding: 28px 24px 56px;
      border-radius: ${token.borderRadiusLG}px;
    `,

    orbLayer: css`
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 0;
    `,

    orb: css`
      position: absolute;
      border-radius: 50%;
      filter: blur(90px);
      will-change: transform;
      @media (prefers-reduced-motion: reduce) {
        animation: none !important;
      }
    `,
    orbOne: css`
      width: 46vw;
      height: 46vw;
      top: -12vh;
      left: -8vw;
      background: radial-gradient(circle, rgba(99, 152, 255, 0.55) 0%, rgba(99, 152, 255, 0) 70%);
      animation: ${floatA} 26s ease-in-out infinite;
    `,
    orbTwo: css`
      width: 40vw;
      height: 40vw;
      top: 18vh;
      right: -10vw;
      background: radial-gradient(circle, rgba(178, 132, 255, 0.5) 0%, rgba(178, 132, 255, 0) 70%);
      animation: ${floatB} 32s ease-in-out infinite;
    `,
    orbThree: css`
      width: 36vw;
      height: 36vw;
      bottom: -14vh;
      left: 22vw;
      background: radial-gradient(circle, rgba(255, 158, 205, 0.42) 0%, rgba(255, 158, 205, 0) 70%);
      animation: ${floatA} 38s ease-in-out infinite reverse;
    `,

    inner: css`
      position: relative;
      z-index: 1;
      max-width: 880px;
      margin: 0 auto;
    `,

    enter: css`
      opacity: 0;
      animation: ${riseIn} 0.62s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      animation-delay: calc(var(--i, 0) * 70ms);
      @media (prefers-reduced-motion: reduce) {
        opacity: 1;
        animation: none;
      }
    `,

    topBar: css`
      ${glass};
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 22px;
      margin-bottom: 22px;
      border-radius: 20px;
    `,
    brand: css`
      display: flex;
      align-items: baseline;
      gap: 12px;
      min-width: 0;
    `,
    brandTitle: css`
      font-size: 18px;
      font-weight: 600;
      color: ${token.colorTextHeading};
      white-space: nowrap;
    `,
    brandPeriod: css`
      font-size: 13px;
      color: ${token.colorTextTertiary};
      white-space: nowrap;
    `,

    mineCard: css`
      ${glass};
      position: relative;
      padding: 28px 30px;
      margin-bottom: 24px;
      overflow: hidden;
    `,
    mineGlow: css`
      position: absolute;
      top: -60%;
      right: -10%;
      width: 60%;
      height: 200%;
      background: radial-gradient(circle, rgba(22, 119, 255, 0.16) 0%, rgba(22, 119, 255, 0) 65%);
      pointer-events: none;
      animation: ${shimmer} 6s ease-in-out infinite;
      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    `,
    mineLabel: css`
      font-size: 13px;
      letter-spacing: 0.06em;
      color: ${token.colorTextTertiary};
      margin-bottom: 14px;
    `,
    mineGrid: css`
      position: relative;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
      ${responsive.mobile} {
        grid-template-columns: repeat(2, 1fr);
        gap: 20px 12px;
      }
    `,
    metric: css`
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    `,
    metricLabel: css`
      font-size: 12px;
      color: ${token.colorTextTertiary};
    `,
    metricValue: css`
      display: flex;
      align-items: baseline;
      gap: 4px;
      font-size: 30px;
      font-weight: 600;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      color: ${token.colorTextHeading};
      ${responsive.mobile} {
        font-size: 26px;
      }
    `,
    metricSuffix: css`
      font-size: 14px;
      font-weight: 400;
      color: ${token.colorTextTertiary};
    `,

    switcher: css`
      display: flex;
      justify-content: center;
      margin-bottom: 26px;
    `,
    segmented: css`
      ${glass};
      padding: 5px;
      border-radius: 16px;
      display: inline-flex;
      gap: 4px;
    `,
    segmentItem: css`
      padding: 7px 22px;
      border: none;
      border-radius: 12px;
      background: transparent;
      font-size: 14px;
      color: ${token.colorTextSecondary};
      cursor: pointer;
      transition: all ${token.motionDurationMid} ease;
      &:hover {
        color: ${token.colorText};
      }
    `,
    segmentActive: css`
      background: rgba(255, 255, 255, 0.92);
      color: ${token.colorTextHeading};
      font-weight: 600;
      box-shadow: 0 2px 10px rgba(31, 38, 135, 0.1);
    `,

    podium: css`
      display: grid;
      grid-template-columns: 1fr 1.16fr 1fr;
      align-items: end;
      gap: 14px;
      margin-bottom: 26px;
      ${responsive.mobile} {
        gap: 8px;
      }
    `,
    podiumSlot: css`
      ${glass};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 20px 10px 18px;
      opacity: 0;
      animation: ${podiumGrow} 0.72s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      animation-delay: calc(var(--i, 0) * 110ms);
      transform-origin: bottom center;
      @media (prefers-reduced-motion: reduce) {
        opacity: 1;
        animation: none;
      }
    `,
    podiumFirst: css`
      min-height: 196px;
      ${responsive.mobile} {
        min-height: 158px;
      }
    `,
    podiumSecond: css`
      min-height: 162px;
      ${responsive.mobile} {
        min-height: 132px;
      }
    `,
    podiumThird: css`
      min-height: 142px;
      ${responsive.mobile} {
        min-height: 118px;
      }
    `,
    podiumMine: css`
      border: 1px solid ${token.colorPrimaryBorder};
      box-shadow:
        0 10px 36px rgba(22, 119, 255, 0.22),
        inset 0 1px 0 rgba(255, 255, 255, 0.9);
    `,
    medal: css`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-size: 17px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      ${responsive.mobile} {
        width: 34px;
        height: 34px;
        font-size: 15px;
      }
    `,
    medalGold: css`
      color: #7c4a00;
      background: linear-gradient(135deg, #ffe58f 0%, #ffc53d 100%);
      box-shadow: 0 4px 16px rgba(250, 173, 20, 0.45);
    `,
    medalSilver: css`
      color: #4d4d4d;
      background: linear-gradient(135deg, #f5f5f5 0%, #c9c9c9 100%);
      box-shadow: 0 4px 14px rgba(140, 140, 140, 0.35);
    `,
    medalBronze: css`
      color: #6b3a10;
      background: linear-gradient(135deg, #ffd8a8 0%, #d48806 100%);
      box-shadow: 0 4px 14px rgba(212, 136, 6, 0.35);
    `,
    podiumScore: css`
      font-size: 26px;
      font-weight: 600;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
      color: ${token.colorTextHeading};
      ${responsive.mobile} {
        font-size: 21px;
      }
    `,
    podiumScoreFirst: css`
      font-size: 32px;
      ${responsive.mobile} {
        font-size: 25px;
      }
    `,
    meChip: css`
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      color: #fff;
      background: ${token.colorPrimary};
      box-shadow: 0 2px 8px rgba(22, 119, 255, 0.35);
    `,

    list: css`
      display: flex;
      flex-direction: column;
      gap: 10px;
    `,
    row: css`
      ${glass};
      display: grid;
      grid-template-columns: 56px 1fr auto auto;
      align-items: center;
      gap: 14px;
      padding: 15px 22px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.42);
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
      opacity: 0;
      animation: ${riseIn} 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      animation-delay: calc(var(--i, 0) * 45ms);
      transition:
        transform ${token.motionDurationMid} ease,
        background ${token.motionDurationMid} ease;
      &:hover {
        transform: translate3d(0, -2px, 0);
        background: rgba(255, 255, 255, 0.62);
      }
      @media (prefers-reduced-motion: reduce) {
        opacity: 1;
        animation: none;
      }
      ${responsive.mobile} {
        grid-template-columns: 44px 1fr auto;
        gap: 10px;
        padding: 13px 16px;
      }
    `,
    rowMine: css`
      background: rgba(255, 255, 255, 0.78);
      border: 1px solid ${token.colorPrimaryBorder};
      box-shadow:
        0 6px 24px rgba(22, 119, 255, 0.16),
        inset 0 1px 0 rgba(255, 255, 255, 0.9);
    `,
    rowRank: css`
      font-size: 17px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: ${token.colorTextSecondary};
      text-align: center;
    `,
    rowBar: css`
      height: 6px;
      border-radius: 3px;
      background: rgba(22, 119, 255, 0.12);
      overflow: hidden;
      ${responsive.mobile} {
        display: none;
      }
    `,
    rowBarFill: css`
      height: 100%;
      border-radius: 3px;
      background: linear-gradient(90deg, rgba(22, 119, 255, 0.55) 0%, rgba(114, 46, 209, 0.5) 100%);
      transition: width 0.8s cubic-bezier(0.22, 1, 0.36, 1);
    `,
    rowScore: css`
      font-size: 19px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: ${token.colorTextHeading};
      min-width: 74px;
      text-align: right;
    `,

    gradeTag: css`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 30px;
      height: 24px;
      padding: 0 9px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.9);
    `,

    footer: css`
      margin-top: 32px;
      text-align: center;
      font-size: 12px;
      color: ${token.colorTextQuaternary};
      line-height: 1.9;
    `,

    stateCard: css`
      ${glass};
      padding: 56px 24px;
      text-align: center;
    `,
  };
});
