import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitAttendanceUpdate(payload: { classId: string; date: string }): void {
    this.server.emit('attendance:update', payload);
  }

  emitMarksUpdate(payload: { subjectCode: string; sem: number }): void {
    this.server.emit('marks:update', payload);
  }

  emitAnnouncementNew(payload: { id: string; title: string; roles: string[] }): void {
    this.server.emit('announcement:new', payload);
  }

  emitAiCallCompleted(payload: { callId: string; studentUsn: string }): void {
    this.server.emit('ai-call:completed', payload);
  }

  emitVtuWindowOpened(payload: { windowId: string; title: string }): void {
    this.server.emit('vtu:window-opened', payload);
  }

  emitIaSubmissionUpdated(payload: { submissionId: string; status: string }): void {
    this.server.emit('ia:submission-updated', payload);
  }
}
