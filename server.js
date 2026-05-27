const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}.wav`),
});
const upload = multer({ storage });

function getPythonCommand() {
  return process.platform === 'win32' ? 'python' : 'python3';
}

function runAssessment(audioPath, expectedText, language) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn(getPythonCommand(), [
      path.join(__dirname, 'scripts', 'assess.py'),
      '--audio', audioPath,
      '--text', expectedText,
      '--language', language,
    ]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || '评测脚本执行失败'));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          reject(new Error(result.error));
          return;
        }
        resolve(result);
      } catch {
        reject(new Error('解析评测结果失败'));
      }
    });
  });
}

// --- Edge TTS ---

app.get('/api/voices', async (req, res) => {
  try {
    const tts = new MsEdgeTTS();
    const voices = await tts.getVoices();
    res.json(voices);
  } catch (error) {
    console.error('获取音色失败:', error);
    res.status(500).json({ error: '获取音色列表失败' });
  }
});

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

    const options = {};
    if (rate) options.rate = `${rate}%`;
    if (pitch) options.pitch = `${pitch}Hz`;
    if (volume) options.volume = `${volume}%`;

    const { audioStream } = tts.toStream(text, options);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'inline; filename="speech.mp3"');

    const chunks = [];
    audioStream.on('data', (data) => {
      chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
    });

    audioStream.on('close', () => {
      res.send(Buffer.concat(chunks));
    });

    audioStream.on('error', (err) => {
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

// --- 发音评测 ---

app.post('/api/assess', upload.single('audio'), async (req, res) => {
  try {
    const { expectedText, language } = req.body;
    const audioPath = req.file?.path;

    if (!expectedText || !audioPath) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await runAssessment(audioPath, expectedText, language || 'zh');

    res.json({
      success: true,
      audioUrl: `/uploads/${req.file.filename}`,
      ...result,
    });
  } catch (error) {
    console.error('评测错误:', error);
    res.status(500).json({ error: '评测失败: ' + error.message });
  }
});

app.delete('/api/audio/:filename', (req, res) => {
  const filepath = path.join(uploadsDir, req.params.filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
  res.json({ success: true });
});

// 静态资源放在 API 之后，避免未预期地拦截或混淆路由
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

app.listen(PORT, () => {
  console.log(`✅ 服务已启动: http://localhost:${PORT}`);
  console.log(`   语音合成: http://localhost:${PORT}/`);
  console.log(`   发音评测: http://localhost:${PORT}/speech.html`);
});
