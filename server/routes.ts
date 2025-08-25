import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { insertServiceRequestSchema, insertCommentSchema } from "@shared/schema";
import { ObjectStorageService } from "./objectStorage";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all service requests
  app.get("/api/service-requests", async (req, res) => {
    try {
      const requests = await storage.getAllServiceRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching service requests:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get active service requests
  app.get("/api/service-requests/active", async (req, res) => {
    try {
      const requests = await storage.getActiveServiceRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching active service requests:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get completed service requests
  app.get("/api/service-requests/completed", async (req, res) => {
    try {
      const requests = await storage.getCompletedServiceRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching completed service requests:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Search service requests
  app.get("/api/service-requests/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query is required" });
      }
      const requests = await storage.searchServiceRequests(query);
      res.json(requests);
    } catch (error) {
      console.error("Error searching service requests:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create new service request
  app.post("/api/service-requests", async (req, res) => {
    try {
      const validatedData = insertServiceRequestSchema.parse(req.body);
      const request = await storage.createServiceRequest(validatedData);
      res.status(201).json(request);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating service request:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update service request
  app.patch("/api/service-requests/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const request = await storage.updateServiceRequest(id, updates);
      if (!request) {
        return res.status(404).json({ error: "Service request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error updating service request:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get comments for a service request
  app.get("/api/service-requests/:id/comments", async (req, res) => {
    try {
      const { id } = req.params;
      const comments = await storage.getCommentsByServiceRequestId(id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add comment to service request
  app.post("/api/service-requests/:id/comments", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertCommentSchema.parse({
        ...req.body,
        serviceRequestId: id,
      });
      const comment = await storage.createComment(validatedData);
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating comment:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get dashboard metrics
  app.get("/api/metrics", async (req, res) => {
    try {
      const metrics = await storage.getMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // File upload endpoints
  app.post("/api/objects/upload", async (req, res) => {
    try {
      // Add CORS headers
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      
      console.log("Upload URL request received from:", req.ip);
      console.log("Request headers:", req.headers);
      console.log("Request body:", req.body);
      
      const objectStorageService = new ObjectStorageService();
      console.log("Creating ObjectStorageService...");
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      console.log("Upload URL generated successfully:", uploadURL.substring(0, 100) + "...");
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      res.status(500).json({ 
        error: "Internal server error",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Serve uploaded objects through our backend
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      res.status(404).json({ error: "File not found" });
    }
  });

  // Normalize object storage path
  app.post("/api/normalize-path", async (req, res) => {
    try {
      const { url } = req.body;
      const objectStorageService = new ObjectStorageService();
      const normalizedPath = objectStorageService.normalizeObjectEntityPath(url);
      res.json({ normalizedPath });
    } catch (error) {
      console.error("Error normalizing path:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add attachments to existing service request
  app.post("/api/service-requests/:id/attachments", async (req, res) => {
    try {
      const { id } = req.params;
      const { attachments } = req.body;
      
      if (!attachments || !Array.isArray(attachments)) {
        return res.status(400).json({ error: "Attachments array is required" });
      }

      const allRequests = await storage.getAllServiceRequests();
      const request = allRequests.find(r => r.id === id);
      if (!request) {
        return res.status(404).json({ error: "Service request not found" });
      }

      const currentAttachments = request.attachments || [];
      const updatedRequest = await storage.updateServiceRequest(id, {
        attachments: [...currentAttachments, ...attachments]
      });

      res.json(updatedRequest);
    } catch (error) {
      console.error("Error adding attachments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Handle file attachment updates
  app.put("/api/service-requests/:id/attachments", async (req, res) => {
    try {
      const { id } = req.params;
      const { attachmentURL } = req.body;
      
      if (!attachmentURL) {
        return res.status(400).json({ error: "attachmentURL is required" });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(attachmentURL);

      // Get existing service request
      const request = await storage.getServiceRequest(id);
      if (!request) {
        return res.status(404).json({ error: "Service request not found" });
      }

      // Update attachments array
      const updatedAttachments = [...(request.attachments || []), objectPath];
      const updatedRequest = await storage.updateServiceRequest(id, {
        attachments: updatedAttachments,
      });

      res.json({ objectPath, request: updatedRequest });
    } catch (error) {
      console.error("Error updating attachments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Serve uploaded files
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(404).json({ error: "File not found" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
