import {
  CheckCircleFilled,
  InfoCircleOutlined,
  MessageOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { Button, Input, Popover, Space, Tag, Tooltip, Typography } from 'antd';
import {
  COMMENT_PLACEHOLDER,
  FAMILIARITY_ERROR_KEY,
  FAMILIARITY_TIP,
  LOCAL_STATUS_META,
  MIN_COMMENT_LENGTH,
} from '../constants';
import type {
  DraftRecord,
  FamiliarityOption,
  LocalStatus,
  ScoringItem,
  ScoringTarget,
} from '../data.d';
import { commentRequired, formatWeight, isUnknownSelected } from '../helpers';
import { useScoringStyles } from '../styles';
import ScorePicker from './ScorePicker';

type TargetCardProps = {
  target: ScoringTarget;
  record?: DraftRecord;
  items: ScoringItem[];
  familiarityOptions: FamiliarityOption[];
  status: LocalStatus;
  readonly: boolean;
  flash: boolean;
  errorCodes: string[];
  onFamiliarity: (code: string | null) => void;
  onScore: (itemCode: string, score: number) => void;
  onComment: (itemCode: string, text: string) => void;
  onOverallComment: (text: string) => void;
  registerRef: (node: HTMLDivElement | null) => void;
};

const TargetCard = ({
  target,
  record,
  items,
  familiarityOptions,
  status,
  readonly,
  flash,
  errorCodes,
  onFamiliarity,
  onScore,
  onComment,
  onOverallComment,
  registerRef,
}: TargetCardProps) => {
  const { styles, cx } = useScoringStyles();

  const skipped = isUnknownSelected(
    familiarityOptions,
    record?.familiarityCode,
  );
  const locked = readonly || status === 'submitted';
  const gated = !record?.familiarityCode;
  const errorSet = new Set(errorCodes);
  const missingFamiliarity = errorSet.has(FAMILIARITY_ERROR_KEY);
  const columns = `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))`;
  const statusMeta = LOCAL_STATUS_META[status];

  const identity = (
    <div className={styles.identity}>
      <Space size={6} align="center">
        <span className={styles.identityName}>{target.name}</span>
        {target.tags.map((tag) => (
          <Tag key={tag.id} color={tag.color} style={{ marginInlineEnd: 0 }}>
            {tag.name}
          </Tag>
        ))}
      </Space>
      <span className={styles.identityMeta}>
        {target.empNo}
        {target.leadName ? ` · ${target.leadName}带` : ''}
      </span>
      <Space size={6} align="center">
        <span
          className={styles.navDot}
          style={{ background: statusMeta.color }}
        />
        <Typography.Text style={{ fontSize: 12, color: statusMeta.color }}>
          {statusMeta.label}
        </Typography.Text>
      </Space>
    </div>
  );

  if (skipped) {
    return (
      <div
        ref={registerRef}
        className={cx(
          styles.card,
          styles.cardSkipped,
          flash && styles.cardFlash,
        )}
      >
        <div className={styles.identity}>
          <Space size={6} align="center">
            <span
              className={styles.identityName}
              style={{ color: 'rgba(0,0,0,0.45)' }}
            >
              {target.name}
            </span>
          </Space>
          <span className={styles.identityMeta}>{target.empNo}</span>
        </div>
        <Space size={8} align="center" style={{ flex: 1 }}>
          <MinusCircleOutlined style={{ color: '#bfbfbf' }} />
          <Typography.Text type="secondary">
            已跳过，不计入他的综合得分
          </Typography.Text>
          {locked ? null : (
            <Button
              type="link"
              size="small"
              onClick={() => onFamiliarity(null)}
            >
              我其实了解，改回来
            </Button>
          )}
        </Space>
      </div>
    );
  }

  return (
    <div
      ref={registerRef}
      className={cx(
        styles.card,
        status === 'submitted' && styles.cardSubmitted,
        flash && styles.cardFlash,
      )}
    >
      {identity}

      <div className={styles.familiarity}>
        <Space size={4} align="center">
          <Typography.Text
            style={{ fontSize: 12 }}
            type={missingFamiliarity ? 'danger' : 'secondary'}
          >
            熟悉程度
          </Typography.Text>
          <Tooltip title={FAMILIARITY_TIP}>
            <InfoCircleOutlined
              style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }}
            />
          </Tooltip>
        </Space>
        <div className={styles.famChips}>
          {familiarityOptions.map((option) => {
            const active = record?.familiarityCode === option.code;
            return (
              <button
                key={option.code}
                type="button"
                disabled={locked}
                className={cx(
                  styles.chip,
                  option.isUnknown && styles.chipUnknown,
                  active && !option.isUnknown && styles.chipActive,
                  active && option.isUnknown && styles.chipUnknownActive,
                )}
                onClick={() => {
                  if (locked || active) return;
                  onFamiliarity(option.code);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <Popover
          trigger="click"
          title="整体评语（可不填）"
          content={
            <Input.TextArea
              rows={4}
              maxLength={300}
              readOnly={locked}
              style={{ width: 300 }}
              placeholder="想补充的整体印象写在这里，不影响分数计算"
              value={record?.overallComment ?? ''}
              onChange={(event) => onOverallComment(event.target.value)}
            />
          }
        >
          <Button
            type="link"
            size="small"
            icon={<MessageOutlined />}
            style={{ padding: 0, height: 20, fontSize: 12 }}
          >
            {record?.overallComment ? '整体评语已填' : '加一句整体评语'}
          </Button>
        </Popover>
      </div>

      <div className={styles.itemsArea}>
        <div className={cx(gated && styles.gateInner)}>
          <div
            className={styles.itemGrid}
            style={{ gridTemplateColumns: columns }}
          >
            {items.map((item) => {
              const invalid = errorSet.has(item.code);
              return (
                <div key={item.code}>
                  <div className={styles.itemHead}>
                    <Typography.Text
                      style={{ fontSize: 12 }}
                      type={invalid ? 'danger' : undefined}
                    >
                      {item.label}
                    </Typography.Text>
                    <Typography.Text
                      type="secondary"
                      style={{ fontSize: 11, opacity: 0.8 }}
                    >
                      {formatWeight(item.weight)}
                    </Typography.Text>
                    {item.anchorText ? (
                      <Tooltip title={item.anchorText}>
                        <InfoCircleOutlined
                          style={{ fontSize: 11, color: 'rgba(0,0,0,0.3)' }}
                        />
                      </Tooltip>
                    ) : null}
                  </div>
                  <ScorePicker
                    value={record?.scores?.[item.code]}
                    disabled={gated}
                    readonly={locked}
                    onChange={(score) => onScore(item.code, score)}
                  />
                </div>
              );
            })}
          </div>

          <div
            className={styles.commentZone}
            style={{ gridTemplateColumns: columns }}
          >
            {items.some((item) =>
              commentRequired(item, record?.scores?.[item.code]),
            ) ? (
              items.map((item) => {
                const score = record?.scores?.[item.code];
                if (!commentRequired(item, score))
                  return <div key={item.code} />;
                const text = record?.comments?.[item.code] ?? '';
                const short = text.trim().length < MIN_COMMENT_LENGTH;
                return (
                  <div key={item.code}>
                    <Input.TextArea
                      rows={2}
                      maxLength={200}
                      status={
                        short && errorSet.has(item.code) ? 'error' : undefined
                      }
                      readOnly={locked}
                      placeholder={COMMENT_PLACEHOLDER}
                      value={text}
                      onChange={(event) =>
                        onComment(item.code, event.target.value)
                      }
                    />
                    <div className={styles.commentCounter}>
                      <Typography.Text
                        type={short ? 'danger' : 'secondary'}
                        style={{ fontSize: 11 }}
                      >
                        {short
                          ? `${item.label}只给 ${score} 分，还需 ${MIN_COMMENT_LENGTH - text.trim().length} 个字`
                          : '说明已达标'}
                      </Typography.Text>
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                className={styles.commentHint}
                style={{ gridColumn: '1 / -1' }}
              >
                {status === 'submitted' ? (
                  <Space size={6}>
                    <CheckCircleFilled style={{ color: '#52c41a' }} />
                    本条已提交，如需更正请联系管理员
                  </Space>
                ) : (
                  `低于 ${items[0]?.commentRequiredBelow ?? 3} 分的题项会在这里展开必填说明框，说明不少于 ${MIN_COMMENT_LENGTH} 个字`
                )}
              </div>
            )}
          </div>
        </div>

        {gated ? (
          <div className={styles.gate}>
            <InfoCircleOutlined />
            请先选择熟悉程度
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TargetCard;
