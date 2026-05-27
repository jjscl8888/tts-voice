
# Node.js + Edge-TTS 网页配置朗读系统

## 项目结构

```
edge-tts-web/
├── package.json
├── server.js
└── public/
    └── index.html
```

## 1. package.json

```json
{
  "name": "edge-tts-web",
  "version": "1.0.0",
  "description": "Edge TTS Web Interface",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "edge-tts": "^1.3.0"
  }
}
```

## 2. server.js

```javascript
const express = require('express');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('edge-tts');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 获取可用音色列表
app.get('/api/voices', async (req, res) => {
  try {
    const voices = await MsEdgeTTS.getVoices();
    res.json(voices);
  } catch (error) {
    console.error('获取音色失败:', error);
    res.status(500).json({ error: '获取音色列表失败' });
  }
});

// 合成语音
app.post('/api/tts', async (req, res) => {
  try {
    const { text, voice, rate, pitch, volume } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: '请输入文本' });
    }

    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      voice || 'zh-CN-XiaoxiaoNeural',
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );

    // 构建 prosody 参数
    const rateStr = rate ? `${rate}%` : '+0%';
    const pitchStr = pitch ? `${pitch}Hz` : '+0Hz';
    const volumeStr = volume ? `${volume}%` : '+0%';

    const readable = tts.toStream(text, {
      rate: rateStr,
      pitch: pitchStr,
      volume: volumeStr
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'inline; filename="speech.mp3"');

    const chunks = [];
    readable.on('data', (chunk) => {
      // edge-tts 返回的 data 事件中包含 audio 数据
      if (chunk.audio) {
        chunks.push(chunk.audio);
      }
    });

    readable.on('end', () => {
      const buffer = Buffer.concat(chunks);
      res.send(buffer);
    });

    readable.on('error', (err) => {
      console.error('TTS流错误:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: '语音合成失败' });
      }
    });

  } catch (error) {
    console.error('TTS合成错误:', error);
    res.status(500).json({ error: '语音合成失败: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Edge-TTS 服务已启动: http://localhost:${PORT}`);
});
```

## 3. public/index.html

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edge-TTS 语音合成</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      min-height: 100vh;
      padding: 20px;
      color: #e0e0e0;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      text-align: center;
      margin-bottom: 30px;
      font-size: 2em;
      background: linear-gradient(90deg, #00d2ff, #3a7bd5);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 20px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #b0b0b0;
      font-size: 0.9em;
    }

    textarea {
      width: 100%;
      height: 150px;
      padding: 15px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.3);
      color: #fff;
      font-size: 16px;
      resize: vertical;
      transition: border-color 0.3s;
      font-family: inherit;
    }

    textarea:focus {
      outline: none;
      border-color: #3a7bd5;
    }

    select {
      width: 100%;
      padding: 12px 15px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.3);
      color: #fff;
      font-size: 14px;
      cursor: pointer;
      appearance: none;
    }

    select:focus {
      outline: none;
      border-color: #3a7bd5;
    }

    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
    }

    .slider-group {
      display: flex;
      flex-direction: column;
    }

    .slider-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .slider-value {
      background: rgba(58, 123, 213, 0.3);
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.85em;
      color: #7bb8ff;
    }

    input[type="range"] {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.1);
      outline: none;
      -webkit-appearance: none;
      appearance: none;
    }

    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: linear-gradient(135deg, #00d2ff, #3a7bd5);
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 210, 255, 0.3);
    }

    .filter-group {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
      flex-wrap: wrap;
    }

    .filter-group select {
      flex: 1;
      min-width: 150px;
    }

    .btn {
      padding: 14px 40px;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #00d2ff, #3a7bd5);
      color: #fff;
      box-shadow: 0 4px 15px rgba(0, 210, 255, 0.3);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 210, 255, 0.4);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #e0e0e0;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .btn-group {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .audio-player {
      width: 100%;
      margin-top: 20px;
      display: none;
    }

    .audio-player.show {
      display: block;
    }

    audio {
      width: 100%;
      border-radius: 10px;
    }

    .status {
      text-align: center;
      margin-top: 15px;
      font-size: 0.9em;
      min-height: 24px;
    }

    .status.loading {
      color: #ffd700;
    }

    .status.success {
      color: #00e676;
    }

    .status.error {
      color: #ff5252;
    }

    .voice-info {
      font-size: 0.8em;
      color: #888;
      margin-top: 5px;
    }

    .presets {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 15px;
    }

    .preset-btn {
      padding: 6px 14px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.05);
      color: #b0b0b0;
      font-size: 0.85em;
      cursor: pointer;
      transition: all 0.2s;
    }

    .preset-btn:hover {
      background: rgba(58, 123, 213, 0.2);
      border-color: #3a7bd5;
      color: #7bb8ff;
    }

    .section-title {
      font-size: 1.1em;
      margin-bottom: 15px;
      color: #7bb8ff;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    @media (max-width: 600px) {
      .settings-grid {
        grid-template-columns: 1fr;
      }
      .filter-group {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔊 Edge-TTS 语音合成</h1>

    <!-- 文本输入 -->
    <div class="card">
      <div class="section-title">📝 输入文本</div>
      <div class="presets">
        <span class="preset-btn" onclick="setPresetText('zh')">中文示例</span>
        <span class="preset-btn" onclick="setPresetText('en')">English</span>
        <span class="preset-btn" onclick="setPresetText('jp')">日本語</span>
        <span class="preset-btn" onclick="setPresetText('kr')">한국어</span>
        <span class="preset-btn" onclick="setPresetText('mix')">中英混合</span>
      </div>
      <div class="form-group">
        <textarea id="text" placeholder="请输入要朗读的文本...">你好！欢迎使用 Edge TTS 语音合成系统。这是一个支持多语言、多音色的免费语音合成工具。</textarea>
      </div>
    </div>

    <!-- 音色选择 -->
    <div class="card">
      <div class="section-title">🎙️ 音色设置</div>
      <div class="filter-group">
        <select id="langFilter" onchange="filterVoices()">
          <option value="">所有语言</option>
        </select>
        <select id="genderFilter" onchange="filterVoices()">
          <option value="">所有性别</option>
          <option value="Female">女声</option>
          <option value="Male">男声</option>
        </select>
      </div>
      <div class="form-group">
        <select id="voice">
          <option value="">加载中...</option>
        </select>
        <div class="voice-info" id="voiceInfo"></div>
      </div>
    </div>

    <!-- 参数调节 -->
    <div class="card">
      <div class="section-title">⚙️ 参数调节</div>
      <div class="settings-grid">
        <div class="slider-group">
          <div class="slider-header">
            <label>语速</label>
            <span class="slider-value" id="rateValue">+0%</span>
          </div>
          <input type="range" id="rate" min="-100" max="200" value="0" oninput="updateSlider('rate')">
        </div>
        <div class="slider-group">
          <div class="slider-header">
            <label>音调</label>
            <span class="slider-value" id="pitchValue">+0Hz</span>
          </div>
          <input type="range" id="pitch" min="-50" max="50" value="0" oninput="updateSlider('pitch')">
        </div>
        <div class="slider-group">
          <div class="slider-header">
            <label>音量</label>
            <span class="slider-value" id="volumeValue">+0%</span>
          </div>
          <input type="range" id="volume" min="-50" max="50" value="0" oninput="updateSlider('volume')">
        </div>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="card">
      <div class="btn-group">
        <button class="btn btn-primary" id="synthBtn" onclick="synthesize()">
          🔊 合成并播放
        </button>
        <button class="btn btn-secondary" onclick="downloadAudio()">
          💾 下载音频
        </button>
        <button class="btn btn-secondary" onclick="stopAudio()">
          ⏹️ 停止
        </button>
      </div>
      <div class="status" id="status"></div>
      <div class="audio-player" id="audioPlayer">
        <audio id="audio" controls></audio>
      </div>
    </div>
  </div>

  <script>
    let allVoices = [];
    let currentAudioUrl = null;

    // 预设文本
    const presetTexts = {
      zh: '你好！欢迎使用 Edge TTS 语音合成系统。今天天气真不错，适合出去走走。',
      en: 'Hello! Welcome to the Edge TTS speech synthesis system. It supports multiple languages and voices.',
      jp: 'こんにちは！Edge TTSの音声合成システムへようこそ。多言語と多音色をサポートしています。',
      kr: '안녕하세요! Edge TTS 음성 합성 시스템에 오신 것을 환영합니다.',
      mix: '今天我们来学习一下English。Hello大家好，这是一个中英混合的示例。Let\'s go!'
    };

    function setPresetText(lang) {
      document.getElementById('text').value = presetTexts[lang];
    }

    // 更新滑块显示
    function updateSlider(type) {
      const value = document.getElementById(type).value;
      const display = document.getElementById(type + 'Value');
      if (type === 'pitch') {
        display.textContent = `${value >= 0 ? '+' : ''}${value}Hz`;
      } else {
        display.textContent = `${value >= 0 ? '+' : ''}${value}%`;
      }
    }

    // 加载音色列表
    async function loadVoices() {
      try {
        const response = await fetch('/api/voices');
        allVoices = await response.json();
        
        // 提取语言列表
        const langs = [...new Set(allVoices.map(v => v.Locale))].sort();
        const langFilter = document.getElementById('langFilter');
        langs.forEach(lang => {
          const option = document.createElement('option');
          option.value = lang;
          option.textContent = `${lang} (${getLangName(lang)})`;
          langFilter.appendChild(option);
        });

        // 默认选择中文
        langFilter.value = 'zh-CN';
        filterVoices();
      } catch (error) {
        console.error('加载音色失败:', error);
        setStatus('加载音色列表失败，请刷新重试', 'error');
      }
    }

    // 获取语言友好名称
    function getLangName(locale) {
      const names = {
        'zh-CN': '中文(普通话)', 'zh-TW': '中文(台湾)', 'zh-HK': '中文(粤语)',
        'en-US': '英语(美国)', 'en-GB': '英语(英国)', 'en-AU': '英语(澳大利亚)',
        'ja-JP': '日语', 'ko-KR': '韩语', 'fr-FR': '法语',
        'de-DE': '德语', 'es-ES': '西班牙语', 'ru-RU': '俄语',
        'it-IT': '意大利语', 'pt-BR': '葡萄牙语(巴西)',
      };
      return names[locale] || locale;
    }

    // 筛选音色
    function filterVoices() {
      const lang = document.getElementById('langFilter').value;
      const gender = document.getElementById('genderFilter').value;
      
      let filtered = allVoices;
      if (lang) filtered = filtered.filter(v => v.Locale === lang);
      if (gender) filtered = filtered.filter(v => v.Gender === gender);

      const voiceSelect = document.getElementById('voice');
      voiceSelect.innerHTML = '';
      
      filtered.forEach(v => {
        const option = document.createElement('option');
        option.value = v.ShortName;
        const genderIcon = v.Gender === 'Female' ? '👩' : '👨';
        option.textContent = `${genderIcon} ${v.ShortName} (${v.FriendlyName || ''})`;
        voiceSelect.appendChild(option);
      });

      if (filtered.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '没有匹配的音色';
        voiceSelect.appendChild(option);
      }

      updateVoiceInfo();
    }

    // 显示音色信息
    function updateVoiceInfo() {
      const voiceSelect = document.getElementById('voice');
      const selected = voiceSelect.value;
      const voice = allVoices.find(v => v.ShortName === selected);
      const info = document.getElementById('voiceInfo');
      if (voice) {
        info.textContent = `语言: ${voice.Locale} | 性别: ${voice.Gender === 'Female' ? '女' : '男'} | ${voice.FriendlyName || ''}`;
      } else {
        info.textContent = '';
      }
    }

    document.getElementById('voice').addEventListener('change', updateVoiceInfo);

    // 合成语音
    async function synthesize() {
      const text = document.getElementById('text').value.trim();
      if (!text) {
        setStatus('请输入要朗读的文本', 'error');
        return;
      }

      const voice = document.getElementById('voice').value;
      const rate = document.getElementById('rate').value;
      const pitch = document.getElementById('pitch').value;
      const volume = document.getElementById('volume').value;

      const btn = document.getElementById('synthBtn');
      btn.disabled = true;
      setStatus('⏳ 正在合成语音...', 'loading');

      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice: voice || 'zh-CN-XiaoxiaoNeural',
            rate: rate !== '0' ? (rate > 0 ? `+${rate}` : rate) : null,
            pitch: pitch !== '0' ? (pitch > 0 ? `+${pitch}` : pitch) : null,
            volume: volume !== '0' ? (volume > 0 ? `+${volume}` : volume) : null,
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || '合成失败');
        }

        const blob = await response.blob();
        
        // 释放之前的URL
        if (currentAudioUrl) {
          URL.revokeObjectURL(currentAudioUrl);
        }

        currentAudioUrl = URL.createObjectURL(blob);
        const audio = document.getElementById('audio');
        audio.src = currentAudioUrl;
        
        document.getElementById('audioPlayer').classList.add('show');
        audio.play();
        
        setStatus('✅ 合成成功，正在播放', 'success');
      } catch (error) {
        setStatus('❌ ' + error.message, 'error');
      } finally {
        btn.disabled = false;
      }
    }

    // 下载音频
    function downloadAudio() {
      if (!currentAudioUrl) {
        setStatus('请先合成语音', 'error');
        return;
      }
      const a = document.createElement('a');
      a.href = currentAudioUrl;
      a.download = 'speech.mp3';
      a.click();
    }

    // 停止播放
    function stopAudio() {
      const audio = document.getElementById('audio');
      audio.pause();
      audio.currentTime = 0;
      setStatus('已停止', 'success');
    }

    // 状态显示
    function setStatus(msg, type) {
      const status = document.getElementById('status');
      status.textContent = msg;
      status.className = 'status ' + type;
    }

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        synthesize();
      }
    });

    // 初始化
    loadVoices();
  </script>
</body>
</html>
```

