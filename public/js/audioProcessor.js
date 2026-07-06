class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4800;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input?.length) {
      return true;
    }

    const channelData = input[0];
    for (let i = 0; i < channelData.length; i += 1) {
      this.buffer[this.bufferIndex] = channelData[i];
      this.bufferIndex += 1;

      if (this.bufferIndex >= this.bufferSize) {
        this.port.postMessage({ audio: this.buffer.slice(0) });
        this.bufferIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
