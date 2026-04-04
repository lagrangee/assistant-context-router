# Work Breakdown（v0）

## 目标
将 MVP 实现拆成清晰的工作块，便于逐步推进与验收。

---

## Workstream A：Project registry & listing
### 目标
实现项目宇宙读取与最小 listing。

### 任务
1. 读取 `projects/index.yaml`
2. 定义最小展示字段
3. 设计 `/projects` 输出格式
4. 验证不同项目类型/status 的显示效果

### 产出
- project registry reader
- `/projects` listing 行为

---

## Workstream B：Project context switch
### 目标
实现 `/project XXXX` 的最小可用行为。

### 任务
1. 定义 project resolve 规则（id/title/path alias?）
2. 定义切换成功返回的轻量 summary
3. 明确切换失败时的错误提示
4. 连接 current project state store

### 产出
- `/project XXXX` handler
- project resolve policy

---

## Workstream C：Current project state ownership
### 目标
实现非全局的 current project state。

### 任务
1. 确认 session metadata 路径是否可行
2. 若不可行，设计 plugin-owned lightweight state store
3. 定义 state schema（project_id/source/set_at）
4. 明确 state 读取/覆盖/清除规则

### 产出
- state ownership decision 落地
- current project state adapter

---

## Workstream D：Minimal context loading
### 目标
实现 project-centric 的轻量 context loading。

### 任务
1. 定义默认加载 buckets
2. 定义切换时只返回 light summary 的内容
3. 设计按需追加加载的触发条件
4. 避免切换瞬间 context 爆炸

### 产出
- minimal context loading policy
- light project summary builder

---

## Workstream E：Protocol routing MVP
### 目标
实现 dispatch/review 的最小 project/workflow route。

### 任务
1. 定义 project anchor 消费规则
2. 定义 fallback 顺序
3. 定义 safe-fail 行为
4. 验证 dispatch/review 场景

### 产出
- protocol route parser
- dispatch/review minimal bridge

---

## Workstream F：Route trace
### 目标
让关键 route decision 可解释。

### 任务
1. 定义最小 trace schema
2. 明确 trace 记录位置
3. 记录 `/project` resolve 与 protocol route
4. 明确 reject/fallback trace 文案

### 产出
- route trace logger
- trace schema

---

## 推荐执行顺序
1. Workstream A（registry/listing）
2. Workstream B（project switch）
3. Workstream C（state ownership）
4. Workstream D（minimal context loading）
5. Workstream F（route trace）
6. Workstream E（protocol routing MVP）

说明：
- 先把 project-centric interaction 跑通
- 再补 protocol route
- 避免一上来就被 dispatch/review 复杂度绑架
