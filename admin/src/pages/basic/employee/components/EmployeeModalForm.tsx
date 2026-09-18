import {
  ModalForm,
  ProFormDatePicker,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { useMutation } from '@tanstack/react-query';
import { message } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import { EMPLOYMENT_STATUS_OPTIONS } from '../constants';
import type { EmployeeFormValues, EmployeeItem } from '../data.d';
import {
  createEmployee,
  fetchLeadOptions,
  fetchActiveTagOptions,
  updateEmployee,
} from '../service';

type EmployeeModalFormProps = {
  trigger: React.ReactElement<any>;
  values?: EmployeeItem;
  onSuccess?: () => void;
};

const EmployeeModalForm: React.FC<EmployeeModalFormProps> = ({
  trigger,
  values,
  onSuccess,
}) => {
  const [messageApi, contextHolder] = message.useMessage();
  const isEdit = Boolean(values?.id);

  const { mutateAsync: save, isPending } = useMutation({
    mutationFn: async (payload: EmployeeFormValues) =>
      isEdit && values
        ? updateEmployee(values.id, payload)
        : createEmployee(payload),
    onSuccess: () => {
      messageApi.success(isEdit ? '员工信息已更新' : '员工已创建');
      onSuccess?.();
    },
  });

  return (
    <>
      {contextHolder}
      <ModalForm<EmployeeFormValues>
        title={isEdit ? '编辑员工档案' : '新建员工档案'}
        trigger={trigger}
        width={560}
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
                empNo: values.empNo,
                name: values.name,
                employmentStatus: values.employmentStatus,
                hiredAt: values.hiredAt ? dayjs(values.hiredAt) : undefined,
                remark: values.remark ?? undefined,
                leadUserId: values.leadUserId ?? undefined,
                tagIds: values.tags?.map((item) => item.id) ?? [],
              }
            : { employmentStatus: 'regular', tagIds: [] }
        }
        onFinish={async (formValues) => {
          try {
            await save({
              empNo: formValues.empNo,
              name: formValues.name,
              employmentStatus: formValues.employmentStatus,
              hiredAt: formValues.hiredAt ?? null,
              remark: formValues.remark ?? null,
              leadUserId: formValues.leadUserId ?? null,
              tagIds: formValues.tagIds ?? [],
            });
            return true;
          } catch {
            return false;
          }
        }}
      >
        <ProFormText
          name="name"
          label="姓名"
          placeholder="请输入编辑姓名"
          rules={[{ required: true, message: '请输入姓名' }]}
        />
        <ProFormText
          name="empNo"
          label="工号"
          placeholder="请输入工号，全局唯一"
          rules={[{ required: true, message: '请输入工号' }]}
        />
        <ProFormSelect
          name="employmentStatus"
          label="在职状态"
          options={EMPLOYMENT_STATUS_OPTIONS}
          rules={[{ required: true, message: '请选择在职状态' }]}
        />
        <ProFormDatePicker
          name="hiredAt"
          label="入职日期"
          fieldProps={{ style: { width: '100%' } }}
        />
        <ProFormSelect
          name="leadUserId"
          label="直属主管"
          placeholder="请选择直属编辑主管"
          allowClear
          request={fetchLeadOptions}
          extra="留空表示暂未指定主管，该编辑在评价周期内会被提示缺主管"
        />
        <ProFormSelect
          name="tagIds"
          label="擅长领域"
          mode="multiple"
          allowClear
          placeholder="可多选，标签由基础数据维护"
          request={fetchActiveTagOptions}
        />
        <ProFormTextArea
          name="remark"
          label="备注"
          placeholder="记录派单注意事项、擅长学科补充说明等"
          fieldProps={{ rows: 3, maxLength: 500, showCount: true }}
        />
      </ModalForm>
    </>
  );
};

export default EmployeeModalForm;
