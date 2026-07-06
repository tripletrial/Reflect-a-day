const SAMPLE_RATE = 24000;

export function base64EncodeAudio(float32Array) {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;

  for (let i = 0; i < float32Array.length; i += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function base64ToFloat32Array(base64Audio) {
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);

  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const dataView = new DataView(bytes.buffer);
  const float32Array = new Float32Array(bytes.length / 2);

  for (let i = 0; i < float32Array.length; i += 1) {
    const int16 = dataView.getInt16(i * 2, true);
    float32Array[i] = int16 / (int16 < 0 ? 0x8000 : 0x7fff);
  }

  return float32Array;
}

export class AudioIO {
  constructor() {
    this.inputContext = null;
    this.outputContext = null;
    this.processor = null;
    this.mediaStream = null;
    this.nextStartTime = 0;
    this.isPlaying = false;
    this.onAudioChunk = null;
  }

  async startCapture(onAudioChunk) {
    this.onAudioChunk = onAudioChunk;
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
      video: false,
    });

    this.inputContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    await this.inputContext.audioWorklet.addModule('/js/audioProcessor.js');

    const source = this.inputContext.createMediaStreamSource(this.mediaStream);
    this.processor = new AudioWorkletNode(this.inputContext, 'audio-processor');
    source.connect(this.processor);

    this.processor.port.onmessage = (event) => {
      const float32Array = event.data.audio;
      if (float32Array?.length && this.onAudioChunk) {
        this.onAudioChunk(base64EncodeAudio(float32Array));
      }
    };
  }

  async playChunk(base64Audio) {
    if (!base64Audio) {
      return;
    }

    if (!this.outputContext) {
      this.outputContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    }

    if (this.outputContext.state === 'suspended') {
      await this.outputContext.resume();
    }

    const float32Array = base64ToFloat32Array(base64Audio);
    const audioBuffer = this.outputContext.createBuffer(1, float32Array.length, SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(float32Array);

    const source = this.outputContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputContext.destination);

    const currentTime = this.outputContext.currentTime;
    const startTime = Math.max(currentTime, this.nextStartTime);
    source.start(startTime);
    this.nextStartTime = startTime + audioBuffer.duration;
    this.isPlaying = true;

    source.onended = () => {
      if (this.outputContext.currentTime >= this.nextStartTime - 0.01) {
        this.isPlaying = false;
      }
    };
  }

  async stop() {
    this.processor?.port?.close();
    this.processor?.disconnect();
    this.processor = null;

    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;

    if (this.inputContext) {
      await this.inputContext.close();
      this.inputContext = null;
    }

    if (this.outputContext) {
      await this.outputContext.close();
      this.outputContext = null;
    }

    this.nextStartTime = 0;
    this.isPlaying = false;
  }
}
