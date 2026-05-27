class PronunciationApp {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioBlob = null;
    this.audioUrl = null;
    this.recordingTimer = null;
    this.recordingSeconds = 0;
    this.audioContext = null;
    this.analyser = null;
    this.animationId = null;
    this.history = JSON.parse(localStorage.getItem('pronunciation_history') || '[]');

    this.initElements();
    this.initEvents();
    this.renderHistory();
    this.updateHint();
  }

  initElements() {
    this.languageSelect = document.getElementById('languageSelect');
    this.textInput = document.getElementById('textInput');
    this.inputHint = document.getElementById('inputHint');
    this.recordBtn = document.getElementById('recordBtn');
    this.stopBtn = document.getElementById('stopBtn');
    this.recordingStatus = document.getElementById('recordingStatus');
    this.recordTime = document.getElementById('recordTime');
    this.waveformCanvas = document.getElementById('waveform');
    this.playbackSection = document.getElementById('playbackSection');
    this.audioPlayer = document.getElementById('audioPlayer');
    this.reRecordBtn = document.getElementById('reRecordBtn');
    this.submitBtn = document.getElementById('submitBtn');
    this.resultSection = document.getElementById('resultSection');
    this.loading = document.getElementById('loading');
    this.scoreCard = document.getElementById('scoreCard');
    this.subScores = document.getElementById('subScores');
    this.recognizedSection = document.getElementById('recognizedSection');
    this.detailSection = document.getElementById('detailSection');
    this.historyList = document.getElementById('historyList');
  }

  initEvents() {
    this.languageSelect.addEventListener('change', () => this.updateHint());
    this.textInput.addEventListener('input', () => {
      this.recordBtn.disabled = !this.textInput.value.trim();
    });
    this.recordBtn.addEventListener('click', () => this.startRecording());
    this.stopBtn.addEventListener('click', () => this.stopRecording());
    this.reRecordBtn.addEventListener('click', () => this.resetRecording());
    this.submitBtn.addEventListener('click', () => this.submitAssessment());
    document.querySelectorAll('.example-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.textInput.value = btn.dataset.text;
        this.languageSelect.value = btn.dataset.lang;
        this.recordBtn.disabled = false;
        this.updateHint();
      });
    });
  }

  updateHint() {
    const hints = {
      zh: '请输入中文汉字，如：你好世界',
      pinyin: '请输入拼音（带声调数字），如：ni3 hao3 shi4 jie4',
      en: '请输入英语单词或句子，如：Hello World',
    };
    this.inputHint.textContent = hints[this.languageSelect.value] || '';
  }

  async startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.setupWaveform(stream);
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: this.getSupportedMimeType(),
      });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = () => {
        this.audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
        this.audioUrl = URL.createObjectURL(this.audioBlob);
        this.audioPlayer.src = this.audioUrl;
        this.showPlayback();
        stream.getTracks().forEach((track) => track.stop());
      };

      this.mediaRecorder.start(100);
      this.onRecordingStart();
    } catch (error) {
      alert('无法访问麦克风，请确保已授予权限。\n错误: ' + error.message);
      console.error(error);
    }
  }

  getSupportedMimeType() {
    const types = ['audio/webm', 'audio/ogg', 'audio/mp4'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm';
  }

  setupWaveform(stream) {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);
    this.analyser.fftSize = 256;
    this.waveformCanvas.classList.remove('hidden');
    this.drawWaveform();
  }

  drawWaveform() {
    if (!this.analyser) return;
    const canvas = this.waveformCanvas;
    const ctx = canvas.getContext('2d');
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);
      this.analyser.getByteTimeDomainData(dataArray);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#3a7bd5';
      ctx.beginPath();
      const sliceWidth = canvas.width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    draw();
  }

  stopWaveform() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.waveformCanvas.classList.add('hidden');
  }

  onRecordingStart() {
    this.recordBtn.disabled = true;
    this.recordBtn.classList.add('recording');
    this.stopBtn.disabled = false;
    this.recordingStatus.classList.remove('hidden');
    this.playbackSection.classList.add('hidden');
    this.resultSection.classList.add('hidden');
    this.recordingSeconds = 0;
    this.recordTime.textContent = '0';
    this.recordingTimer = setInterval(() => {
      this.recordingSeconds++;
      this.recordTime.textContent = this.recordingSeconds;
      if (this.recordingSeconds >= 30) this.stopRecording();
    }, 1000);
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    this.recordBtn.classList.remove('recording');
    this.recordBtn.disabled = !this.textInput.value.trim();
    this.stopBtn.disabled = true;
    this.recordingStatus.classList.add('hidden');
    clearInterval(this.recordingTimer);
    this.stopWaveform();
  }

  showPlayback() {
    this.playbackSection.classList.remove('hidden');
  }

  resetRecording() {
    this.playbackSection.classList.add('hidden');
    this.resultSection.classList.add('hidden');
    this.audioBlob = null;
    if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
    this.audioUrl = null;
    this.audioPlayer.src = '';
  }

  async submitAssessment() {
    if (!this.audioBlob || !this.textInput.value.trim()) {
      alert('请先录音并输入评测文本');
      return;
    }

    this.resultSection.classList.remove('hidden');
    this.loading.classList.remove('hidden');
    this.scoreCard.classList.add('hidden');
    this.subScores.classList.add('hidden');
    this.recognizedSection.classList.add('hidden');
    this.detailSection.classList.add('hidden');
    this.submitBtn.disabled = true;

    try {
      const wavBlob = await this.convertToWav(this.audioBlob);
      const formData = new FormData();
      formData.append('audio', wavBlob, 'recording.wav');
      formData.append('expectedText', this.textInput.value.trim());
      formData.append('language', this.languageSelect.value);

      const response = await fetch('/api/assess', { method: 'POST', body: formData });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || '评测失败');
      if (result.success) {
        this.displayResult(result);
        this.addToHistory(result);
      } else {
        throw new Error(result.error || '评测失败');
      }
    } catch (error) {
      alert('评测失败: ' + error.message);
      console.error(error);
    } finally {
      this.loading.classList.add('hidden');
      this.submitBtn.disabled = false;
    }
  }

  async convertToWav(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const sampleRate = 16000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const offlineContext = new OfflineAudioContext(
      numChannels,
      audioBuffer.duration * sampleRate,
      sampleRate
    );
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    const renderedBuffer = await offlineContext.startRendering();
    const samples = renderedBuffer.getChannelData(0);
    const wavBuffer = this.encodeWav(samples, sampleRate, numChannels, bitsPerSample);
    audioContext.close();
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  encodeWav(samples, sampleRate, numChannels, bitsPerSample) {
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = samples.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
    return buffer;
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  displayResult(result) {
    const assessment = result.assessment;
    const overallScore = assessment.overall_score;

    this.scoreCard.classList.remove('hidden');
    document.getElementById('overallScore').textContent = Math.round(overallScore);

    const circle = document.getElementById('scoreCircle');
    const circumference = 283;
    circle.style.strokeDashoffset = circumference - (overallScore / 100) * circumference;
    if (overallScore >= 80) circle.style.stroke = '#4caf50';
    else if (overallScore >= 60) circle.style.stroke = '#ff9800';
    else circle.style.stroke = '#f44336';

    this.subScores.classList.remove('hidden');
    document.getElementById('accuracyScore').textContent = assessment.accuracy_score;
    document.getElementById('accuracyBar').style.width = assessment.accuracy_score + '%';

    if (assessment.pinyin_score !== undefined) {
      document.getElementById('pinyinScoreRow').classList.remove('hidden');
      document.getElementById('pinyinScore').textContent = assessment.pinyin_score;
      document.getElementById('pinyinBar').style.width = assessment.pinyin_score + '%';
    } else {
      document.getElementById('pinyinScoreRow').classList.add('hidden');
    }

    this.recognizedSection.classList.remove('hidden');
    document.getElementById('expectedText').textContent = result.expected_text;
    document.getElementById('recognizedText').textContent = result.recognized_text;

    if (assessment.details && assessment.details.length > 0) {
      this.detailSection.classList.remove('hidden');
      this.renderDetails(assessment.details, result.language);
    }
  }

  renderDetails(details, language) {
    const grid = document.getElementById('detailGrid');
    grid.innerHTML = '';

    details.forEach((item) => {
      const div = document.createElement('div');
      let isCorrect;

      if (language === 'zh') {
        isCorrect = item.char_correct && item.tone_correct;
        div.className = `detail-item ${isCorrect ? 'correct' : item.char_correct ? 'partial' : 'incorrect'}`;
        div.innerHTML = `
          <span class="detail-char">${item.char || ''}</span>
          <span class="detail-pinyin">${item.expected_pinyin || ''}</span>
          <span class="detail-pinyin">${item.recognized_pinyin ? '→ ' + item.recognized_pinyin : ''}</span>
          <span class="detail-score">${item.tone_correct ? '✓ 声调正确' : '✗ 声调错误'}</span>
        `;
      } else if (language === 'pinyin') {
        isCorrect = item.score >= 80;
        div.className = `detail-item ${isCorrect ? 'correct' : item.score >= 50 ? 'partial' : 'incorrect'}`;
        div.innerHTML = `
          <span class="detail-char">${item.expected}</span>
          <span class="detail-pinyin">→ ${item.recognized || '?'}</span>
          <span class="detail-score">${item.score}分</span>
          <span class="detail-pinyin">${item.tone_correct ? '✓声调' : '✗声调'}</span>
        `;
      } else {
        div.className = `detail-item ${item.correct ? 'correct' : 'incorrect'}`;
        div.innerHTML = `
          <span class="detail-char">${item.expected}</span>
          <span class="detail-pinyin">→ ${item.recognized || '?'}</span>
          <span class="detail-score">${item.score}分</span>
        `;
      }
      grid.appendChild(div);
    });
  }

  addToHistory(result) {
    const historyItem = {
      id: Date.now(),
      text: result.expected_text,
      language: result.language,
      score: result.assessment.overall_score,
      audioUrl: result.audioUrl,
      timestamp: new Date().toLocaleString(),
    };
    this.history.unshift(historyItem);
    if (this.history.length > 20) this.history = this.history.slice(0, 20);
    localStorage.setItem('pronunciation_history', JSON.stringify(this.history));
    this.renderHistory();
  }

  renderHistory() {
    if (this.history.length === 0) {
      this.historyList.innerHTML = '<p class="empty-hint">暂无评测记录</p>';
      return;
    }
    const langLabels = { zh: '中文', en: '英语', pinyin: '拼音' };
    this.historyList.innerHTML = this.history
      .map((item) => {
        const scoreClass = item.score >= 80 ? 'high' : item.score >= 60 ? 'medium' : 'low';
        const escapedText = item.text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
          <div class="history-item">
            <div>
              <span class="history-text">${escapedText}</span>
              <span style="font-size:12px;color:#666;margin-left:8px">[${langLabels[item.language] || item.language}]</span>
            </div>
            <div class="history-meta">
              <span style="font-size:12px;color:#666">${item.timestamp}</span>
              <span class="history-score ${scoreClass}">${Math.round(item.score)}分</span>
              ${item.audioUrl ? `<button type="button" class="history-play-btn" data-url="${item.audioUrl}">▶️</button>` : ''}
            </div>
          </div>
        `;
      })
      .join('');

    this.historyList.querySelectorAll('.history-play-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        new Audio(btn.dataset.url).play();
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PronunciationApp();
});
