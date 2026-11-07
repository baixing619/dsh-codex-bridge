---
name: dsh-message-bridge
description: 用户要求与指定的既有 DSH/DeepSeek Harness 对话协作、发送消息或读取公开回复时使用。
---

# DSH 与 Codex 协作桥

使用本技能自带的 scripts/client.mjs，需要 Node.js 24 及已安装的[配套服务](https://github.com/baixing619/dsh-codex-bridge)。安装技能不会安装 DSH 或绑定会话。

## 核对目标与读取

先从用户要求和相关记录核实目标对话，再查 status；sessionId 仅说明当前绑定，不能自行证明是用户指定的对话。不一致且无法查证时问清目标，禁止向别的对话试发或自动重绑。

~~~powershell
node "<本技能目录>/scripts/client.mjs" status
node "<本技能目录>/scripts/client.mjs" read <上次cursor>
~~~

首次读取可省略 cursor。只读取本次所需正文；最多返回40条 user/assistant 文本，truncated=true 表示历史被截断。version 是桥协议版本。动态发现文件含凭据，不打印、上传或改写。

## 授权发送与确认回复

读取或讨论不授权发送。确认会话及本次内容在授权内，再将消息写入任务允许的 UTF-8 文件，记录发送前 cursor，为新逻辑消息生成唯一 requestId。

~~~powershell
node "<本技能目录>/scripts/client.mjs" send "<消息文件>" "<唯一requestId>"
~~~

requestId 为8–100个字母、数字、下划线或连字符。每分钟最多4条新消息，正文最多12000个 JavaScript 字符单元，JSON 总量不超过32KiB。

发送可触发原会话已有工具权限。accepted=true 仅表示接收；结合发送前 cursor、正文、seq/时间及新的 turn/start、turn/end 确认可见回复。多人并发时不要猜归属。超时或结果不确定时先查状态及增量回复；确需重试，保持相同 requestId 和正文。

沿用用户指定的原会话，不静默换成独立模型 API。保存 DSH 产出时保留原文和来源，不将自行改写冒充原回复。

## 故障边界

仅提供 status/read/send，不创建、fork 或切换会话。安装、重启或改变绑定须符合当前授权。

401或连接拒绝时重新发现并查状态；403核对本地 CLI、回环 Host 和无 Origin，不放宽远程权限；429等待窗口结束，不拆分绕过。不得用离线测试替代真实投递证据。
