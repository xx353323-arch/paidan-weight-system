import type { ProFormInstance } from '@ant-design/pro-components';
import {
  DrawerForm,
  ProFormDependency,
  ProFormDigit,
  ProFormRadio,
  ProFormSelect,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, App, Slider, Space, Tag, Typography } from 'antd';
import type React from 'react';
import { useRef, useState } from 'react';
import {
  ADJUST_QUERY_KEY,
  ADJUST_TYPE_HINT,
  ADJUST_TYPE_OPTIONS,
  bizMessage,
  formatGrade,
  formatRank,
  formatScore,
  GRADE_COLOR,
} from '../constants';
import type {
  AdjustmentCreatePayload,
  AdjustmentFormValues,
  AdjustType,
} from '../data.d';
import {
  createAdjustment,
  fetchEmployeeOptions,
  fetchEmployeeScores,
  fetchPeriodOptions,
} from '../service';
import AdjustPreview from './AdjustPreview';

type FormRef = ProFormInstance<AdjustmentFormValues> & {
  nativeElement?: HTMLElement;
  focus?: () => void;
};

type AdjustDrawerFormProps = {
  trigger: React.ReactElement<any>;
  onSuccess?: () => void;
};

const TYPE_DEFAULT_VALUE: Record<AdjustType, number | undefined> = {
  MULTIPLIER: 1,
  DELTA: undefined,
  OVERRIDE: undefined,
  FREEZE: undefined,
};

