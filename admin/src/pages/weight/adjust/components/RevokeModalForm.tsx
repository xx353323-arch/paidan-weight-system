import { ModalForm, ProFormTextArea } from '@ant-design/pro-components';
import { useMutation } from '@tanstack/react-query';
import { App, Descriptions } from 'antd';
import type React from 'react';
import { bizMessage, formatPeriodTitle } from '../constants';
import type { AdjustmentItem } from '../data.d';
import { revokeAdjustment } from '../service';

type RevokeModalFormProps = {
  trigger: React.ReactElement<any>;
  record: AdjustmentItem;
  onSuccess?: () => void;
};

const RevokeModalForm: React.FC<RevokeModalFormProps> = ({
  trigger,
  record,
  onSuccess,
}) => {
  const { message, modal } = App.useApp();

  const { mutateAsync: revoke, isPending } = useMutation({
    mutationFn: (reason: string) => revokeAdjustment(record.id, reason),
  });

  return (
    <ModalForm<{ reason: string }>
      title="撤销调权记录"
      trigger={trigger}
      width={560}
      layout="vertical"
      modalProps={{
        destroyOnHidden: true,
        okButtonProps: { loading: isPending, danger: true },
        okText: '提交撤销',
        cancelText: '取消',
      }}
      onFinish={async (values) => {
        const confirmed = await new Promise<boolean>((resolve) => {
          modal.confirm({
            title: '确认撤销这条调整',
            content:
              '撤销后该调整在下次跑批时不再生效，已发布的历史结果不受影响。调权记录不做物理删除，撤销动作会以追加的方式留痕。',
            okText: '确认撤销',
            okButtonProps: { danger: true },
            cancelText: '再想想',
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!confirmed) return false;
        try {
          await revoke(values.reason.trim());
          message.success('调整已撤销，下次跑批不再生效');
          onSuccess?.();
          return true;
        } catch (error) {
          message.error(bizMessage(error, '撤销失败，请稍后重试'));
          return false;
        }
      }}
    >
      <Descriptions
        size="small"
        column={2}
        style={{ marginBottom: 16 }}
        items={[
          { key: 'employee', label: '员工', children: record.employeeName },
          {
            key: 'type',
            label: '调整方式',
            children: `${record.adjustTypeLabel} ${record.valueLabel}`,
          },
          {
            key: 'period',
            label: '适用周期',
            children: record.effectiveToCode
              ? `${formatPeriodTitle(record.effectiveFromCode)} 至 ${formatPeriodTitle(record.effectiveToCode)}`
              : `${formatPeriodTitle(record.effectiveFromCode)} 起长期`,
          },
          {
            key: 'creator',
            label: '创建人',
            children: record.createdByName ?? '未知',
          },
          {
            key: 'reason',
            label: '原始原因',
            span: 2,
            children: record.reason,
          },
        ]}
      />
      <ProFormTextArea
        name="reason"
        label="撤销原因"
        rules={[
          { required: true, message: '请填写撤销原因' },
          { min: 5, message: '撤销原因至少填写 5 个字' },
        ]}
        fieldProps={{
          showCount: true,
          maxLength: 200,
          autoSize: { minRows: 3, maxRows: 5 },
          placeholder:
            '说明为什么撤销，例如误操作、情况已变化、管理层复核后取消',
        }}
      />
    </ModalForm>
  );
};

export default RevokeModalForm;
