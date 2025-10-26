import { contextBridge, ipcRenderer } from 'electron';

// 허용된 IPC 채널 목록 정의
const VALID_CHANNELS = [
  'run',
  'logUserInput',
  'terminal:chunk',
  'snapshot:ready',
  'llm:suggestion',
  'error',
  'history:recent',
  'history:search',
  'history:previous',
  'llm:convert'
];

// window.ai 네임스페이스 노출
contextBridge.exposeInMainWorld('ai', {
  // 메인 프로세스로 메시지 보내기 (request-response)
  request: (channel: string, ...args: any[]) => {
    if (!VALID_CHANNELS.includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  // 메인 → 렌더러 이벤트 수신
  on: (channel: string, func: (...args: any[]) => void) => {
    if (!VALID_CHANNELS.includes(channel)) {
      return () => {}; // 빈 cleanup 함수 반환
    }
    
    const listener = (_event: any, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, listener);
    
    // cleanup 함수 반환
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },

  // 리스너 제거
  off: (channel: string, func: (...args: any[]) => void) => {
    if (!VALID_CHANNELS.includes(channel)) return;
    ipcRenderer.removeListener(channel, func);
  }
});
