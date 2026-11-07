# Security

This bridge only accepts authenticated loopback CLI requests for one configured DSH session. Origin-bearing browser requests and non-matching Host headers are refused. Never forward the port or publish runtime discovery files.

Sending a prompt may invoke the session's existing tools. Approval to read is not approval to send. A 202 response is not evidence of a completed model turn.

The installer protects the discovery directory with a Windows current-user/SYSTEM ACL. Same-user processes are outside that boundary. Config backups stay inside the protected DSH data directory. Do not attach discovery, config, chat history, screenshots, or tokens to issues.

Report a security issue privately using GitHub's private security reporting if enabled; otherwise contact the maintainer without publishing secrets.
