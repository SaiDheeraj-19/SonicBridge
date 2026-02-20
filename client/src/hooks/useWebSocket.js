import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebSocket = (url, onMessage) => {
    const wsRef = useRef(null);
    const [isConnected, setIsConnected] = useState(false);
    const reconnectTimeoutRef = useRef(null);
    const onMessageRef = useRef(onMessage);
    const connectRef = useRef(null);

    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket Connected');
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            if (onMessageRef.current) onMessageRef.current(event.data);
        };

        ws.onclose = () => {
            console.log('WebSocket Disconnected');
            setIsConnected(false);

            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

            reconnectTimeoutRef.current = setTimeout(() => {
                if (connectRef.current) connectRef.current();
            }, 3000);
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
        };
    }, [url]);

    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    useEffect(() => {
        if (connectRef.current) connectRef.current();
        return () => {
            if (wsRef.current) wsRef.current.close();
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        };
    }, []); // Only once on mount

    const sendMessage = useCallback((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(data);
        }
    }, []);

    return { isConnected, sendMessage };
};
