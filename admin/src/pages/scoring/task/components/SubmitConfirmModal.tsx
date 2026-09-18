import { Alert, Checkbox, Modal, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useScoringStyles } from '../styles';

type UnfilledRow = {
  employeeId: number;
  name: string;
};

type SubmitConfirmModalProps = {
  open: boolean;
  loading: boolean;
  doneCount: number;
  skippedCount: number;
  unfilled: UnfilledRow[];
  onCancel: () => void;
  onJump: (employeeId: number) => void;
  onConfirm: (markRestUnknown: boolean) => void;
};

const SubmitConfirmModal = ({
  open,
  loading,
  doneCount,
  skippedCount,
  unfilled,
  onCancel,
  onJump,
  onConfirm,
}: SubmitConfirmModalProps) => {
  const { styles } = useScoringStyles();
  const [markRest, setMarkRest] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (open) return;
    setMarkRest(false);
    setAcknowledged(false);
  }, [open]);

  const hasUnfilled = unfilled.length > 0;
  const blocked = markRest && !acknowledged;
  const nothingToSubmit = doneCount + skippedCount === 0 && !markRest;

  const okText = markRest
    ? `标记剩余 ${unfilled.length} 人并提交 ${doneCount + skippedCount + unfilled.length} 条`
    : `确认提交 ${doneCount + skippedCount} 条`;

  return (
    <Modal
      open={open}
      title="提交前再确认一次"
      width={560}
      okText={okText}
      cancelText="再改改"
      confirmLoading={loading}
      okButtonProps={{ disabled: blocked || nothingToSubmit }}
      onCancel={onCancel}
      onOk={() => onConfirm(markRest)}
      destroyOnHidden
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Space size={24}>
          <Space direction="vertical" size={0}>
            <span className={styles.statValue} style={{ color: '#389e0d' }}>
              {doneCount}
            </span>
            <span className={styles.statLabel}>已评</span>
          </Space>
          <Space direction="vertical" size={0}>
            <span className={styles.statValue} style={{ color: '#8c8c8c' }}>
              {skippedCount}
            </span>
            <span className={styles.statLabel}>跳过</span>
          </Space>
          <Space direction="vertical" size={0}>
            <span
              className={styles.statValue}
              style={{ color: hasUnfilled ? '#d46b08' : undefined }}
            >
              {unfilled.length}
            </span>
            <span className={styles.statLabel}>未填</span>
          </Space>
        </Space>

        {hasUnfilled ? (
          <Alert
            type="warning"
            showIcon
            title={`还有 ${unfilled.length} 人一个字都没填`}
            description={
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space size={[8, 4]} wrap>
                  {unfilled.map((row) => (
                    <span
                      key={row.employeeId}
                      className={styles.unfilledName}
                      onClick={() => onJump(row.employeeId)}
                    >
                      {row.name}
                    </span>
                  ))}
                </Space>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  点姓名可以跳回去补填。直接提交的话，这些人本期保持未填状态，截止前还能继续填。
                </Typography.Text>
                <Checkbox
                  checked={markRest}
                  onChange={(event) => {
                    setMarkRest(event.target.checked);
                    if (!event.target.checked) setAcknowledged(false);
                  }}
                >
                  把剩余 {unfilled.length} 人全部标记为不了解并一起提交
                </Checkbox>
                {markRest ? (
                  <Checkbox
                    checked={acknowledged}
                    onChange={(event) => setAcknowledged(event.target.checked)}
                  >
                    <Typography.Text type="danger" style={{ fontSize: 13 }}>
                      我确认这 {unfilled.length}{' '}
                      人本期我确实没接触过，跳过后他们不计入我这一票
                    </Typography.Text>
                  </Checkbox>
                ) : null}
              </Space>
            }
          />
        ) : null}

        <Typography.Text type="danger">
          提交后不可修改，如需更正请联系管理员。
        </Typography.Text>
      </Space>
    </Modal>
  );
};

export default SubmitConfirmModal;
