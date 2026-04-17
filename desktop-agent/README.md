# 电脑端代理

1. 安装依赖：

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. 复制配置文件：

```powershell
Copy-Item config.example.json config.json
```

3. 修改 `config.json` 里的 `server_url`、`device_id`、`secret`。

4. 启动：

```powershell
python agent.py config.json
```

启动后，手机浏览器访问中继服务首页，输入 `device_id` 和 `secret` 即可控制电脑。