const AdjustDrawerForm: React.FC<AdjustDrawerFormProps> = ({
  trigger,
  onSuccess,
}) => {
  const formRef = useRef<FormRef | undefined>(undefined);
  const { message, modal } = App.useApp();
  const [open, setOpen] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: [ADJUST_QUERY_KEY, 'employee-options'],
    queryFn: fetchEmployeeOptions,
    staleTime: 5 * 60_000,
  });

  const { data: periods = [] } = useQuery({
    queryKey: [ADJUST_QUERY_KEY, 'period-options'],
    queryFn: fetchPeriodOptions,
    staleTime: 5 * 60_000,
  });

  const { data: scores = {} } = useQuery({
    queryKey: [ADJUST_QUERY_KEY, 'employee-scores'],
    queryFn: fetchEmployeeScores,
    staleTime: 5 * 60_000,
  });

  const { mutateAsync: save } = useMutation({
    mutationFn: createAdjustment,
  });

  const defaultPeriodId = periods[0]?.value;
  const periodCode = (id?: number | null) =>
    periods.find((item) => item.value === id)?.code ?? '';

  const renderValueField = (adjustType?: AdjustType) => {
    if (adjustType === 'FREEZE') {
      return (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
          title="冻结后该员工最终分记 0，退出派单池，不参与排名"
          description="适用于离职交接、停职等场景。冻结优先级最高，同期的乘数、加减分与绝对覆盖全部作废。撤销冻结之后，下次跑批该员工重新进入排名。"
        />
      );
    }
    if (adjustType === 'MULTIPLIER') {
      return (
        <>
          <ProFormDigit
            name="value"
            label="乘数"
            min={0.1}
            max={2}
            rules={[{ required: true, message: '请填写乘数' }]}
            fieldProps={{
              step: 0.05,
              precision: 2,
              addonAfter: '倍',
              style: { width: '100%' },
            }}
            extra={ADJUST_TYPE_HINT.MULTIPLIER}
          />
          <ProFormDependency name={['value']}>
            {({ value }) => (
              <div style={{ padding: '0 10px', marginBottom: 20 }}>
                <Slider
                  min={0.1}
                  max={2}
                  step={0.05}
                  value={typeof value === 'number' ? value : 1}
                  onChange={(next) =>
                    formRef.current?.setFieldValue('value', next)
                  }
                  marks={{
                    0.1: '0.1',
                    0.5: '0.5',
                    1: '1.0',
                    1.5: '1.5',
                    2: '2.0',
                  }}
                />
              </div>
            )}
          </ProFormDependency>
        </>
      );
    }
    if (adjustType === 'DELTA') {
      return (
        <ProFormDigit
          name="value"
          label="加减分"
          min={-30}
          max={30}
          rules={[{ required: true, message: '请填写加减分' }]}
          fieldProps={{
            step: 1,
            addonAfter: '分',
            style: { width: '100%' },
            placeholder: '加分填正数，减分填负数',
          }}
          extra={ADJUST_TYPE_HINT.DELTA}
        />
      );
    }
    if (adjustType === 'OVERRIDE') {
      return (
        <ProFormDigit
          name="value"
          label="覆盖分数"
          min={0}
          max={100}
          rules={[{ required: true, message: '请填写覆盖分数' }]}
          fieldProps={{
            step: 1,
            addonAfter: '分',
            style: { width: '100%' },
            placeholder: '直接指定该员工的最终分',
          }}
          extra={ADJUST_TYPE_HINT.OVERRIDE}
        />
      );
    }
    return null;
  };

  return (
    <DrawerForm<AdjustmentFormValues>
      title="新建人工调权"
      trigger={trigger}
      formRef={formRef}
      width={720}
      layout="vertical"
      open={open}
      onOpenChange={setOpen}
      drawerProps={{ destroyOnHidden: true, maskClosable: false }}
      submitter={{
        searchConfig: { submitText: '保存调整', resetText: '取消' },
      }}
      initialValues={{
        adjustType: 'MULTIPLIER',
        value: 1,
        effectiveFromPeriodId: defaultPeriodId,
      }}
      onFinish={async (values) => {
        if (!values.employeeId || !values.adjustType) {
          message.warning('请先选择员工与调整类型');
          return false;
        }
        const from = periodCode(values.effectiveFromPeriodId);
        const to = periodCode(values.effectiveToPeriodId);
        if (from && to && to < from) {
          message.warning('失效周期不能早于生效周期');
          return false;
        }
        const payload: AdjustmentCreatePayload = {
          employeeId: values.employeeId,
          adjustType: values.adjustType,
          value: values.adjustType === 'FREEZE' ? null : values.value,
          reason: (values.reason ?? '').trim(),
          effectiveFromPeriodId: values.effectiveFromPeriodId as number,
          effectiveToPeriodId: values.effectiveToPeriodId ?? null,
        };
        try {
          const res = await save(payload);
          const warnings = res?.data?.warnings ?? [];
          if (warnings.length) {
            modal.warning({
              title: '调整已保存，但存在优先级冲突',
              width: 520,
              okText: '好的',
              content: (
                <ul style={{ paddingInlineStart: 20, margin: '8px 0 0' }}>
                  {warnings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            });
          } else {
            message.success('调整已保存，下次跑批时生效');
          }
          onSuccess?.();
          return true;
        } catch (error) {
          message.error(bizMessage(error, '保存调整失败，请稍后重试'));
          return false;
        }
      }}
    >
      <ProFormSelect
        name="employeeId"
        label="调整对象"
        showSearch
        options={employees}
        rules={[{ required: true, message: '请选择需要调整的员工' }]}
        fieldProps={{
          placeholder: '输入姓名或工号搜索',
          optionFilterProp: 'label',
        }}
      />
      <ProFormDependency name={['employeeId']}>
        {({ employeeId }) => {
          if (!employeeId) {
            return (
              <Typography.Paragraph type="secondary" style={{ marginTop: -16 }}>
                选定员工之后，这里显示该员工最近一期发布的权重分与排名。
              </Typography.Paragraph>
            );
          }
          const current = scores[employeeId as number];
          if (!current) {
            return (
              <Typography.Paragraph type="secondary" style={{ marginTop: -16 }}>
                该员工暂时没有已发布的评价结果，调整会在下次跑批时叠加到新算出的分数上。
              </Typography.Paragraph>
            );
          }
          return (
            <Space size={8} style={{ marginTop: -16, marginBottom: 20 }} wrap>
              <Typography.Text type="secondary">当前</Typography.Text>
              <Typography.Text strong>
                {formatScore(current.wFinal)} 分
              </Typography.Text>
              <Typography.Text type="secondary">·</Typography.Text>
              <Typography.Text strong>
                {formatRank(current.rankNo)}
              </Typography.Text>
              <Tag color={GRADE_COLOR[current.gradeCode ?? ''] ?? 'default'}>
                {formatGrade(current.gradeCode)}
              </Tag>
            </Space>
          );
        }}
      </ProFormDependency>
      <ProFormRadio.Group
        name="adjustType"
        label="调整方式"
        radioType="button"
        options={ADJUST_TYPE_OPTIONS}
        rules={[{ required: true, message: '请选择调整方式' }]}
        fieldProps={{
          onChange: (event: any) => {
            const next = event?.target?.value as AdjustType;
            formRef.current?.setFieldValue('value', TYPE_DEFAULT_VALUE[next]);
          },
        }}
        extra="四种方式按冻结、绝对覆盖、乘数与加减分的先后顺序短路生效，不叠加。"
      />
      <ProFormDependency name={['adjustType']}>
        {({ adjustType }) => renderValueField(adjustType as AdjustType)}
      </ProFormDependency>
      <ProFormTextArea
        name="reason"
        label="调整原因"
        rules={[
          { required: true, message: '请填写调整原因' },
          { min: 10, message: '调整原因至少填写 10 个字，便于以后追溯' },
        ]}
        fieldProps={{
          showCount: true,
          maxLength: 200,
          autoSize: { minRows: 3, maxRows: 5 },
          placeholder:
            '写清楚为什么调整、依据是什么，调权记录不可修改也不可删除',
        }}
      />
      <ProFormSelect
        name="effectiveFromPeriodId"
        label="生效周期"
        options={periods}
        rules={[{ required: true, message: '请选择生效周期' }]}
        fieldProps={{ placeholder: '从哪一期开始生效' }}
      />
      <ProFormSelect
        name="effectiveToPeriodId"
        label="失效周期"
        options={periods}
        allowClear
        fieldProps={{ placeholder: '留空表示长期有效' }}
        extra="填写之后，跑批跑到更晚的周期时这条调整自动失效。"
      />
      <ProFormDependency
        name={['employeeId', 'adjustType', 'value', 'effectiveFromPeriodId']}
      >
        {({ employeeId, adjustType, value, effectiveFromPeriodId }) => (
          <AdjustPreview
            employeeId={employeeId as number}
            adjustType={adjustType as AdjustType}
            value={value as number}
            periodId={effectiveFromPeriodId as number}
          />
        )}
      </ProFormDependency>
    </DrawerForm>
  );
};

export default AdjustDrawerForm;
