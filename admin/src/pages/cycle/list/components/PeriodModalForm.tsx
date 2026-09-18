import {
  ModalForm,
  ProFormDatePicker,
  ProFormDateTimeRangePicker,
  ProFormText,
} from '@ant-design/pro-components';
import { useMutation } from '@tanstack/react-query';
import { App } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { bizMessage } from '../../constants';
import type {
  PeriodCreatePayload,
  PeriodFormValues,
  PeriodItem,
} from '../data.d';
import { createPeriod, updatePeriodTime } from '../service';

const SUBMIT_FORMAT = 'YYYY-MM-DDTHH:mm:ss';

type PeriodModalFormProps = {
  trigger: React.ReactElement<any>;
  values?: PeriodItem;
  onSuccess?: () => void;
};

const PeriodModalForm: React.FC<PeriodModalFormProps> = ({
  trigger,
  values,
  onSuccess,
}) => {
  const { message } = App.useApp();
  const isEdit = Boolean(values?.id);

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: async (payload: PeriodCreatePayload) =>
      isEdit && values
        ? updatePeriodTime(values.id, {
            openAt: payload.openAt,
            closeAt: payload.closeAt,
          })
        : createPeriod(payload),
    onSuccess: () => {
      message.success(isEdit ? '周期时间已更新' : '周期已创建，可在列表中开启');
      onSuccess?.();
    },
    onError: (error) => {
      message.error(
        bizMessage(error, isEdit ? '周期时间更新失败' : '周期创建失败'),
      );
    },
  });

  return (
    <ModalForm<PeriodFormValues>
      title={isEdit ? '调整填报时间' : '新建评价周期'}
      trigger={trigger}
      width={520}
      layout="horizontal"
      labelCol={{ span: 6 }}
      wrapperCol={{ span: 16 }}
      modalProps={{
        destroyOnHidden: true,
        okButtonProps: { loading: isPending },
        okText: '保存',
        cancelText: '取消',
      }}
      initialValues={
        values
          ? {
              code: values.code,
              month: dayjs(`${values.code}-01`),
              range:
                values.openAt && values.closeAt
                  ? [dayjs(values.openAt), dayjs(values.closeAt)]
                  : undefined,
            }
          : { month: dayjs().startOf('month') }
      }
      onFinish={async (formValues) => {
        const range = formValues.range;
        const openAt = range?.[0]
          ? dayjs(range[0]).format(SUBMIT_FORMAT)
          : null;
        const closeAt = range?.[1]
          ? dayjs(range[1]).format(SUBMIT_FORMAT)
          : null;
        if (openAt && closeAt && !dayjs(closeAt).isAfter(dayjs(openAt))) {
          message.warning('截止时间必须晚于开始时间');
          return false;
        }
        const code =
          isEdit && values
            ? values.code
            : dayjs(formValues.month).format('YYYY-MM');
        if (!code || code === 'Invalid Date') {
          message.warning('请选择归属月份');
          return false;
        }
        try {
          await save({ code, openAt, closeAt });
          return true;
        } catch {
          return false;
        }
      }}
    >
      {isEdit ? (
        <ProFormText name="code" label="归属月份" disabled />
      ) : (
        <ProFormDatePicker
          name="month"
          label="归属月份"
          rules={[{ required: true, message: '请选择归属月份' }]}
          fieldProps={{
            picker: 'month',
            format: 'YYYY-MM',
            style: { width: '100%' },
            placeholder: '选择考核归属月份',
          }}
          extra="一个月份只能建一个周期，编码格式形如 2026-09"
        />
      )}
      <ProFormDateTimeRangePicker
        name="range"
        label="填报起止"
        fieldProps={{
          style: { width: '100%' },
          placeholder: ['填报开始时间', '填报截止时间'],
        }}
        extra="可留空，开启周期时会自动把当前时间记为开始时间"
      />
    </ModalForm>
  );
};

export default PeriodModalForm;
