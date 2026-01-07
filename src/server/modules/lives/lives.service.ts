
interface StreamData {
    roomId: string;
    hostId: string;
    hostName: string;
    gameMode: string;
    startedAt: number;
    viewers: number;
    title: string;
    thumbnail?: string;
    isPaid: boolean;
}

class LivesService {
    private activeStreams: Map<string, StreamData> = new Map();
    private config = {
        streamCost: 10 // Custo em créditos para transmitir
    };

    constructor() {
        // Mock inicial para popular a Landing Page
        this.startStream('mock-room-1', 'user-1', {
            hostName: 'Mestre da Sinuca',
            gameMode: '8ball',
            title: 'Desafio do Mestre - Rank #1',
            isPaid: true
        });
    }

    getConfig() {
        return this.config;
    }

    updateConfig(cost: number) {
        this.config.streamCost = cost;
    }

    startStream(roomId: string, userId: string, data: Partial<StreamData>) {
        // Aqui deveria verificar pagamento/créditos se já não foi verificado no Controller

        const stream: StreamData = {
            roomId,
            hostId: userId,
            hostName: data.hostName || 'Anônimo',
            gameMode: data.gameMode || '8ball',
            startedAt: Date.now(),
            viewers: 0,
            title: data.title || `Partida de ${data.hostName}`,
            isPaid: true // Assumimos que passou pelo gate de pagamento
        };

        this.activeStreams.set(roomId, stream);
        return stream;
    }

    stopStream(roomId: string) {
        this.activeStreams.delete(roomId);
    }

    getStream(roomId: string) {
        return this.activeStreams.get(roomId);
    }

    listStreams() {
        return Array.from(this.activeStreams.values()).sort((a, b) => b.viewers - a.viewers);
    }

    // Viewer Heartbeat / Join
    addViewer(roomId: string) {
        const stream = this.activeStreams.get(roomId);
        if (stream) {
            stream.viewers++;
            return stream.viewers;
        }
        return 0;
    }

    removeViewer(roomId: string) {
        const stream = this.activeStreams.get(roomId);
        if (stream && stream.viewers > 0) {
            stream.viewers--;
        }
    }
}

export const livesService = new LivesService();
