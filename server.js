const express = require('express');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.listen(PORT, () => {
  console.log(`✅ Edge-TTS 服务已启动: http://localhost:${PORT}`);
});
