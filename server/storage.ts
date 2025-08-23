import { type ServiceRequest, type InsertServiceRequest, type Comment, type InsertComment } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Service Requests
  getServiceRequest(id: string): Promise<ServiceRequest | undefined>;
  getAllServiceRequests(): Promise<ServiceRequest[]>;
  getActiveServiceRequests(): Promise<ServiceRequest[]>;
  getCompletedServiceRequests(): Promise<ServiceRequest[]>;
  createServiceRequest(serviceRequest: InsertServiceRequest): Promise<ServiceRequest>;
  updateServiceRequest(id: string, updates: Partial<ServiceRequest>): Promise<ServiceRequest | undefined>;
  searchServiceRequests(query: string): Promise<ServiceRequest[]>;
  
  // Comments
  getCommentsByServiceRequestId(serviceRequestId: string): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  
  // Metrics
  getMetrics(): Promise<{
    totalActive: number;
    newComplaints: number;
    underInspection: number;
    sentToService: number;
    received: number;
  }>;
}

export class MemStorage implements IStorage {
  private serviceRequests: Map<string, ServiceRequest>;
  private comments: Map<string, Comment>;

  constructor() {
    this.serviceRequests = new Map();
    this.comments = new Map();
  }

  async getServiceRequest(id: string): Promise<ServiceRequest | undefined> {
    return this.serviceRequests.get(id);
  }

  async getAllServiceRequests(): Promise<ServiceRequest[]> {
    return Array.from(this.serviceRequests.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getActiveServiceRequests(): Promise<ServiceRequest[]> {
    return Array.from(this.serviceRequests.values())
      .filter(request => request.status !== "completed")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getCompletedServiceRequests(): Promise<ServiceRequest[]> {
    return Array.from(this.serviceRequests.values())
      .filter(request => request.status === "completed")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createServiceRequest(insertServiceRequest: InsertServiceRequest): Promise<ServiceRequest> {
    const id = randomUUID();
    const now = new Date();
    const serviceRequest: ServiceRequest = {
      ...insertServiceRequest,
      id,
      status: insertServiceRequest.status || "new",
      attachments: insertServiceRequest.attachments || [],
      createdAt: now,
      updatedAt: now,
    };
    this.serviceRequests.set(id, serviceRequest);
    return serviceRequest;
  }

  async updateServiceRequest(id: string, updates: Partial<ServiceRequest>): Promise<ServiceRequest | undefined> {
    const existing = this.serviceRequests.get(id);
    if (!existing) return undefined;

    const updated: ServiceRequest = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.serviceRequests.set(id, updated);
    return updated;
  }

  async searchServiceRequests(query: string): Promise<ServiceRequest[]> {
    const lowercaseQuery = query.toLowerCase();
    return Array.from(this.serviceRequests.values())
      .filter(request => 
        request.customerContact.toLowerCase().includes(lowercaseQuery) ||
        request.serialNumber.toLowerCase().includes(lowercaseQuery) ||
        request.customerName.toLowerCase().includes(lowercaseQuery) ||
        request.productName.toLowerCase().includes(lowercaseQuery)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getCommentsByServiceRequestId(serviceRequestId: string): Promise<Comment[]> {
    return Array.from(this.comments.values())
      .filter(comment => comment.serviceRequestId === serviceRequestId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const id = randomUUID();
    const comment: Comment = {
      ...insertComment,
      id,
      createdAt: new Date(),
    };
    this.comments.set(id, comment);
    return comment;
  }

  async getMetrics(): Promise<{
    totalActive: number;
    newComplaints: number;
    underInspection: number;
    sentToService: number;
    received: number;
  }> {
    const activeRequests = await this.getActiveServiceRequests();
    
    return {
      totalActive: activeRequests.length,
      newComplaints: activeRequests.filter(r => r.status === "new").length,
      underInspection: activeRequests.filter(r => r.status === "inspection").length,
      sentToService: activeRequests.filter(r => r.status === "service").length,
      received: activeRequests.filter(r => r.status === "received").length,
    };
  }
}

export const storage = new MemStorage();
