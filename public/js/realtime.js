import { AudioIO } from './audio.js';

export class RealtimeSession {
  constructor({ sessionId, onStatus, onTranscript, onError, onDisconnect }) {
    this.sessionId = sessionId;
    this.onStatus = onStatus;
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.onDisconnect = onDisconnect;
    this.socket = null;
    this.audio = new AudioIO();
    this.model = null;
    this.active = false;
    this.isRecording = false;
    this.closingIntentionally = false;
    this.pendingAssistant = '';
    this.pendingUser = '';
  }

  async start() {
    this.onStatus('connecting');

    try {
      const tokenResponse = await fetch('/api/realtime/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: this.sessionId }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json().catch(() => ({}));
        throw new Error(error.details || error.error || 'Failed to get realtime token');
      }

      const { ephemeralKey, model } = await tokenResponse.json();
      this.model = model;

      const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
      this.socket = new WebSocket(url, [
        'realtime',
        `openai-insecure-api-key.${ephemeralKey}`,
      ]);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Realtime connection timed out')), 15000);

        this.socket.addEventListener('open', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });

        this.socket.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Realtime WebSocket failed to connect'));
        }, { once: true });
      });

      this.attachSocketHandlers();

      if (this.socket.readyState !== WebSocket.OPEN) {
        throw new Error('Realtime connection closed before the session started');
      }

      try {
        await this.audio.startCapture((chunk) => {
          if (!this.active || !this.isRecording || this.socket?.readyState !== WebSocket.OPEN) {
            return;
          }

          this.socket.send(JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: chunk,
          }));
        });
      } catch (error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Microphone access is required. Allow mic permission and try again.');
        }
        throw error;
      }

      if (this.socket.readyState !== WebSocket.OPEN) {
        throw new Error('Realtime connection closed before microphone setup finished');
      }

      this.active = true;
      this.onStatus('ready');
    } catch (error) {
      await this.cleanup();
      throw error;
    }
  }

  startRecording() {
    if (!this.active || this.isRecording || this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.isRecording = true;
    this.socket.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
    this.onStatus('recording');
  }

  stopRecording() {
    if (!this.isRecording || this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.isRecording = false;
    this.socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    this.socket.send(JSON.stringify({ type: 'response.create' }));
    this.onStatus('thinking');
  }

  attachSocketHandlers() {
    this.socket.addEventListener('message', (event) => this.handleServerEvent(event));
    this.socket.addEventListener('close', () => {
      if (this.closingIntentionally) {
        return;
      }

      const wasActive = this.active;
      this.active = false;
      this.isRecording = false;
      void this.cleanup({ skipSocketClose: true });

      if (wasActive) {
        this.onDisconnect?.('Connection lost. Press T to try again.');
      }
    });
    this.socket.addEventListener('error', () => {
      this.onError?.('Realtime connection error');
    });
  }

  handleServerEvent(event) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }

    switch (data.type) {
      case 'session.created':
      case 'session.updated':
        break;

      case 'response.created':
        this.onStatus('thinking');
        this.pendingAssistant = '';
        break;

      case 'response.output_audio.delta':
        this.onStatus('speaking');
        this.audio.playChunk(data.delta);
        break;

      case 'response.output_audio_transcript.delta':
        this.pendingAssistant += data.delta || '';
        this.onTranscript({
          role: 'assistant',
          text: this.pendingAssistant,
          final: false,
        });
        break;

      case 'response.output_audio_transcript.done':
        this.pendingAssistant = data.transcript || this.pendingAssistant;
        this.onTranscript({
          role: 'assistant',
          text: this.pendingAssistant,
          final: true,
        });
        this.pendingAssistant = '';
        this.onStatus('ready');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        this.pendingUser = data.transcript || '';
        if (this.pendingUser) {
          this.onTranscript({
            role: 'user',
            text: this.pendingUser,
            final: true,
          });
        }
        this.pendingUser = '';
        break;

      case 'error':
        this.onError?.(data.error?.message || 'Realtime API error');
        void this.cleanup({ skipSocketClose: true });
        break;

      default:
        break;
    }
  }

  async cleanup({ skipSocketClose = false } = {}) {
    this.active = false;
    this.isRecording = false;
    await this.audio.stop();

    if (!skipSocketClose && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.closingIntentionally = true;
      this.socket.close();
    }

    this.socket = null;
    this.closingIntentionally = false;
  }

  async stop() {
    await this.cleanup();
    this.onStatus('idle');
  }
}
