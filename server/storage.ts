import { type ServiceRequest, type InsertServiceRequest, type Comment, type InsertComment, serviceRequests, comments } from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, or, ilike, ne } from "drizzle-orm";

export interface IStorage {
  // Service Requests
  getServiceRequest(id: string): Promise<ServiceRequest | undefined>;
  getAllServiceRequests(): Promise<ServiceRequest[]>;
  getActiveServiceRequests(): Promise<ServiceRequest[]>;
  getCompletedServiceRequests(): Promise<ServiceRequest[]>;
  createServiceRequest(serviceRequest: InsertServiceRequest): Promise<ServiceRequest>;
  updateServiceRequest(id: string, updates: Partial<ServiceRequest>): Promise<ServiceRequest | undefined>;
  deleteServiceRequest(id: string): Promise<void>;
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

export class DatabaseStorage implements IStorage {
  constructor() {}

  async getServiceRequest(id: string): Promise<ServiceRequest | undefined> {
    const [result] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id));
    return result;
  }

  async getAllServiceRequests(): Promise<ServiceRequest[]> {
    return await db.select().from(serviceRequests).orderBy(desc(serviceRequests.createdAt));
  }

  async getActiveServiceRequests(): Promise<ServiceRequest[]> {
    return await db.select().from(serviceRequests)
      .where(ne(serviceRequests.status, "completed"))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async getCompletedServiceRequests(): Promise<ServiceRequest[]> {
    return await db.select().from(serviceRequests)
      .where(eq(serviceRequests.status, "completed"))
      .orderBy(desc(serviceRequests.createdAt));
  }

  async createServiceRequest(insertServiceRequest: InsertServiceRequest): Promise<ServiceRequest> {
    const [result] = await db.insert(serviceRequests)
      .values({
        ...insertServiceRequest,
        status: insertServiceRequest.status || "new",
        attachments: insertServiceRequest.attachments || [],
      })
      .returning();
    return result;
  }

  async updateServiceRequest(id: string, updates: Partial<ServiceRequest>): Promise<ServiceRequest | undefined> {
    const [result] = await db.update(serviceRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(serviceRequests.id, id))
      .returning();
    return result;
  }

  async deleteServiceRequest(id: string): Promise<void> {
    // Delete associated comments first (due to foreign key constraint)
    await db.delete(comments).where(eq(comments.serviceRequestId, id));
    
    // Then delete the service request
    await db.delete(serviceRequests).where(eq(serviceRequests.id, id));
  }

  async searchServiceRequests(query: string): Promise<ServiceRequest[]> {
    return await db.select().from(serviceRequests)
      .where(
        or(
          ilike(serviceRequests.customerContact, `%${query}%`),
          ilike(serviceRequests.serialNumber, `%${query}%`),
          ilike(serviceRequests.customerName, `%${query}%`),
          ilike(serviceRequests.productName, `%${query}%`)
        )
      )
      .orderBy(desc(serviceRequests.createdAt));
  }

  async getCommentsByServiceRequestId(serviceRequestId: string): Promise<Comment[]> {
    return await db.select().from(comments)
      .where(eq(comments.serviceRequestId, serviceRequestId))
      .orderBy(asc(comments.createdAt));
  }

  async createComment(insertComment: InsertComment): Promise<Comment> {
    const [result] = await db.insert(comments)
      .values(insertComment)
      .returning();
    return result;
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

export const storage = new DatabaseStorage();
