import { useEffect, useRef, useCallback, useState } from 'react';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let _socket = null;

function getSocket() {
  if (!_socket) {
    _socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
      autoConnect: false,  // don't connect until mounted
    });
  }
  return _socket;
}

/**
 * useSocket — shared Socket.IO connection hook.
 * Gracefully handles offline backend — never throws or crashes React.
 *
 * @param {Object} [handlers] — { eventName: handler }
 * @returns {{ connected: boolean, emit }}
 */
export function useSocket(handlers = {}) {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let socket;
    try {
      socket = getSocket();
    } catch {
      return;
    }

    const onConnect = () => {
      setConnected(true);
      socket.emit('fleet:subscribe', { cityId: 'amsterdam' });
    };

    const onDisconnect = () => setConnected(false);
    const onConnectError = (err) => {
      console.warn('[socket] Connection error (retrying):', err.message);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    const eventNames = Object.keys(handlersRef.current);
    const wrappedHandlers = {};
    for (const event of eventNames) {
      wrappedHandlers[event] = (...args) => handlersRef.current[event]?.(...args);
      socket.on(event, wrappedHandlers[event]);
    }

    if (!socket.connected) {
      socket.connect();
    } else {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      for (const event of eventNames) {
        socket.off(event, wrappedHandlers[event]);
      }
    };
  }, []);

  const emit = useCallback((event, data) => {
    try { getSocket().emit(event, data); } catch { /* offline */ }
  }, []);

  return { connected, emit };
}
