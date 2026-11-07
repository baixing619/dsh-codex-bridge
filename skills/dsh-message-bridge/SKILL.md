---
name: dsh-message-bridge
description: 通过已安装的本机消息桥，在用户指定的既有 DSH/DeepSeek Harness 对话中协作、发送授权消息及增量读取公开回复。沿用原对话上下文，不是独立模型 API。
---

# DSH 与 Codex 协作桥

使用本技能自带 `scripts/client.mjs`，需要 Node.js 24 和已安装的配套服务。配套服务源码与安装说明在 https://github.com/baixing619/dsh-codex-bridge 。安装技能不会自动安装、启动 DSH 或绑定会话。

## 使用前确认目标

先从用户要求、相关任务记录和配套服务 README 确认目标对话，再运行只读状态查询。历史绑定和 sessionId 只说明当前连接，不能自行证明它就是用户指定的对话。目标不一致且无法查证时问清标题或 ID；不要向别的对话试发或自动重绑。

```powershell
node "<本技能目录>/scripts/client.mjs" status
node "<本技能目录>/scripts/client.mjs" read
node "<本技能目录>/scripts/client.mjs" read <上次cursor>
```

客户端从 `DSH_HOME`，或 Windows 的 `%LOCALAPPDATA%/DSHDesktop/dsh-home`，读取受保护的动态发现文件。不要打印、上传或改写 connection.json、令牌及会话数据。version 指桥协议，不是 DSH 软件版本。

read 只返回最近最多40条可见 user/assistant 文本、seq/时间、cursor、truncated、turnState，不返回推理和工具细节。truncated=true 不代表完整历史；公开正文仍可能含隐私，只读本次所需范围。

## 发送授权内容

读取或讨论不自动授权发送。确认会话及本次内容在用户授权内，再将消息写入当前任务允许的 UTF-8 文件；记录发送前 cursor，并为每条新逻辑消息分配新 requestId（8–100字符，字母、数字、下划线或连字符）。

```powershell
node "<本技能目录>/scripts/client.mjs" send "<消息文件>" "<唯一requestId>"
```

发送的是原 DSH 对话中的普通用户消息，可触发该会话已有工具权限。accepted=true 仅表示接收；用发送前 cursor、消息内容、seq/时间、新的 turn/start 与 turn/end 核对实际可见回复。多人同时提交时不要猜回复归属。

超时或结果不确定时先查状态和增量回复，必要重试用**相同 requestId、相同正文**，不要换ID重发。每分钟最多4条新消息，每条最多12000个 JavaScript 字符单元。限流后等待，不拆分绕过。

用户要求原对话生成样本时，继续原对话的既有人设与历史，不静默改用独立 API。保存原文和来源关联，格式修复单独标明，不自行改写后冒充 DSH 输出。

## 能力及故障边界

服务绑定单个安装时指定的既有会话，仅提供 status/read/send，没有新建、fork、切换会话或任意命令接口。改变绑定、安装/重启服务应符合本次授权。

401或连接拒绝时重新读取发现文件并查 status，不输出凭据。403核对本地 CLI、精确回环Host及无Origin，不改浏览器或远程权限绕过。安装器拒绝重复覆盖；回滚只移除本次新增配置块，不用旧备份覆盖他人后续更改。

离线测试不证明真实 DSH 消息投递；只有授权发送并读到对应可见回复，才称端到端成功。
