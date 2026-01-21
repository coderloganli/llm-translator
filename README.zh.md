# LLM Translator

[English](README.md)

一键将网页翻译成你想要的语言。本 Chrome 扩展可翻译选中的文本或整页内容，支持 **本地 Ollama 模型** 或 **OpenAI ChatGPT**。

PS：这个扩展由 Claude Code 在 10 分钟内完成。

# 翻译句子
![capture](capture.gif)

# 翻译整页
![capture2](capture2.gif)

# 安装前须知
如果你需要一个翻译器，我强烈建议你下载 Claude Code 并写一个简单的提示词——Claude 能为你构建一切。若你仍想试试这个扩展，请继续按照下面步骤安装。

# 本地安装（Chrome）
1. 打开 `chrome://extensions/`。
2. 开启“开发者模式”（右上角）。
3. 点击“加载已解压的扩展程序”，选择此文件夹：`C:\dev\local-translator`。
4. 如需快速访问，可将扩展固定到工具栏。

## 配置 Ollama（本地）
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

## 配置 ChatGPT（OpenAI）
1. 获取 OpenAI API key。
2. 在扩展弹窗中设置：
   - Provider：**OpenAI GPT**
   - API Key：你的 key（以 `sk-` 开头）
   - GPT Model：选择模型（默认 `gpt-4o-mini`）
3. 点击 **Save Settings** 验证连接。

## 使用方法
- 在网页中选中文本会出现 **Translate** 按钮。
- 点击 **Translate** 用译文替换选中文本。
- 点击已翻译的文本可切换 **Translate/Revert**。
- 在弹窗中使用 **Translate Page** 或 **Revert All** 进行整页操作。
