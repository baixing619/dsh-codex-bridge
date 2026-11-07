# DSH ↔ Codex 本机协作桥

通过 CLI 向指定的既有 DSH 对话发送授权消息，并读取公开回复。消息保留在原界面，沿用原对话上下文和工具权限。

支持 Windows 10/11 x64、PowerShell 5.1+、Node.js 24、DSHDesktop 0.5.16 / DSH 0.1.6-alpha.1。其他 DSH 版本需先核对 sessionController 接口；不包含 DSH、Node 或模型。

## 安装

1. 从 [Releases](https://github.com/baixing619/dsh-codex-bridge/releases) 下载并解压 ZIP。
2. 在 DSH 中选定已有会话，取得其 sessionId，在解压目录运行：

~~~powershell
./Install.ps1 -SessionId 'session-your-target-id'
node ./client.mjs status
~~~

自定义数据目录可传 -DshHome。安装器读取目标电脑自己的配置，拒绝重复安装；备份保存在 DSH 数据目录的 profiles/local-message-bridge/backups。检查 status 的 sessionId，确认桥绑定正确。

将 skills/dsh-message-bridge 整个目录复制到 Codex 技能目录（默认 ~/.codex/skills）。技能自带 CLI，可单独复制；配套服务仍需先安装。

## 使用

~~~powershell
node ./client.mjs status
node ./client.mjs read
node ./client.mjs read 12
node ./client.mjs send './message.txt' 'request-new-0001'
~~~

消息文件使用 UTF-8。新消息使用新 ID；结果不确定时先增量读取，重试保持原 ID 和相同正文。accepted 只代表接收，需核对后续可见回复和新的回合状态。

## 安全与回滚

服务只监听受认证的动态回环端口，绑定单个会话。发送可能触发该会话已有工具；读取权限不包含发送权限。

发现文件 profiles/local-message-bridge/connection.json 含令牌，不要打印、提交或上传。客户端从 DSH_HOME 或当前 Windows 用户的默认 DSHDesktop 数据目录发现服务。同用户进程仍可读取本用户凭据。

回滚时只移除 profiles/web/cordis.patch.yml 中本次新增的 codex-local-message-bridge insert 块，勿用旧备份覆盖后续修改。热卸载会关闭端口并移除本实例的发现文件。

## 开发

源码仓库保留测试和构建工具；发布 ZIP 只含技能、CLI、插件、安装器、说明及许可证。GitHub Actions 在 Windows/Linux 运行隔离测试，在 Windows 检查安装器、打包并核验 ZIP。测试使用合成宿主，不调用真实 DSH 或模型，也不证明真实 DSH 端到端投递。

源码采用 [MIT 许可证](LICENSE)。
