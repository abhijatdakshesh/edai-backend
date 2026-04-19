import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
export declare class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private readonly logger;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    emitAttendanceUpdate(payload: {
        classId: string;
        date: string;
    }): void;
    emitMarksUpdate(payload: {
        subjectCode: string;
        sem: number;
    }): void;
    emitAnnouncementNew(payload: {
        id: string;
        title: string;
        roles: string[];
    }): void;
    emitAiCallCompleted(payload: {
        callId: string;
        studentUsn: string;
    }): void;
    emitVtuWindowOpened(payload: {
        windowId: string;
        title: string;
    }): void;
    emitIaSubmissionUpdated(payload: {
        submissionId: string;
        status: string;
    }): void;
}
