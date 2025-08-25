import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, Bell, Edit, MessageSquare, ChevronDown, ChevronUp, Send, Paperclip, X, Trash2, Camera } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertServiceRequestSchema, type InsertServiceRequest } from "@shared/schema";
import type { ServiceRequest, Comment } from "@shared/schema";
import type { UploadResult } from "@uppy/core";

// Use the shared schema with validation
const createRequestSchema = insertServiceRequestSchema.extend({
  attachments: z.array(z.string()).optional().default([]),
});

type CreateRequestForm = z.infer<typeof createRequestSchema>;

// Comments Button Component with Count
function CommentsButton({ requestId, isExpanded, onToggle }: { 
  requestId: string; 
  isExpanded: boolean; 
  onToggle: () => void; 
}) {
  const { data: comments, isLoading } = useQuery<Comment[]>({
    queryKey: ["/api/service-requests", requestId, "comments"],
  });

  const commentCount = comments?.length || 0;

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={onToggle}
      data-testid={`button-comments-${requestId}`}
    >
      <MessageSquare className="h-4 w-4 mr-1" />
      Comments {!isLoading && `(${commentCount})`}
      {isExpanded ? 
        <ChevronUp className="h-4 w-4 ml-1" /> : 
        <ChevronDown className="h-4 w-4 ml-1" />
      }
    </Button>
  );
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentAttachments, setCommentAttachments] = useState<Record<string, string[]>>({});
  const [pendingUploads, setPendingUploads] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [editingRequest, setEditingRequest] = useState<ServiceRequest | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showAttachments, setShowAttachments] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Helper function to convert attachment URLs to local backend URLs
  const normalizeAttachmentUrl = async (url: string): Promise<string> => {
    if (!url.includes('storage.googleapis.com')) {
      return url;
    }
    
    try {
      const response = await fetch('/api/normalize-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (response.ok) {
        const { normalizedPath } = await response.json();
        return normalizedPath;
      }
    } catch (error) {
      console.error('Error normalizing attachment URL:', error);
    }
    
    return url;
  };
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<CreateRequestForm>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: {
      productName: "",
      serialNumber: "",
      customerName: "",
      customerContact: "",
      issueDescription: "",
      attachments: [],
    },
  });

  // Edit form setup
  const editForm = useForm<CreateRequestForm>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: {
      productName: "",
      serialNumber: "",
      customerName: "",
      customerContact: "",
      issueDescription: "",
    },
  });

  // Queries
  const { data: metrics } = useQuery<{
    totalActive: number;
    newComplaints: number;
    underInspection: number;
    sentToService: number;
    received: number;
  }>({
    queryKey: ["/api/metrics"],
  });

  const { data: activeRequests, isLoading: activeLoading } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/service-requests/active"],
  });

  const { data: completedRequests, isLoading: completedLoading } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/service-requests/completed"],
  });

  const { data: searchResults } = useQuery<ServiceRequest[]>({
    queryKey: ["/api/service-requests/search", { q: searchQuery }],
    enabled: !!searchQuery,
  });

  // Comments query function - fetch comment counts for all requests
  const useCommentsQuery = (requestId: string) => {
    return useQuery<Comment[]>({
      queryKey: ["/api/service-requests", requestId, "comments"],
      enabled: true, // Always fetch to show counts
    });
  };

  // Mutations
  const createRequestMutation = useMutation({
    mutationFn: async (data: CreateRequestForm) => {
      const response = await apiRequest("POST", "/api/service-requests", data);
      return response.json();
    },
    onSuccess: () => {
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/completed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({
        title: "Success",
        description: "Service request created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create service request",
        variant: "destructive",
      });
    },
  });

  const deleteRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/service-requests/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/completed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({
        title: "Success",
        description: "Service request deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete service request",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/service-requests/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/completed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({
        title: "Success",
        description: "Status updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ requestId, text, attachments }: { requestId: string; text: string; attachments?: string[] }) => {
      const response = await apiRequest("POST", `/api/service-requests/${requestId}/comments`, { text, attachments: attachments || [] });
      return response.json();
    },
    onSuccess: (_, variables) => {
      setCommentInputs(prev => ({ ...prev, [variables.requestId]: "" }));
      setCommentAttachments(prev => ({ ...prev, [variables.requestId]: [] }));
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/completed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests", variables.requestId, "comments"] });
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      });
    },
  });

  const addAttachmentsMutation = useMutation({
    mutationFn: async ({ requestId, attachments }: { requestId: string; attachments: string[] }) => {
      const response = await apiRequest("POST", `/api/service-requests/${requestId}/attachments`, { attachments });
      return response.json();
    },
    onSuccess: () => {
      setSelectedFiles([]);
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/completed"] });
      toast({
        title: "Success",
        description: "Attachments added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add attachments",
        variant: "destructive",
      });
    },
  });

  const updateRequestMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<ServiceRequest> }) => {
      const response = await apiRequest("PATCH", `/api/service-requests/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      setIsEditDialogOpen(false);
      setEditingRequest(null);
      editForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/service-requests/completed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({
        title: "Success",
        description: "Service request updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update service request",
        variant: "destructive",
      });
    },
  });

  // Display data logic
  const displayedActiveRequests = useMemo(() => {
    let requests: ServiceRequest[] = [];
    
    if (searchQuery && searchResults) {
      requests = searchResults.filter((req: ServiceRequest) => req.status !== "completed");
    } else {
      requests = activeRequests || [];
    }
    
    // Apply status filter
    if (statusFilter) {
      requests = requests.filter((req: ServiceRequest) => req.status === statusFilter);
    }
    
    return requests;
  }, [searchQuery, searchResults, activeRequests, statusFilter]);

  const displayedCompletedRequests = useMemo(() => {
    if (searchQuery && searchResults) {
      return searchResults.filter((req: ServiceRequest) => req.status === "completed");
    }
    return completedRequests || [];
  }, [searchQuery, searchResults, completedRequests]);

  // Handlers
  const handleStatusUpdate = (requestId: string, status: string) => {
    updateStatusMutation.mutate({ id: requestId, status });
  };

  const handleAddComment = (requestId: string) => {
    const text = commentInputs[requestId];
    if (!text?.trim()) return;
    const attachments = commentAttachments[requestId] || [];
    addCommentMutation.mutate({ requestId, text, attachments });
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  // File upload function
  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const results: string[] = [];
    
    // Upload files sequentially to avoid overwhelming the system
    for (const file of files) {
      try {
        console.log(`Starting upload for file: ${file.name} (${file.size} bytes, ${file.type})`);
        
        // Step 1: Get upload URL from our backend
        console.log('Step 1: Getting upload URL from backend...');
        const response = await apiRequest('POST', '/api/objects/upload', {});
        const { uploadURL } = await response.json();
        console.log('Step 1 complete: Got upload URL from backend');
        
        // Step 2: Upload file directly to Google Cloud Storage
        console.log('Step 2: Uploading file to Google Cloud Storage...');
        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        });
        
        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text().catch(() => uploadResponse.statusText);
          throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText}`);
        }
        console.log('Step 2 complete: Google Cloud upload response received');
        
        // Step 3: Extract the base URL without query parameters to get the actual object URL
        console.log('Step 3: Normalizing path...');
        const objectURL = uploadURL.split('?')[0];
        
        // Normalize the path for our backend to serve
        const normalizeResponse = await apiRequest('POST', '/api/normalize-path', { url: objectURL });
        const { normalizedPath } = await normalizeResponse.json();
        console.log('Step 3 complete: Path normalization response received');
        
        console.log(`Upload complete for ${file.name}: ${normalizedPath}`);
        results.push(normalizedPath);
      } catch (error) {
        console.error(`Error uploading file ${file.name}:`, error);
        throw new Error(`Upload failed for ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return results;
  };

  const onSubmit = async (data: CreateRequestForm) => {
    console.log('Form submission started with data:', data);
    console.log('Selected files:', selectedFiles);
    console.log('Form state errors:', form.formState.errors);
    
    // Prevent multiple simultaneous submissions
    if (createRequestMutation.isPending) {
      console.log('Submission already in progress, ignoring...');
      return;
    }

    try {
      let attachments: string[] = [];
      
      // Upload files if any selected
      if (selectedFiles.length > 0) {
        console.log(`Starting upload of ${selectedFiles.length} files:`, selectedFiles.map(f => f.name));
        
        toast({
          title: "Uploading files...",
          description: `Uploading ${selectedFiles.length} file(s), please wait...`,
        });
        
        attachments = await uploadFiles(selectedFiles);
        console.log('Upload completed successfully:', attachments);
      }
      
      // Create request with attachments
      console.log('Creating request with data:', { ...data, attachments });
      createRequestMutation.mutate({
        ...data,
        attachments
      });
      
      // Clear selected files after submission
      setSelectedFiles([]);
    } catch (error) {
      console.error('Error in onSubmit:', error);
      toast({
        title: "Upload Failed",
        description: `Failed to upload files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const onEditSubmit = (data: CreateRequestForm) => {
    if (!editingRequest) return;
    updateRequestMutation.mutate({ id: editingRequest.id, updates: data });
  };

  const handleEditRequest = (request: ServiceRequest) => {
    setEditingRequest(request);
    editForm.reset({
      productName: request.productName,
      serialNumber: request.serialNumber,
      customerName: request.customerName,
      customerContact: request.customerContact,
      issueDescription: request.issueDescription,
    });
    setIsEditDialogOpen(true);
  };

  const toggleComments = (requestId: string) => {
    setExpandedComments(prev => ({
      ...prev,
      [requestId]: !prev[requestId]
    }));
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(current => current === status ? null : status);
  };

  const getFilterButtonClass = (status: string, baseClasses: string) => {
    const isActive = statusFilter === status;
    return `${baseClasses} cursor-pointer transition-all duration-200 hover:scale-105 ${
      isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-100 transform scale-105' : 'hover:shadow-lg'
    }`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-100 text-blue-800";
      case "inspection": return "bg-yellow-100 text-yellow-800";
      case "service": return "bg-orange-100 text-orange-800";
      case "received": return "bg-red-100 text-red-800";
      case "completed": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "new": return "New Complaint";
      case "inspection": return "Under Inspection";
      case "service": return "Sent to Service Center";
      case "received": return "Received";
      case "completed": return "Completed";
      default: return status;
    }
  };

  const handleGetUploadParameters = async () => {
    const response = await apiRequest("POST", "/api/objects/upload");
    const data = await response.json();
    return {
      method: "PUT" as const,
      url: data.uploadURL,
    };
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    // This would typically be used to update the current form or request with the uploaded file
    console.log("Upload complete:", result);
    if (result.successful && result.successful.length > 0) {
      const uploadURL = result.successful[0].uploadURL;
      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
      // Here you would typically update the form or associate the file with a request
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter']">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-semibold text-gray-900" data-testid="header-title">
                Service Issue Tracker
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" data-testid="button-notifications">
                <Bell className="h-5 w-5 text-gray-400" />
              </Button>
              <div className="h-8 w-8 rounded-full bg-gray-300" data-testid="img-avatar" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <p className="text-gray-600">Manage and track product service requests efficiently.</p>
        </div>

        {/* Search Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Search All Requests</h3>
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Enter Customer Contact or Token #"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <Button variant="outline" onClick={handleClearSearch} data-testid="button-clear-search">
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard & Active</TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">Completed Installations</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-8">
            {/* Metrics Cards - Now Clickable Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card 
                className={getFilterButtonClass('', 'bg-gray-600 text-white')}
                onClick={() => setStatusFilter(null)}
                data-testid="filter-total-active"
              >
                <CardContent className="p-6">
                  <div className="text-3xl font-bold" data-testid="metric-total-active">
                    {metrics?.totalActive || 0}
                  </div>
                  <div className="text-sm font-medium text-gray-200">TOTAL ACTIVE</div>
                  {statusFilter === null && <div className="text-xs mt-1 text-gray-300">All requests shown</div>}
                </CardContent>
              </Card>
              <Card 
                className={getFilterButtonClass('new', 'bg-blue-600 text-white')}
                onClick={() => handleStatusFilter('new')}
                data-testid="filter-new-complaints"
              >
                <CardContent className="p-6">
                  <div className="text-3xl font-bold" data-testid="metric-new-complaints">
                    {metrics?.newComplaints || 0}
                  </div>
                  <div className="text-sm font-medium text-blue-100">NEW COMPLAINT</div>
                  {statusFilter === 'new' && <div className="text-xs mt-1 text-blue-200">Filter active</div>}
                </CardContent>
              </Card>
              <Card 
                className={getFilterButtonClass('inspection', 'bg-yellow-500 text-white')}
                onClick={() => handleStatusFilter('inspection')}
                data-testid="filter-under-inspection"
              >
                <CardContent className="p-6">
                  <div className="text-3xl font-bold" data-testid="metric-under-inspection">
                    {metrics?.underInspection || 0}
                  </div>
                  <div className="text-sm font-medium text-yellow-100">UNDER INSPECTION</div>
                  {statusFilter === 'inspection' && <div className="text-xs mt-1 text-yellow-200">Filter active</div>}
                </CardContent>
              </Card>
              <Card 
                className={getFilterButtonClass('service', 'bg-orange-500 text-white')}
                onClick={() => handleStatusFilter('service')}
                data-testid="filter-sent-to-service"
              >
                <CardContent className="p-6">
                  <div className="text-3xl font-bold" data-testid="metric-sent-to-service">
                    {metrics?.sentToService || 0}
                  </div>
                  <div className="text-sm font-medium text-orange-100">SENT TO SERVICE CENTER</div>
                  {statusFilter === 'service' && <div className="text-xs mt-1 text-orange-200">Filter active</div>}
                </CardContent>
              </Card>
              <Card 
                className={getFilterButtonClass('received', 'bg-red-500 text-white')}
                onClick={() => handleStatusFilter('received')}
                data-testid="filter-received"
              >
                <CardContent className="p-6">
                  <div className="text-3xl font-bold" data-testid="metric-received">
                    {metrics?.received || 0}
                  </div>
                  <div className="text-sm font-medium text-red-100">RECEIVED</div>
                  {statusFilter === 'received' && <div className="text-xs mt-1 text-red-200">Filter active</div>}
                </CardContent>
              </Card>
            </div>

            {/* Create Request Form */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-6">Create New Service Request</h3>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="productName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Product Name / Model</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-product-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="serialNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Serial Number</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-serial-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer Name</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-customer-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="customerContact"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer Contact (Phone/Email)</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-customer-contact" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="issueDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Detailed description of the issue...</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={4} data-testid="textarea-issue-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div>
                      <Label className="block text-sm font-medium text-gray-900 mb-4">Attachments</Label>
                      <div className="flex justify-center">
                        <Button 
                          type="button" 
                          className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02]"
                          data-testid="button-attachments"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/jpeg,image/png,video/*,.pdf';
                            input.multiple = true;
                            input.onchange = (e) => {
                              const files = (e.target as HTMLInputElement).files;
                              if (files && files.length > 0) {
                                const fileArray = Array.from(files);
                                setSelectedFiles(prev => [...prev, ...fileArray]);
                                toast({
                                  title: "Files Selected",
                                  description: `Added ${files.length} file(s): ${fileArray.map(f => f.name).join(', ')}`,
                                });
                              }
                            };
                            input.click();
                          }}
                        >
                          <Paperclip className="h-4 w-4 mr-2" />
                          Attachments
                        </Button>
                      </div>
                      
                      {/* Selected Files Preview */}
                      {selectedFiles.length > 0 && (
                        <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                          <div className="flex items-center mb-3">
                            <Paperclip className="h-4 w-4 text-gray-600 mr-2" />
                            <h4 className="text-sm font-medium text-gray-800">Attached files:</h4>
                          </div>
                          <div className="space-y-3">
                            {selectedFiles.map((file, index) => (
                              <div key={index} className="relative">
                                <div className="bg-gray-100 border border-gray-200 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-2">
                                      <Paperclip className="h-4 w-4 text-gray-500" />
                                      <span className="text-sm font-medium text-gray-800">Attachment {index + 1}</span>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <div className="w-full h-20 bg-white border border-gray-200 rounded flex items-center justify-center mb-2">
                                    {file.type.startsWith('image/') ? (
                                      <img 
                                        src={URL.createObjectURL(file)} 
                                        alt={file.name}
                                        className="max-h-16 max-w-full object-contain rounded"
                                        onLoad={() => URL.revokeObjectURL(URL.createObjectURL(file))}
                                      />
                                    ) : file.type === 'application/pdf' ? (
                                      <div className="flex items-center justify-center text-red-600">
                                        <div className="flex flex-col items-center">
                                          <div className="w-8 h-8 mb-1 flex items-center justify-center bg-red-100 rounded text-xs font-bold">
                                            PDF
                                          </div>
                                          <span className="text-xs text-gray-500">PDF Document</span>
                                        </div>
                                      </div>
                                    ) : file.type.startsWith('video/') ? (
                                      <div className="flex items-center justify-center text-purple-600">
                                        <div className="flex flex-col items-center">
                                          <div className="w-8 h-8 mb-1 flex items-center justify-center bg-purple-100 rounded text-xs font-bold">
                                            VID
                                          </div>
                                          <span className="text-xs text-gray-500">Video File</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center text-gray-600">
                                        <div className="flex flex-col items-center">
                                          <Paperclip className="w-6 h-6 mb-1" />
                                          <span className="text-xs text-gray-500">File</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 truncate">{file.name}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-6 border-t border-gray-100">
                      <Button 
                        type="submit" 
                        disabled={createRequestMutation.isPending}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 px-8 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:opacity-50 disabled:transform-none min-w-[160px]"
                        data-testid="button-submit-request"
                      >
                        {createRequestMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Request
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Active Requests List */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    Active Service Requests {statusFilter && `(${getStatusLabel(statusFilter)})`}
                  </h3>
                  {statusFilter && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setStatusFilter(null)}
                      data-testid="button-clear-filter"
                    >
                      Clear Filter
                    </Button>
                  )}
                </div>
                {activeLoading ? (
                  <div data-testid="loading-active-requests">Loading...</div>
                ) : displayedActiveRequests.length === 0 ? (
                  <div className="text-gray-500 text-center py-8" data-testid="empty-active-requests">
                    No active service requests found.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {displayedActiveRequests.map((request: ServiceRequest) => (
                      <div key={request.id} className="border-b border-gray-200 pb-6 last:border-b-0" data-testid={`request-${request.id}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-lg font-medium text-gray-900" data-testid={`text-product-${request.id}`}>
                              {request.productName} (SN: {request.serialNumber})
                            </h4>
                            <div className="text-sm text-gray-600 mt-1">
                              <span data-testid={`text-customer-${request.id}`}>Customer: {request.customerName} ({request.customerContact})</span><br />
                              <span data-testid={`text-issue-${request.id}`}>Issue: {request.issueDescription}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500" data-testid={`text-created-${request.id}`}>
                              Created: {new Date(request.createdAt).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEditRequest(request)}
                              data-testid={`button-edit-${request.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this service request?')) {
                                  deleteRequestMutation.mutate(request.id);
                                }
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={deleteRequestMutation.isPending}
                              data-testid={`button-delete-${request.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                            <CommentsButton 
                              requestId={request.id} 
                              isExpanded={expandedComments[request.id]} 
                              onToggle={() => toggleComments(request.id)}
                            />
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setShowAttachments(showAttachments === request.id ? null : request.id)}
                              data-testid={`button-attachments-${request.id}`}
                            >
                              <Paperclip className="h-4 w-4 mr-1" />
                              Attachments ({request.attachments?.length || 0})
                            </Button>
                          </div>
                          <div className="flex items-center space-x-4">
                            <Select
                              value={request.status}
                              onValueChange={(status) => handleStatusUpdate(request.id, status)}
                            >
                              <SelectTrigger className="w-48" data-testid={`select-status-${request.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New Complaint</SelectItem>
                                <SelectItem value="inspection">Under Inspection</SelectItem>
                                <SelectItem value="service">Sent to Service Center</SelectItem>
                                <SelectItem value="received">Received</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Attachments Section */}
                        {showAttachments === request.id && (
                          <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-medium text-gray-900">Attachments</h5>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setShowAttachments(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            {request.attachments && request.attachments.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {request.attachments.map((attachment, index) => (
                                  <AttachmentImage 
                                    key={index} 
                                    attachment={attachment} 
                                    index={index} 
                                    normalizeUrl={normalizeAttachmentUrl}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="text-gray-500 text-center py-4">
                                No attachments uploaded
                              </div>
                            )}
                            
                            {/* Add More Attachments Button */}
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/jpeg,image/png,video/*,.pdf';
                                  input.multiple = true;
                                  input.onchange = async (e) => {
                                    const files = (e.target as HTMLInputElement).files;
                                    if (files && files.length > 0) {
                                      const fileArray = Array.from(files);
                                      try {
                                        const attachments = await uploadFiles(fileArray);
                                        addAttachmentsMutation.mutate({ requestId: request.id, attachments });
                                      } catch (error) {
                                        toast({
                                          title: "Error",
                                          description: "Failed to upload files",
                                          variant: "destructive",
                                        });
                                      }
                                    }
                                  };
                                  input.click();
                                }}
                                data-testid={`button-add-attachments-${request.id}`}
                              >
                                <Camera className="h-4 w-4 mr-2" />
                                Attach Images
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Comments Section */}
                        {expandedComments[request.id] && (
                          <CommentsSection 
                            requestId={request.id} 
                            normalizeAttachmentUrl={normalizeAttachmentUrl}
                          />
                        )}
                        
                        <div className="bg-gray-50 rounded-lg p-4">
                          {/* Comment Attachments Preview */}
                          {commentAttachments[request.id] && commentAttachments[request.id].length > 0 && (
                            <div className="mb-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Paperclip className="h-4 w-4 text-gray-500" />
                                <span className="text-sm text-gray-700">Attached images:</span>
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {commentAttachments[request.id].map((attachment, index) => (
                                  <AttachmentImage
                                    key={index}
                                    attachment={attachment}
                                    index={index}
                                    normalizeUrl={normalizeAttachmentUrl}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-2">
                            <Input
                              type="text"
                              placeholder="Add a comment..."
                              value={commentInputs[request.id] || ""}
                              onChange={(e) => setCommentInputs(prev => ({ ...prev, [request.id]: e.target.value }))}
                              className="flex-1"
                              data-testid={`input-comment-${request.id}`}
                            />
                            
                            {/* Attach Image Button */}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="p-2 hover:bg-gray-100 rounded-lg"
                              onClick={async () => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/jpeg,image/png,video/*,.pdf';
                                input.multiple = true;
                                input.onchange = async (e) => {
                                  const files = (e.target as HTMLInputElement).files;
                                  if (files && files.length > 0) {
                                    const fileArray = Array.from(files);
                                    try {
                                      const newAttachments = await uploadFiles(fileArray);
                                      setCommentAttachments(prev => ({
                                        ...prev,
                                        [request.id]: [...(prev[request.id] || []), ...newAttachments]
                                      }));
                                      
                                      toast({
                                        title: "Success",
                                        description: `Added ${newAttachments.length} image(s) to comment`,
                                      });
                                    } catch (error) {
                                      console.error('Error uploading comment images:', error);
                                      toast({
                                        title: "Error",
                                        description: "Failed to upload images",
                                        variant: "destructive",
                                      });
                                    }
                                  }
                                };
                                input.click();
                              }}
                              data-testid={`button-attach-comment-${request.id}`}
                            >
                              <Paperclip className="h-4 w-4 text-gray-600" />
                            </Button>
                            
                            <Button
                              onClick={() => handleAddComment(request.id)}
                              className="bg-blue-600 hover:bg-blue-700"
                              disabled={addCommentMutation.isPending}
                              data-testid={`button-add-comment-${request.id}`}
                            >
                              Post
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Completed Tab */}
          <TabsContent value="completed">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-6">
                  Completed Installations ({displayedCompletedRequests.length})
                </h3>
                {completedLoading ? (
                  <div data-testid="loading-completed-requests">Loading...</div>
                ) : displayedCompletedRequests.length === 0 ? (
                  <div className="text-gray-500 text-center py-8" data-testid="empty-completed-requests">
                    No completed installations found.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {displayedCompletedRequests.map((request: ServiceRequest) => (
                      <div key={request.id} className="border-b border-gray-200 pb-6 last:border-b-0" data-testid={`completed-request-${request.id}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h4 className="text-lg font-medium text-gray-900" data-testid={`text-completed-product-${request.id}`}>
                              {request.productName} (SN: {request.serialNumber})
                            </h4>
                            <div className="text-sm text-gray-600 mt-1">
                              <span data-testid={`text-completed-customer-${request.id}`}>Customer: {request.customerName} ({request.customerContact})</span><br />
                              <span data-testid={`text-completed-issue-${request.id}`}>Issue: {request.issueDescription}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500" data-testid={`text-completed-created-${request.id}`}>
                              Created: {new Date(request.createdAt).toLocaleString()}
                            </div>
                            <div className="mt-2">
                              <Badge className={getStatusColor(request.status)} data-testid={`badge-status-${request.id}`}>
                                Status: {getStatusLabel(request.status)}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditRequest(request)}
                            data-testid={`button-edit-completed-${request.id}`}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this service request?')) {
                                deleteRequestMutation.mutate(request.id);
                              }
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            disabled={deleteRequestMutation.isPending}
                            data-testid={`button-delete-completed-${request.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                          <CommentsButton 
                            requestId={request.id} 
                            isExpanded={expandedComments[request.id]} 
                            onToggle={() => toggleComments(request.id)}
                          />
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setShowAttachments(showAttachments === request.id ? null : request.id)}
                            data-testid={`button-attachments-completed-${request.id}`}
                          >
                            <Paperclip className="h-4 w-4 mr-1" />
                            Attachments ({request.attachments?.length || 0})
                          </Button>
                        </div>
                        
                        {/* Attachments Section */}
                        {showAttachments === request.id && (
                          <div className="mt-4 p-4 border rounded-lg bg-gray-50">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-medium text-gray-900">Attachments</h5>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setShowAttachments(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            {request.attachments && request.attachments.length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {request.attachments.map((attachment, index) => (
                                  <AttachmentImage 
                                    key={index} 
                                    attachment={attachment} 
                                    index={index} 
                                    normalizeUrl={normalizeAttachmentUrl}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="text-gray-500 text-center py-4">
                                No attachments uploaded
                              </div>
                            )}
                            
                            {/* Add More Attachments Button */}
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="w-full sm:w-auto"
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/jpeg,image/png,video/*,.pdf';
                                  input.multiple = true;
                                  input.onchange = async (e) => {
                                    const files = (e.target as HTMLInputElement).files;
                                    if (files && files.length > 0) {
                                      const fileArray = Array.from(files);
                                      try {
                                        const attachments = await uploadFiles(fileArray);
                                        addAttachmentsMutation.mutate({ requestId: request.id, attachments });
                                      } catch (error) {
                                        toast({
                                          title: "Error",
                                          description: "Failed to upload files",
                                          variant: "destructive",
                                        });
                                      }
                                    }
                                  };
                                  input.click();
                                }}
                                data-testid={`button-add-attachments-${request.id}`}
                              >
                                <Camera className="h-4 w-4 mr-2" />
                                Attach Images
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Comments Section for Completed Requests */}
                        {expandedComments[request.id] && (
                          <div className="mt-4">
                            <CommentsSection 
                              requestId={request.id} 
                              normalizeAttachmentUrl={normalizeAttachmentUrl}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Service Request</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={editForm.control}
                  name="productName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name / Model</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="edit-input-product-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="serialNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="edit-input-serial-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={editForm.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="edit-input-customer-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="customerContact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Contact (Phone/Email)</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="edit-input-customer-contact" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={editForm.control}
                name="issueDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Detailed description of the issue...</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={4} data-testid="edit-textarea-issue-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-blue-600 hover:bg-blue-700"
                  disabled={updateRequestMutation.isPending}
                  data-testid="button-save-edit"
                >
                  {updateRequestMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Comments Section Component
function CommentsSection({ 
  requestId, 
  normalizeAttachmentUrl 
}: { 
  requestId: string;
  normalizeAttachmentUrl: (url: string) => Promise<string>;
}) {
  const { data: comments, isLoading: commentsLoading } = useQuery<Comment[]>({
    queryKey: ["/api/service-requests", requestId, "comments"],
  });

  if (commentsLoading) {
    return (
      <div className="bg-white rounded-lg p-4 mb-4 border" data-testid={`loading-comments-${requestId}`}>
        <div className="text-sm text-gray-500">Loading comments...</div>
      </div>
    );
  }

  if (!comments || comments.length === 0) {
    return (
      <div className="bg-white rounded-lg p-4 mb-4 border" data-testid={`empty-comments-${requestId}`}>
        <div className="text-sm text-gray-500">No comments yet.</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-4 mb-4 border" data-testid={`comments-${requestId}`}>
      <h4 className="font-medium text-gray-900 mb-3">Comments ({comments.length})</h4>
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="border-l-2 border-blue-200 pl-4" data-testid={`comment-${comment.id}`}>
            <div className="text-sm text-gray-900" data-testid={`comment-text-${comment.id}`}>
              {comment.text}
            </div>
            
            {/* Comment Attachments */}
            {comment.attachments && comment.attachments.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip className="h-3 w-3 text-gray-500" />
                  <span className="text-xs text-gray-600">Attached images ({comment.attachments.length}):</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {comment.attachments.map((attachment, index) => (
                    <AttachmentImage
                      key={index}
                      attachment={attachment}
                      index={index}
                      normalizeUrl={normalizeAttachmentUrl}
                    />
                  ))}
                </div>
              </div>
            )}
            
            <div className="text-xs text-gray-500 mt-1" data-testid={`comment-date-${comment.id}`}>
              Posted: {new Date(comment.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper component to handle attachment images with URL normalization
function AttachmentImage({ 
  attachment, 
  index, 
  normalizeUrl 
}: { 
  attachment: string; 
  index: number; 
  normalizeUrl: (url: string) => Promise<string>;
}) {
  const [imageUrl, setImageUrl] = useState(attachment);
  const [isLoading, setIsLoading] = useState(true);
  const [isImage, setIsImage] = useState(true);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [fileType, setFileType] = useState<'image' | 'pdf' | 'video' | 'other'>('image');

  // Normalize URL on mount and detect file type
  useEffect(() => {
    normalizeUrl(attachment).then(url => {
      setImageUrl(url);
      setIsLoading(false);
      
      // Try to detect file type from the original attachment path
      if (attachment.toLowerCase().includes('pdf')) {
        setFileType('pdf');
        setIsImage(false);
      } else if (attachment.toLowerCase().includes('mp4') || 
                 attachment.toLowerCase().includes('video') ||
                 attachment.toLowerCase().includes('mov') ||
                 attachment.toLowerCase().includes('avi')) {
        setFileType('video');
        setIsImage(false);
      }
    });
  }, [attachment]);

  // Handle image load failure to detect non-image files
  const handleImageError = () => {
    console.error('Failed to load image:', imageUrl);
    setIsImage(false);
    setImageLoadFailed(true);
    
    // If we haven't already detected the file type, try to guess
    if (fileType === 'image') {
      // Check for common file patterns in the URL
      if (attachment.toLowerCase().includes('pdf')) {
        setFileType('pdf');
      } else if (attachment.toLowerCase().includes('mp4') || 
                 attachment.toLowerCase().includes('video') ||
                 attachment.toLowerCase().includes('mov') ||
                 attachment.toLowerCase().includes('avi')) {
        setFileType('video');
      } else {
        // Default to PDF for other non-image files
        setFileType('pdf');
      }
    }
  };

  const renderFileIcon = () => {
    if (fileType === 'pdf') {
      return (
        <div 
          className="flex flex-col items-center justify-center text-red-600 cursor-pointer hover:bg-gray-200 w-full h-full rounded-lg transition-colors"
          onClick={() => window.open(imageUrl, '_blank')}
        >
          <div className="w-12 h-12 mb-1 flex items-center justify-center bg-red-100 rounded-lg">
            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
              <path d="M6,14H8V12H6V14M10,14H12V12H10V14M14,14H16V12H14V14M6,16H8V18H6V16M10,16H12V18H10V16M14,16H16V18H14V16Z" fill="#dc2626"/>
            </svg>
          </div>
          <span className="text-xs font-medium">PDF</span>
        </div>
      );
    } else if (fileType === 'video') {
      return (
        <div 
          className="flex flex-col items-center justify-center text-blue-600 cursor-pointer hover:bg-gray-200 w-full h-full rounded-lg transition-colors"
          onClick={() => window.open(imageUrl, '_blank')}
        >
          <div className="w-12 h-12 mb-1 flex items-center justify-center bg-blue-100 rounded-lg">
            <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
              <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
            </svg>
          </div>
          <span className="text-xs font-medium">Video</span>
        </div>
      );
    }
    return null;
  };

  const getFileLabel = () => {
    if (fileType === 'pdf') return `PDF ${index + 1}`;
    if (fileType === 'video') return `Video ${index + 1}`;
    return `Photo ${index + 1}`;
  };

  return (
    <div className="relative">
      <div className="w-full h-24 bg-gray-100 rounded-lg border flex items-center justify-center">
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : !isImage || imageLoadFailed ? (
          renderFileIcon()
        ) : (
          <img 
            src={imageUrl} 
            alt={`Attachment ${index + 1}`} 
            className="w-full h-full object-cover rounded-lg cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => window.open(imageUrl, '_blank')}
            onError={handleImageError}
          />
        )}
      </div>
      <div className="text-xs text-gray-500 mt-1 truncate">
        {getFileLabel()}
      </div>
    </div>
  );
}
