# 派单权重综合评价系统

按月收集四类主管对编辑的评价，合成可比较的派单权重分，供交付人员参考派单。局域网内部署，前后端分离。

## 解决什么问题

派单原先靠主管的主观印象，缺少可追溯依据。难点不在算分，而在收集：评价关系是稀疏的，两位编辑主管各管各的人，三位交付各自只对接过一部分编辑，人事和客服虽然名义上评全员但对某些人并不了解。直接把所有人的打分平均会得到无意义的结果。

系统用三个机制处理这件事。评价人打分前先自评熟悉度，熟悉度既做加权系数也用来量化分数可信度；评价人之间的松紧差异用向角色池收缩的方式校准，样本越少越依赖整体分布；某个维度缺失时，权重按可信度重新分配给其余维度，覆盖度过低则把分数拉回历史值。

## 技术栈

前端 Ant Design Pro 6（React 19 + UmiJS Max + antd 6 + ProComponents 3），后端 FastAPI + SQLAlchemy 2.0 + SQLite。

## 目录

```
admin/    前端，src/pages 下按业务模块组织
server/   后端
  app/engine/    权重计算引擎，纯函数，不依赖数据库，可脱库单测
  app/services/  事务边界，业务逻辑
  app/api/       路由层
  app/models/    25 张表的 ORM 定义
  app/tests/     引擎单元测试
```

## 本地运行

后端需要 Python 3.12，前端需要 Node 20 以上。

```bash
cd server && uv venv --python 3.12 && uv pip install -r requirements.txt
cd admin && npm install
```

复制 `.env.example` 为 `server/.env` 并填入随机的 JWT 密钥，然后分别启动：

```bash
cd server && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
cd admin && npm run dev
```

前端 8001 端口，后端 8000 端口，前端已配置 `/api` 代理到后端。首次启动会自动建表并灌入种子数据。

## 运维脚本

`server/重置系统.sh --yes` 清空所有评价数据并恢复初始状态，保留人员档案与算法配置。
`server/重置密码.sh <账号>` 把指定账号密码重置为账号名，下次登录强制改密。

## 权重算法

完整推导见 `需求说明书.md`。核心步骤为题项加权、评价人松紧校准、按熟悉度合并同维度多人打分、缺失维度的权重重分配、月度平滑与新人保护、人工调权、档位与排名。

引擎测试覆盖了小样本收缩、熟悉度加权、缺维度重分配、四种调权的优先级短路等场景：

```bash
cd server && .venv/bin/python -m pytest app/tests/ -q
```
