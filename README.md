# DSH ↔ Codex 本机协作桥

把 Codex 的授权消息送进你**现有的 DSH 对话**，并增量读取该对话的公开回复。原 DSH 界面仍会显示消息，原会话上下文和工具权限继续有效。

本仓库同时包含 **Codex 技能、Node CLI、DSH 插件服务、Windows 安装器、隔离测试和云端打包工作流**。不是直接调用 DeepSeek API，也不会分发 DSH、模型或个人数据。

## 组成

```text
Codex 技能 / CLI
  → 受认证的动态 127.0.0.1 端口
  → DSH 插件服务
  → 安装时指定的既有会话
```

- `bridge.mjs`：固定会话的认证 HTTP 服务。
- `plugin.mjs`：在 DSH 的 Cordis 插件生命周期内启动、卸载服务并生成发现文件。
- `client.mjs`：status / read / send。
- `Install.ps1`：读取目标电脑自己的 DSH 配置，安装服务并保护本机凭据目录。
- `skills/dsh-message-bridge/`：可单独安装、自带 CLI 的 Codex 技能。

## 支持范围与前提

Windows 10/11 x64、PowerShell 5.1+、Node.js 24，以及已安装的 DSHDesktop 0.5.16 / `@deepseek-ai/dsh` 0.1.6-alpha.1。插件依赖该版本注入的 `sessionController.inspect/prompt` 与 Cordis effect 生命周期；其他版本须先核对接口。Node 核心测试也可在 Linux 跑，不代表提供 Linux 安装器。

## 安装服务

1. 在 DSH 中创建或选定要协作的会话，记下它的真实 sessionId。
2. 解压发布包，在该目录的 PowerShell 中运行：

```powershell
./Install.ps1 -SessionId 'session-your-target-id'
# 自定义 DSH 数据位置：
./Install.ps1 -SessionId 'session-your-target-id' -DshHome 'D:/Apps/DSH/data'
node ./client.mjs status
```

安装器不复制凭据/会话/模型，不覆盖已有桥配置，不安装 DSH 或 Node。配置备份存放在受保护的 DSH 数据目录内 `profiles/local-message-bridge/backups/`，不写进源码目录。配置变更不等于服务已加载；以 status 和目标会话核对为准。

## 安装 Codex 技能

将 `skills/dsh-message-bridge` 整个目录复制到你的 Codex skills 目录（默认 `~/.codex/skills`）。技能自带 CLI，单独复制该子目录也可使用；服务仍需按上一步安装。

## 使用

```powershell
node ./client.mjs status
node ./client.mjs read
node ./client.mjs read 12
node ./client.mjs send './message.txt' 'request-new-0001'
```

消息文件为 UTF-8。每条新逻辑消息用新 ID；未知结果重试用原 ID 和相同内容。accepted 只表示已接收，继续增量读取回复、核对消息和新的 turn/start/turn/end 才能判定完成。并行操作者的回复没有逐条 requestId 绑定，不要猜归属。

## 权限与限制

仅回环监听、精确 Host、拒绝 Origin、随机令牌、恒定时间鉴权；客户端不跟随重定向。只支持单个已绑定会话和 status/read/send。每分钟最多4条新消息，每条最多12000字符、JSON总量32KiB。历史最多返回最近40条 user/assistant 的 text，排除 reasoning 和工具内容。

DSH_HOME 或 Windows 默认数据目录中 `profiles/local-message-bridge/connection.json` 含运行期地址与令牌。不要提交、打印或上传。相同 Windows 用户下的其他程序仍可读取本用户凭据；这不是对同用户恶意程序的隔离。

发送会继承目标会话已有工具权限，可能产生真实副作用；插件不负责撤销这些权限。此首版采用单实例源实现，没有把个人安装副本的未同步多实例扩展混入公开版本。

## 回滚

只移除 DSH web `cordis.patch.yml` 中本次新增的 `id: codex-local-message-bridge` insert 块。不要用备份覆盖后来修改。热卸载会关闭服务并移除本实例的发现文件；源码和配置备份保留。

## 测试和发布

```powershell
npm test
npm run test:install
```

测试均使用 runner 临时目录和合成宿主，不调用真实 DSH、模型或会话。GitHub Actions 在云端 Windows/Linux 运行核心测试，在 Windows 验证安装器，并打包包含服务及技能的 ZIP。云端测试不等于其他电脑上的真实 DSH 端到端验收。

源码 MIT；不包含 DSH 二进制和依赖。DSH、DSH session 和 Cordis 属于各自上游项目并遵循其许可证。
