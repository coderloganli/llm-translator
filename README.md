<a id="llm-translator"></a>
# LLM Translator

[English](#llm-translator) | [中文](#llm-zh)

Turn any webpage into your preferred language in a click. This Chrome extension translates highlighted text or whole pages using either a **local Ollama model** or **OpenAI ChatGPT**.

PS: This extension was written by Claude Code in 10 minutes.

### Translate Sentences
![capture](capture.gif)

### Translate Whole Page
![capture2](capture2.gif)

### Before installing
If you need a translator, I strongly suggest you download Claude Code and write a single, simple prompt — Claude can build EVERYTHING for you. If you still want to try this extension, continue to the installation steps below.

### Install locally (Chrome)
1. Open `chrome://extensions/`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select this folder: `C:\dev\local-translator`.
4. Pin the extension if you want quick access from the toolbar.

### Set up Ollama (local)
1. Install Ollama and make sure it is running.
2. Start Ollama with CORS enabled for extensions:
   - Windows PowerShell:
     ```powershell
     $env:OLLAMA_ORIGINS="*"; ollama serve
     ```
3. In the extension popup:
   - Provider: **Ollama (Local)**
   - Ollama API URL: `http://localhost:11434`
   - Model Name: for example `llama3.2`, `mistral`, `qwen2.5`
4. Click **Save Settings** to validate the connection.

### Set up ChatGPT (OpenAI)
1. Get an OpenAI API key.
2. In the extension popup:
   - Provider: **OpenAI GPT**
   - API Key: your key (starts with `sk-`)
   - GPT Model: choose a model (default is `gpt-4o-mini`)
3. Click **Save Settings** to validate the connection.

### How to use
- Select text on any webpage to reveal the **Translate** button.
- Click **Translate** to swap the selection with the translated text.
- Click a translated span to toggle **Translate/Revert** for that text.
- Use **Translate Page** or **Revert All** from the popup for page-level actions.

<a id="llm-zh"></a>
## LLM翻译插件

[English](#llm-translator) | [中文](#llm-zh)

一键将网页翻译成你想要的语言。本 Chrome 扩展可翻译选中的文本或整页内容，支持 **本地 Ollama 模型** 或 **OpenAI ChatGPT**。

PS：这个扩展由 Claude Code 在 10 分钟内完成。

### 翻译句子
![capture](capture.gif)

### 翻译整页
![capture2](capture2.gif)

### 安装前须知
如果你需要一个翻译器，我强烈建议你下载 Claude Code 并写一个简单的提示词——Claude 能为你构建一切。若你仍想试试这个扩展，请继续按照下面步骤安装。

### 本地安装（Chrome）
1. 打开 `chrome://extensions/`。
2. 开启“开发者模式”（右上角）。
3. 点击“加载已解压的扩展程序”，选择此文件夹：`C:\dev\local-translator`。
4. 如需快速访问，可将扩展固定到工具栏。

### 配置 Ollama（本地）
1. 安装 Ollama 并确保其正在运行。
2. 以允许扩展的 CORS 设置启动 Ollama：
   - Windows PowerShell：
     ```powershell
     $env:OLLAMA_ORIGINS="*"; ollama serve
     ```
3. 在扩展弹窗中设置：
   - Provider：**Ollama (Local)**
   - Ollama API URL：`http://localhost:11434`
   - Model Name：例如 `llama3.2`、`mistral`、`qwen2.5`
4. 点击 **Save Settings** 验证连接。

### 配置 ChatGPT（OpenAI）
1. 获取 OpenAI API key。
2. 在扩展弹窗中设置：
   - Provider：**OpenAI GPT**
   - API Key：你的 key（以 `sk-` 开头）
   - GPT Model：选择模型（默认 `gpt-4o-mini`）
3. 点击 **Save Settings** 验证连接。

### 使用方法
- 在网页中选中文本会出现 **Translate** 按钮。
- 点击 **Translate** 用译文替换选中文本。
- 点击已翻译的文本可切换 **Translate/Revert**。
- 在弹窗中使用 **Translate Page** 或 **Revert All** 进行整页操作。
