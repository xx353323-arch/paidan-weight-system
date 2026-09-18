import {
  ModalForm,
  ProFormDatePicker,
  ProFormSelect,
} from '@ant-design/pro-components';
import { useMutation } from '@tanstack/react-query';
import { Alert, Form, message } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { useState } from 'react';
import { EMPLOYMENT_STATUS_OPTIONS } from '../constants';
import type {
  EmployeeItem,
  EmployeeStatusValues,
  EmploymentStatus,
} from '../data.d';
import { updateEmployeeStatus } from '../service';

type StatusModalFormProps = {
  trigger: React.ReactElement<any>;
  record: EmployeeItem;
  onSuccess?: () => void;
};

const StatusModalForm: React.FC<StatusModalFormProps> = ({
  trigger,
  record,
  onSuccess,
}) => {
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<EmployeeStatusValues>();
  const [status, setStatus] = useState<EmploymentStatus>(
    record.employmentStatus,
  );
  const keepsLeftAt = (value: EmploymentStatus) =>
    value === 'left' || value === 'leaving';

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: async (payload: EmployeeStatusValues) =>
      updateEmployeeStatus(record.id, payload),
    onSuccess: () => {
      messageApi.success('在职状态已更新');
      onSuccess?.();
    },
  });

  return (
    <>
      {contextHolder}
      <ModalForm<EmployeeStatusValues>
        title={`变更在职状态 ${record.name}（${record.empNo}）`}
        trigger={trigger}
        form={form}
        width={520}
        layout="horizontal"
        labelCol={{ span: 6 }}
        wrapperCol={{ span: 16 }}
        modalProps={{
          destroyOnHidden: true,
          okButtonProps: { loading: isPending },
          okText: '确认变更',
          cancelText: '取消',
        }}
        initialValues={{
          employmentStatus: record.employmentStatus,
          leftAt: record.leftAt ? dayjs(record.leftAt) : undefined,
        }}
        onValuesChange={(changed) => {
          if (changed.employmentStatus) {
            setStatus(changed.employmentStatus);
            if (!keepsLeftAt(changed.employmentStatus)) {
              form.setFieldValue('leftAt', undefined);
            }
          }
        }}
        onFinish={async (values) => {
          try {
            await save({
              employmentStatus: values.employmentStatus,
              leftAt: keepsLeftAt(values.employmentStatus)
                ? (values.leftAt ?? null)
                : null,
            });
            return true;
          } catch {
            return false;
          }
        }}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title="离职后不参与后续周期，历史评价数据保留"
          description="员工不做物理删除，标记为已离职后会自动移出派单池，已产生的评价记录与权重快照全部保留可查。"
        />
        <ProFormSelect
          name="employmentStatus"
          label="在职状态"
          options={EMPLOYMENT_STATUS_OPTIONS}
          rules={[{ required: true, message: '请选择在职状态' }]}
        />
        <ProFormDatePicker
          name="leftAt"
          label="离职日期"
          disabled={!keepsLeftAt(status)}
          fieldProps={{ style: { width: '100%' } }}
          extra={
            status === 'left'
              ? '留空则默认记为今天，离职后自动移出派单池'
              : status === 'leaving'
                ? '可填写预计的最后工作日，离职中仍留在派单池'
                : '仅离职中与已离职需要填写，改回在职会清空该日期并放回派单池'
          }
        />
      </ModalForm>
    </>
  );
};

export default StatusModalForm;