## 4. 备选 server.js（使用 edge-tts-node 命令行方式）

如果 `edge-tts` npm 包有兼容性问题，可用 `msedge-tts` 包替代：

```javascript
// server.js - 使用 msedge-tts 替代方案
const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 动态导入 msedge-tts（ESM模块）
let MsEdgeTTS, OUTPUT_FORMAT;

async function initTTS() {
  const module = await import('msedge-tts');
  MsEdgeTTS = module.MsEdgeTTS;
  OUTPUT_FORMAT = module.OUTPUT_FORMAT;
}

app.get('/api/voices', async (req, res) => {
  try {
    if (!MsEdgeTTS) await initTTS();
    const tts = new MsEdgeTTS();
    const voices = await MsEdgeTTS.getVoices();
    res.json(voices);
  } catch (error) {
    console.error('获取音色失败:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    if (!MsEdgeTTS) await initTTS();
    
    const { text, voice, rate, pitch, volume } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: '请输入文本' });
    }

    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      voice || 'zh-CN-XiaoxiaoNeural',
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3
    );

    const options = {};
    if (rate) options.rate = `${rate}%`;
    if (pitch) options.pitch = `${pitch}Hz`;
    if (volume) options.volume = `${volume}%`;

    const readable = tts.toStream(text, options);
    
    res.setHeader('Content-Type', 'audio/mpeg');
    
    const chunks = [];
    readable.on('data', (data) => {
      if (data.audio) {
        chunks.push(data.audio);
      }
    });
    
    readable.on('close', () => {
      const buffer = Buffer.concat(chunks);
      res.end(buffer);
    });

    readable.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

  } catch (error) {
    console.error('TTS错误:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 服务已启动: http://localhost:${PORT}`);
});
```

## 5. 启动方式

```bash
# 初始化项目
mkdir edge-tts-web && cd edge-tts-web
npm init -y

# 安装依赖（二选一）
npm install express msedge-tts
# 或
npm install express edge-tts

# 启动
node server.js
```

浏览器访问 `http://localhost:3000`

## 6. 功能说明

| 功能 | 说明 |
|------|------|
| 🌍 多语言 | 支持 100+ 语言/地区 |
| 🎙️ 多音色 | 400+ 种音色可选 |
| 🔍 筛选 | 按语言、性别快速筛选 |
| ⚡ 语速调节 | -100% ~ +200% |
| 🎵 音调调节 | -50Hz ~ +50Hz |
| 🔊 音量调节 | -50% ~ +50% |
| 💾 下载 | 支持下载 MP3 |
| ⌨️ 快捷键 | Ctrl+Enter 快速合成 |
| 📱 响应式 | 适配手机/平板 |

## 7. 效果预览

页面是暗色调 glassmorphism 风格，包含：
- 文本输入区 + 预设示例按钮
- 语言/性别筛选 + 音色下拉选择
- 语速/音调/音量滑块调节
- 合成播放/下载/停止按钮
- 内嵌音频播放器